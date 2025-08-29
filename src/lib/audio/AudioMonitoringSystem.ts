/**
 * Main audio monitoring system that orchestrates all audio analysis components
 */

import { AudioProcessor } from './AudioProcessor';
import { VoiceActivityDetector } from './VoiceActivityDetector';
import { AudioAnalyzer } from './AudioAnalyzer';
import { AudioFingerprinter } from './AudioFingerprinter';
import { 
  AudioSignals, 
  AudioConfig, 
  AudioEvent, 
  AudioProcessorConfig,
  AudioCalibrationProfile,
  AudioError 
} from './types';

export class AudioMonitoringSystem {
  private audioProcessor: AudioProcessor;
  private voiceActivityDetector: VoiceActivityDetector;
  private audioAnalyzer: AudioAnalyzer;
  private audioFingerprinter: AudioFingerprinter;
  private config: AudioConfig;
  private processorConfig: AudioProcessorConfig;
  private isMonitoring = false;
  private calibrationProfile: AudioCalibrationProfile | null = null;
  private eventCallbacks: ((event: AudioEvent) => void)[] = [];
  private signalCallbacks: ((signals: AudioSignals) => void)[] = [];

  constructor(config: AudioConfig, processorConfig: AudioProcessorConfig) {
    this.config = config;
    this.processorConfig = processorConfig;
    
    this.audioProcessor = new AudioProcessor(config);
    this.voiceActivityDetector = new VoiceActivityDetector(config);
    this.audioAnalyzer = new AudioAnalyzer(config);
    this.audioFingerprinter = new AudioFingerprinter();
  }

  async initialize(): Promise<void> {
    try {
      await this.audioProcessor.initialize();
    } catch (error) {
      throw new AudioError(`Failed to initialize audio monitoring system: ${error.message}`, {
        code: 'MICROPHONE_ACCESS_DENIED',
        details: { originalError: error }
      });
    }
  }

  async calibrate(durationMs: number = 10000): Promise<AudioCalibrationProfile> {
    if (!this.processorConfig.enabled) {
      throw new AudioError('Audio monitoring is disabled', { code: 'PROCESSING_ERROR' });
    }

    const calibrationSamples: any[] = [];
    const calibrationAnalyses: any[] = [];
    let sampleCount = 0;
    const targetSamples = Math.floor(durationMs / 100); // Sample every 100ms

    return new Promise((resolve, reject) => {
      const calibrationTimeout = setTimeout(() => {
        reject(new AudioError('Calibration timeout', { code: 'CALIBRATION_FAILED' }));
      }, durationMs + 5000);

      const calibrationCallback = (signals: AudioSignals) => {
        if (sampleCount < targetSamples) {
          // Store calibration data (simplified - would need actual buffer access)
          calibrationSamples.push({
            timestamp: signals.timestamp,
            energy: 0.1, // Placeholder
            data: new Float32Array(1024) // Placeholder
          });
          
          calibrationAnalyses.push({
            frequencies: new Float32Array(512),
            magnitudes: new Float32Array(512),
            spectralCentroid: signals.audioFingerprint.spectralCentroid,
            spectralRolloff: 3000,
            spectralFlux: 0.2,
            dominantFrequency: 150,
            mfcc: signals.audioFingerprint.mfccFeatures
          });
          
          sampleCount++;
        } else {
          // Calibration complete
          clearTimeout(calibrationTimeout);
          this.audioProcessor.stopProcessing();
          
          try {
            // Calibrate components
            this.voiceActivityDetector.calibrate(calibrationSamples);
            if (this.processorConfig.fingerprintingEnabled) {
              this.audioFingerprinter.calibrateVoiceReference(calibrationSamples, calibrationAnalyses);
            }
            
            // Create calibration profile
            this.calibrationProfile = this.createCalibrationProfile(calibrationSamples, calibrationAnalyses);
            
            resolve(this.calibrationProfile);
          } catch (error) {
            reject(new AudioError(`Calibration failed: ${error.message}`, {
              code: 'CALIBRATION_FAILED',
              details: { originalError: error }
            }));
          }
        }
      };

      // Start calibration
      this.audioProcessor.startProcessing(calibrationCallback);
    });
  }

  startMonitoring(): void {
    if (!this.processorConfig.enabled || this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.audioProcessor.startProcessing((signals: AudioSignals) => {
      this.processAudioSignals(signals);
    });
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    this.audioProcessor.stopProcessing();
  }

  private processAudioSignals(signals: AudioSignals): void {
    // Notify signal callbacks
    this.signalCallbacks.forEach(callback => {
      try {
        callback(signals);
      } catch (error) {
        console.error('Error in signal callback:', error);
      }
    });

    // Analyze signals for events
    this.analyzeForEvents(signals);
  }

  private analyzeForEvents(signals: AudioSignals): void {
    const events: AudioEvent[] = [];

    // Voice activity events
    if (this.processorConfig.voiceActivityDetection && signals.voiceActivityDetected) {
      events.push(this.createEvent('VOICE_DETECTED', 'medium', signals.voiceConfidence, {
        duration: 0, // Would need temporal tracking
        audioFeatures: { voiceActivityDetected: signals.voiceActivityDetected },
        classification: 'human_voice'
      }));
    }

    // Background conversation events
    if (this.processorConfig.conversationDetection && signals.backgroundConversation) {
      events.push(this.createEvent('CONVERSATION', 'high', 0.8, {
        duration: 0,
        audioFeatures: { backgroundConversation: signals.backgroundConversation },
        classification: 'multiple_speakers'
      }));
    }

    // Whisper detection events
    if (this.processorConfig.whisperDetection && signals.whisperDetected) {
      events.push(this.createEvent('WHISPER', 'high', 0.9, {
        duration: 0,
        audioFeatures: { whisperDetected: signals.whisperDetected },
        classification: 'whisper_speech'
      }));
    }

    // Phone call detection events
    if (signals.phoneCallDetected) {
      events.push(this.createEvent('PHONE_CALL', 'high', 0.85, {
        duration: 0,
        audioFeatures: { phoneCallDetected: signals.phoneCallDetected },
        classification: 'phone_conversation'
      }));
    }

    // Keyboard sounds events
    if (signals.keyboardSoundsDetected) {
      events.push(this.createEvent('KEYBOARD_SOUNDS', 'medium', 0.7, {
        duration: 0,
        audioFeatures: { keyboardSoundsDetected: signals.keyboardSoundsDetected },
        classification: 'external_keyboard'
      }));
    }

    // Device detection events
    if (signals.deviceSounds.phoneVibration || signals.deviceSounds.notificationSounds || signals.deviceSounds.electronicBeeps) {
      events.push(this.createEvent('DEVICE_DETECTED', 'medium', 0.75, {
        duration: 0,
        audioFeatures: { deviceSounds: signals.deviceSounds },
        classification: 'electronic_device'
      }));
    }

    // Environment change events
    if (this.processorConfig.environmentMonitoring && this.detectEnvironmentChange(signals)) {
      events.push(this.createEvent('ENVIRONMENT_CHANGE', 'low', 0.6, {
        duration: 0,
        audioFeatures: { roomAcoustics: signals.roomAcoustics },
        classification: 'acoustic_environment_change'
      }));
    }

    // Notify event callbacks
    events.forEach(event => {
      this.eventCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in event callback:', error);
        }
      });
    });
  }

  private createEvent(
    type: AudioEvent['type'], 
    severity: AudioEvent['severity'], 
    confidence: number, 
    details: AudioEvent['details']
  ): AudioEvent {
    return {
      id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      severity,
      confidence,
      details
    };
  }

  private detectEnvironmentChange(signals: AudioSignals): boolean {
    if (!this.calibrationProfile) return false;
    
    // Compare current acoustics with baseline
    const currentReverberation = signals.roomAcoustics.reverberation;
    const currentNoise = signals.roomAcoustics.backgroundNoise;
    const baselineReverb = this.calibrationProfile.roomAcoustics.reverbTime;
    const baselineNoise = this.calibrationProfile.roomAcoustics.backgroundLevel;
    
    const reverbChange = Math.abs(currentReverberation - baselineReverb) / Math.max(baselineReverb, 0.1);
    const noiseChange = Math.abs(currentNoise - baselineNoise) / Math.max(baselineNoise, 0.1);
    
    return reverbChange > 0.3 || noiseChange > 0.5;
  }

  private createCalibrationProfile(samples: any[], analyses: any[]): AudioCalibrationProfile {
    // Calculate baseline noise
    const noiseValues = samples.map(s => s.energy || 0.01);
    const baselineNoise = new Float32Array(noiseValues);
    
    // Calculate voice reference (simplified)
    const voiceReference = new Float32Array(40);
    for (let i = 0; i < Math.min(40, analyses.length); i++) {
      voiceReference[i] = analyses[0]?.mfcc?.[i % 13] || 0;
    }
    
    // Calculate environment signature
    const environmentSignature = new Float32Array(32);
    for (let i = 0; i < 32; i++) {
      environmentSignature[i] = Math.random() * 0.1; // Placeholder
    }
    
    // Calculate microphone characteristics
    const avgNoise = noiseValues.reduce((sum, val) => sum + val, 0) / noiseValues.length;
    
    return {
      baselineNoise,
      voiceReference,
      environmentSignature,
      microphoneCharacteristics: {
        sensitivity: 1.0,
        frequencyResponse: new Float32Array(64),
        noiseFloor: avgNoise
      },
      roomAcoustics: {
        reverbTime: 0.5,
        backgroundLevel: avgNoise,
        acousticSignature: environmentSignature
      },
      quality: 0.85 // Placeholder quality score
    };
  }

  // Public API methods
  onAudioEvent(callback: (event: AudioEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  onAudioSignals(callback: (signals: AudioSignals) => void): void {
    this.signalCallbacks.push(callback);
  }

  removeEventCallback(callback: (event: AudioEvent) => void): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index !== -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  removeSignalCallback(callback: (signals: AudioSignals) => void): void {
    const index = this.signalCallbacks.indexOf(callback);
    if (index !== -1) {
      this.signalCallbacks.splice(index, 1);
    }
  }

  updateConfig(newConfig: Partial<AudioProcessorConfig>): void {
    Object.assign(this.processorConfig, newConfig);
  }

  getCalibrationProfile(): AudioCalibrationProfile | null {
    return this.calibrationProfile;
  }

  getCurrentAudioLevel(): number {
    // Would need to track current audio level from processor
    return 0; // Placeholder
  }

  isVoiceDetected(): boolean {
    // Would need to track current voice activity state
    return false; // Placeholder
  }

  getVoiceIdentityMatch(): { isMatch: boolean; confidence: number } {
    if (!this.processorConfig.fingerprintingEnabled) {
      return { isMatch: true, confidence: 1.0 }; // Assume match if not enabled
    }
    
    // Would need current fingerprint to compare
    return { isMatch: true, confidence: 0.8 }; // Placeholder
  }

  dispose(): void {
    this.stopMonitoring();
    this.audioProcessor.dispose();
    this.audioFingerprinter.dispose();
    this.eventCallbacks = [];
    this.signalCallbacks = [];
    this.calibrationProfile = null;
  }
}

// Factory function for creating configured audio monitoring system
export function createAudioMonitoringSystem(options: {
  sampleRate?: number;
  bufferSize?: number;
  fftSize?: number;
  enableVoiceActivity?: boolean;
  enableConversationDetection?: boolean;
  enableWhisperDetection?: boolean;
  enableDeviceDetection?: boolean;
  enableEnvironmentMonitoring?: boolean;
  enableFingerprinting?: boolean;
} = {}): AudioMonitoringSystem {
  const audioConfig: AudioConfig = {
    sampleRate: options.sampleRate || 44100,
    bufferSize: options.bufferSize || 4096,
    fftSize: options.fftSize || 2048,
    smoothingTimeConstant: 0.8,
    thresholds: {
      voiceActivity: 0.3,
      whisperLevel: 0.05,
      backgroundConversation: 0.4,
      keyboardSounds: 0.6,
      phoneCall: 0.7
    },
    calibration: {
      baselineNoise: 0.01,
      voicePrintReference: null,
      environmentBaseline: 0.02
    }
  };

  const processorConfig: AudioProcessorConfig = {
    enabled: true,
    continuousMonitoring: true,
    voiceActivityDetection: options.enableVoiceActivity !== false,
    conversationDetection: options.enableConversationDetection !== false,
    whisperDetection: options.enableWhisperDetection !== false,
    deviceDetection: options.enableDeviceDetection !== false,
    environmentMonitoring: options.enableEnvironmentMonitoring !== false,
    fingerprintingEnabled: options.enableFingerprinting !== false
  };

  return new AudioMonitoringSystem(audioConfig, processorConfig);
}