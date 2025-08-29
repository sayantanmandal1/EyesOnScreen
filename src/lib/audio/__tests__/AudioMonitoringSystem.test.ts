/**
 * Tests for AudioMonitoringSystem
 */

import { AudioMonitoringSystem, createAudioMonitoringSystem } from '../AudioMonitoringSystem';
import { AudioConfig, AudioProcessorConfig } from '../types';

// Mock the audio processor and related classes
jest.mock('../AudioProcessor');
jest.mock('../VoiceActivityDetector');
jest.mock('../AudioAnalyzer');
jest.mock('../AudioFingerprinter');

describe('AudioMonitoringSystem', () => {
  let audioSystem: AudioMonitoringSystem;
  let config: AudioConfig;
  let processorConfig: AudioProcessorConfig;

  beforeEach(() => {
    config = {
      sampleRate: 44100,
      bufferSize: 4096,
      fftSize: 2048,
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

    processorConfig = {
      enabled: true,
      continuousMonitoring: true,
      voiceActivityDetection: true,
      conversationDetection: true,
      whisperDetection: true,
      deviceDetection: true,
      environmentMonitoring: true,
      fingerprintingEnabled: true
    };

    audioSystem = new AudioMonitoringSystem(config, processorConfig);
  });

  afterEach(() => {
    audioSystem.dispose();
  });

  describe('initialization', () => {
    it('should create audio monitoring system with correct configuration', () => {
      expect(audioSystem).toBeDefined();
      expect(audioSystem.getCalibrationProfile()).toBeNull();
    });

    it('should initialize audio processor', async () => {
      await expect(audioSystem.initialize()).resolves.not.toThrow();
    });
  });

  describe('calibration', () => {
    it('should perform calibration and create profile', async () => {
      // Mock successful calibration
      const mockProfile = {
        baselineNoise: new Float32Array([0.01, 0.02]),
        voiceReference: new Float32Array(40),
        environmentSignature: new Float32Array(32),
        microphoneCharacteristics: {
          sensitivity: 1.0,
          frequencyResponse: new Float32Array(64),
          noiseFloor: 0.01
        },
        roomAcoustics: {
          reverbTime: 0.5,
          backgroundLevel: 0.02,
          acousticSignature: new Float32Array(32)
        },
        quality: 0.85
      };

      // Mock the calibration process
      jest.spyOn(audioSystem as any, 'createCalibrationProfile').mockReturnValue(mockProfile);

      const profile = await audioSystem.calibrate(1000); // Short calibration for testing
      
      expect(profile).toBeDefined();
      expect(profile.quality).toBeGreaterThan(0);
      expect(audioSystem.getCalibrationProfile()).toBe(profile);
    });

    it('should throw error if calibration fails', async () => {
      // Mock calibration failure
      jest.spyOn(audioSystem as any, 'audioProcessor').mockImplementation(() => {
        throw new Error('Calibration failed');
      });

      await expect(audioSystem.calibrate(1000)).rejects.toThrow();
    });
  });

  describe('monitoring', () => {
    it('should start and stop monitoring', () => {
      expect(() => audioSystem.startMonitoring()).not.toThrow();
      expect(() => audioSystem.stopMonitoring()).not.toThrow();
    });

    it('should not start monitoring if disabled', () => {
      const disabledConfig = { ...processorConfig, enabled: false };
      const disabledSystem = new AudioMonitoringSystem(config, disabledConfig);
      
      expect(() => disabledSystem.startMonitoring()).not.toThrow();
      disabledSystem.dispose();
    });
  });

  describe('event handling', () => {
    it('should register and call event callbacks', () => {
      const eventCallback = jest.fn();
      audioSystem.onAudioEvent(eventCallback);

      // Simulate an audio event
      const mockEvent = {
        id: 'test_event',
        timestamp: Date.now(),
        type: 'VOICE_DETECTED' as const,
        severity: 'medium' as const,
        confidence: 0.8,
        details: {
          duration: 1000,
          audioFeatures: { voiceActivityDetected: true },
          classification: 'human_voice'
        }
      };

      // Trigger event processing
      (audioSystem as any).analyzeForEvents({
        timestamp: Date.now(),
        voiceActivityDetected: true,
        voiceConfidence: 0.8,
        backgroundConversation: false,
        whisperDetected: false,
        humanVoicePresent: true,
        phoneCallDetected: false,
        keyboardSoundsDetected: false,
        roomAcoustics: {
          reverberation: 0.3,
          backgroundNoise: 0.02,
          environmentType: 'quiet' as const
        },
        deviceSounds: {
          phoneVibration: false,
          notificationSounds: false,
          electronicBeeps: false
        },
        audioFingerprint: {
          spectralCentroid: 1500,
          mfccFeatures: new Float32Array(13),
          voicePrint: new Float32Array(20)
        }
      });

      expect(eventCallback).toHaveBeenCalled();
    });

    it('should register and call signal callbacks', () => {
      const signalCallback = jest.fn();
      audioSystem.onAudioSignals(signalCallback);

      const mockSignals = {
        timestamp: Date.now(),
        voiceActivityDetected: true,
        voiceConfidence: 0.8,
        backgroundConversation: false,
        whisperDetected: false,
        humanVoicePresent: true,
        phoneCallDetected: false,
        keyboardSoundsDetected: false,
        roomAcoustics: {
          reverberation: 0.3,
          backgroundNoise: 0.02,
          environmentType: 'quiet' as const
        },
        deviceSounds: {
          phoneVibration: false,
          notificationSounds: false,
          electronicBeeps: false
        },
        audioFingerprint: {
          spectralCentroid: 1500,
          mfccFeatures: new Float32Array(13),
          voicePrint: new Float32Array(20)
        }
      };

      (audioSystem as any).processAudioSignals(mockSignals);

      expect(signalCallback).toHaveBeenCalledWith(mockSignals);
    });

    it('should remove event callbacks', () => {
      const eventCallback = jest.fn();
      audioSystem.onAudioEvent(eventCallback);
      audioSystem.removeEventCallback(eventCallback);

      // Trigger event processing
      (audioSystem as any).analyzeForEvents({
        timestamp: Date.now(),
        voiceActivityDetected: true,
        voiceConfidence: 0.8,
        backgroundConversation: false,
        whisperDetected: false,
        humanVoicePresent: true,
        phoneCallDetected: false,
        keyboardSoundsDetected: false,
        roomAcoustics: {
          reverberation: 0.3,
          backgroundNoise: 0.02,
          environmentType: 'quiet' as const
        },
        deviceSounds: {
          phoneVibration: false,
          notificationSounds: false,
          electronicBeeps: false
        },
        audioFingerprint: {
          spectralCentroid: 1500,
          mfccFeatures: new Float32Array(13),
          voicePrint: new Float32Array(20)
        }
      });

      expect(eventCallback).not.toHaveBeenCalled();
    });
  });

  describe('configuration updates', () => {
    it('should update processor configuration', () => {
      const newConfig = { voiceActivityDetection: false };
      audioSystem.updateConfig(newConfig);

      // Verify configuration was updated
      expect((audioSystem as any).processorConfig.voiceActivityDetection).toBe(false);
    });
  });

  describe('factory function', () => {
    it('should create audio monitoring system with default options', () => {
      const system = createAudioMonitoringSystem();
      expect(system).toBeInstanceOf(AudioMonitoringSystem);
      system.dispose();
    });

    it('should create audio monitoring system with custom options', () => {
      const system = createAudioMonitoringSystem({
        sampleRate: 48000,
        enableVoiceActivity: false,
        enableFingerprinting: false
      });
      expect(system).toBeInstanceOf(AudioMonitoringSystem);
      system.dispose();
    });
  });

  describe('event generation', () => {
    it('should generate voice detection events', () => {
      const eventCallback = jest.fn();
      audioSystem.onAudioEvent(eventCallback);

      const signals = {
        timestamp: Date.now(),
        voiceActivityDetected: true,
        voiceConfidence: 0.9,
        backgroundConversation: false,
        whisperDetected: false,
        humanVoicePresent: true,
        phoneCallDetected: false,
        keyboardSoundsDetected: false,
        roomAcoustics: {
          reverberation: 0.3,
          backgroundNoise: 0.02,
          environmentType: 'quiet' as const
        },
        deviceSounds: {
          phoneVibration: false,
          notificationSounds: false,
          electronicBeeps: false
        },
        audioFingerprint: {
          spectralCentroid: 1500,
          mfccFeatures: new Float32Array(13),
          voicePrint: new Float32Array(20)
        }
      };

      (audioSystem as any).analyzeForEvents(signals);

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'VOICE_DETECTED',
          severity: 'medium',
          confidence: 0.9
        })
      );
    });

    it('should generate conversation detection events', () => {
      const eventCallback = jest.fn();
      audioSystem.onAudioEvent(eventCallback);

      const signals = {
        timestamp: Date.now(),
        voiceActivityDetected: true,
        voiceConfidence: 0.8,
        backgroundConversation: true,
        whisperDetected: false,
        humanVoicePresent: true,
        phoneCallDetected: false,
        keyboardSoundsDetected: false,
        roomAcoustics: {
          reverberation: 0.3,
          backgroundNoise: 0.02,
          environmentType: 'quiet' as const
        },
        deviceSounds: {
          phoneVibration: false,
          notificationSounds: false,
          electronicBeeps: false
        },
        audioFingerprint: {
          spectralCentroid: 1500,
          mfccFeatures: new Float32Array(13),
          voicePrint: new Float32Array(20)
        }
      };

      (audioSystem as any).analyzeForEvents(signals);

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CONVERSATION',
          severity: 'high',
          confidence: 0.8
        })
      );
    });

    it('should generate device detection events', () => {
      const eventCallback = jest.fn();
      audioSystem.onAudioEvent(eventCallback);

      const signals = {
        timestamp: Date.now(),
        voiceActivityDetected: false,
        voiceConfidence: 0.1,
        backgroundConversation: false,
        whisperDetected: false,
        humanVoicePresent: false,
        phoneCallDetected: false,
        keyboardSoundsDetected: true,
        roomAcoustics: {
          reverberation: 0.3,
          backgroundNoise: 0.02,
          environmentType: 'quiet' as const
        },
        deviceSounds: {
          phoneVibration: true,
          notificationSounds: false,
          electronicBeeps: false
        },
        audioFingerprint: {
          spectralCentroid: 1500,
          mfccFeatures: new Float32Array(13),
          voicePrint: new Float32Array(20)
        }
      };

      (audioSystem as any).analyzeForEvents(signals);

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'KEYBOARD_SOUNDS',
          severity: 'medium'
        })
      );

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DEVICE_DETECTED',
          severity: 'medium'
        })
      );
    });
  });
});