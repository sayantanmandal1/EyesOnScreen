/**
 * Tests for HumanVoiceClassifier
 */

import { HumanVoiceClassifier } from '../HumanVoiceClassifier';
import { AudioConfig, AudioBuffer, FrequencyAnalysis } from '../types';

describe('HumanVoiceClassifier', () => {
  let classifier: HumanVoiceClassifier;
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

    classifier = new HumanVoiceClassifier(config);
  });

  describe('voice classification', () => {
    it('should classify human voice correctly', () => {
      const buffer: AudioBuffer = {
        data: createVoiceBuffer(),
        timestamp: Date.now(),
        sampleRate: 44100
      };

      const frequencyAnalysis: FrequencyAnalysis = createVoiceFrequencyAnalysis();

      const result = classifier.classifyVoice(buffer, frequencyAnalysis);

      expect(result.isHuman).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.voiceCharacteristics.gender).toBeDefined();
      expect(result.voiceCharacteristics.ageGroup).toBeDefined();
    });

    it('should detect artificial voice', () => {
      const buffer: AudioBuffer = {
        data: createArtificialVoiceBuffer(),
        timestamp: Date.now(),
        sampleRate: 44100
      };

      const frequencyAnalysis: FrequencyAnalysis = createArtificialVoiceFrequencyAnalysis();

      const result = classifier.classifyVoice(buffer, frequencyAnalysis);

      expect(result.suspiciousIndicators.artificialVoice).toBe(true);
      expect(result.voiceQuality.naturalness).toBeLessThan(0.5);
    });

    it('should classify voice characteristics', () => {
      const buffer: AudioBuffer = {
        data: createMaleVoiceBuffer(),
        timestamp: Date.now(),
        sampleRate: 44100
      };

      const frequencyAnalysis: FrequencyAnalysis = createMaleVoiceFrequencyAnalysis();

      const result = classifier.classifyVoice(buffer, frequencyAnalysis);

      expect(result.voiceCharacteristics.gender).toBe('male');
      expect(result.voiceCharacteristics.ageGroup).toBe('adult');
    });

    it('should detect voice changer', () => {
      const buffer: AudioBuffer = {
        data: createVoiceChangerBuffer(),
        timestamp: Date.now(),
        sampleRate: 44100
      };

      const frequencyAnalysis: FrequencyAnalysis = createVoiceChangerFrequencyAnalysis();

      const result = classifier.classifyVoice(buffer, frequencyAnalysis);

      expect(result.suspiciousIndicators.voiceChanger).toBe(true);
    });

    it('should detect multiple voices', () => {
      const buffer: AudioBuffer = {
        data: createMultipleVoicesBuffer(),
        timestamp: Date.now(),
        sampleRate: 44100
      };

      const frequencyAnalysis: FrequencyAnalysis = createMultipleVoicesFrequencyAnalysis();

      const result = classifier.classifyVoice(buffer, frequencyAnalysis);

      expect(result.suspiciousIndicators.multipleVoices).toBe(true);
    });

    it('should not classify noise as human voice', () => {
      const buffer: AudioBuffer = {
        data: createNoiseBuffer(),
        timestamp: Date.now(),
        sampleRate: 44100
      };

      const frequencyAnalysis: FrequencyAnalysis = createNoiseFrequencyAnalysis();

      const result = classifier.classifyVoice(buffer, frequencyAnalysis);

      expect(result.isHuman).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
    });
  });

  describe('voice quality assessment', () => {
    it('should assess voice quality correctly', () => {
      const buffer: AudioBuffer = {
        data: createHighQualityVoiceBuffer(),
        timestamp: Date.now(),
        sampleRate: 44100
      };

      const frequencyAnalysis: FrequencyAnalysis = createHighQualityVoiceFrequencyAnalysis();

      const result = classifier.classifyVoice(buffer, frequencyAnalysis);

      expect(result.voiceQuality.clarity).toBeGreaterThan(0.7);
      expect(result.voiceQuality.naturalness).toBeGreaterThan(0.7);
    });

    it('should detect poor voice quality', () => {
      const buffer: AudioBuffer = {
        data: createPoorQualityVoiceBuffer(),
        timestamp: Date.now(),
        sampleRate: 44100
      };

      const frequencyAnalysis: FrequencyAnalysis = createPoorQualityVoiceFrequencyAnalysis();

      const result = classifier.classifyVoice(buffer, frequencyAnalysis);

      expect(result.voiceQuality.clarity).toBeLessThan(0.5);
    });
  });

  // Helper functions to create test data
  function createVoiceBuffer(): Float32Array {
    const buffer = new Float32Array(1024);
    // Simulate human voice with fundamental frequency around 150 Hz
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 
        Math.sin(2 * Math.PI * 150 * i / 44100) * 0.1 +  // F0
        Math.sin(2 * Math.PI * 800 * i / 44100) * 0.05 +  // F1
        Math.sin(2 * Math.PI * 1200 * i / 44100) * 0.03 + // F2
        (Math.random() - 0.5) * 0.01; // Small amount of noise
    }
    return buffer;
  }

  function createVoiceFrequencyAnalysis(): FrequencyAnalysis {
    const frequencies = new Float32Array(512);
    const magnitudes = new Float32Array(512);
    
    for (let i = 0; i < frequencies.length; i++) {
      frequencies[i] = (i * 44100) / (2 * frequencies.length);
    }
    
    // Simulate voice spectrum with formants
    for (let i = 0; i < magnitudes.length; i++) {
      const freq = frequencies[i];
      let magnitude = 0;
      
      // F0 and harmonics
      if (Math.abs(freq - 150) < 10) magnitude += 0.8;
      if (Math.abs(freq - 300) < 10) magnitude += 0.4;
      if (Math.abs(freq - 450) < 10) magnitude += 0.2;
      
      // Formants
      if (Math.abs(freq - 800) < 50) magnitude += 0.6;
      if (Math.abs(freq - 1200) < 50) magnitude += 0.4;
      if (Math.abs(freq - 2500) < 100) magnitude += 0.3;
      
      magnitudes[i] = magnitude;
    }
    
    return {
      frequencies,
      magnitudes,
      phases: new Float32Array(512),
      dominantFrequency: 150,
      spectralCentroid: 1200,
      spectralRolloff: 3000,
      spectralFlux: 0.3,
      mfcc: new Float32Array(13)
    };
  }

  function createArtificialVoiceBuffer(): Float32Array {
    const buffer = new Float32Array(1024);
    // Simulate artificial voice with perfect harmonics and no jitter
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 
        Math.sin(2 * Math.PI * 200 * i / 44100) * 0.1 +  // Perfect F0
        Math.sin(2 * Math.PI * 400 * i / 44100) * 0.05 + // Perfect 2nd harmonic
        Math.sin(2 * Math.PI * 600 * i / 44100) * 0.03;  // Perfect 3rd harmonic
    }
    return buffer;
  }

  function createArtificialVoiceFrequencyAnalysis(): FrequencyAnalysis {
    const frequencies = new Float32Array(512);
    const magnitudes = new Float32Array(512);
    
    for (let i = 0; i < frequencies.length; i++) {
      frequencies[i] = (i * 44100) / (2 * frequencies.length);
    }
    
    // Perfect harmonic structure (too perfect for human voice)
    for (let i = 0; i < magnitudes.length; i++) {
      const freq = frequencies[i];
      let magnitude = 0;
      
      if (Math.abs(freq - 200) < 5) magnitude = 1.0;
      if (Math.abs(freq - 400) < 5) magnitude = 0.5;
      if (Math.abs(freq - 600) < 5) magnitude = 0.25;
      
      magnitudes[i] = magnitude;
    }
    
    return {
      frequencies,
      magnitudes,
      phases: new Float32Array(512),
      dominantFrequency: 200,
      spectralCentroid: 400,
      spectralRolloff: 800,
      spectralFlux: 0.1, // Very low flux (too stable)
      mfcc: new Float32Array(13)
    };
  }

  function createMaleVoiceBuffer(): Float32Array {
    const buffer = new Float32Array(1024);
    // Simulate male voice with lower F0
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 
        Math.sin(2 * Math.PI * 120 * i / 44100) * 0.1 +  // Lower F0
        Math.sin(2 * Math.PI * 600 * i / 44100) * 0.04 + // Lower F1
        Math.sin(2 * Math.PI * 1000 * i / 44100) * 0.03; // Lower F2
    }
    return buffer;
  }

  function createMaleVoiceFrequencyAnalysis(): FrequencyAnalysis {
    const frequencies = new Float32Array(512);
    const magnitudes = new Float32Array(512);
    
    for (let i = 0; i < frequencies.length; i++) {
      frequencies[i] = (i * 44100) / (2 * frequencies.length);
    }
    
    // Male voice characteristics
    for (let i = 0; i < magnitudes.length; i++) {
      const freq = frequencies[i];
      let magnitude = 0;
      
      if (Math.abs(freq - 120) < 10) magnitude += 0.8; // Lower F0
      if (Math.abs(freq - 600) < 50) magnitude += 0.5; // Lower F1
      if (Math.abs(freq - 1000) < 50) magnitude += 0.4; // Lower F2
      
      magnitudes[i] = magnitude;
    }
    
    return {
      frequencies,
      magnitudes,
      phases: new Float32Array(512),
      dominantFrequency: 120,
      spectralCentroid: 800,
      spectralRolloff: 2500,
      spectralFlux: 0.25,
      mfcc: new Float32Array(13)
    };
  }

  function createVoiceChangerBuffer(): Float32Array {
    const buffer = new Float32Array(1024);
    // Simulate voice changer with unnatural formant shifts
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 
        Math.sin(2 * Math.PI * 150 * i / 44100) * 0.1 +   // Normal F0
        Math.sin(2 * Math.PI * 400 * i / 44100) * 0.08 +  // Shifted F1 (too low)
        Math.sin(2 * Math.PI * 3000 * i / 44100) * 0.06;  // Shifted F2 (too high)
    }
    return buffer;
  }

  function createVoiceChangerFrequencyAnalysis(): FrequencyAnalysis {
    const frequencies = new Float32Array(512);
    const magnitudes = new Float32Array(512);
    
    for (let i = 0; i < frequencies.length; i++) {
      frequencies[i] = (i * 44100) / (2 * frequencies.length);
    }
    
    // Unnatural formant ratios
    for (let i = 0; i < magnitudes.length; i++) {
      const freq = frequencies[i];
      let magnitude = 0;
      
      if (Math.abs(freq - 150) < 10) magnitude += 0.8;
      if (Math.abs(freq - 400) < 30) magnitude += 0.8; // Too close to F0
      if (Math.abs(freq - 3000) < 100) magnitude += 0.6; // Too high
      
      magnitudes[i] = magnitude;
    }
    
    return {
      frequencies,
      magnitudes,
      phases: new Float32Array(512),
      dominantFrequency: 150,
      spectralCentroid: 1500,
      spectralRolloff: 4000,
      spectralFlux: 0.2,
      mfcc: new Float32Array(13)
    };
  }

  function createMultipleVoicesBuffer(): Float32Array {
    const buffer = new Float32Array(1024);
    // Simulate multiple overlapping voices
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 
        Math.sin(2 * Math.PI * 150 * i / 44100) * 0.08 +  // Voice 1
        Math.sin(2 * Math.PI * 200 * i / 44100) * 0.06 +  // Voice 2
        Math.sin(2 * Math.PI * 800 * i / 44100) * 0.04 +  // Formants
        Math.sin(2 * Math.PI * 1100 * i / 44100) * 0.03;
    }
    return buffer;
  }

  function createMultipleVoicesFrequencyAnalysis(): FrequencyAnalysis {
    const frequencies = new Float32Array(512);
    const magnitudes = new Float32Array(512);
    
    for (let i = 0; i < frequencies.length; i++) {
      frequencies[i] = (i * 44100) / (2 * frequencies.length);
    }
    
    // Multiple fundamental frequencies
    for (let i = 0; i < magnitudes.length; i++) {
      const freq = frequencies[i];
      let magnitude = 0;
      
      if (Math.abs(freq - 150) < 10) magnitude += 0.6; // Voice 1 F0
      if (Math.abs(freq - 200) < 10) magnitude += 0.5; // Voice 2 F0
      if (Math.abs(freq - 800) < 50) magnitude += 0.4;
      if (Math.abs(freq - 1100) < 50) magnitude += 0.3;
      
      magnitudes[i] = magnitude;
    }
    
    return {
      frequencies,
      magnitudes,
      phases: new Float32Array(512),
      dominantFrequency: 150,
      spectralCentroid: 1000,
      spectralRolloff: 3000,
      spectralFlux: 0.6, // High flux due to overlapping voices
      mfcc: new Float32Array(13)
    };
  }

  function createNoiseBuffer(): Float32Array {
    const buffer = new Float32Array(1024);
    // Random noise
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = (Math.random() - 0.5) * 0.1;
    }
    return buffer;
  }

  function createNoiseFrequencyAnalysis(): FrequencyAnalysis {
    const frequencies = new Float32Array(512);
    const magnitudes = new Float32Array(512);
    
    for (let i = 0; i < frequencies.length; i++) {
      frequencies[i] = (i * 44100) / (2 * frequencies.length);
      magnitudes[i] = Math.random() * 0.1; // Flat noise spectrum
    }
    
    return {
      frequencies,
      magnitudes,
      phases: new Float32Array(512),
      dominantFrequency: 0,
      spectralCentroid: 2000,
      spectralRolloff: 8000,
      spectralFlux: 0.8, // High flux for noise
      mfcc: new Float32Array(13)
    };
  }

  function createHighQualityVoiceBuffer(): Float32Array {
    const buffer = new Float32Array(1024);
    // High quality voice with natural characteristics
    for (let i = 0; i < buffer.length; i++) {
      const jitter = 1 + 0.005 * Math.sin(i * 0.01); // Small natural jitter
      buffer[i] = 
        Math.sin(2 * Math.PI * 150 * jitter * i / 44100) * 0.1 +
        Math.sin(2 * Math.PI * 800 * i / 44100) * 0.05 +
        Math.sin(2 * Math.PI * 1200 * i / 44100) * 0.03 +
        (Math.random() - 0.5) * 0.005; // Very low noise
    }
    return buffer;
  }

  function createHighQualityVoiceFrequencyAnalysis(): FrequencyAnalysis {
    return createVoiceFrequencyAnalysis(); // Same as normal voice
  }

  function createPoorQualityVoiceBuffer(): Float32Array {
    const buffer = new Float32Array(1024);
    // Poor quality voice with high jitter and noise
    for (let i = 0; i < buffer.length; i++) {
      const jitter = 1 + 0.05 * Math.sin(i * 0.1); // High jitter
      buffer[i] = 
        Math.sin(2 * Math.PI * 150 * jitter * i / 44100) * 0.08 +
        Math.sin(2 * Math.PI * 800 * i / 44100) * 0.04 +
        (Math.random() - 0.5) * 0.05; // High noise
    }
    return buffer;
  }

  function createPoorQualityVoiceFrequencyAnalysis(): FrequencyAnalysis {
    const analysis = createVoiceFrequencyAnalysis();
    // Add noise to spectrum
    for (let i = 0; i < analysis.magnitudes.length; i++) {
      analysis.magnitudes[i] += Math.random() * 0.1;
    }
    analysis.spectralFlux = 0.8; // High flux due to noise
    return analysis;
  }
});