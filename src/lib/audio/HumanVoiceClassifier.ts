/**
 * Advanced human voice classification and analysis system
 */

import { AudioBuffer, FrequencyAnalysis, AudioConfig } from './types';

export interface VoiceClassificationResult {
  isHuman: boolean;
  confidence: number;
  voiceCharacteristics: {
    gender: 'male' | 'female' | 'unknown';
    ageGroup: 'child' | 'adult' | 'elderly' | 'unknown';
    emotionalState: 'neutral' | 'stressed' | 'excited' | 'calm' | 'unknown';
    speakingStyle: 'normal' | 'whisper' | 'shouting' | 'reading' | 'unknown';
  };
  voiceQuality: {
    clarity: number;
    naturalness: number;
    consistency: number;
  };
  suspiciousIndicators: {
    artificialVoice: boolean;
    voiceChanger: boolean;
    playback: boolean;
    multipleVoices: boolean;
  };
}

export class HumanVoiceClassifier {
  private config: AudioConfig;
  private voiceHistory: Float32Array[] = [];
  private maxHistorySize = 50;
  private genderModel: VoiceGenderModel;
  private ageModel: VoiceAgeModel;
  private emotionModel: VoiceEmotionModel;
  private artificialVoiceDetector: ArtificialVoiceDetector;

  constructor(config: AudioConfig) {
    this.config = config;
    this.genderModel = new VoiceGenderModel();
    this.ageModel = new VoiceAgeModel();
    this.emotionModel = new VoiceEmotionModel();
    this.artificialVoiceDetector = new ArtificialVoiceDetector();
  }

  classifyVoice(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): VoiceClassificationResult {
    // Extract comprehensive voice features
    const voiceFeatures = this.extractVoiceFeatures(buffer, frequencyAnalysis);
    
    // Store in history for temporal analysis
    this.voiceHistory.push(voiceFeatures);
    if (this.voiceHistory.length > this.maxHistorySize) {
      this.voiceHistory.shift();
    }

    // Perform classification
    const isHuman = this.classifyAsHuman(voiceFeatures, frequencyAnalysis);
    const confidence = this.calculateHumanConfidence(voiceFeatures, frequencyAnalysis);
    const voiceCharacteristics = this.analyzeVoiceCharacteristics(voiceFeatures, frequencyAnalysis);
    const voiceQuality = this.assessVoiceQuality(voiceFeatures, frequencyAnalysis);
    const suspiciousIndicators = this.detectSuspiciousIndicators(voiceFeatures, frequencyAnalysis);

    return {
      isHuman,
      confidence,
      voiceCharacteristics,
      voiceQuality,
      suspiciousIndicators
    };
  }

  private extractVoiceFeatures(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): Float32Array {
    const features = new Float32Array(60); // Comprehensive feature vector
    let idx = 0;

    // Fundamental frequency and harmonics
    const f0 = this.extractFundamentalFrequency(frequencyAnalysis);
    const harmonics = this.analyzeHarmonicStructure(frequencyAnalysis, f0);
    features[idx++] = f0 / 400; // Normalized F0
    features[idx++] = harmonics.harmonicity;
    features[idx++] = harmonics.harmonicRatio;

    // Formant analysis
    const formants = this.extractFormants(frequencyAnalysis);
    for (let i = 0; i < Math.min(5, formants.length); i++) {
      features[idx++] = formants[i] / 4000; // Normalized formants
    }
    while (idx < 8) features[idx++] = 0; // Pad if fewer formants

    // Spectral features
    features[idx++] = frequencyAnalysis.spectralCentroid / 4000;
    features[idx++] = frequencyAnalysis.spectralRolloff / 8000;
    features[idx++] = frequencyAnalysis.spectralFlux;
    features[idx++] = this.calculateSpectralSlope(frequencyAnalysis);
    features[idx++] = this.calculateSpectralSpread(frequencyAnalysis);

    // Voice quality measures
    const jitter = this.calculateJitter(buffer.data, f0);
    const shimmer = this.calculateShimmer(buffer.data);
    const hnr = this.calculateHarmonicsToNoiseRatio(frequencyAnalysis);
    features[idx++] = jitter;
    features[idx++] = shimmer;
    features[idx++] = hnr;

    // Prosodic features
    const energy = this.calculateRMSEnergy(buffer.data);
    const zcr = this.calculateZeroCrossingRate(buffer.data);
    features[idx++] = energy;
    features[idx++] = zcr;

    // MFCC coefficients
    const mfcc = this.calculateMFCC(frequencyAnalysis.magnitudes);
    for (let i = 0; i < Math.min(13, mfcc.length); i++) {
      features[idx++] = mfcc[i];
    }

    // Temporal dynamics
    const temporalFeatures = this.calculateTemporalFeatures();
    for (let i = 0; i < Math.min(10, temporalFeatures.length); i++) {
      features[idx++] = temporalFeatures[i];
    }

    // Fill remaining with spectral envelope
    while (idx < features.length) {
      features[idx] = 0;
      idx++;
    }

    return features;
  }

  private classifyAsHuman(features: Float32Array, frequencyAnalysis: FrequencyAnalysis): boolean {
    // Multi-criteria human voice classification
    const f0 = features[0] * 400; // Denormalize F0
    const harmonicity = features[1];
    const formantStructure = this.hasValidFormantStructure(features.slice(3, 8));
    const voiceQuality = this.assessBasicVoiceQuality(features);
    const spectralCharacteristics = this.hasHumanSpectralCharacteristics(frequencyAnalysis);

    // Human voice criteria
    const validF0 = f0 >= 80 && f0 <= 400;
    const goodHarmonicity = harmonicity > 0.6;
    const naturalSpectrum = spectralCharacteristics;
    const qualityCheck = voiceQuality > 0.5;

    return validF0 && goodHarmonicity && formantStructure && naturalSpectrum && qualityCheck;
  }

  private calculateHumanConfidence(features: Float32Array, frequencyAnalysis: FrequencyAnalysis): number {
    let confidence = 0;

    // F0 confidence
    const f0 = features[0] * 400;
    if (f0 >= 80 && f0 <= 400) {
      confidence += 0.2;
    }

    // Harmonicity confidence
    confidence += features[1] * 0.2;

    // Formant confidence
    const formantScore = this.calculateFormantScore(features.slice(3, 8));
    confidence += formantScore * 0.2;

    // Voice quality confidence
    const qualityScore = this.assessBasicVoiceQuality(features);
    confidence += qualityScore * 0.2;

    // Temporal consistency confidence
    const temporalScore = this.calculateTemporalConsistency();
    confidence += temporalScore * 0.2;

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  private analyzeVoiceCharacteristics(features: Float32Array, frequencyAnalysis: FrequencyAnalysis) {
    const f0 = features[0] * 400;
    const formants = features.slice(3, 8).map(f => f * 4000);
    
    return {
      gender: this.genderModel.classify(f0, formants),
      ageGroup: this.ageModel.classify(f0, features),
      emotionalState: this.emotionModel.classify(features, frequencyAnalysis),
      speakingStyle: this.classifySpeakingStyle(features, frequencyAnalysis)
    };
  }

  private assessVoiceQuality(features: Float32Array, frequencyAnalysis: FrequencyAnalysis) {
    const jitter = features[15];
    const shimmer = features[16];
    const hnr = features[17];
    
    const clarity = Math.max(0, 1 - (jitter + shimmer) / 2);
    const naturalness = Math.min(1, hnr);
    const consistency = this.calculateTemporalConsistency();

    return { clarity, naturalness, consistency };
  }

  private detectSuspiciousIndicators(features: Float32Array, frequencyAnalysis: FrequencyAnalysis) {
    return {
      artificialVoice: this.artificialVoiceDetector.detect(features, frequencyAnalysis),
      voiceChanger: this.detectVoiceChanger(features, frequencyAnalysis),
      playback: this.detectPlayback(features, frequencyAnalysis),
      multipleVoices: this.detectMultipleVoices(frequencyAnalysis)
    };
  }

  // Helper methods
  private extractFundamentalFrequency(frequencyAnalysis: FrequencyAnalysis): number {
    // Find the strongest peak in the voice frequency range
    let maxMagnitude = 0;
    let f0 = 0;
    
    for (let i = 0; i < frequencyAnalysis.frequencies.length; i++) {
      const freq = frequencyAnalysis.frequencies[i];
      if (freq >= 80 && freq <= 400 && frequencyAnalysis.magnitudes[i] > maxMagnitude) {
        maxMagnitude = frequencyAnalysis.magnitudes[i];
        f0 = freq;
      }
    }
    
    return f0;
  }

  private analyzeHarmonicStructure(frequencyAnalysis: FrequencyAnalysis, f0: number) {
    if (f0 === 0) return { harmonicity: 0, harmonicRatio: 0 };
    
    let harmonicEnergy = 0;
    let totalEnergy = 0;
    let harmonicCount = 0;
    
    // Check harmonics up to 5th
    for (let h = 1; h <= 5; h++) {
      const harmonicFreq = f0 * h;
      const energy = this.getEnergyAtFrequency(frequencyAnalysis, harmonicFreq, 20);
      harmonicEnergy += energy;
      if (energy > 0.1) harmonicCount++;
    }
    
    // Calculate total energy
    for (let i = 0; i < frequencyAnalysis.magnitudes.length; i++) {
      totalEnergy += frequencyAnalysis.magnitudes[i] * frequencyAnalysis.magnitudes[i];
    }
    
    const harmonicity = totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
    const harmonicRatio = harmonicCount / 5;
    
    return { harmonicity, harmonicRatio };
  }

  private extractFormants(frequencyAnalysis: FrequencyAnalysis): number[] {
    const formants: number[] = [];
    const peaks = this.findSpectralPeaks(frequencyAnalysis.magnitudes, 0.1);
    
    // Expected formant ranges for human speech
    const formantRanges = [
      [200, 1200],   // F1
      [800, 2500],   // F2
      [1500, 3500],  // F3
      [2500, 4500],  // F4
      [3500, 5500]   // F5
    ];
    
    for (const [minFreq, maxFreq] of formantRanges) {
      let bestPeak = -1;
      let bestMagnitude = 0;
      
      for (const peak of peaks) {
        const freq = frequencyAnalysis.frequencies[peak];
        if (freq >= minFreq && freq <= maxFreq && frequencyAnalysis.magnitudes[peak] > bestMagnitude) {
          bestMagnitude = frequencyAnalysis.magnitudes[peak];
          bestPeak = peak;
        }
      }
      
      if (bestPeak !== -1) {
        formants.push(frequencyAnalysis.frequencies[bestPeak]);
      }
    }
    
    return formants;
  }

  private calculateSpectralSlope(frequencyAnalysis: FrequencyAnalysis): number {
    // Calculate the slope of the spectral envelope
    const frequencies = frequencyAnalysis.frequencies;
    const magnitudes = frequencyAnalysis.magnitudes;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    let count = 0;
    
    for (let i = 0; i < frequencies.length; i++) {
      if (frequencies[i] > 0 && magnitudes[i] > 0) {
        const x = Math.log(frequencies[i]);
        const y = Math.log(magnitudes[i]);
        
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
        count++;
      }
    }
    
    if (count < 2) return 0;
    
    const slope = (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
    return slope;
  }

  private calculateSpectralSpread(frequencyAnalysis: FrequencyAnalysis): number {
    const centroid = frequencyAnalysis.spectralCentroid;
    let spread = 0;
    let totalMagnitude = 0;
    
    for (let i = 0; i < frequencyAnalysis.frequencies.length; i++) {
      const freq = frequencyAnalysis.frequencies[i];
      const magnitude = frequencyAnalysis.magnitudes[i];
      
      spread += magnitude * Math.pow(freq - centroid, 2);
      totalMagnitude += magnitude;
    }
    
    return totalMagnitude > 0 ? Math.sqrt(spread / totalMagnitude) : 0;
  }

  private calculateJitter(buffer: Float32Array, f0: number): number {
    if (f0 === 0) return 0;
    
    const sampleRate = 44100;
    const expectedPeriod = sampleRate / f0;
    const periods: number[] = [];
    
    // Find zero crossings to estimate periods
    let lastCrossing = 0;
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) {
        if (i - lastCrossing > expectedPeriod * 0.5) {
          periods.push(i - lastCrossing);
          lastCrossing = i;
        }
      }
    }
    
    if (periods.length < 2) return 0;
    
    // Calculate period variation
    let sumDiff = 0;
    for (let i = 1; i < periods.length; i++) {
      sumDiff += Math.abs(periods[i] - periods[i - 1]);
    }
    
    const avgPeriod = periods.reduce((sum, p) => sum + p, 0) / periods.length;
    return avgPeriod > 0 ? (sumDiff / (periods.length - 1)) / avgPeriod : 0;
  }

  private calculateShimmer(buffer: Float32Array): number {
    const windowSize = 1024;
    const amplitudes: number[] = [];
    
    for (let i = 0; i < buffer.length - windowSize; i += windowSize / 2) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += Math.abs(buffer[i + j]);
      }
      amplitudes.push(sum / windowSize);
    }
    
    if (amplitudes.length < 2) return 0;
    
    let sumDiff = 0;
    for (let i = 1; i < amplitudes.length; i++) {
      sumDiff += Math.abs(amplitudes[i] - amplitudes[i - 1]);
    }
    
    const avgAmplitude = amplitudes.reduce((sum, a) => sum + a, 0) / amplitudes.length;
    return avgAmplitude > 0 ? (sumDiff / (amplitudes.length - 1)) / avgAmplitude : 0;
  }

  private calculateHarmonicsToNoiseRatio(frequencyAnalysis: FrequencyAnalysis): number {
    const f0 = this.extractFundamentalFrequency(frequencyAnalysis);
    if (f0 === 0) return 0;
    
    let harmonicEnergy = 0;
    let noiseEnergy = 0;
    
    // Calculate harmonic energy
    for (let h = 1; h <= 5; h++) {
      const harmonicFreq = f0 * h;
      harmonicEnergy += this.getEnergyAtFrequency(frequencyAnalysis, harmonicFreq, 10);
    }
    
    // Calculate noise energy (between harmonics)
    for (let h = 1; h < 5; h++) {
      const betweenFreq = f0 * (h + 0.5);
      noiseEnergy += this.getEnergyAtFrequency(frequencyAnalysis, betweenFreq, 10);
    }
    
    return noiseEnergy > 0 ? harmonicEnergy / noiseEnergy : 0;
  }

  private calculateRMSEnergy(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  private calculateZeroCrossingRate(buffer: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / buffer.length;
  }

  private calculateMFCC(magnitudes: Float32Array): Float32Array {
    // Simplified MFCC calculation
    const numCoeffs = 13;
    const mfcc = new Float32Array(numCoeffs);
    
    // Create mel filter bank
    const melFilters = this.createMelFilterBank(magnitudes.length, numCoeffs);
    
    // Apply filters and DCT
    for (let i = 0; i < numCoeffs; i++) {
      let sum = 0;
      for (let j = 0; j < magnitudes.length; j++) {
        sum += magnitudes[j] * melFilters[i][j];
      }
      mfcc[i] = Math.log(Math.max(sum, 1e-10));
    }
    
    return mfcc;
  }

  private calculateTemporalFeatures(): Float32Array {
    if (this.voiceHistory.length < 5) {
      return new Float32Array(10);
    }
    
    const features = new Float32Array(10);
    const recent = this.voiceHistory.slice(-5);
    
    // Calculate temporal statistics
    for (let i = 0; i < Math.min(10, recent[0].length); i++) {
      const values = recent.map(frame => frame[i]);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
      
      features[i] = variance; // Use variance as temporal feature
    }
    
    return features;
  }

  private hasValidFormantStructure(formantFeatures: Float32Array): boolean {
    const formants = Array.from(formantFeatures).map(f => f * 4000).filter(f => f > 0);
    
    if (formants.length < 2) return false;
    
    // Check formant spacing and ranges
    const f1 = formants[0];
    const f2 = formants[1];
    
    return f1 >= 200 && f1 <= 1200 && f2 >= 800 && f2 <= 2500 && f2 > f1;
  }

  private assessBasicVoiceQuality(features: Float32Array): number {
    const jitter = features[15];
    const shimmer = features[16];
    const hnr = features[17];
    
    // Quality decreases with jitter and shimmer, increases with HNR
    const quality = Math.max(0, 1 - (jitter + shimmer) / 2) * Math.min(1, hnr);
    return quality;
  }

  private hasHumanSpectralCharacteristics(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Human speech has characteristic spectral tilt and formant structure
    const lowEnergy = this.getEnergyInRange(frequencyAnalysis, 0, 1000);
    const midEnergy = this.getEnergyInRange(frequencyAnalysis, 1000, 4000);
    const highEnergy = this.getEnergyInRange(frequencyAnalysis, 4000, 8000);
    
    // Human speech typically has more energy in mid frequencies
    return midEnergy > lowEnergy * 0.5 && midEnergy > highEnergy;
  }

  private calculateFormantScore(formantFeatures: Float32Array): number {
    const formants = Array.from(formantFeatures).map(f => f * 4000).filter(f => f > 0);
    
    if (formants.length === 0) return 0;
    
    let score = 0;
    
    // Score based on number of formants
    score += Math.min(1, formants.length / 3) * 0.5;
    
    // Score based on formant positions
    if (formants.length >= 2) {
      const f1 = formants[0];
      const f2 = formants[1];
      
      if (f1 >= 200 && f1 <= 1200) score += 0.25;
      if (f2 >= 800 && f2 <= 2500) score += 0.25;
    }
    
    return score;
  }

  private calculateTemporalConsistency(): number {
    if (this.voiceHistory.length < 3) return 0.5;
    
    const recent = this.voiceHistory.slice(-3);
    let totalSimilarity = 0;
    let pairCount = 0;
    
    for (let i = 0; i < recent.length; i++) {
      for (let j = i + 1; j < recent.length; j++) {
        const similarity = this.calculateCosineSimilarity(recent[i], recent[j]);
        totalSimilarity += similarity;
        pairCount++;
      }
    }
    
    return pairCount > 0 ? totalSimilarity / pairCount : 0.5;
  }

  private classifySpeakingStyle(features: Float32Array, frequencyAnalysis: FrequencyAnalysis): 'normal' | 'whisper' | 'shouting' | 'reading' | 'unknown' {
    const energy = features[18];
    const zcr = features[19];
    const spectralCentroid = frequencyAnalysis.spectralCentroid;
    
    if (energy < 0.05 && spectralCentroid > 2000) return 'whisper';
    if (energy > 0.3 && spectralCentroid > 1500) return 'shouting';
    if (zcr < 0.1 && energy > 0.1 && energy < 0.25) return 'reading';
    if (energy > 0.05 && energy < 0.3) return 'normal';
    
    return 'unknown';
  }

  private detectVoiceChanger(features: Float32Array, frequencyAnalysis: FrequencyAnalysis): boolean {
    // Voice changers often create unnatural formant shifts or spectral artifacts
    const formants = features.slice(3, 8).map(f => f * 4000);
    const spectralSlope = features[12];
    
    // Unnatural formant ratios
    if (formants.length >= 2) {
      const f1f2Ratio = formants[1] / formants[0];
      if (f1f2Ratio < 1.2 || f1f2Ratio > 4.0) return true;
    }
    
    // Unnatural spectral slope
    if (Math.abs(spectralSlope) > 2.0) return true;
    
    return false;
  }

  private detectPlayback(features: Float32Array, frequencyAnalysis: FrequencyAnalysis): boolean {
    // Playback often has compression artifacts and unnatural consistency
    const consistency = this.calculateTemporalConsistency();
    const hnr = features[17];
    
    // Too consistent might indicate playback
    if (consistency > 0.95 && hnr > 0.9) return true;
    
    return false;
  }

  private detectMultipleVoices(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Look for multiple fundamental frequencies
    const peaks = this.findSpectralPeaks(frequencyAnalysis.magnitudes, 0.1);
    const voicePeaks = peaks.filter(peak => {
      const freq = frequencyAnalysis.frequencies[peak];
      return freq >= 80 && freq <= 400;
    });
    
    return voicePeaks.length > 1;
  }

  // Utility methods
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

  private createMelFilterBank(numBins: number, numFilters: number): number[][] {
    // Simplified mel filter bank
    const filters: number[][] = [];
    
    for (let i = 0; i < numFilters; i++) {
      const filter = new Array(numBins).fill(0);
      const center = Math.floor((i + 1) * numBins / (numFilters + 1));
      const width = Math.floor(numBins / numFilters);
      
      for (let j = Math.max(0, center - width); j < Math.min(numBins, center + width); j++) {
        filter[j] = 1 - Math.abs(j - center) / width;
      }
      
      filters.push(filter);
    }
    
    return filters;
  }

  private calculateCosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
}

// Supporting classes for voice analysis
class VoiceGenderModel {
  classify(f0: number, formants: number[]): 'male' | 'female' | 'unknown' {
    if (formants.length < 2) return 'unknown';
    
    const f1 = formants[0];
    const f2 = formants[1];
    
    // Simplified gender classification based on F0 and formants
    if (f0 < 165 && f1 < 500 && f2 < 1500) return 'male';
    if (f0 > 165 && f1 > 400 && f2 > 1400) return 'female';
    
    return 'unknown';
  }
}

class VoiceAgeModel {
  classify(f0: number, features: Float32Array): 'child' | 'adult' | 'elderly' | 'unknown' {
    const jitter = features[15];
    const shimmer = features[16];
    
    // Simplified age classification
    if (f0 > 250) return 'child';
    if (jitter > 0.02 || shimmer > 0.05) return 'elderly';
    if (f0 >= 80 && f0 <= 250) return 'adult';
    
    return 'unknown';
  }
}

class VoiceEmotionModel {
  classify(features: Float32Array, frequencyAnalysis: FrequencyAnalysis): 'neutral' | 'stressed' | 'excited' | 'calm' | 'unknown' {
    const f0 = features[0] * 400;
    const energy = features[18];
    const jitter = features[15];
    const spectralCentroid = frequencyAnalysis.spectralCentroid;
    
    // Simplified emotion classification
    if (jitter > 0.015 || energy > 0.25) return 'stressed';
    if (f0 > 200 && energy > 0.2 && spectralCentroid > 1500) return 'excited';
    if (energy < 0.1 && jitter < 0.01) return 'calm';
    if (energy > 0.05 && energy < 0.2 && jitter < 0.015) return 'neutral';
    
    return 'unknown';
  }
}

class ArtificialVoiceDetector {
  detect(features: Float32Array, frequencyAnalysis: FrequencyAnalysis): boolean {
    const hnr = features[17];
    const jitter = features[15];
    const shimmer = features[16];
    const spectralSlope = features[12];
    
    // Artificial voices often have very low jitter/shimmer and high HNR
    const tooClean = jitter < 0.001 && shimmer < 0.001 && hnr > 0.95;
    
    // Unnatural spectral characteristics
    const unnaturalSpectrum = Math.abs(spectralSlope) > 3.0;
    
    return tooClean || unnaturalSpectrum;
  }
}