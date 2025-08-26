/**
 * AlertEngine - Manages tiered alert system with debouncing
 * Handles soft alerts (toast notifications) and hard alerts (modal dialogs with sound)
 */

import { FlagEvent, AlertConfig } from './types';

export interface AlertEngineConfig {
  debouncing: {
    softAlertFrames: number; // 8-12 frames
    hardAlertFrames: number; // 5 frames
    gracePeriodMs: number; // 500ms
  };
  audio: {
    enabled: boolean;
    softAlertVolume: number; // 0.3
    hardAlertVolume: number; // 0.7
  };
  toast: {
    duration: number; // 3000ms
    maxVisible: number; // 3
  };
}

export interface AlertState {
  id: string;
  type: 'soft' | 'hard';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  flagEvent?: FlagEvent;
}

export interface AlertCallbacks {
  onSoftAlert: (alert: AlertState) => void;
  onHardAlert: (alert: AlertState) => void;
  onAlertDismissed: (alertId: string) => void;
}

export class AlertEngine {
  private config: AlertEngineConfig;
  private callbacks: AlertCallbacks;
  private activeAlerts: Map<string, AlertState> = new Map();
  private pendingFlags: Map<string, { count: number; firstSeen: number }> = new Map();
  private audioContext: AudioContext | null = null;
  private alertCounter = 0;

  constructor(config: AlertEngineConfig, callbacks: AlertCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
    this.initializeAudio();
  }

  private initializeAudio(): void {
    if (this.config.audio.enabled && typeof window !== 'undefined') {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Failed to initialize audio context:', error);
      }
    }
  }

  /**
   * Process a flag event and determine if an alert should be triggered
   */
  public processFlag(flag: FlagEvent): void {
    const flagKey = `${flag.type}_${flag.questionId || 'global'}`;
    const now = Date.now();

    // Get or create pending flag entry
    let pending = this.pendingFlags.get(flagKey);
    if (!pending) {
      pending = { count: 0, firstSeen: now };
      this.pendingFlags.set(flagKey, pending);
    }

    // Increment count
    pending.count++;

    // Check if we should trigger an alert based on debouncing rules
    const shouldTriggerSoft = this.shouldTriggerSoftAlert(flag, pending);
    const shouldTriggerHard = this.shouldTriggerHardAlert(flag, pending);

    if (shouldTriggerHard) {
      this.triggerHardAlert(flag);
      // Reset pending count after hard alert
      this.pendingFlags.delete(flagKey);
    } else if (shouldTriggerSoft) {
      this.triggerSoftAlert(flag);
      // Keep pending for potential escalation to hard alert
    }

    // Clean up old pending flags
    this.cleanupPendingFlags(now);
  }

  private shouldTriggerSoftAlert(flag: FlagEvent, pending: { count: number; firstSeen: number }): boolean {
    // Trigger soft alert if we've seen enough frames for this flag type and it's soft severity
    const requiredFrames = this.config.debouncing.softAlertFrames;
    return pending.count === requiredFrames && flag.severity === 'soft';
  }

  private shouldTriggerHardAlert(flag: FlagEvent, pending: { count: number; firstSeen: number }): boolean {
    // Trigger hard alert if:
    // 1. Flag is marked as hard severity (immediate), OR
    // 2. We've seen enough frames for hard alert threshold (escalation)
    if (flag.severity === 'hard') {
      return true;
    }
    
    const requiredFrames = this.config.debouncing.hardAlertFrames;
    return pending.count === requiredFrames;
  }

  private triggerSoftAlert(flag: FlagEvent): void {
    const alertId = `soft_${++this.alertCounter}`;
    const message = this.getAlertMessage(flag, 'soft');
    
    const alert: AlertState = {
      id: alertId,
      type: 'soft',
      message,
      timestamp: Date.now(),
      acknowledged: false,
      flagEvent: flag,
    };

    this.activeAlerts.set(alertId, alert);
    this.callbacks.onSoftAlert(alert);

    // Auto-dismiss soft alerts after duration
    setTimeout(() => {
      this.dismissAlert(alertId);
    }, this.config.toast.duration);

    // Play soft alert sound
    if (this.config.audio.enabled) {
      this.playAlertSound('soft');
    }
  }

  private triggerHardAlert(flag: FlagEvent): void {
    const alertId = `hard_${++this.alertCounter}`;
    const message = this.getAlertMessage(flag, 'hard');
    
    const alert: AlertState = {
      id: alertId,
      type: 'hard',
      message,
      timestamp: Date.now(),
      acknowledged: false,
      flagEvent: flag,
    };

    this.activeAlerts.set(alertId, alert);
    this.callbacks.onHardAlert(alert);

    // Play hard alert sound
    if (this.config.audio.enabled) {
      this.playAlertSound('hard');
    }
  }

  private getAlertMessage(flag: FlagEvent, severity: 'soft' | 'hard'): string {
    const messages = {
      EYES_OFF: {
        soft: 'Please keep your eyes on the screen',
        hard: 'ATTENTION: Eyes detected off-screen for extended period',
      },
      HEAD_POSE: {
        soft: 'Please keep your head facing the screen',
        hard: 'ATTENTION: Head position violation detected',
      },
      TAB_BLUR: {
        soft: 'Please stay focused on the quiz',
        hard: 'ATTENTION: Tab switching or window focus lost',
      },
      SECOND_FACE: {
        soft: 'Additional person detected in frame',
        hard: 'ATTENTION: Multiple people detected - this is not allowed',
      },
      DEVICE_OBJECT: {
        soft: 'Please remove any devices from view',
        hard: 'ATTENTION: Electronic device detected in frame',
      },
      SHADOW_ANOMALY: {
        soft: 'Lighting conditions have changed',
        hard: 'ATTENTION: Significant lighting manipulation detected',
      },
      FACE_MISSING: {
        soft: 'Please ensure your face is visible',
        hard: 'ATTENTION: Face not detected for extended period',
      },
      DOWN_GLANCE: {
        soft: 'Please keep your eyes on the screen',
        hard: 'ATTENTION: Frequent downward glances detected',
      },
      INTEGRITY_VIOLATION: {
        soft: 'Please maintain quiz integrity',
        hard: 'ATTENTION: Integrity violation detected',
      },
      FULLSCREEN_EXIT: {
        soft: 'Please return to fullscreen mode',
        hard: 'ATTENTION: Fullscreen mode required',
      },
    };

    return messages[flag.type]?.[severity] || `${severity} alert: ${flag.type}`;
  }

  private playAlertSound(type: 'soft' | 'hard'): void {
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Different frequencies for different alert types
      oscillator.frequency.setValueAtTime(
        type === 'soft' ? 800 : 1200,
        this.audioContext.currentTime
      );

      // Different volumes
      const volume = type === 'soft' 
        ? this.config.audio.softAlertVolume 
        : this.config.audio.hardAlertVolume;
      
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Failed to play alert sound:', error);
    }
  }

  /**
   * Acknowledge a hard alert (user clicked OK)
   */
  public acknowledgeAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.dismissAlert(alertId);
    }
  }

  /**
   * Dismiss an alert
   */
  public dismissAlert(alertId: string): void {
    if (this.activeAlerts.has(alertId)) {
      this.activeAlerts.delete(alertId);
      this.callbacks.onAlertDismissed(alertId);
    }
  }

  /**
   * Get all active alerts
   */
  public getActiveAlerts(): AlertState[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get active alerts by type
   */
  public getActiveAlertsByType(type: 'soft' | 'hard'): AlertState[] {
    return this.getActiveAlerts().filter(alert => alert.type === type);
  }

  /**
   * Clear all alerts
   */
  public clearAllAlerts(): void {
    const alertIds = Array.from(this.activeAlerts.keys());
    alertIds.forEach(id => this.dismissAlert(id));
  }

  /**
   * Clean up old pending flags that haven't been triggered
   */
  private cleanupPendingFlags(now: number): void {
    const maxAge = this.config.debouncing.gracePeriodMs * 2; // Clean up after 2x grace period
    
    for (const [key, pending] of this.pendingFlags.entries()) {
      if (now - pending.firstSeen > maxAge) {
        this.pendingFlags.delete(key);
      }
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<AlertEngineConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Reinitialize audio if audio settings changed
    if (config.audio) {
      this.initializeAudio();
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): AlertEngineConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.clearAllAlerts();
    this.pendingFlags.clear();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {
        // Ignore close errors
      });
      this.audioContext = null;
    }
  }
}