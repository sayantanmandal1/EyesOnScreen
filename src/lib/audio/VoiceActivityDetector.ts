/**
 * Advanced Voice Activity Detection (VAD) system
 */

import { VoiceActivityResult, AudioBuffer, FrequencyAnalysis, AudioConfig } from './types';

export class VoiceActivityDetector {
  private config: AudioConfig;
  private energyHistory: number[] = [];
  private spectralHistory: number[] = [];
  private voiceBaseline: number = 0;
  private noiseBaseline: number = 0;
  private isCalibrated = false;

  constructor(config: AudioConfig) {
    this.config = config;
  }

  calibrate(audioSamples: AudioBuffer[]): void {
    if (audioSamples.length < 10) {
      throw new Error('Insufficient samples for VAD calibration');
    }

    let totalEnergy = 0;
    let totalSpectral = 0;
    const energies: number[] = [];

    // Analyze calibration samples
    for (const sample of audioSamples) {
      const energy = this.calculateRMSEnergy(sample.data);
      const spectralCentroid = this.calculateSpectralCentroid(sample.data);
      
      energies.push(energy);
      totalEnergy += energy;
      totalSpectral += spectralCentroid;
    }

    // Set baselines
    this.noiseBaseline = Math.min(...energies);
    this.voiceBaseline = totalEnergy / audioSamples.length;
    
    // Adjust thresholds based on environment
    const dynamicRange = Math.max(...energies) - Math.min(...energies);
    this.config.thresholds.voiceActivity = this.noiseBaseline + (dynamicRange * 0.3);
    
    this.isCalibrated = true;
  }

  detectVoiceActivity(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): VoiceActivityResult {
    const energy = this.calculateRMSEnergy(buffer.data);
    const spectralFeatures = this.extractSpectralFeatures(buffer.data, frequencyAnalysis);
    
    // Update history
    this.energyHistory.push(energy);
    this.spectralHistory.push(spectralFeatures.centroid);
    
    if (this.energyHistory.length > 50) {
      this.energyHistory.shift();
      this.spectralHistory.shift();
    }

    // Multi-criteria voice activity detection
    const energyCriterion = this.evaluateEnergyCriterion(energy);
    const spectralCriterion = this.evaluateSpectralCriterion(spectralFeatures);
    const temporalCriterion = this.evaluateTemporalCriterion();
    const harmonicityCriterion = this.evaluateHarmonicityCriterion(frequencyAnalysis);

    // Combine criteria with weights
    const confidence = (
      energyCriterion * 0.3 +
      spectralCriterion * 0.25 +
      temporalCriterion * 0.2 +
      harmonicityCriterion * 0.25
    );

    const isActive = confidence > this.config.thresholds.voiceActivity;

    return {
      isActive,
      confidence: Math.min(1.0, Math.max(0.0, confidence)),
      energyLevel: energy,
      spectralFeatures
    };
  }

  detectBackgroundConversation(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): boolean {
    // Look for multiple overlapping voice signatures
    const multipleVoiceIndicators = this.detectMultipleVoiceSignatures(frequencyAnalysis);
    const conversationPatterns = this.detectConversationPatterns(buffer, frequencyAnalysis);
    const spatialCues = this.detectSpatialVoiceCues(buffer);

    return multipleVoiceIndicators || conversationPatterns || spatialCues;
  }

  detectWhisperSpeech(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): boolean {
    const energy = this.calculateRMSEnergy(buffer.data);
    const spectralFeatures = this.extractSpectralFeatures(buffer.data, frequencyAnalysis);

    // Whisper characteristics
    const lowEnergy = energy < this.config.thresholds.whisperLevel;
    const speechLikeSpectrum = this.hasSpeechLikeSpectrum(frequencyAnalysis);
    const highFrequencyEmphasis = this.hasHighFrequencyEmphasis(frequencyAnalysis);
    const breathinessIndicator = this.detectBreathiness(frequencyAnalysis);

    return lowEnergy && speechLikeSpectrum && (highFrequencyEmphasis || breathinessIndicator);
  }

  private calculateRMSEnergy(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  private calculateSpectralCentroid(buffer: Float32Array): number {
    // Simplified spectral centroid calculation
    const fftSize = Math.min(1024, buffer.length);
    const spectrum = this.performFFT(buffer.slice(0, fftSize));
    
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length / 2; i++) {
      const magnitude = Math.sqrt(spectrum[i * 2] ** 2 + spectrum[i * 2 + 1] ** 2);
      const frequency = (i * this.config.sampleRate) / fftSize;
      
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private performFFT(buffer: Float32Array): Float32Array {
    // Simplified FFT implementation - in production, use a proper FFT library
    const N = buffer.length;
    const result = new Float32Array(N * 2);
    
    for (let k = 0; k < N; k++) {
      let realSum = 0;
      let imagSum = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        realSum += buffer[n] * Math.cos(angle);
        imagSum += buffer[n] * Math.sin(angle);
      }
      
      result[k * 2] = realSum;
      result[k * 2 + 1] = imagSum;
    }
    
    return result;
  }

  private extractSpectralFeatures(buffer: Float32Array, frequencyAnalysis: FrequencyAnalysis) {
    return {
      centroid: frequencyAnalysis.spectralCentroid,
      rolloff: frequencyAnalysis.spectralRolloff,
      flux: frequencyAnalysis.spectralFlux
    };
  }

  private evaluateEnergyCriterion(energy: number): number {
    if (!this.isCalibrated) return energy > 0.01 ? 0.5 : 0;
    
    const normalizedEnergy = (energy - this.noiseBaseline) / Math.max(this.voiceBaseline - this.noiseBaseline, 0.001);
    return Math.min(1.0, Math.max(0.0, normalizedEnergy));
  }

  private evaluateSpectralCriterion(spectralFeatures: any): number {
    // Voice typically has spectral centroid in 500-3000 Hz range
    const centroidScore = spectralFeatures.centroid > 500 && spectralFeatures.centroid < 3000 ? 1.0 : 0.3;
    
    // Voice has moderate spectral rolloff
    const rolloffScore = spectralFeatures.rolloff > 1000 && spectralFeatures.rolloff < 4000 ? 1.0 : 0.5;
    
    return (centroidScore + rolloffScore) / 2;
  }

  private evaluateTemporalCriterion(): number {
    if (this.energyHistory.length < 5) return 0.5;
    
    // Voice has temporal continuity
    const recentEnergy = this.energyHistory.slice(-5);
    const variance = this.calculateVariance(recentEnergy);
    const mean = recentEnergy.reduce((sum, val) => sum + val, 0) / recentEnergy.length;
    
    // Voice should have moderate variance (not too stable like noise, not too chaotic)
    const normalizedVariance = variance / Math.max(mean, 0.001);
    const temporalScore = normalizedVariance > 0.1 && normalizedVariance < 2.0 ? 1.0 : 0.3;
    
    return temporalScore;
  }

  private evaluateHarmonicityCriterion(frequencyAnalysis: FrequencyAnalysis): number {
    // Look for harmonic structure typical of voiced speech
    const harmonics = this.detectHarmonics(frequencyAnalysis);
    const fundamentalFreq = frequencyAnalysis.dominantFrequency;
    
    // Human voice fundamental frequency range
    const validFundamental = fundamentalFreq >= 80 && fundamentalFreq <= 400;
    
    return (harmonics ? 0.7 : 0.2) + (validFundamental ? 0.3 : 0);
  }

  private detectHarmonics(frequencyAnalysis: FrequencyAnalysis): boolean {
    const fundamental = frequencyAnalysis.dominantFrequency;
    if (fundamental < 80 || fundamental > 400) return false;
    
    // Look for energy at harmonic frequencies
    let harmonicCount = 0;
    for (let harmonic = 2; harmonic <= 5; harmonic++) {
      const harmonicFreq = fundamental * harmonic;
      const energy = this.getEnergyAtFrequency(frequencyAnalysis, harmonicFreq, 20);
      if (energy > 0.1) harmonicCount++;
    }
    
    return harmonicCount >= 2;
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

  private detectMultipleVoiceSignatures(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Look for multiple fundamental frequencies
    const peaks = this.findSpectralPeaks(frequencyAnalysis.magnitudes, 0.1);
    const voicePeaks = peaks.filter(peak => {
      const freq = frequencyAnalysis.frequencies[peak];
      return freq >= 80 && freq <= 400;
    });
    
    return voicePeaks.length > 1;
  }

  private detectConversationPatterns(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): boolean {
    // Look for alternating speech patterns and pauses
    const energy = this.calculateRMSEnergy(buffer.data);
    const isCurrentlySpeaking = energy > this.config.thresholds.voiceActivity;
    
    // Simple conversation pattern detection based on energy transitions
    if (this.energyHistory.length >= 10) {
      const recentHistory = this.energyHistory.slice(-10);
      const transitions = this.countEnergyTransitions(recentHistory);
      return transitions >= 2; // Multiple speech/pause transitions suggest conversation
    }
    
    return false;
  }

  private detectSpatialVoiceCues(buffer: AudioBuffer): boolean {
    // Simplified spatial analysis - would need stereo input for proper implementation
    // Look for phase differences or amplitude variations that suggest multiple sources
    return false; // Placeholder - requires stereo audio processing
  }

  private hasSpeechLikeSpectrum(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Speech has energy concentrated in 300-3400 Hz range
    const speechEnergy = this.getEnergyInRange(frequencyAnalysis, 300, 3400);
    const totalEnergy = frequencyAnalysis.magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    
    return speechEnergy / Math.max(totalEnergy, 0.001) > 0.6;
  }

  private hasHighFrequencyEmphasis(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Whispers often have emphasized high frequencies
    const highFreqEnergy = this.getEnergyInRange(frequencyAnalysis, 2000, 8000);
    const midFreqEnergy = this.getEnergyInRange(frequencyAnalysis, 500, 2000);
    
    return highFreqEnergy > midFreqEnergy * 0.5;
  }

  private detectBreathiness(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Breathiness shows up as noise-like components in high frequencies
    const noiseLevel = this.estimateNoiseLevel(frequencyAnalysis);
    const highFreqNoise = this.getEnergyInRange(frequencyAnalysis, 4000, 8000);
    
    return highFreqNoise > noiseLevel * 2;
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

  private countEnergyTransitions(energyHistory: number[]): number {
    let transitions = 0;
    const threshold = this.config.thresholds.voiceActivity;
    
    for (let i = 1; i < energyHistory.length; i++) {
      const prevActive = energyHistory[i - 1] > threshold;
      const currentActive = energyHistory[i] > threshold;
      
      if (prevActive !== currentActive) {
        transitions++;
      }
    }
    
    return transitions;
  }

  private estimateNoiseLevel(frequencyAnalysis: FrequencyAnalysis): number {
    // Estimate noise floor from lowest magnitude bins
    const sortedMagnitudes = Array.from(frequencyAnalysis.magnitudes).sort((a, b) => a - b);
    const noiseFloor = sortedMagnitudes.slice(0, Math.floor(sortedMagnitudes.length * 0.1));
    return noiseFloor.reduce((sum, mag) => sum + mag, 0) / noiseFloor.length;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => (val - mean) ** 2);
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }
}