/**
 * PermissionEnforcer - Mandatory system permissions enforcement
 * 
 * Enforces camera, microphone, and screen recording permissions with no opt-out capability.
 * Provides continuous verification of permission status and device functionality.
 */

import type { PermissionStatus, SecurityThreat } from './types';

interface PermissionConfig {
  camera: {
    required: boolean;
    allowOptOut: boolean;
    continuousVerification: boolean;
    verificationIntervalMs: number;
  };
  microphone: {
    required: boolean;
    allowOptOut: boolean;
    continuousVerification: boolean;
    verificationIntervalMs: number;
  };
  screen: {
    required: boolean;
    allowOptOut: boolean;
    continuousVerification: boolean;
    verificationIntervalMs: number;
  };
}

interface PermissionEvent {
  permissions: PermissionStatus;
  threat?: SecurityThreat;
}

type PermissionEventHandler = (event: PermissionEvent) => void;

export class PermissionEnforcer {
  private config: PermissionConfig;
  private currentStatus: PermissionStatus;
  private eventHandlers: Set<PermissionEventHandler> = new Set();
  private verificationIntervals: Map<string, NodeJS.Timeout> = new Map();
  private mediaStreams: Map<string, MediaStream> = new Map();
  private isDestroyed = false;

  constructor(config: PermissionConfig) {
    this.config = config;
    this.currentStatus = this.createInitialStatus();
    this.setupPermissionChangeListeners();
  }

  /**
   * Enforce all required permissions with no opt-out capability
   */
  async enforcePermissions(): Promise<PermissionStatus> {
    if (this.isDestroyed) {
      throw new Error('PermissionEnforcer has been destroyed');
    }

    try {
      // Request camera permission if required
      if (this.config.camera.required) {
        await this.requestCameraPermission();
      }

      // Request microphone permission if required
      if (this.config.microphone.required) {
        await this.requestMicrophonePermission();
      }

      // Request screen recording permission if required
      if (this.config.screen.required) {
        await this.requestScreenPermission();
      }

      // Start continuous verification
      this.startContinuousVerification();

      return this.currentStatus;
    } catch (error) {
      const threat: SecurityThreat = {
        id: `permission_error_${Date.now()}`,
        type: 'permission_denied',
        severity: 'critical',
        message: `Failed to enforce permissions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error },
        timestamp: Date.now(),
        resolved: false
      };

      this.emitEvent({ permissions: this.currentStatus, threat });
      throw error;
    }
  }

  /**
   * Get current permission status
   */
  getStatus(): PermissionStatus {
    return { ...this.currentStatus };
  }

  /**
   * Add event handler for permission events
   */
  addEventListener(handler: PermissionEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  removeEventListener(handler: PermissionEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Manually verify all permissions
   */
  async verifyPermissions(): Promise<PermissionStatus> {
    if (this.isDestroyed) return this.currentStatus;

    await Promise.all([
      this.verifyCameraPermission(),
      this.verifyMicrophonePermission(),
      this.verifyScreenPermission()
    ]);

    return this.currentStatus;
  }

  /**
   * Destroy the permission enforcer and cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) return;

    // Stop all verification intervals
    this.verificationIntervals.forEach(interval => clearInterval(interval));
    this.verificationIntervals.clear();

    // Stop all media streams
    this.mediaStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    this.mediaStreams.clear();

    this.eventHandlers.clear();
    this.isDestroyed = true;
  }

  private createInitialStatus(): PermissionStatus {
    return {
      camera: { granted: false, active: false, lastVerified: 0 },
      microphone: { granted: false, active: false, lastVerified: 0 },
      screen: { granted: false, active: false, lastVerified: 0 }
    };
  }

  private async requestCameraPermission(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } 
      });

      this.mediaStreams.set('camera', stream);
      this.currentStatus.camera = {
        granted: true,
        active: true,
        lastVerified: Date.now()
      };

      this.emitEvent({ permissions: this.currentStatus });
    } catch (error) {
      this.currentStatus.camera = {
        granted: false,
        active: false,
        lastVerified: Date.now(),
        error: error instanceof Error ? error.message : 'Camera access denied'
      };

      const threat: SecurityThreat = {
        id: `camera_denied_${Date.now()}`,
        type: 'permission_denied',
        severity: 'critical',
        message: 'Camera permission denied - quiz cannot proceed without camera access',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          permissionRequired: true,
          allowOptOut: this.config.camera.allowOptOut
        },
        timestamp: Date.now(),
        resolved: false
      };

      throw new Error(`Camera permission denied: ${threat.message}`);
    }
  }

  private async requestMicrophonePermission(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.mediaStreams.set('microphone', stream);
      this.currentStatus.microphone = {
        granted: true,
        active: true,
        lastVerified: Date.now()
      };

      this.emitEvent({ permissions: this.currentStatus });
    } catch (error) {
      this.currentStatus.microphone = {
        granted: false,
        active: false,
        lastVerified: Date.now(),
        error: error instanceof Error ? error.message : 'Microphone access denied'
      };

      const threat: SecurityThreat = {
        id: `microphone_denied_${Date.now()}`,
        type: 'permission_denied',
        severity: 'critical',
        message: 'Microphone permission denied - quiz cannot proceed without microphone access',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          permissionRequired: true,
          allowOptOut: this.config.microphone.allowOptOut
        },
        timestamp: Date.now(),
        resolved: false
      };

      throw new Error(`Microphone permission denied: ${threat.message}`);
    }
  }

  private async requestScreenPermission(): Promise<void> {
    try {
      // Note: Screen capture requires user gesture and may not be available in all browsers
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen recording not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 30 }
        },
        audio: false
      });

      this.mediaStreams.set('screen', stream);
      this.currentStatus.screen = {
        granted: true,
        active: true,
        lastVerified: Date.now()
      };

      // Monitor for screen share ending
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.currentStatus.screen.active = false;
        const threat: SecurityThreat = {
          id: `screen_ended_${Date.now()}`,
          type: 'permission_denied',
          severity: 'critical',
          message: 'Screen recording stopped - quiz session terminated',
          details: { reason: 'Screen share ended by user' },
          timestamp: Date.now(),
          resolved: false
        };
        this.emitEvent({ permissions: this.currentStatus, threat });
      });

      this.emitEvent({ permissions: this.currentStatus });
    } catch (error) {
      this.currentStatus.screen = {
        granted: false,
        active: false,
        lastVerified: Date.now(),
        error: error instanceof Error ? error.message : 'Screen recording access denied'
      };

      const threat: SecurityThreat = {
        id: `screen_denied_${Date.now()}`,
        type: 'permission_denied',
        severity: 'critical',
        message: 'Screen recording permission denied - quiz cannot proceed without screen monitoring',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          permissionRequired: true,
          allowOptOut: this.config.screen.allowOptOut
        },
        timestamp: Date.now(),
        resolved: false
      };

      throw new Error(`Screen permission denied: ${threat.message}`);
    }
  }

  private startContinuousVerification(): void {
    if (this.config.camera.continuousVerification) {
      const interval = setInterval(() => {
        this.verifyCameraPermission();
      }, this.config.camera.verificationIntervalMs);
      this.verificationIntervals.set('camera', interval);
    }

    if (this.config.microphone.continuousVerification) {
      const interval = setInterval(() => {
        this.verifyMicrophonePermission();
      }, this.config.microphone.verificationIntervalMs);
      this.verificationIntervals.set('microphone', interval);
    }

    if (this.config.screen.continuousVerification) {
      const interval = setInterval(() => {
        this.verifyScreenPermission();
      }, this.config.screen.verificationIntervalMs);
      this.verificationIntervals.set('screen', interval);
    }
  }

  private async verifyCameraPermission(): Promise<void> {
    if (this.isDestroyed) return;

    try {
      const stream = this.mediaStreams.get('camera');
      if (!stream || !stream.active) {
        throw new Error('Camera stream not active');
      }

      // Check if tracks are still active
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
        throw new Error('Camera track not live');
      }

      this.currentStatus.camera.active = true;
      this.currentStatus.camera.lastVerified = Date.now();
      delete this.currentStatus.camera.error;
    } catch (error) {
      this.currentStatus.camera.active = false;
      this.currentStatus.camera.error = error instanceof Error ? error.message : 'Camera verification failed';
      
      const threat: SecurityThreat = {
        id: `camera_inactive_${Date.now()}`,
        type: 'permission_denied',
        severity: 'high',
        message: 'Camera became inactive during quiz session',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now(),
        resolved: false
      };

      this.emitEvent({ permissions: this.currentStatus, threat });
    }
  }

  private async verifyMicrophonePermission(): Promise<void> {
    if (this.isDestroyed) return;

    try {
      const stream = this.mediaStreams.get('microphone');
      if (!stream || !stream.active) {
        throw new Error('Microphone stream not active');
      }

      // Check if tracks are still active
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || audioTracks[0].readyState !== 'live') {
        throw new Error('Microphone track not live');
      }

      this.currentStatus.microphone.active = true;
      this.currentStatus.microphone.lastVerified = Date.now();
      delete this.currentStatus.microphone.error;
    } catch (error) {
      this.currentStatus.microphone.active = false;
      this.currentStatus.microphone.error = error instanceof Error ? error.message : 'Microphone verification failed';
      
      const threat: SecurityThreat = {
        id: `microphone_inactive_${Date.now()}`,
        type: 'permission_denied',
        severity: 'high',
        message: 'Microphone became inactive during quiz session',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now(),
        resolved: false
      };

      this.emitEvent({ permissions: this.currentStatus, threat });
    }
  }

  private async verifyScreenPermission(): Promise<void> {
    if (this.isDestroyed) return;

    try {
      const stream = this.mediaStreams.get('screen');
      if (!stream || !stream.active) {
        throw new Error('Screen recording stream not active');
      }

      // Check if tracks are still active
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
        throw new Error('Screen recording track not live');
      }

      this.currentStatus.screen.active = true;
      this.currentStatus.screen.lastVerified = Date.now();
      delete this.currentStatus.screen.error;
    } catch (error) {
      this.currentStatus.screen.active = false;
      this.currentStatus.screen.error = error instanceof Error ? error.message : 'Screen recording verification failed';
      
      const threat: SecurityThreat = {
        id: `screen_inactive_${Date.now()}`,
        type: 'permission_denied',
        severity: 'critical',
        message: 'Screen recording became inactive during quiz session',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now(),
        resolved: false
      };

      this.emitEvent({ permissions: this.currentStatus, threat });
    }
  }

  private setupPermissionChangeListeners(): void {
    // Listen for permission changes via Permissions API if available
    if ('permissions' in navigator) {
      ['camera', 'microphone'].forEach(async (permission) => {
        try {
          const result = await navigator.permissions.query({ name: permission as PermissionName });
          result.addEventListener('change', () => {
            // Re-verify permissions when they change
            this.verifyPermissions();
          });
        } catch (error) {
          // Permissions API not fully supported, continue without it
          console.warn(`Permission monitoring not available for ${permission}:`, error);
        }
      });
    }

    // Listen for visibility changes that might affect permissions
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // Page became visible, verify permissions
        setTimeout(() => this.verifyPermissions(), 100);
      }
    });
  }

  private emitEvent(event: PermissionEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in permission event handler:', error);
      }
    });
  }
}