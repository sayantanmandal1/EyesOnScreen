/**
 * Audio monitoring system type definitions
 */

export interface AudioSignals {
  timestamp: number;
  voiceActivityDetected: boolean;
  voiceConfidence: number;
  backgroundConversation: boolean;
  whisperDetected: boolean;
  humanVoicePresent: boolean;
  phoneCallDetected: boolean;
  keyboardSoundsDetected: boolean;
  roomAcoustics: {
    reverberation: number;
    backgroundNoise: number;
    environmentType: 'quiet' | 'normal' | 'noisy' | 'public';
  };
  deviceSounds: {
    phoneVibration: boolean;
    notificationSounds: boolean;
    electronicBeeps: boolean;
  };
  audioFingerprint: {
    spectralCentroid: number;
    mfccFeatures: Float32Array;
    voicePrint: Float32Array;
  };
}

export interface AudioConfig {
  sampleRate: number;
  bufferSize: number;
  fftSize: number;
  smoothingTimeConstant: number;
  thresholds: {
    voiceActivity: number;
    whisperLevel: number;
    backgroundConversation: number;
    keyboardSounds: number;
    phoneCall: number;
  };
  calibration: {
    baselineNoise: number;
    voicePrintReference: Float32Array | null;
    environmentBaseline: number;
  };
}

export interface VoiceActivityResult {
  isActive: boolean;
  confidence: number;
  energyLevel: number;
  spectralFeatures: {
    centroid: number;
    rolloff: number;
    flux: number;
  };
}

export interface AudioAnalysisResult {
  voiceActivity: VoiceActivityResult;
  conversationDetected: boolean;
  whisperDetected: boolean;
  humanVoiceClassification: {
    isHuman: boolean;
    confidence: number;
    voiceCharacteristics: {
      pitch: number;
      formants: number[];
      harmonicity: number;
    };
  };
  environmentAnalysis: {
    acousticFingerprint: Float32Array;
    reverbTime: number;
    backgroundNoiseLevel: number;
    roomSize: 'small' | 'medium' | 'large' | 'outdoor';
  };
  deviceDetection: {
    phoneCall: boolean;
    keyboardTyping: boolean;
    electronicDevices: string[];
  };
}

export interface AudioCalibrationProfile {
  baselineNoise: Float32Array;
  voiceReference: Float32Array;
  environmentSignature: Float32Array;
  microphoneCharacteristics: {
    sensitivity: number;
    frequencyResponse: Float32Array;
    noiseFloor: number;
  };
  roomAcoustics: {
    reverbTime: number;
    backgroundLevel: number;
    acousticSignature: Float32Array;
  };
  quality: number;
}

export interface AudioEvent {
  id: string;
  timestamp: number;
  type: 'VOICE_DETECTED' | 'CONVERSATION' | 'WHISPER' | 'PHONE_CALL' | 
        'KEYBOARD_SOUNDS' | 'DEVICE_DETECTED' | 'ENVIRONMENT_CHANGE';
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  details: {
    duration: number;
    audioFeatures: Partial<AudioSignals>;
    classification: string;
  };
}

export interface AudioProcessorConfig {
  enabled: boolean;
  continuousMonitoring: boolean;
  voiceActivityDetection: boolean;
  conversationDetection: boolean;
  whisperDetection: boolean;
  deviceDetection: boolean;
  environmentMonitoring: boolean;
  fingerprintingEnabled: boolean;
}

export interface AudioBuffer {
  data: Float32Array;
  timestamp: number;
  sampleRate: number;
}

export interface FrequencyAnalysis {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  phases: Float32Array;
  dominantFrequency: number;
  spectralCentroid: number;
  spectralRolloff: number;
  spectralFlux: number;
  mfcc: Float32Array;
}

export interface AudioError extends Error {
  code: 'MICROPHONE_ACCESS_DENIED' | 'AUDIO_CONTEXT_ERROR' | 
        'PROCESSING_ERROR' | 'CALIBRATION_FAILED' | 'DEVICE_NOT_FOUND';
  details?: Record<string, unknown>;
}