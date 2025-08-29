/**
 * ContinuousVerifier - Continuous verification of camera and microphone functionality
 * 
 * Provides ongoing verification that camera and microphone remain active and functional
 * throughout the quiz session with configurable intervals and automatic recovery.
 */

import type { SecurityConfig, SecurityThreat } from './types';

interface VerificationResult {
  camera: {
    active: boolean;
    functional: boolean;
    error?: string;
    lastVerified: number;
  };
  microphone: {
    active: boolean;
    functional: boolean;
    error?: string;
    lastVerified: number;
  };
}

interface VerificationEvent {
  result: VerificationResult;
  threats?: SecurityThreat[];
}

type VerificationEventHandler = (event: VerificationEvent) => void;

export class ContinuousVerifier {
  private config: SecurityConfig;
  private eventHandlers: Set<VerificationEventHandler> = new Set();
  private verificationInterval?: NodeJS.Timeout;
  private cameraStream?: MediaStream;
  private microphoneStream?: MediaStream;
  private isRunning = false;
  private isDestroyed = false;
  private currentResult: VerificationResult;

  // Audio analysis for microphone verification
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private microphone?: MediaStreamAudioSourceNode;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.currentResult = this.createInitialResult();
  }

  /**
   * Start continuous verification
   */
  async start(): Promise<void> {
    if (this.isRunning || this.isDestroyed) return;

    try {
      // Initialize media streams
      await this.initializeStreams();

      // Start verification loop
      this.isRunning = true;
      this.startVerificationLoop();

      console.log('Continuous verification started');
    } catch (error) {
      const threat: SecurityThreat = {
        id: `verification_start_error_${Date.now()}`,
        type: 'permission_denied',
        severity: 'critical',
        message: `Failed to start continuous verification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error },
        timestamp: Date.now(),
        resolved: false
      };

      this.emitEvent({ result: this.currentResult, threats: [threat] });
      throw error;
    }
  }

  /**
   * Stop continuous verification
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.verificationInterval) {
      clearInterval(this.verificationInterval);
      this.verificationInterval = undefined;
    }

    this.cleanupStreams();
    console.log('Continuous verification stopped');
  }

  /**
   * Get current verification result
   */
  getResult(): VerificationResult {
    return { ...this.currentResult };
  }

  /**
   * Add event handler
   */
  addEventListener(handler: VerificationEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  removeEventListener(handler: VerificationEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Manually trigger verification
   */
  async verify(): Promise<VerificationResult> {
    if (this.isDestroyed) return this.currentResult;

    await this.performVerification();
    return this.currentResult;
  }

  /**
   * Destroy the verifier and cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.stop();
    this.eventHandlers.clear();
    this.isDestroyed = true;
  }

  private createInitialResult(): VerificationResult {
    return {
      camera: {
        active: false,
        functional: false,
        lastVerified: 0
      },
      microphone: {
        active: false,
        functional: false,
        lastVerified: 0
      }
    };
  }

  private async initializeStreams(): Promise<void> {
    // Initialize camera stream
    if (this.config.permissions.camera.required) {
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        });

        this.currentResult.camera.active = true;
        this.currentResult.camera.functional = true;
        this.currentResult.camera.lastVerified = Date.now();
      } catch (error) {
        this.currentResult.camera.error = error instanceof Error ? error.message : 'Camera initialization failed';
        throw error;
      }
    }

    // Initialize microphone stream
    if (this.config.permissions.microphone.required) {
      try {
        this.microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        // Set up audio analysis
        await this.setupAudioAnalysis();

        this.currentResult.microphone.active = true;
        this.currentResult.microphone.functional = true;
        this.currentResult.microphone.lastVerified = Date.now();
      } catch (error) {
        this.currentResult.microphone.error = error instanceof Error ? error.message : 'Microphone initialization failed';
        throw error;
      }
    }
  }

  private async setupAudioAnalysis(): Promise<void> {
    if (!this.microphoneStream) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.microphoneStream);

      this.analyser.fftSize = 256;
      this.microphone.connect(this.analyser);
    } catch (error) {
      console.warn('Audio analysis setup failed:', error);
    }
  }

  private startVerificationLoop(): void {
    const interval = Math.min(
      this.config.permissions.camera.verificationIntervalMs,
      this.config.permissions.microphone.verificationIntervalMs
    );

    this.verificationInterval = setInterval(() => {
      this.performVerification();
    }, interval);

    // Perform initial verification
    this.performVerification();
  }

  private async performVerification(): Promise<void> {
    if (!this.isRunning || this.isDestroyed) return;

    const threats: SecurityThreat[] = [];

    // Verify camera
    if (this.config.permissions.camera.required && this.config.permissions.camera.continuousVerification) {
      const cameraResult = await this.verifyCamera();
      this.currentResult.camera = cameraResult;

      if (!cameraResult.active || !cameraResult.functional) {
        threats.push({
          id: `camera_verification_failed_${Date.now()}`,
          type: 'permission_denied',
          severity: 'critical',
          message: `Camera verification failed: ${cameraResult.error || 'Unknown error'}`,
          details: {
            active: cameraResult.active,
            functional: cameraResult.functional,
            error: cameraResult.error
          },
          timestamp: Date.now(),
          resolved: false
        });
      }
    }

    // Verify microphone
    if (this.config.permissions.microphone.required && this.config.permissions.microphone.continuousVerification) {
      const microphoneResult = await this.verifyMicrophone();
      this.currentResult.microphone = microphoneResult;

      if (!microphoneResult.active || !microphoneResult.functional) {
        threats.push({
          id: `microphone_verification_failed_${Date.now()}`,
          type: 'permission_denied',
          severity: 'critical',
          message: `Microphone verification failed: ${microphoneResult.error || 'Unknown error'}`,
          details: {
            active: microphoneResult.active,
            functional: microphoneResult.functional,
            error: microphoneResult.error
          },
          timestamp: Date.now(),
          resolved: false
        });
      }
    }

    // Emit event with results
    if (threats.length > 0) {
      this.emitEvent({ result: this.currentResult, threats });
    } else {
      this.emitEvent({ result: this.currentResult });
    }
  }

  private async verifyCamera(): Promise<VerificationResult['camera']> {
    const result: VerificationResult['camera'] = {
      active: false,
      functional: false,
      lastVerified: Date.now()
    };

    try {
      if (!this.cameraStream) {
        throw new Error('Camera stream not initialized');
      }

      // Check if stream is active
      if (!this.cameraStream.active) {
        throw new Error('Camera stream is not active');
      }

      // Check video tracks
      const videoTracks = this.cameraStream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error('No video tracks found');
      }

      const videoTrack = videoTracks[0];
      if (videoTrack.readyState !== 'live') {
        throw new Error(`Video track state is ${videoTrack.readyState}, expected 'live'`);
      }

      // Test video functionality by creating a video element
      const video = document.createElement('video');
      video.srcObject = this.cameraStream;
      video.muted = true;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video load timeout'));
        }, 5000);

        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };

        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video load error'));
        };

        video.load();
      });

      // Check video dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('Video has no dimensions');
      }

      result.active = true;
      result.functional = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Camera verification failed';

      // Attempt to recover camera stream
      try {
        await this.recoverCameraStream();
      } catch (recoveryError) {
        console.error('Camera recovery failed:', recoveryError);
      }
    }

    return result;
  }

  private async verifyMicrophone(): Promise<VerificationResult['microphone']> {
    const result: VerificationResult['microphone'] = {
      active: false,
      functional: false,
      lastVerified: Date.now()
    };

    try {
      if (!this.microphoneStream) {
        throw new Error('Microphone stream not initialized');
      }

      // Check if stream is active
      if (!this.microphoneStream.active) {
        throw new Error('Microphone stream is not active');
      }

      // Check audio tracks
      const audioTracks = this.microphoneStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found');
      }

      const audioTrack = audioTracks[0];
      if (audioTrack.readyState !== 'live') {
        throw new Error(`Audio track state is ${audioTrack.readyState}, expected 'live'`);
      }

      // Test audio functionality using audio analysis
      if (this.analyser && this.audioContext) {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        // Check if we're getting audio data
        const hasAudioData = dataArray.some(value => value > 0);
        if (!hasAudioData) {
          // This might be normal if there's no sound, so we'll just warn
          console.warn('No audio data detected, but microphone appears functional');
        }
      }

      result.active = true;
      result.functional = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Microphone verification failed';

      // Attempt to recover microphone stream
      try {
        await this.recoverMicrophoneStream();
      } catch (recoveryError) {
        console.error('Microphone recovery failed:', recoveryError);
      }
    }

    return result;
  }

  private async recoverCameraStream(): Promise<void> {
    try {
      // Stop existing stream
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach(track => track.stop());
      }

      // Request new stream
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });

      console.log('Camera stream recovered successfully');
    } catch (error) {
      console.error('Camera stream recovery failed:', error);
      throw error;
    }
  }

  private async recoverMicrophoneStream(): Promise<void> {
    try {
      // Stop existing stream and audio context
      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach(track => track.stop());
      }

      if (this.audioContext) {
        await this.audioContext.close();
      }

      // Request new stream
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Re-setup audio analysis
      await this.setupAudioAnalysis();

      console.log('Microphone stream recovered successfully');
    } catch (error) {
      console.error('Microphone stream recovery failed:', error);
      throw error;
    }
  }

  private cleanupStreams(): void {
    // Stop camera stream
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = undefined;
    }

    // Stop microphone stream
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => track.stop());
      this.microphoneStream = undefined;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = undefined;
      this.analyser = undefined;
      this.microphone = undefined;
    }

    // Reset results
    this.currentResult = this.createInitialResult();
  }

  private emitEvent(event: VerificationEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in verification event handler:', error);
      }
    });
  }
}