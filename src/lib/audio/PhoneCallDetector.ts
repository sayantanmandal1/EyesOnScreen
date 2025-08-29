/**
 * Advanced phone call and video call detection system
 */

import { AudioBuffer, FrequencyAnalysis, AudioConfig } from './types';

export interface PhoneCallDetectionResult {
  isPhoneCall: boolean;
  confidence: number;
  callType: 'cellular' | 'voip' | 'video_call' | 'unknown';
  callQuality: 'poor' | 'fair' | 'good' | 'excellent';
  compressionArtifacts: {
    bandwidthLimitation: boolean;
    codecArtifacts: boolean;
    packetLoss: boolean;
    jitterBuffer: boolean;
  };
  networkCharacteristics: {
    latency: number;
    stability: number;
    compressionRatio: number;
  };
}

export class PhoneCallDetector {
  private config: AudioConfig;
  private callHistory: PhoneCallDetectionResult[] = [];
  private maxHistorySize = 20;
  private codecSignatures: Map<string, Float32Array> = new Map();
  private networkPatterns: Map<string, any> = new Map();

  constructor(config: AudioConfig) {
    this.config = config;
    this.initializeCodecSignatures();
    this.initializeNetworkPatterns();
  }

  detectPhoneCall(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): PhoneCallDetectionResult {
    // Analyze audio characteristics
    const bandwidthAnalysis = this.analyzeBandwidth(frequencyAnalysis);
    const compressionAnalysis = this.analyzeCompression(buffer, frequencyAnalysis);
    const codecAnalysis = this.analyzeCodec(frequencyAnalysis);
    const networkAnalysis = this.analyzeNetworkCharacteristics(buffer, frequencyAnalysis);
    
    // Determine if it's a phone call
    const isPhoneCall = this.classifyAsPhoneCall(
      bandwidthAnalysis, 
      compressionAnalysis, 
      codecAnalysis, 
      networkAnalysis
    );
    
    const confidence = this.calculateConfidence(
      bandwidthAnalysis, 
      compressionAnalysis, 
      codecAnalysis, 
      networkAnalysis
    );
    
    const callType = this.classifyCallType(codecAnalysis, networkAnalysis);
    const callQuality = this.assessCallQuality(compressionAnalysis, networkAnalysis);
    
    const result: PhoneCallDetectionResult = {
      isPhoneCall,
      confidence,
      callType,
      callQuality,
      compressionArtifacts: compressionAnalysis,
      networkCharacteristics: networkAnalysis
    };
    
    // Store in history
    this.callHistory.push(result);
    if (this.callHistory.length > this.maxHistorySize) {
      this.callHistory.shift();
    }
    
    return result;
  }

  private initializeCodecSignatures(): void {
    // G.711 (PCMU/PCMA) - 64 kbps, 8 kHz sampling
    const g711Signature = new Float32Array(32);
    for (let i = 0; i < 16; i++) {
      g711Signature[i] = Math.exp(-i * 0.2); // Sharp cutoff at 4 kHz
    }
    this.codecSignatures.set('G.711', g711Signature);
    
    // G.729 - 8 kbps, heavy compression
    const g729Signature = new Float32Array(32);
    for (let i = 0; i < 12; i++) {
      g729Signature[i] = Math.exp(-i * 0.3); // Even sharper cutoff
    }
    this.codecSignatures.set('G.729', g729Signature);
    
    // AMR (Adaptive Multi-Rate) - mobile networks
    const amrSignature = new Float32Array(32);
    for (let i = 0; i < 14; i++) {
      amrSignature[i] = Math.exp(-i * 0.25) * (1 + 0.1 * Math.sin(i)); // With artifacts
    }
    this.codecSignatures.set('AMR', amrSignature);
    
    // Opus (VoIP) - variable bitrate, better quality
    const opusSignature = new Float32Array(32);
    for (let i = 0; i < 24; i++) {
      opusSignature[i] = Math.exp(-i * 0.1); // Wider bandwidth
    }
    this.codecSignatures.set('Opus', opusSignature);
  }

  private initializeNetworkPatterns(): void {
    this.networkPatterns.set('cellular', {
      latencyRange: [100, 300], // ms
      jitterRange: [10, 50],    // ms
      packetLossRange: [0.1, 2.0], // %
      bandwidthLimit: 3400 // Hz
    });
    
    this.networkPatterns.set('voip', {
      latencyRange: [20, 150],
      jitterRange: [5, 30],
      packetLossRange: [0.01, 1.0],
      bandwidthLimit: 8000
    });
    
    this.networkPatterns.set('video_call', {
      latencyRange: [50, 200],
      jitterRange: [10, 40],
      packetLossRange: [0.1, 1.5],
      bandwidthLimit: 16000
    });
  }

  private analyzeBandwidth(frequencyAnalysis: FrequencyAnalysis): {
    effectiveBandwidth: number;
    cutoffFrequency: number;
    bandwidthLimited: boolean;
  } {
    // Find the effective bandwidth by analyzing energy distribution
    const totalEnergy = frequencyAnalysis.magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    let cumulativeEnergy = 0;
    let cutoffFrequency = 0;
    
    // Find frequency where 95% of energy is contained
    for (let i = 0; i < frequencyAnalysis.frequencies.length; i++) {
      cumulativeEnergy += frequencyAnalysis.magnitudes[i] * frequencyAnalysis.magnitudes[i];
      if (cumulativeEnergy >= totalEnergy * 0.95) {
        cutoffFrequency = frequencyAnalysis.frequencies[i];
        break;
      }
    }
    
    const effectiveBandwidth = cutoffFrequency;
    const bandwidthLimited = effectiveBandwidth < 4000; // Typical phone bandwidth limit
    
    return { effectiveBandwidth, cutoffFrequency, bandwidthLimited };
  }

  private analyzeCompression(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): {
    bandwidthLimitation: boolean;
    codecArtifacts: boolean;
    packetLoss: boolean;
    jitterBuffer: boolean;
  } {
    const bandwidthAnalysis = this.analyzeBandwidth(frequencyAnalysis);
    
    // Bandwidth limitation detection
    const bandwidthLimitation = bandwidthAnalysis.bandwidthLimited;
    
    // Codec artifacts detection
    const codecArtifacts = this.detectCodecArtifacts(frequencyAnalysis);
    
    // Packet loss detection
    const packetLoss = this.detectPacketLoss(buffer);
    
    // Jitter buffer artifacts
    const jitterBuffer = this.detectJitterBufferArtifacts(buffer);
    
    return { bandwidthLimitation, codecArtifacts, packetLoss, jitterBuffer };
  }

  private analyzeCodec(frequencyAnalysis: FrequencyAnalysis): {
    detectedCodec: string;
    confidence: number;
    compressionLevel: number;
  } {
    let bestMatch = 'unknown';
    let bestScore = 0;
    
    // Extract spectral envelope for codec matching
    const spectralEnvelope = this.extractSpectralEnvelope(frequencyAnalysis, 32);
    
    // Compare with known codec signatures
    for (const [codecName, signature] of this.codecSignatures) {
      const similarity = this.calculateCosineSimilarity(spectralEnvelope, signature);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = codecName;
      }
    }
    
    // Estimate compression level
    const compressionLevel = this.estimateCompressionLevel(frequencyAnalysis);
    
    return {
      detectedCodec: bestMatch,
      confidence: bestScore,
      compressionLevel
    };
  }

  private analyzeNetworkCharacteristics(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): {
    latency: number;
    stability: number;
    compressionRatio: number;
  } {
    // Estimate latency from audio characteristics
    const latency = this.estimateLatency(buffer);
    
    // Calculate stability from temporal consistency
    const stability = this.calculateStability(frequencyAnalysis);
    
    // Estimate compression ratio
    const compressionRatio = this.estimateCompressionRatio(frequencyAnalysis);
    
    return { latency, stability, compressionRatio };
  }

  private classifyAsPhoneCall(
    bandwidthAnalysis: any,
    compressionAnalysis: any,
    codecAnalysis: any,
    networkAnalysis: any
  ): boolean {
    // Multiple criteria for phone call detection
    const criteria = [
      bandwidthAnalysis.bandwidthLimited,
      compressionAnalysis.codecArtifacts,
      codecAnalysis.confidence > 0.6,
      networkAnalysis.compressionRatio > 0.3,
      bandwidthAnalysis.effectiveBandwidth < 4000
    ];
    
    // Require at least 3 out of 5 criteria
    const matchedCriteria = criteria.filter(Boolean).length;
    return matchedCriteria >= 3;
  }

  private calculateConfidence(
    bandwidthAnalysis: any,
    compressionAnalysis: any,
    codecAnalysis: any,
    networkAnalysis: any
  ): number {
    let confidence = 0;
    
    // Bandwidth limitation confidence
    if (bandwidthAnalysis.bandwidthLimited) {
      const limitationStrength = Math.max(0, 1 - bandwidthAnalysis.effectiveBandwidth / 4000);
      confidence += limitationStrength * 0.3;
    }
    
    // Codec detection confidence
    confidence += codecAnalysis.confidence * 0.3;
    
    // Compression artifacts confidence
    const artifactCount = Object.values(compressionAnalysis).filter(Boolean).length;
    confidence += (artifactCount / 4) * 0.2;
    
    // Network characteristics confidence
    confidence += Math.min(1, networkAnalysis.compressionRatio) * 0.2;
    
    return Math.min(1.0, Math.max(0.0, confidence));
  }

  private classifyCallType(codecAnalysis: any, networkAnalysis: any): 'cellular' | 'voip' | 'video_call' | 'unknown' {
    const codec = codecAnalysis.detectedCodec;
    const compressionRatio = networkAnalysis.compressionRatio;
    const latency = networkAnalysis.latency;
    
    // Cellular call indicators
    if (codec === 'AMR' || (compressionRatio > 0.7 && latency > 100)) {
      return 'cellular';
    }
    
    // VoIP call indicators
    if (codec === 'Opus' || codec === 'G.729') {
      return 'voip';
    }
    
    // Video call indicators (usually higher quality)
    if (compressionRatio < 0.4 && latency < 100) {
      return 'video_call';
    }
    
    // Traditional landline
    if (codec === 'G.711') {
      return 'cellular'; // Classify as cellular for simplicity
    }
    
    return 'unknown';
  }

  private assessCallQuality(compressionAnalysis: any, networkAnalysis: any): 'poor' | 'fair' | 'good' | 'excellent' {
    let qualityScore = 1.0;
    
    // Reduce quality based on artifacts
    const artifactCount = Object.values(compressionAnalysis).filter(Boolean).length;
    qualityScore -= artifactCount * 0.15;
    
    // Reduce quality based on compression
    qualityScore -= networkAnalysis.compressionRatio * 0.3;
    
    // Reduce quality based on instability
    qualityScore -= (1 - networkAnalysis.stability) * 0.2;
    
    if (qualityScore > 0.8) return 'excellent';
    if (qualityScore > 0.6) return 'good';
    if (qualityScore > 0.4) return 'fair';
    return 'poor';
  }

  private detectCodecArtifacts(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Look for typical codec artifacts
    
    // Quantization noise in high frequencies
    const highFreqNoise = this.getEnergyInRange(frequencyAnalysis, 3000, 4000);
    const midFreqEnergy = this.getEnergyInRange(frequencyAnalysis, 1000, 3000);
    const quantizationNoise = highFreqNoise > midFreqEnergy * 0.1;
    
    // Pre-echo artifacts (energy before main signal)
    const preEcho = this.detectPreEcho(frequencyAnalysis);
    
    // Aliasing artifacts
    const aliasing = this.detectAliasing(frequencyAnalysis);
    
    return quantizationNoise || preEcho || aliasing;
  }

  private detectPacketLoss(buffer: AudioBuffer): boolean {
    // Look for sudden amplitude drops or discontinuities
    const windowSize = 1024;
    let discontinuities = 0;
    
    for (let i = windowSize; i < buffer.data.length - windowSize; i += windowSize) {
      const prevEnergy = this.calculateWindowEnergy(buffer.data, i - windowSize, windowSize);
      const currentEnergy = this.calculateWindowEnergy(buffer.data, i, windowSize);
      
      // Sudden energy drop might indicate packet loss
      if (prevEnergy > 0.01 && currentEnergy < prevEnergy * 0.1) {
        discontinuities++;
      }
    }
    
    const discontinuityRate = discontinuities / (buffer.data.length / windowSize);
    return discontinuityRate > 0.02; // 2% discontinuity rate threshold
  }

  private detectJitterBufferArtifacts(buffer: AudioBuffer): boolean {
    // Jitter buffers can cause time-stretching artifacts
    const pitchVariation = this.calculatePitchVariation(buffer);
    const timeStretchingArtifacts = pitchVariation > 0.1;
    
    return timeStretchingArtifacts;
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

  private estimateCompressionLevel(frequencyAnalysis: FrequencyAnalysis): number {
    // Estimate compression based on spectral characteristics
    const totalEnergy = frequencyAnalysis.magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    const highFreqEnergy = this.getEnergyInRange(frequencyAnalysis, 4000, 8000);
    
    // Higher compression typically reduces high frequency content
    const highFreqRatio = highFreqEnergy / Math.max(totalEnergy, 0.001);
    const compressionLevel = Math.max(0, 1 - highFreqRatio * 10);
    
    return Math.min(1, compressionLevel);
  }

  private estimateLatency(buffer: AudioBuffer): number {
    // Simplified latency estimation based on audio characteristics
    // In practice, this would require more sophisticated analysis
    const energy = this.calculateRMSEnergy(buffer.data);
    const zcr = this.calculateZeroCrossingRate(buffer.data);
    
    // Lower energy and higher ZCR might indicate network processing delays
    const latencyIndicator = (1 - energy) * zcr;
    return Math.min(300, latencyIndicator * 200); // Scale to reasonable latency range
  }

  private calculateStability(frequencyAnalysis: FrequencyAnalysis): number {
    // Calculate spectral stability
    if (this.callHistory.length < 3) return 0.5;
    
    const recentResults = this.callHistory.slice(-3);
    const currentSpectralCentroid = frequencyAnalysis.spectralCentroid;
    
    let totalVariation = 0;
    for (const result of recentResults) {
      // Would need to store spectral centroids in history for proper implementation
      const variation = Math.abs(currentSpectralCentroid - 1500) / 1500; // Placeholder
      totalVariation += variation;
    }
    
    const avgVariation = totalVariation / recentResults.length;
    return Math.max(0, 1 - avgVariation);
  }

  private estimateCompressionRatio(frequencyAnalysis: FrequencyAnalysis): number {
    // Estimate compression ratio based on spectral characteristics
    const spectralFlatness = this.calculateSpectralFlatness(frequencyAnalysis);
    const dynamicRange = this.calculateDynamicRange(frequencyAnalysis);
    
    // Compressed audio typically has reduced dynamic range and spectral flatness
    const compressionRatio = (1 - spectralFlatness) * (1 - dynamicRange);
    return Math.min(1, Math.max(0, compressionRatio));
  }

  private detectPreEcho(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Simplified pre-echo detection
    // Would need temporal analysis for proper implementation
    return false;
  }

  private detectAliasing(frequencyAnalysis: FrequencyAnalysis): boolean {
    // Look for aliasing artifacts near Nyquist frequency
    const nyquist = this.config.sampleRate / 2;
    const nearNyquistEnergy = this.getEnergyInRange(frequencyAnalysis, nyquist * 0.9, nyquist);
    const totalEnergy = frequencyAnalysis.magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    
    return nearNyquistEnergy / Math.max(totalEnergy, 0.001) > 0.05;
  }

  private calculateWindowEnergy(buffer: Float32Array, start: number, length: number): number {
    let sum = 0;
    for (let i = start; i < Math.min(start + length, buffer.length); i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / length);
  }

  private calculatePitchVariation(buffer: AudioBuffer): number {
    // Simplified pitch variation calculation
    const windowSize = 2048;
    const pitches: number[] = [];
    
    for (let i = 0; i < buffer.data.length - windowSize; i += windowSize / 2) {
      const window = buffer.data.slice(i, i + windowSize);
      const pitch = this.estimatePitch(window);
      if (pitch > 0) pitches.push(pitch);
    }
    
    if (pitches.length < 2) return 0;
    
    // Calculate coefficient of variation
    const mean = pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
    const variance = pitches.reduce((sum, p) => sum + (p - mean) ** 2, 0) / pitches.length;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? stdDev / mean : 0;
  }

  private estimatePitch(window: Float32Array): number {
    // Simplified pitch estimation using autocorrelation
    const minPeriod = 20;  // ~2200 Hz max
    const maxPeriod = 400; // ~110 Hz min
    
    let bestPeriod = 0;
    let bestCorrelation = 0;
    
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < window.length - period; i++) {
        correlation += window[i] * window[i + period];
        count++;
      }
      
      correlation /= count;
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return bestPeriod > 0 ? this.config.sampleRate / bestPeriod : 0;
  }

  private calculateSpectralFlatness(frequencyAnalysis: FrequencyAnalysis): number {
    // Calculate spectral flatness (Wiener entropy)
    let geometricMean = 1;
    let arithmeticMean = 0;
    let count = 0;
    
    for (let i = 0; i < frequencyAnalysis.magnitudes.length; i++) {
      const magnitude = frequencyAnalysis.magnitudes[i];
      if (magnitude > 0) {
        geometricMean *= Math.pow(magnitude, 1 / frequencyAnalysis.magnitudes.length);
        arithmeticMean += magnitude;
        count++;
      }
    }
    
    arithmeticMean /= count;
    
    return count > 0 && arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
  }

  private calculateDynamicRange(frequencyAnalysis: FrequencyAnalysis): number {
    const magnitudes = Array.from(frequencyAnalysis.magnitudes).filter(mag => mag > 0);
    if (magnitudes.length === 0) return 0;
    
    const maxMagnitude = Math.max(...magnitudes);
    const minMagnitude = Math.min(...magnitudes);
    
    return maxMagnitude > 0 ? (maxMagnitude - minMagnitude) / maxMagnitude : 0;
  }

  // Utility methods
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

  // Public methods
  getCallHistory(): PhoneCallDetectionResult[] {
    return [...this.callHistory];
  }

  clearHistory(): void {
    this.callHistory = [];
  }

  isCurrentlyInCall(): boolean {
    if (this.callHistory.length === 0) return false;
    
    const recentResults = this.callHistory.slice(-3);
    const callDetections = recentResults.filter(result => result.isPhoneCall).length;
    
    return callDetections >= 2; // Majority vote
  }

  getCurrentCallQuality(): 'poor' | 'fair' | 'good' | 'excellent' | 'unknown' {
    if (this.callHistory.length === 0) return 'unknown';
    
    const latestResult = this.callHistory[this.callHistory.length - 1];
    return latestResult.isPhoneCall ? latestResult.callQuality : 'unknown';
  }
}