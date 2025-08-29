/**
 * Audio fingerprinting system for voice verification and identity tracking
 */

import { AudioBuffer, FrequencyAnalysis, AudioCalibrationProfile } from './types';

export class AudioFingerprinter {
  private voiceReference: Float32Array | null = null;
  private fingerprintHistory: Float32Array[] = [];
  private maxHistorySize = 100;

  constructor() {}

  calibrateVoiceReference(audioSamples: AudioBuffer[], frequencyAnalyses: FrequencyAnalysis[]): void {
    if (audioSamples.length !== frequencyAnalyses.length || audioSamples.length < 5) {
      throw new Error('Insufficient samples for voice reference calibration');
    }

    // Extract voice features from calibration samples
    const voiceFeatures: Float32Array[] = [];
    
    for (let i = 0; i < audioSamples.length; i++) {
      const features = this.extractVoiceFeatures(audioSamples[i], frequencyAnalyses[i]);
      if (this.isValidVoiceSample(features, frequencyAnalyses[i])) {
        voiceFeatures.push(features);
      }
    }

    if (voiceFeatures.length < 3) {
      throw new Error('Insufficient valid voice samples for calibration');
    }

    // Create reference fingerprint by averaging valid samples
    this.voiceReference = this.createReferenceFingerprint(voiceFeatures);
  }

  generateFingerprint(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): Float32Array {
    const fingerprint = this.extractVoiceFeatures(buffer, frequencyAnalysis);
    
    // Add to history for temporal analysis
    this.fingerprintHistory.push(new Float32Array(fingerprint));
    if (this.fingerprintHistory.length > this.maxHistorySize) {
      this.fingerprintHistory.shift();
    }

    return fingerprint;
  }

  verifyVoiceIdentity(fingerprint: Float32Array): { isMatch: boolean; confidence: number; similarity: number } {
    if (!this.voiceReference) {
      return { isMatch: false, confidence: 0, similarity: 0 };
    }

    const similarity = this.calculateSimilarity(fingerprint, this.voiceReference);
    const temporalConsistency = this.calculateTemporalConsistency(fingerprint);
    
    // Combine similarity and temporal consistency for confidence
    const confidence = (similarity * 0.7 + temporalConsistency * 0.3);
    const isMatch = confidence > 0.75; // Threshold for voice match

    return { isMatch, confidence, similarity };
  }

  detectVoiceChange(): { changed: boolean; confidence: number } {
    if (this.fingerprintHistory.length < 10) {
      return { changed: false, confidence: 0 };
    }

    // Analyze recent fingerprints for consistency
    const recentFingerprints = this.fingerprintHistory.slice(-10);
    const variability = this.calculateFingerprintVariability(recentFingerprints);
    
    // High variability might indicate voice change or multiple speakers
    const changed = variability > 0.4;
    const confidence = Math.min(1.0, variability * 2);

    return { changed, confidence };
  }

  private extractVoiceFeatures(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): Float32Array {
    const features = new Float32Array(40); // Comprehensive feature vector
    let idx = 0;

    // MFCC features (13 coefficients)
    const mfcc = this.calculateMFCC(frequencyAnalysis.magnitudes);
    for (let i = 0; i < 13 && idx < features.length; i++, idx++) {
      features[idx] = mfcc[i];
    }

    // Spectral features
    if (idx < features.length) features[idx++] = frequencyAnalysis.spectralCentroid / 4000; // Normalized
    if (idx < features.length) features[idx++] = frequencyAnalysis.spectralRolloff / 8000; // Normalized
    if (idx < features.length) features[idx++] = frequencyAnalysis.spectralFlux;

    // Pitch and harmonicity features
    const pitch = this.extractPitch(frequencyAnalysis);
    const harmonicity = this.calculateHarmonicity(frequencyAnalysis);
    if (idx < features.length) features[idx++] = pitch / 400; // Normalized to typical voice range
    if (idx < features.length) features[idx++] = harmonicity;

    // Formant features
    const formants = this.extractFormants(frequencyAnalysis);
    for (let i = 0; i < Math.min(4, formants.length) && idx < features.length; i++, idx++) {
      features[idx] = formants[i] / 4000; // Normalized
    }

    // Energy and dynamics features
    const energy = this.calculateRMSEnergy(buffer.data);
    const zeroCrossingRate = this.calculateZeroCrossingRate(buffer.data);
    if (idx < features.length) features[idx++] = energy;
    if (idx < features.length) features[idx++] = zeroCrossingRate;

    // Spectral shape features
    const spectralSkewness = this.calculateSpectralSkewness(frequencyAnalysis);
    const spectralKurtosis = this.calculateSpectralKurtosis(frequencyAnalysis);
    if (idx < features.length) features[idx++] = spectralSkewness;
    if (idx < features.length) features[idx++] = spectralKurtosis;

    // Jitter and shimmer (voice quality measures)
    const jitter = this.calculateJitter(buffer.data, pitch);
    const shimmer = this.calculateShimmer(buffer.data);
    if (idx < features.length) features[idx++] = jitter;
    if (idx < features.length) features[idx++] = shimmer;

    // Fill remaining with spectral envelope features
    const spectralEnvelope = this.extractSpectralEnvelope(frequencyAnalysis, 10);
    for (let i = 0; i < spectralEnvelope.length && idx < features.length; i++, idx++) {
      features[idx] = spectralEnvelope[i];
    }

    return features;
  }

  private calculateMFCC(magnitudes: Float32Array): Float32Array {
    const numCoeffs = 13;
    const mfcc = new Float32Array(numCoeffs);
    
    // Create mel filter bank
    const melFilters = this.createMelFilterBank(magnitudes.length, numCoeffs);
    
    // Apply mel filters and take logarithm
    const melSpectrum = new Float32Array(numCoeffs);
    for (let i = 0; i < numCoeffs; i++) {
      let sum = 0;
      for (let j = 0; j < magnitudes.length; j++) {
        sum += magnitudes[j] * melFilters[i][j];
      }
      melSpectrum[i] = Math.log(Math.max(sum, 1e-10));
    }
    
    // Apply DCT to get MFCC coefficients
    for (let i = 0; i < numCoeffs; i++) {
      let sum = 0;
      for (let j = 0; j < numCoeffs; j++) {
        sum += melSpectrum[j] * Math.cos(Math.PI * i * (j + 0.5) / numCoeffs);
      }
      mfcc[i] = sum;
    }
    
    return mfcc;
  }

  private createMelFilterBank(numBins: number, numFilters: number): number[][] {
    const filters: number[][] = [];
    const melMin = this.hzToMel(80);   // Minimum frequency for voice
    const melMax = this.hzToMel(8000); // Maximum frequency
    
    // Create mel-spaced filter centers
    const melCenters: number[] = [];
    for (let i = 0; i <= numFilters + 1; i++) {
      const mel = melMin + (melMax - melMin) * i / (numFilters + 1);
      melCenters.push(this.melToHz(mel));
    }
    
    // Create triangular filters
    for (let i = 1; i <= numFilters; i++) {
      const filter = new Array(numBins).fill(0);
      const leftFreq = melCenters[i - 1];
      const centerFreq = melCenters[i];
      const rightFreq = melCenters[i + 1];
      
      for (let j = 0; j < numBins; j++) {
        const freq = (j * 8000) / numBins; // Assuming 8kHz max frequency
        
        if (freq >= leftFreq && freq <= centerFreq) {
          filter[j] = (freq - leftFreq) / (centerFreq - leftFreq);
        } else if (freq > centerFreq && freq <= rightFreq) {
          filter[j] = (rightFreq - freq) / (rightFreq - centerFreq);
        }
      }
      
      filters.push(filter);
    }
    
    return filters;
  }

  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  private extractPitch(frequencyAnalysis: FrequencyAnalysis): number {
    // Find the fundamental frequency in voice range
    let maxMagnitude = 0;
    let pitch = 0;
    
    for (let i = 0; i < frequencyAnalysis.frequencies.length; i++) {
      const freq = frequencyAnalysis.frequencies[i];
      if (freq >= 80 && freq <= 400 && frequencyAnalysis.magnitudes[i] > maxMagnitude) {
        maxMagnitude = frequencyAnalysis.magnitudes[i];
        pitch = freq;
      }
    }
    
    return pitch;
  }

  private calculateHarmonicity(frequencyAnalysis: FrequencyAnalysis): number {
    const pitch = this.extractPitch(frequencyAnalysis);
    if (pitch === 0) return 0;
    
    let harmonicEnergy = 0;
    let totalEnergy = 0;
    
    // Check energy at harmonic frequencies
    for (let harmonic = 1; harmonic <= 5; harmonic++) {
      const harmonicFreq = pitch * harmonic;
      const energy = this.getEnergyAtFrequency(frequencyAnalysis, harmonicFreq, 20);
      harmonicEnergy += energy;
    }
    
    // Calculate total energy
    for (let i = 0; i < frequencyAnalysis.magnitudes.length; i++) {
      totalEnergy += frequencyAnalysis.magnitudes[i] * frequencyAnalysis.magnitudes[i];
    }
    
    return totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
  }

  private extractFormants(frequencyAnalysis: FrequencyAnalysis): number[] {
    const formants: number[] = [];
    const peaks = this.findSpectralPeaks(frequencyAnalysis.magnitudes, 0.1);
    
    // Look for formant peaks in typical ranges
    const formantRanges = [
      [200, 1200],   // F1
      [800, 2500],   // F2
      [1500, 3500],  // F3
      [2500, 4500]   // F4
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

  private calculateSpectralSkewness(frequencyAnalysis: FrequencyAnalysis): number {
    const mean = frequencyAnalysis.spectralCentroid;
    let sum = 0;
    let variance = 0;
    
    for (let i = 0; i < frequencyAnalysis.frequencies.length; i++) {
      const freq = frequencyAnalysis.frequencies[i];
      const magnitude = frequencyAnalysis.magnitudes[i];
      const deviation = freq - mean;
      
      variance += magnitude * deviation * deviation;
      sum += magnitude * deviation * deviation * deviation;
    }
    
    const stdDev = Math.sqrt(variance);
    return stdDev > 0 ? sum / (stdDev * stdDev * stdDev) : 0;
  }

  private calculateSpectralKurtosis(frequencyAnalysis: FrequencyAnalysis): number {
    const mean = frequencyAnalysis.spectralCentroid;
    let sum = 0;
    let variance = 0;
    
    for (let i = 0; i < frequencyAnalysis.frequencies.length; i++) {
      const freq = frequencyAnalysis.frequencies[i];
      const magnitude = frequencyAnalysis.magnitudes[i];
      const deviation = freq - mean;
      
      variance += magnitude * deviation * deviation;
      sum += magnitude * deviation * deviation * deviation * deviation;
    }
    
    const stdDev = Math.sqrt(variance);
    return stdDev > 0 ? sum / (stdDev * stdDev * stdDev * stdDev) - 3 : 0;
  }

  private calculateJitter(buffer: Float32Array, pitch: number): number {
    if (pitch === 0) return 0;
    
    // Simplified jitter calculation - measures period-to-period variation
    const sampleRate = 44100; // Assuming standard sample rate
    const expectedPeriod = sampleRate / pitch;
    
    // Find actual periods by detecting zero crossings
    const periods: number[] = [];
    let lastCrossing = 0;
    
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) {
        if (i - lastCrossing > expectedPeriod * 0.5) { // Avoid noise
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
    // Simplified shimmer calculation - measures amplitude variation
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

  private extractSpectralEnvelope(frequencyAnalysis: FrequencyAnalysis, numBands: number): Float32Array {
    const envelope = new Float32Array(numBands);
    const bandSize = Math.floor(frequencyAnalysis.magnitudes.length / numBands);
    
    for (let i = 0; i < numBands; i++) {
      let sum = 0;
      for (let j = 0; j < bandSize; j++) {
        const idx = i * bandSize + j;
        if (idx < frequencyAnalysis.magnitudes.length) {
          sum += frequencyAnalysis.magnitudes[idx];
        }
      }
      envelope[i] = sum / bandSize;
    }
    
    return envelope;
  }

  private isValidVoiceSample(features: Float32Array, frequencyAnalysis: FrequencyAnalysis): boolean {
    // Check if the sample contains valid voice characteristics
    const pitch = this.extractPitch(frequencyAnalysis);
    const energy = features[17]; // Energy feature index
    const harmonicity = features[18]; // Harmonicity feature index
    
    return pitch > 80 && pitch < 400 && energy > 0.01 && harmonicity > 0.3;
  }

  private createReferenceFingerprint(voiceFeatures: Float32Array[]): Float32Array {
    const numFeatures = voiceFeatures[0].length;
    const reference = new Float32Array(numFeatures);
    
    // Average the features across all samples
    for (let i = 0; i < numFeatures; i++) {
      let sum = 0;
      for (const features of voiceFeatures) {
        sum += features[i];
      }
      reference[i] = sum / voiceFeatures.length;
    }
    
    return reference;
  }

  private calculateSimilarity(fingerprint1: Float32Array, fingerprint2: Float32Array): number {
    if (fingerprint1.length !== fingerprint2.length) return 0;
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < fingerprint1.length; i++) {
      dotProduct += fingerprint1[i] * fingerprint2[i];
      norm1 += fingerprint1[i] * fingerprint1[i];
      norm2 += fingerprint2[i] * fingerprint2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private calculateTemporalConsistency(currentFingerprint: Float32Array): number {
    if (this.fingerprintHistory.length < 5) return 0.5;
    
    // Calculate consistency with recent fingerprints
    const recentFingerprints = this.fingerprintHistory.slice(-5);
    let totalSimilarity = 0;
    
    for (const fingerprint of recentFingerprints) {
      totalSimilarity += this.calculateSimilarity(currentFingerprint, fingerprint);
    }
    
    return totalSimilarity / recentFingerprints.length;
  }

  private calculateFingerprintVariability(fingerprints: Float32Array[]): number {
    if (fingerprints.length < 2) return 0;
    
    // Calculate average pairwise distance
    let totalDistance = 0;
    let pairCount = 0;
    
    for (let i = 0; i < fingerprints.length; i++) {
      for (let j = i + 1; j < fingerprints.length; j++) {
        const similarity = this.calculateSimilarity(fingerprints[i], fingerprints[j]);
        totalDistance += 1 - similarity; // Convert similarity to distance
        pairCount++;
      }
    }
    
    return pairCount > 0 ? totalDistance / pairCount : 0;
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

  getVoiceReference(): Float32Array | null {
    return this.voiceReference ? new Float32Array(this.voiceReference) : null;
  }

  clearHistory(): void {
    this.fingerprintHistory = [];
  }

  dispose(): void {
    this.voiceReference = null;
    this.fingerprintHistory = [];
  }
}