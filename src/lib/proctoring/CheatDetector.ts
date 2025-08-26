/**
 * CheatDetector - Comprehensive cheat detection system
 * Integrates multiple detection methods for various cheating behaviors
 */

import { VisionSignals } from '../vision/types';
import { FlagEvent } from './types';

export interface CheatDetectionConfig {
  eyesOffScreen: {
    confidenceThreshold: number; // 0.7
    durationThreshold: number; // 500ms
  };
  headPose: {
    yawThreshold: number; // 20 degrees
    pitchThreshold: number; // 15 degrees
    durationThreshold: number; // 300ms
  };
  secondaryFace: {
    confidenceThreshold: number; // 0.6
    frameThreshold: number; // 5 consecutive frames
  };
  deviceObject: {
    confidenceThreshold: number; // 0.5
    frameThreshold: number; // 3 consecutive frames
  };
  shadowAnomaly: {
    scoreThreshold: number; // 0.6
    durationThreshold: number; // 800ms
  };
  faceMissing: {
    durationThreshold: number; // 1000ms
  };
  downGlance: {
    angleThreshold: number; // -15 degrees (looking down)
    frequencyThreshold: number; // 3 times in 10 seconds
    windowSize: number; // 10000ms
  };
  occlusion: {
    landmarkThreshold: number; // 0.3 (30% of landmarks missing)
    durationThreshold: number; // 500ms
  };
  externalMonitor: {
    correlationThreshold: number; // 0.8
    sampleSize: number; // 10 samples
  };
}

export interface DetectionState {
  eyesOffStartTime: number | null;
  headPoseViolationStartTime: number | null;
  secondaryFaceFrameCount: number;
  deviceObjectFrameCount: number;
  shadowAnomalyStartTime: number | null;
  faceMissingStartTime: number | null;
  downGlanceEvents: number[];
  occlusionStartTime: number | null;
  cursorPositions: Array<{ x: number; y: number; timestamp: number }>;
  headYawSamples: Array<{ yaw: number; timestamp: number }>;
}

export class CheatDetector {
  private config: CheatDetectionConfig;
  private state: DetectionState;
  private flagCounter = 0;
  private skipBrowserCheck = false;

  constructor(config: CheatDetectionConfig, skipBrowserCheck = false) {
    this.config = config;
    this.state = this.initializeState();
    this.skipBrowserCheck = skipBrowserCheck;
    this.setupBrowserEventListeners();
  }

  private initializeState(): DetectionState {
    return {
      eyesOffStartTime: null,
      headPoseViolationStartTime: null,
      secondaryFaceFrameCount: 0,
      deviceObjectFrameCount: 0,
      shadowAnomalyStartTime: null,
      faceMissingStartTime: null,
      downGlanceEvents: [],
      occlusionStartTime: null,
      cursorPositions: [],
      headYawSamples: [],
    };
  }

  private setupBrowserEventListeners(): void {
    if (!this.skipBrowserCheck && (typeof window === 'undefined' || typeof document === 'undefined')) return;

    // Tab blur/focus detection
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    window.addEventListener('focus', this.handleWindowFocus.bind(this));

    // Fullscreen exit detection
    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));

    // Mouse movement for external monitor detection
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));

    // Keyboard shortcuts prevention
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Context menu prevention
    document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
  }

  /**
   * Process vision signals and detect cheating behaviors
   */
  public processVisionSignals(signals: VisionSignals, questionId?: string): FlagEvent[] {
    const flags: FlagEvent[] = [];
    const now = Date.now();

    // 1. Eyes-off-screen detection
    const eyesOffFlag = this.detectEyesOffScreen(signals, now, questionId);
    if (eyesOffFlag) flags.push(eyesOffFlag);

    // 2. Head pose boundary violation
    const headPoseFlag = this.detectHeadPoseViolation(signals, now, questionId);
    if (headPoseFlag) flags.push(headPoseFlag);

    // 3. Secondary face detection
    const secondaryFaceFlag = this.detectSecondaryFace(signals, now, questionId);
    if (secondaryFaceFlag) flags.push(secondaryFaceFlag);

    // 4. Device object detection
    const deviceObjectFlag = this.detectDeviceObject(signals, now, questionId);
    if (deviceObjectFlag) flags.push(deviceObjectFlag);

    // 5. Shadow/lighting tampering
    const shadowAnomalyFlag = this.detectShadowAnomaly(signals, now, questionId);
    if (shadowAnomalyFlag) flags.push(shadowAnomalyFlag);

    // 6. Face missing detection
    const faceMissingFlag = this.detectFaceMissing(signals, now, questionId);
    if (faceMissingFlag) flags.push(faceMissingFlag);

    // 7. Frequent down-glance detection
    const downGlanceFlag = this.detectDownGlance(signals, now, questionId);
    if (downGlanceFlag) flags.push(downGlanceFlag);

    // 8. Occlusion detection
    const occlusionFlag = this.detectOcclusion(signals, now, questionId);
    if (occlusionFlag) flags.push(occlusionFlag);

    // 9. External monitor usage detection
    const externalMonitorFlag = this.detectExternalMonitorUsage(signals, now, questionId);
    if (externalMonitorFlag) flags.push(externalMonitorFlag);

    return flags;
  }

  private detectEyesOffScreen(signals: VisionSignals, now: number, questionId?: string): FlagEvent | null {
    const isEyesOff = !signals.eyesOnScreen || signals.gazeVector.confidence < this.config.eyesOffScreen.confidenceThreshold;

    if (isEyesOff) {
      if (this.state.eyesOffStartTime === null) {
        this.state.eyesOffStartTime = now;
      } else {
        const duration = now - this.state.eyesOffStartTime;
        if (duration >= this.config.eyesOffScreen.durationThreshold) {
          // Reset timer after flagging
          this.state.eyesOffStartTime = null;
          
          return this.createFlag('EYES_OFF', 'soft', signals.gazeVector.confidence, {
            duration,
            gazeConfidence: signals.gazeVector.confidence,
          }, questionId);
        }
      }
    } else {
      // Reset timer when eyes are back on screen
      this.state.eyesOffStartTime = null;
    }

    return null;
  }

  private detectHeadPoseViolation(signals: VisionSignals, now: number, questionId?: string): FlagEvent | null {
    if (!signals.headPose) return null;
    
    const { yaw, pitch } = signals.headPose;
    const isViolation = Math.abs(yaw) > this.config.headPose.yawThreshold || 
                       Math.abs(pitch) > this.config.headPose.pitchThreshold;

    if (isViolation) {
      if (this.state.headPoseViolationStartTime === null) {
        this.state.headPoseViolationStartTime = now;
      } else {
        const duration = now - this.state.headPoseViolationStartTime;
        if (duration >= this.config.headPose.durationThreshold) {
          // Reset timer after flagging
          this.state.headPoseViolationStartTime = null;
          
          return this.createFlag('HEAD_POSE', 'soft', signals.headPose.confidence, {
            duration,
            yaw,
            pitch,
            yawThreshold: this.config.headPose.yawThreshold,
            pitchThreshold: this.config.headPose.pitchThreshold,
          }, questionId);
        }
      }
    } else {
      // Reset timer when head pose is normal
      this.state.headPoseViolationStartTime = null;
    }

    return null;
  }

  private detectSecondaryFace(signals: VisionSignals, now: number, questionId?: string): FlagEvent | null {
    const hasSecondaryFace = signals.environmentScore.secondaryFaces > this.config.secondaryFace.confidenceThreshold;

    if (hasSecondaryFace) {
      this.state.secondaryFaceFrameCount++;
      
      if (this.state.secondaryFaceFrameCount >= this.config.secondaryFace.frameThreshold) {
        // Reset counter after flagging
        this.state.secondaryFaceFrameCount = 0;
        
        return this.createFlag('SECOND_FACE', 'hard', signals.environmentScore.secondaryFaces, {
          frameCount: this.state.secondaryFaceFrameCount,
          confidence: signals.environmentScore.secondaryFaces,
        }, questionId);
      }
    } else {
      // Reset counter when no secondary face detected
      this.state.secondaryFaceFrameCount = 0;
    }

    return null;
  }

  private detectDeviceObject(signals: VisionSignals, now: number, questionId?: string): FlagEvent | null {
    const hasDeviceObject = signals.environmentScore.deviceLikeObjects > this.config.deviceObject.confidenceThreshold;

    if (hasDeviceObject) {
      this.state.deviceObjectFrameCount++;
      
      if (this.state.deviceObjectFrameCount >= this.config.deviceObject.frameThreshold) {
        // Reset counter after flagging
        this.state.deviceObjectFrameCount = 0;
        
        return this.createFlag('DEVICE_OBJECT', 'hard', signals.environmentScore.deviceLikeObjects, {
          frameCount: this.state.deviceObjectFrameCount,
          confidence: signals.environmentScore.deviceLikeObjects,
        }, questionId);
      }
    } else {
      // Reset counter when no device object detected
      this.state.deviceObjectFrameCount = 0;
    }

    return null;
  }

  private detectShadowAnomaly(signals: VisionSignals, now: number, questionId?: string): FlagEvent | null {
    const hasShadowAnomaly = signals.environmentScore.shadowStability > this.config.shadowAnomaly.scoreThreshold;

    if (hasShadowAnomaly) {
      if (this.state.shadowAnomalyStartTime === null) {
        this.state.shadowAnomalyStartTime = now;
      } else {
        const duration = now - this.state.shadowAnomalyStartTime;
        if (duration >= this.config.shadowAnomaly.durationThreshold) {
          // Reset timer after flagging
          this.state.shadowAnomalyStartTime = null;
          
          return this.createFlag('SHADOW_ANOMALY', 'soft', signals.environmentScore.shadowStability, {
            duration,
            shadowScore: signals.environmentScore.shadowStability,
          }, questionId);
        }
      }
    } else {
      // Reset timer when shadow is stable
      this.state.shadowAnomalyStartTime = null;
    }

    return null;
  }

  private detectFaceMissing(signals: VisionSignals, now: number, questionId?: string): FlagEvent | null {
    const isFaceMissing = !signals.faceDetected;

    if (isFaceMissing) {
      if (this.state.faceMissingStartTime === null) {
        this.state.faceMissingStartTime = now;
      } else {
        const duration = now - this.state.faceMissingStartTime;
        if (duration >= this.config.faceMissing.durationThreshold) {
          // Reset timer after flagging
          this.state.faceMissingStartTime = null;
          
          return this.createFlag('FACE_MISSING', 'soft', 0, {
            duration,
          }, questionId);
        }
      }
    } else {
      // Reset timer when face is detected
      this.state.faceMissingStartTime = null;
    }

    return null;
  }

  private detectDownGlance(signals: VisionSignals, now: number, questionId?: string): FlagEvent | null {
    if (!signals.headPose) return null;
    
    const { pitch } = signals.headPose;
    const isDownGlance = pitch < this.config.downGlance.angleThreshold;

    if (isDownGlance) {
      // Add down-glance event
      this.state.downGlanceEvents.push(now);
    }

    // Clean up old events outside the window
    const windowStart = now - this.config.downGlance.windowSize;
    this.state.downGlanceEvents = this.state.downGlanceEvents.filter(time => time >= windowStart);

    // Check if frequency threshold is exceeded
    if (this.state.downGlanceEvents.length >= this.config.downGlance.frequencyThreshold) {
      // Clear events after flagging
      this.state.downGlanceEvents = [];
      
      return this.createFlag('DOWN_GLANCE', 'soft', signals.headPose.confidence, {
        frequency: this.state.downGlanceEvents.length,
        windowSize: this.config.downGlance.windowSize,
        pitch,
      }, questionId);
    }

    return null;
  }

  private detectOcclusion(signals: VisionSignals, now: number, questionId?: string): FlagEvent | null {
    // Calculate occlusion based on missing landmarks
    const totalLandmarks = 468; // MediaPipe FaceMesh landmarks
    const visibleLandmarks = signals.landmarks ? signals.landmarks.length / 3 : 0; // x,y,z per landmark
    const occlusionRatio = 1 - (visibleLandmarks / totalLandmarks);

    const isOccluded = occlusionRatio > this.config.occlusion.landmarkThreshold;

    if (isOccluded) {
      if (this.state.occlusionStartTime === null) {
        this.state.occlusionStartTime = now;
      } else {
        const duration = now - this.state.occlusionStartTime;
        if (duration >= this.config.occlusion.durationThreshold) {
          // Reset timer after flagging
          this.state.occlusionStartTime = null;
          
          return this.createFlag('FACE_MISSING', 'soft', 1 - occlusionRatio, {
            duration,
            occlusionRatio,
            visibleLandmarks,
            totalLandmarks,
          }, questionId);
        }
      }
    } else {
      // Reset timer when face is not occluded
      this.state.occlusionStartTime = null;
    }

    return null;
  }

  private detectExternalMonitorUsage(signals: VisionSignals, now: number, questionId?: string): FlagEvent | null {
    if (!signals.headPose) return null;
    
    // Store head yaw samples
    this.state.headYawSamples.push({ yaw: signals.headPose.yaw, timestamp: now });

    // Keep only recent samples
    const sampleWindow = 10000; // 10 seconds
    this.state.headYawSamples = this.state.headYawSamples.filter(
      sample => now - sample.timestamp <= sampleWindow
    );

    // Need enough samples to calculate correlation
    if (this.state.headYawSamples.length < this.config.externalMonitor.sampleSize ||
        this.state.cursorPositions.length < this.config.externalMonitor.sampleSize) {
      return null;
    }

    // Calculate correlation between head yaw and cursor position
    const correlation = this.calculateCorrelation(
      this.state.headYawSamples.map(s => s.yaw),
      this.state.cursorPositions.map(p => p.x)
    );

    if (Math.abs(correlation) > this.config.externalMonitor.correlationThreshold) {
      return this.createFlag('HEAD_POSE', 'hard', Math.abs(correlation), {
        correlation,
        suspectedExternalMonitor: true,
        headYawSamples: this.state.headYawSamples.length,
        cursorSamples: this.state.cursorPositions.length,
      }, questionId);
    }

    return null;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;

    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      numerator += deltaX * deltaY;
      sumXSquared += deltaX * deltaX;
      sumYSquared += deltaY * deltaY;
    }

    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private createFlag(
    type: FlagEvent['type'],
    severity: 'soft' | 'hard',
    confidence: number,
    details: Record<string, unknown>,
    questionId?: string
  ): FlagEvent {
    return {
      id: `flag_${++this.flagCounter}_${Date.now()}`,
      timestamp: Date.now(),
      type,
      severity,
      confidence,
      details,
      questionId,
    };
  }

  // Browser event handlers
  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.triggerBrowserEventFlag('TAB_BLUR', 'Tab became hidden');
    }
  }

  private handleWindowBlur(): void {
    this.triggerBrowserEventFlag('TAB_BLUR', 'Window lost focus');
  }

  private handleWindowFocus(): void {
    // Could be used to track focus regain patterns
  }

  private handleFullscreenChange(): void {
    if (!document.fullscreenElement) {
      this.triggerBrowserEventFlag('TAB_BLUR', 'Exited fullscreen mode');
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    const now = Date.now();
    this.state.cursorPositions.push({
      x: event.clientX,
      y: event.clientY,
      timestamp: now,
    });

    // Keep only recent positions
    const maxAge = 10000; // 10 seconds
    this.state.cursorPositions = this.state.cursorPositions.filter(
      pos => now - pos.timestamp <= maxAge
    );
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Prevent common developer tools shortcuts
    const blockedKeys = [
      'F12', // Developer tools
      'F11', // Fullscreen toggle
    ];

    const blockedCombinations = [
      { ctrl: true, shift: true, key: 'I' }, // Dev tools
      { ctrl: true, shift: true, key: 'J' }, // Console
      { ctrl: true, shift: true, key: 'C' }, // Element inspector
      { ctrl: true, key: 'U' }, // View source
      { ctrl: true, key: 'S' }, // Save page
      { alt: true, key: 'Tab' }, // Alt+Tab
      { ctrl: true, key: 'Tab' }, // Ctrl+Tab
    ];

    if (blockedKeys.includes(event.key)) {
      event.preventDefault();
      this.triggerBrowserEventFlag('TAB_BLUR', `Blocked key: ${event.key}`);
      return;
    }

    for (const combo of blockedCombinations) {
      if (
        (combo.ctrl === undefined || combo.ctrl === event.ctrlKey) &&
        (combo.shift === undefined || combo.shift === event.shiftKey) &&
        (combo.alt === undefined || combo.alt === event.altKey) &&
        combo.key.toLowerCase() === event.key.toLowerCase()
      ) {
        event.preventDefault();
        this.triggerBrowserEventFlag('TAB_BLUR', `Blocked combination: ${JSON.stringify(combo)}`);
        return;
      }
    }
  }

  private handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.triggerBrowserEventFlag('TAB_BLUR', 'Right-click context menu blocked');
  }

  private triggerBrowserEventFlag(type: FlagEvent['type'], description: string): void {
    // This would typically be handled by emitting an event or calling a callback
    // For now, we'll store it in a way that can be retrieved
    const flag = this.createFlag(type, 'hard', 1.0, { description });
    
    // Emit event or call callback if available
    if (this.onBrowserEventFlag) {
      this.onBrowserEventFlag(flag);
    }
  }

  // Callback for browser event flags
  public onBrowserEventFlag?: (flag: FlagEvent) => void;

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<CheatDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): CheatDetectionConfig {
    return { ...this.config };
  }

  /**
   * Reset detection state
   */
  public resetState(): void {
    this.state = this.initializeState();
  }

  /**
   * Get current detection state (for debugging)
   */
  public getState(): DetectionState {
    return { ...this.state };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (!this.skipBrowserCheck && (typeof window === 'undefined' || typeof document === 'undefined')) return;

    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.removeEventListener('blur', this.handleWindowBlur.bind(this));
    window.removeEventListener('focus', this.handleWindowFocus.bind(this));
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
    document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('contextmenu', this.handleContextMenu.bind(this));
  }
}