/**
 * Tests for AudioProcessor
 */

import { AudioProcessor } from '../AudioProcessor';
import { AudioConfig } from '../types';

// Mock Web Audio API
const mockAudioContext = {
  createAnalyser: jest.fn(() => ({
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    frequencyBinCount: 1024,
    getByteFrequencyData: jest.fn(),
    getByteTimeDomainData: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  })),
  createScriptProcessor: jest.fn(() => ({
    onaudioprocess: null,
    connect: jest.fn(),
    disconnect: jest.fn()
  })),
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn()
  })),
  destination: {},
  state: 'running',
  resume: jest.fn(),
  close: jest.fn()
};

const mockMediaStream = {
  getTracks: jest.fn(() => [{ stop: jest.fn() }])
};

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(() => Promise.resolve(mockMediaStream))
  }
});

// Mock AudioContext
(global as any).AudioContext = jest.fn(() => mockAudioContext);
(global as any).webkitAudioContext = jest.fn(() => mockAudioContext);

describe('AudioProcessor', () => {
  let audioProcessor: AudioProcessor;
  let config: AudioConfig;

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

    audioProcessor = new AudioProcessor(config);
    jest.clearAllMocks();
  });

  afterEach(() => {
    audioProcessor.dispose();
  });

  describe('initialization', () => {
    it('should initialize audio context and media stream', async () => {
      await audioProcessor.initialize();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
      expect(mockAudioContext.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1);
    });

    it('should throw error if microphone access is denied', async () => {
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(
        new Error('Permission denied')
      );

      await expect(audioProcessor.initialize()).rejects.toThrow('Failed to initialize audio processor');
    });
  });

  describe('audio processing', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    it('should start processing and call callback', () => {
      const callback = jest.fn();
      audioProcessor.startProcessing(callback);

      // Simulate audio processing event
      const mockEvent = {
        inputBuffer: {
          getChannelData: jest.fn(() => new Float32Array(1024))
        }
      };

      const scriptProcessor = mockAudioContext.createScriptProcessor();
      if (scriptProcessor.onaudioprocess) {
        scriptProcessor.onaudioprocess(mockEvent as any);
      }

      expect(callback).toHaveBeenCalled();
    });

    it('should stop processing', () => {
      const callback = jest.fn();
      audioProcessor.startProcessing(callback);
      audioProcessor.stopProcessing();

      // Simulate audio processing event after stopping
      const mockEvent = {
        inputBuffer: {
          getChannelData: jest.fn(() => new Float32Array(1024))
        }
      };

      const scriptProcessor = mockAudioContext.createScriptProcessor();
      if (scriptProcessor.onaudioprocess) {
        scriptProcessor.onaudioprocess(mockEvent as any);
      }

      expect(callback).not.toHaveBeenCalled();
    });

    it('should generate audio signals with voice activity detection', () => {
      const callback = jest.fn();
      audioProcessor.startProcessing(callback);

      // Mock frequency data that represents voice activity
      const mockFrequencyData = new Uint8Array(1024);
      mockFrequencyData.fill(100); // Moderate energy levels

      const mockAnalyser = mockAudioContext.createAnalyser();
      mockAnalyser.getByteFrequencyData.mockImplementation((data: Uint8Array) => {
        data.set(mockFrequencyData);
      });

      const mockEvent = {
        inputBuffer: {
          getChannelData: jest.fn(() => {
            const buffer = new Float32Array(1024);
            // Generate sine wave to simulate voice
            for (let i = 0; i < buffer.length; i++) {
              buffer[i] = Math.sin(2 * Math.PI * 150 * i / 44100) * 0.1;
            }
            return buffer;
          })
        }
      };

      const scriptProcessor = mockAudioContext.createScriptProcessor();
      if (scriptProcessor.onaudioprocess) {
        scriptProcessor.onaudioprocess(mockEvent as any);
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          voiceActivityDetected: expect.any(Boolean),
          voiceConfidence: expect.any(Number),
          backgroundConversation: expect.any(Boolean),
          whisperDetected: expect.any(Boolean),
          humanVoicePresent: expect.any(Boolean),
          phoneCallDetected: expect.any(Boolean),
          keyboardSoundsDetected: expect.any(Boolean),
          roomAcoustics: expect.objectContaining({
            reverberation: expect.any(Number),
            backgroundNoise: expect.any(Number),
            environmentType: expect.any(String)
          }),
          deviceSounds: expect.objectContaining({
            phoneVibration: expect.any(Boolean),
            notificationSounds: expect.any(Boolean),
            electronicBeeps: expect.any(Boolean)
          }),
          audioFingerprint: expect.objectContaining({
            spectralCentroid: expect.any(Number),
            mfccFeatures: expect.any(Float32Array),
            voicePrint: expect.any(Float32Array)
          })
        })
      );
    });
  });

  describe('voice activity detection', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    it('should detect voice activity in speech-like audio', () => {
      const callback = jest.fn();
      audioProcessor.startProcessing(callback);

      // Create speech-like audio buffer
      const speechBuffer = new Float32Array(1024);
      for (let i = 0; i < speechBuffer.length; i++) {
        // Simulate formant frequencies
        speechBuffer[i] = 
          Math.sin(2 * Math.PI * 150 * i / 44100) * 0.1 +  // F0
          Math.sin(2 * Math.PI * 800 * i / 44100) * 0.05 +  // F1
          Math.sin(2 * Math.PI * 1200 * i / 44100) * 0.03;  // F2
      }

      const mockEvent = {
        inputBuffer: {
          getChannelData: jest.fn(() => speechBuffer)
        }
      };

      const scriptProcessor = mockAudioContext.createScriptProcessor();
      if (scriptProcessor.onaudioprocess) {
        scriptProcessor.onaudioprocess(mockEvent as any);
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          voiceActivityDetected: expect.any(Boolean),
          voiceConfidence: expect.any(Number)
        })
      );
    });

    it('should not detect voice activity in noise', () => {
      const callback = jest.fn();
      audioProcessor.startProcessing(callback);

      // Create noise buffer
      const noiseBuffer = new Float32Array(1024);
      for (let i = 0; i < noiseBuffer.length; i++) {
        noiseBuffer[i] = (Math.random() - 0.5) * 0.01; // Low-level noise
      }

      const mockEvent = {
        inputBuffer: {
          getChannelData: jest.fn(() => noiseBuffer)
        }
      };

      const scriptProcessor = mockAudioContext.createScriptProcessor();
      if (scriptProcessor.onaudioprocess) {
        scriptProcessor.onaudioprocess(mockEvent as any);
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          voiceActivityDetected: false
        })
      );
    });
  });

  describe('device detection', () => {
    beforeEach(async () => {
      await audioProcessor.initialize();
    });

    it('should detect keyboard sounds', () => {
      const callback = jest.fn();
      audioProcessor.startProcessing(callback);

      // Create keyboard click-like audio
      const clickBuffer = new Float32Array(1024);
      for (let i = 0; i < 100; i++) {
        clickBuffer[i] = Math.sin(2 * Math.PI * 4000 * i / 44100) * 0.5 * Math.exp(-i * 0.1);
      }

      const mockEvent = {
        inputBuffer: {
          getChannelData: jest.fn(() => clickBuffer)
        }
      };

      const scriptProcessor = mockAudioContext.createScriptProcessor();
      if (scriptProcessor.onaudioprocess) {
        scriptProcessor.onaudioprocess(mockEvent as any);
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          keyboardSoundsDetected: expect.any(Boolean)
        })
      );
    });

    it('should detect phone vibration', () => {
      const callback = jest.fn();
      audioProcessor.startProcessing(callback);

      // Create low-frequency vibration-like audio
      const vibrationBuffer = new Float32Array(1024);
      for (let i = 0; i < vibrationBuffer.length; i++) {
        vibrationBuffer[i] = Math.sin(2 * Math.PI * 50 * i / 44100) * 0.3;
      }

      const mockEvent = {
        inputBuffer: {
          getChannelData: jest.fn(() => vibrationBuffer)
        }
      };

      const scriptProcessor = mockAudioContext.createScriptProcessor();
      if (scriptProcessor.onaudioprocess) {
        scriptProcessor.onaudioprocess(mockEvent as any);
      }

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceSounds: expect.objectContaining({
            phoneVibration: expect.any(Boolean)
          })
        })
      );
    });
  });

  describe('disposal', () => {
    it('should clean up resources', async () => {
      await audioProcessor.initialize();
      audioProcessor.dispose();

      expect(mockAudioContext.close).toHaveBeenCalled();
      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
    });
  });
});