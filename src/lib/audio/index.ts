/**
 * Audio monitoring system exports
 */

export { AudioProcessor } from './AudioProcessor';
export { VoiceActivityDetector } from './VoiceActivityDetector';
export { AudioAnalyzer } from './AudioAnalyzer';
export { AudioFingerprinter } from './AudioFingerprinter';
export { AudioMonitoringSystem, createAudioMonitoringSystem } from './AudioMonitoringSystem';
export { HumanVoiceClassifier } from './HumanVoiceClassifier';
export { PhoneCallDetector } from './PhoneCallDetector';
export { KeyboardSoundDetector } from './KeyboardSoundDetector';
export { RoomAcousticsAnalyzer } from './RoomAcousticsAnalyzer';

export type {
  AudioSignals,
  AudioConfig,
  AudioBuffer,
  FrequencyAnalysis,
  VoiceActivityResult,
  AudioAnalysisResult,
  AudioCalibrationProfile,
  AudioEvent,
  AudioProcessorConfig,
  AudioError
} from './types';

// Default configurations
export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
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

export const DEFAULT_PROCESSOR_CONFIG: AudioProcessorConfig = {
  enabled: true,
  continuousMonitoring: true,
  voiceActivityDetection: true,
  conversationDetection: true,
  whisperDetection: true,
  deviceDetection: true,
  environmentMonitoring: true,
  fingerprintingEnabled: true
};

// Utility functions
export function createDefaultAudioMonitoringSystem(): AudioMonitoringSystem {
  return new AudioMonitoringSystem(DEFAULT_AUDIO_CONFIG, DEFAULT_PROCESSOR_CONFIG);
}

export function isAudioSupported(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && 
           (window.AudioContext || (window as any).webkitAudioContext));
}

export function getAudioConstraints(config: AudioConfig) {
  return {
    audio: {
      sampleRate: config.sampleRate,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  };
}