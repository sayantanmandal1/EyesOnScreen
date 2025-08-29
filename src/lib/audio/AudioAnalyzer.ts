/**
 * Comprehensive audio analysis system for detecting various audio patterns and sources
 */

import { AudioAnalysisResult, AudioBuffer, FrequencyAnalysis, AudioConfig } from './types';
import { HumanVoiceClassifier } from './HumanVoiceClassifier';
import { PhoneCallDetector } from './PhoneCallDetector';
import { KeyboardSoundDetector } from './KeyboardSoundDetector';
import { RoomAcousticsAnalyzer } from './RoomAcousticsAnalyzer';

export class AudioAnalyzer {
  private config: AudioConfig;
  private humanVoiceClassifier: HumanVoiceClassifier;
  private phoneCallDetector: PhoneCallDetector;
  private keyboardSoundDetector: KeyboardSoundDetector;
  private roomAcousticsAnalyzer: RoomAcousticsAnalyzer;
  private phoneCallPatterns: Map<string, number> = new Map();
  private keyboardSignatures: Float32Array[] = [];
  private deviceSignatures: Map<string, Float32Array> = new Map();
  private environmentBaseline: Float32Array | null = null;

  constructor(config: AudioConfig) {
    this.config = config;
    this.humanVoiceClassifier = new HumanVoiceClassifier(config);
    this.phoneCallDetector = new PhoneCallDetector(config);
    this.keyboardSoundDetector = new KeyboardSoundDetector(config);
    this.roomAcousticsAnalyzer = new RoomAcousticsAnalyzer(config);
    this.initializeSignatureDatabase();
  }

  private initializeSignatureDatabase(): void {
    // Initialize known audio signatures for various devices and sounds
    this.initializePhoneCallPatterns();
    this.initializeKeyboardSignatures();
    this.initializeDeviceSignatures();
  }

  analyzeAudio(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): AudioAnalysisResult {
    // Perform comprehensive audio analysis using specialized analyzers
    const voiceActivity = this.analyzeVoiceActivity(buffer, frequencyAnalysis);
    const conversationDetected = this.detectConversation(buffer, frequencyAnalysis);
    const whisperDetected = this.detectWhisper(buffer, frequencyAnalysis);
    
    // Use specialized classifiers for detailed analysis
    const humanVoiceClassification = this.humanVoiceClassifier.classifyVoice(buffer, frequencyAnalysis);
    const phoneCallAnalysis = this.phoneCallDetector.detectPhoneCall(buffer, frequencyAnalysis);
    const keyboardAnalysis = this.keyboardSoundDetector.detectKeyboardSound(buffer, frequencyAnalysis);
    const roomAcoustics = this.roomAcousticsAnalyzer.analyzeRoomAcoustics(buffer, frequencyAnalysis);
    
    // Legacy device detection for compatibility
    const deviceDetection = this.detectDevices(buffer, frequencyAnalysis);
    
    // Enhanced environment analysis
    const environmentAnalysis = {
      acousticFingerprint: roomAcoustics.spatialCharacteristics.acousticCenter ? 
        new Float32Array([roomAcoustics.spatialCharacteristics.acousticCenter]) : new Float32Array(32),
      reverbTime: roomAcoustics.reverberation.rt60,
      backgroundNoiseLevel: roomAcoustics.backgroundNoise.level,
      roomSize: roomAcoustics.roomCharacteristics.size
    };

    return {
      voiceActivity,
      conversationDetected,
      whisperDetected,
      humanVoiceClassification: {
        isHuman: humanVoiceClassification.isHuman,
        confidence: humanVoiceClassification.confidence,
        voiceCharacteristics: {
          pitch: 150, // Placeholder - would extract from voice analysis
          formants: [800, 1200, 2500], // Placeholder
          harmonicity: humanVoiceClassification.voiceQuality.naturalness
        }
      },
      environmentAnalysis,
      deviceDetection: {
        phoneCall: phoneCallAnalysis.isPhoneCall,
        keyboardTyping: keyboardAnalysis.isKeyboardSound,
        electronicDevices: roomAcoustics.backgroundNoise.sources
      }
    };
  }

  private analyzeVoiceActivity(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis) {
    const energy = this.calculateRMSEnergy(buffer.data);
    const spectralFeatures = this.extractSpectralFeatures(frequencyAnalysis);
    
    // Multi-criteria voice activity detection
    const energyScore = this.evaluateEnergyForVoice(energy);
    const spectralScore = this.evaluateSpectralFeaturesForVoice(spectralFeatures);
    const harmonicScore = this.evaluateHarmonicContent(frequencyAnalysis);
    
    const confidence = (energyScore * 0.4 + spectralScore * 0.4 + harmonicScore * 0.2);
    const isActive = confidence > this.config.thresholds.voiceActivity;

    return {
      isActive,
      confidence,
      energyLevel: energy,
      spectralFeatures
    };
  }

  private detectConversation(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): boolean {
    // Detect multiple speakers or conversation patterns
    const multipleVoices = this.detectMultipleVoices(frequencyAnalysis);
    const conversationRhythm = this.detectConversationRhythm(buffer);
    const overlappingSpeech = this.detectOverlappingSpeech(frequencyAnalysis);
    
    return multipleVoices || conversationRhythm || overlappingSpeech;
  }

  private detectWhisper(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): boolean {
    const energy = this.calculateRMSEnergy(buffer.data);
    
    // Whisper characteristics
    const lowEnergy = energy < this.config.thresholds.whisperLevel;
    const speechSpectrum = this.hasSpeechSpectrum(frequencyAnalysis);
    const breathiness = this.detectBreathiness(frequencyAnalysis);
    const highFreqEmphasis = this.hasHighFrequencyEmphasis(frequencyAnalysis);
    
    return lowEnergy && speechSpectrum && (breathiness || highFreqEmphasis);
  }

  private classifyHumanVoice(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis) {
    const voiceCharacteristics = this.analyzeVoiceCharacteristics(frequencyAnalysis);
    const isHuman = this.isHumanVoice(voiceCharacteristics, frequencyAnalysis);
    const confidence = this.calculateHumanVoiceConfidence(voiceCharacteristics);

    return {
      isHuman,
      confidence,
      voiceCharacteristics
    };
  }

  private analyzeEnvironment(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis) {
    const acousticFingerprint = this.generateAcousticFingerprint(frequencyAnalysis);
    const reverbTime = this.estimateReverbTime(buffer);
    const backgroundNoiseLevel = this.calculateBackgroundNoise(frequencyAnalysis);
    const roomSize = this.estimateRoomSize(reverbTime, backgroundNoiseLevel);

    return {
      acousticFingerprint,
      reverbTime,
      backgroundNoiseLevel,
      roomSize
    };
  }

  private detectDevices(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis) {
    const phoneCall = this.detectPhoneCall(frequencyAnalysis);
    const keyboardTyping = this.detectKeyboardTyping(buffer, frequencyAnalysis);
    const electronicDevices = this.detectElectronicDevices(frequencyAnalysis);

    return {
      phoneCall,
      keyboardTyping,
      electronicDevices
    };
  }

  // Phone call detection methods
  private initializePhoneCallPatterns(): void {
    // Common phone call audio characteristics
    this.phoneCallPatterns.set('bandwidth_limitation', 3400); // Hz
    this.phoneCallPatterns.set('low_cutoff', 300); // Hz
    this.phoneCallPatterns.set('compression_ratio', 0.7);
    this.phoneCallPatterns.set('codec_artifacts', 0.3);
  }

  private detectPhoneCall(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Phone calls have characteristic bandwidth limitations and compression artifacts
    const bandwidthLimited = this.isBandwidthLimited(frequencyAnalysis);
    const compressionArtifacts = this.detectCompressionArtifacts(frequencyAnalysis);
    const phoneFrequencyResponse = this.hasPhoneFrequencyResponse(frequencyAnalysis);
    
    return bandwidthLimited && (compressionArtifacts || phoneFrequencyResponse);
  }

  private isBandwidthLimited(frequencyAnalysis: FrequencyAnalysis): boolean {
    const phoneRange = this.getEnergyInRange(frequencyAnalysis, 300, 3400);
    const fullRange = this.getTotalEnergy(frequencyAnalysis);
    const ratio = phoneRange / Math.max(fullRange, 0.001);
    
    return ratio > 0.85; // Most energy in phone bandwidth
  }

  private detectCompressionArtifacts(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Look for compression artifacts like quantization noise
    const highFreqNoise = this.getEnergyInRange(frequencyAnalysis, 3000, 4000);
    const midFreqEnergy = this.getEnergyInRange(frequencyAnalysis, 1000, 3000);
    
    return highFreqNoise > midFreqEnergy * 0.1 && frequencyAnalysis.spectralFlux < 0.3;
  }

  private hasPhoneFrequencyResponse(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Phone calls often have characteristic frequency response curves
    const lowEnd = this.getEnergyInRange(frequencyAnalysis, 300, 800);
    const midRange = this.getEnergyInRange(frequencyAnalysis, 800, 2000);
    const highEnd = this.getEnergyInRange(frequencyAnalysis, 2000, 3400);
    
    // Typical phone response: mid-range emphasis
    return midRange > lowEnd && midRange > highEnd;
  }

  // Keyboard detection methods
  private initializeKeyboardSignatures(): void {
    // Create signature patterns for different keyboard types
    const mechanicalSignature = new Float32Array(64);
    const membraneSignature = new Float32Array(64);
    
    // Mechanical keyboards: sharp transients, broad spectrum
    for (let i = 0; i < 32; i++) {
      mechanicalSignature[i] = Math.exp(-i * 0.1); // High frequency emphasis
    }
    
    // Membrane keyboards: softer transients, limited spectrum
    for (let i = 0; i < 16; i++) {
      membraneSignature[i] = Math.exp(-i * 0.2);
    }
    
    this.keyboardSignatures.push(mechanicalSignature, membraneSignature);
  }

  private detectKeyboardTyping(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): boolean {
    const transientDetected = this.detectTransients(buffer);
    const keyboardSpectrum = this.hasKeyboardSpectrum(frequencyAnalysis);
    const rhythmicPattern = this.detectTypingRhythm(buffer);
    
    return transientDetected && keyboardSpectrum && rhythmicPattern;
  }

  private detectTransients(buffer: AudioBuffer): boolean {
    // Look for sharp attack characteristics typical of key presses
    const attackTime = this.calculateAttackTime(buffer.data);
    const peakEnergy = Math.max(...Array.from(buffer.data).map(Math.abs));
    
    return attackTime < 0.01 && peakEnergy > 0.1; // Fast attack, sufficient energy
  }

  private hasKeyboardSpectrum(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Keyboard sounds have characteristic spectral signatures
    const clickEnergy = this.getEnergyInRange(frequencyAnalysis, 2000, 8000);
    const totalEnergy = this.getTotalEnergy(frequencyAnalysis);
    
    return clickEnergy / Math.max(totalEnergy, 0.001) > 0.3;
  }

  private detectTypingRhythm(buffer: AudioBuffer): boolean {
    // Typing has characteristic rhythmic patterns
    // This would require temporal analysis across multiple buffers
    return true; // Simplified - would need buffer history for proper implementation
  }

  // Electronic device detection methods
  private initializeDeviceSignatures(): void {
    // Phone vibration signature
    const vibrationSignature = new Float32Array(32);
    for (let i = 0; i < 8; i++) {
      vibrationSignature[i] = 1.0; // Low frequency emphasis
    }
    this.deviceSignatures.set('phone_vibration', vibrationSignature);
    
    // Notification beep signature
    const beepSignature = new Float32Array(32);
    beepSignature[16] = 1.0; // Pure tone around 1kHz
    this.deviceSignatures.set('notification_beep', beepSignature);
    
    // Electronic interference signature
    const interferenceSignature = new Float32Array(32);
    for (let i = 0; i < 32; i += 4) {
      interferenceSignature[i] = 0.5; // Harmonic pattern
    }
    this.deviceSignatures.set('electronic_interference', interferenceSignature);
  }

  private detectElectronicDevices(frequencyAnalysis: FrequencyAnalysis): string[] {
    const detectedDevices: string[] = [];
    
    // Check for phone vibration
    if (this.detectPhoneVibration(frequencyAnalysis)) {
      detectedDevices.push('phone_vibration');
    }
    
    // Check for notification sounds
    if (this.detectNotificationSounds(frequencyAnalysis)) {
      detectedDevices.push('notification_sound');
    }
    
    // Check for electronic interference
    if (this.detectElectronicInterference(frequencyAnalysis)) {
      detectedDevices.push('electronic_interference');
    }
    
    return detectedDevices;
  }

  private detectPhoneVibration(frequencyAnalysis: FrequencyAnalysis): boolean {
    const lowFreqEnergy = this.getEnergyInRange(frequencyAnalysis, 20, 200);
    const totalEnergy = this.getTotalEnergy(frequencyAnalysis);
    
    return lowFreqEnergy / Math.max(totalEnergy, 0.001) > 0.4;
  }

  private detectNotificationSounds(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Notification sounds are often pure tones or simple melodies
    const pureTones = this.detectPureTones(frequencyAnalysis);
    const melodicPattern = this.detectMelodicPattern(frequencyAnalysis);
    
    return pureTones || melodicPattern;
  }

  private detectElectronicInterference(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Electronic devices often produce harmonic interference
    const harmonicPattern = this.detectHarmonicInterference(frequencyAnalysis);
    const switchingNoise = this.detectSwitchingNoise(frequencyAnalysis);
    
    return harmonicPattern || switchingNoise;
  }

  // Voice analysis helper methods
  private analyzeVoiceCharacteristics(frequencyAnalysis: FrequencyAnalysis) {
    const pitch = this.estimatePitch(frequencyAnalysis);
    const formants = this.extractFormants(frequencyAnalysis);
    const harmonicity = this.calculateHarmonicity(frequencyAnalysis);
    
    return { pitch, formants, harmonicity };
  }

  private isHumanVoice(characteristics: any, frequencyAnalysis: FrequencyAnalysis): boolean {
    const validPitch = characteristics.pitch >= 80 && characteristics.pitch <= 400;
    const hasFormants = characteristics.formants.length >= 2;
    const goodHarmonicity = characteristics.harmonicity > 0.6;
    const speechSpectrum = this.hasSpeechSpectrum(frequencyAnalysis);
    
    return validPitch && hasFormants && goodHarmonicity && speechSpectrum;
  }

  private calculateHumanVoiceConfidence(characteristics: any): number {
    let confidence = 0;
    
    // Pitch confidence
    if (characteristics.pitch >= 80 && characteristics.pitch <= 400) {
      confidence += 0.3;
    }
    
    // Formant confidence
    confidence += Math.min(0.3, characteristics.formants.length * 0.1);
    
    // Harmonicity confidence
    confidence += characteristics.harmonicity * 0.4;
    
    return Math.min(1.0, confidence);
  }

  // Utility methods
  private calculateRMSEnergy(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  private extractSpectralFeatures(frequencyAnalysis: FrequencyAnalysis) {
    return {
      centroid: frequencyAnalysis.spectralCentroid,
      rolloff: frequencyAnalysis.spectralRolloff,
      flux: frequencyAnalysis.spectralFlux
    };
  }

  private evaluateEnergyForVoice(energy: number): number {
    // Voice energy is typically in a specific range
    if (energy < 0.01) return 0;
    if (energy > 0.5) return 0.3; // Too loud, might be noise
    return Math.min(1.0, energy * 5); // Scale appropriately
  }

  private evaluateSpectralFeaturesForVoice(features: any): number {
    let score = 0;
    
    // Spectral centroid should be in voice range
    if (features.centroid > 500 && features.centroid < 3000) {
      score += 0.5;
    }
    
    // Spectral rolloff should indicate voice content
    if (features.rolloff > 1000 && features.rolloff < 4000) {
      score += 0.3;
    }
    
    // Spectral flux indicates dynamic content
    if (features.flux > 0.1 && features.flux < 1.0) {
      score += 0.2;
    }
    
    return score;
  }

  private evaluateHarmonicContent(frequencyAnalysis: FrequencyAnalysis): number {
    const harmonics = this.detectHarmonics(frequencyAnalysis);
    return harmonics ? 1.0 : 0.2;
  }

  private detectHarmonics(frequencyAnalysis: FrequencyAnalysis): boolean {
    const fundamental = frequencyAnalysis.dominantFrequency;
    if (fundamental < 80 || fundamental > 400) return false;
    
    let harmonicCount = 0;
    for (let h = 2; h <= 5; h++) {
      const harmonicFreq = fundamental * h;
      const energy = this.getEnergyAtFrequency(frequencyAnalysis, harmonicFreq, 20);
      if (energy > 0.1) harmonicCount++;
    }
    
    return harmonicCount >= 2;
  }

  private getEnergyInRange(frequencyAnalysis: FrequencyAnalysis, minFreq: number, maxFreq: number): number {
    let energy = 0;
    for (let i = 0; i < frequencyAnalysis.frequencies.length; i++) {
      const freq = frequencyAnalysis.frequencies[i];
      if (freq >= minFreq && freq <= maxFreq) {
        energy += frequencyAnalysis.magnitudes[i] * frequencyAnalysis.magnitudes[i];
      }
    }
    return energy;
  }

  private getTotalEnergy(frequencyAnalysis: FrequencyAnalysis): number {
    return frequencyAnalysis.magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
  }

  private getEnergyAtFrequency(frequencyAnalysis: FrequencyAnalysis, targetFreq: number, bandwidth: number): number {
    let energy = 0;
    let count = 0;
    
    for (let i = 0; i < frequencyAnalysis.frequencies.length; i++) {
      const freq = frequencyAnalysis.frequencies[i];
      if (Math.abs(freq - targetFreq) <= bandwidth) {
        energy += frequencyAnalysis.magnitudes[i] * frequencyAnalysis.magnitudes[i];
        count++;
      }
    }
    
    return count > 0 ? energy / count : 0;
  }

  // Additional helper methods (simplified implementations)
  private detectMultipleVoices(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Look for multiple fundamental frequencies
    const peaks = this.findSpectralPeaks(frequencyAnalysis.magnitudes, 0.1);
    const voicePeaks = peaks.filter(peak => {
      const freq = frequencyAnalysis.frequencies[peak];
      return freq >= 80 && freq <= 400;
    });
    return voicePeaks.length > 1;
  }

  private detectConversationRhythm(buffer: AudioBuffer): boolean {
    // Simplified - would need temporal analysis
    return false;
  }

  private detectOverlappingSpeech(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Look for complex spectral patterns indicating overlapping voices
    return frequencyAnalysis.spectralFlux > 0.7;
  }

  private hasSpeechSpectrum(frequencyAnalysis: FrequencyAnalysis): boolean {
    const speechEnergy = this.getEnergyInRange(frequencyAnalysis, 300, 3400);
    const totalEnergy = this.getTotalEnergy(frequencyAnalysis);
    return speechEnergy / Math.max(totalEnergy, 0.001) > 0.6;
  }

  private detectBreathiness(frequencyAnalysis: FrequencyAnalysis): boolean {
    const noiseLevel = this.estimateNoiseLevel(frequencyAnalysis);
    const highFreqNoise = this.getEnergyInRange(frequencyAnalysis, 4000, 8000);
    return highFreqNoise > noiseLevel * 2;
  }

  private hasHighFrequencyEmphasis(frequencyAnalysis: FrequencyAnalysis): boolean {
    const highFreq = this.getEnergyInRange(frequencyAnalysis, 2000, 8000);
    const midFreq = this.getEnergyInRange(frequencyAnalysis, 500, 2000);
    return highFreq > midFreq * 0.5;
  }

  private estimatePitch(frequencyAnalysis: FrequencyAnalysis): number {
    return frequencyAnalysis.dominantFrequency;
  }

  private extractFormants(frequencyAnalysis: FrequencyAnalysis): number[] {
    // Simplified formant extraction
    const formants: number[] = [];
    const peaks = this.findSpectralPeaks(frequencyAnalysis.magnitudes, 0.1);
    
    for (const peak of peaks.slice(0, 4)) {
      const freq = frequencyAnalysis.frequencies[peak];
      if (freq > 200 && freq < 4000) {
        formants.push(freq);
      }
    }
    
    return formants.sort((a, b) => a - b);
  }

  private calculateHarmonicity(frequencyAnalysis: FrequencyAnalysis): number {
    const harmonics = this.detectHarmonics(frequencyAnalysis);
    return harmonics ? 0.8 : 0.2;
  }

  private generateAcousticFingerprint(frequencyAnalysis: FrequencyAnalysis): Float32Array {
    // Create a compact acoustic fingerprint
    const fingerprint = new Float32Array(32);
    const binSize = Math.floor(frequencyAnalysis.magnitudes.length / 32);
    
    for (let i = 0; i < 32; i++) {
      let sum = 0;
      for (let j = 0; j < binSize; j++) {
        const idx = i * binSize + j;
        if (idx < frequencyAnalysis.magnitudes.length) {
          sum += frequencyAnalysis.magnitudes[idx];
        }
      }
      fingerprint[i] = sum / binSize;
    }
    
    return fingerprint;
  }

  private estimateReverbTime(buffer: AudioBuffer): number {
    // Simplified reverberation time estimation
    const energy = this.calculateRMSEnergy(buffer.data);
    return Math.min(2.0, energy * 4); // Placeholder calculation
  }

  private calculateBackgroundNoise(frequencyAnalysis: FrequencyAnalysis): number {
    return this.estimateNoiseLevel(frequencyAnalysis);
  }

  private estimateRoomSize(reverbTime: number, noiseLevel: number): 'small' | 'medium' | 'large' | 'outdoor' {
    if (reverbTime > 1.5) return 'large';
    if (reverbTime > 0.8) return 'medium';
    if (noiseLevel > 0.3) return 'outdoor';
    return 'small';
  }

  private calculateAttackTime(buffer: Float32Array): number {
    // Find time to reach peak from start
    const peak = Math.max(...Array.from(buffer).map(Math.abs));
    const threshold = peak * 0.9;
    
    for (let i = 0; i < buffer.length; i++) {
      if (Math.abs(buffer[i]) >= threshold) {
        return i / 44100; // Assuming 44.1kHz sample rate
      }
    }
    
    return 1.0; // Default if no peak found
  }

  private detectPureTones(frequencyAnalysis: FrequencyAnalysis): boolean {
    const peaks = this.findSpectralPeaks(frequencyAnalysis.magnitudes, 0.2);
    return peaks.length <= 3 && peaks.length > 0;
  }

  private detectMelodicPattern(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Simplified melodic pattern detection
    return frequencyAnalysis.spectralCentroid > 1000 && frequencyAnalysis.spectralFlux > 0.3;
  }

  private detectHarmonicInterference(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Look for regular harmonic spacing
    const peaks = this.findSpectralPeaks(frequencyAnalysis.magnitudes, 0.1);
    if (peaks.length < 3) return false;
    
    // Check for regular spacing
    const spacings: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const freq1 = frequencyAnalysis.frequencies[peaks[i - 1]];
      const freq2 = frequencyAnalysis.frequencies[peaks[i]];
      spacings.push(freq2 - freq1);
    }
    
    // Check if spacings are approximately equal (harmonic)
    const avgSpacing = spacings.reduce((sum, s) => sum + s, 0) / spacings.length;
    const variance = spacings.reduce((sum, s) => sum + (s - avgSpacing) ** 2, 0) / spacings.length;
    
    return variance < avgSpacing * 0.1; // Low variance indicates regular spacing
  }

  private detectSwitchingNoise(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Switching power supplies create characteristic noise patterns
    const highFreqNoise = this.getEnergyInRange(frequencyAnalysis, 10000, 20000);
    const totalEnergy = this.getTotalEnergy(frequencyAnalysis);
    
    return highFreqNoise / Math.max(totalEnergy, 0.001) > 0.1;
  }

  private findSpectralPeaks(magnitudes: Float32Array, threshold: number): number[] {
    const peaks: number[] = [];
    
    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (magnitudes[i] > threshold &&
          magnitudes[i] > magnitudes[i - 1] &&
          magnitudes[i] > magnitudes[i + 1]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }

  private estimateNoiseLevel(frequencyAnalysis: FrequencyAnalysis): number {
    const sortedMagnitudes = Array.from(frequencyAnalysis.magnitudes).sort((a, b) => a - b);
    const noiseFloor = sortedMagnitudes.slice(0, Math.floor(sortedMagnitudes.length * 0.1));
    return noiseFloor.reduce((sum, mag) => sum + mag, 0) / noiseFloor.length;
  }
}