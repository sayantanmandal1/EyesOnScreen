/**
 * Advanced keyboard sound detection system for external devices
 */

import { AudioBuffer, FrequencyAnalysis, AudioConfig } from './types';

export interface KeyboardDetectionResult {
  isKeyboardSound: boolean;
  confidence: number;
  keyboardType: 'mechanical' | 'membrane' | 'laptop' | 'virtual' | 'unknown';
  keyPressCharacteristics: {
    attackTime: number;
    sustainTime: number;
    releaseTime: number;
    peakFrequency: number;
    spectralSpread: number;
  };
  typingPattern: {
    isRhythmic: boolean;
    estimatedWPM: number;
    burstTyping: boolean;
    pausePattern: 'natural' | 'artificial' | 'unknown';
  };
  deviceIndicators: {
    externalDevice: boolean;
    bluetoothKeyboard: boolean;
    mechanicalSwitch: boolean;
    touchTyping: boolean;
  };
}

export class KeyboardSoundDetector {
  private config: AudioConfig;
  private keyPressHistory: KeyPressEvent[] = [];
  private maxHistorySize = 100;
  private keyboardSignatures: Map<string, KeyboardSignature> = new Map();
  private typingPatternAnalyzer: TypingPatternAnalyzer;

  constructor(config: AudioConfig) {
    this.config = config;
    this.initializeKeyboardSignatures();
    this.typingPatternAnalyzer = new TypingPatternAnalyzer();
  }

  detectKeyboardSound(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): KeyboardDetectionResult {
    // Analyze transient characteristics
    const transientAnalysis = this.analyzeTransients(buffer);
    
    // Analyze spectral characteristics
    const spectralAnalysis = this.analyzeSpectralCharacteristics(frequencyAnalysis);
    
    // Classify keyboard type
    const keyboardClassification = this.classifyKeyboardType(transientAnalysis, spectralAnalysis);
    
    // Analyze key press characteristics
    const keyPressCharacteristics = this.analyzeKeyPressCharacteristics(buffer, frequencyAnalysis);
    
    // Analyze typing patterns
    const typingPattern = this.analyzeTypingPattern(transientAnalysis, keyPressCharacteristics);
    
    // Detect device indicators
    const deviceIndicators = this.analyzeDeviceIndicators(spectralAnalysis, typingPattern);
    
    // Determine if it's a keyboard sound
    const isKeyboardSound = this.classifyAsKeyboardSound(
      transientAnalysis, 
      spectralAnalysis, 
      keyboardClassification
    );
    
    const confidence = this.calculateConfidence(
      transientAnalysis, 
      spectralAnalysis, 
      keyboardClassification
    );

    // Store key press event
    if (isKeyboardSound) {
      this.keyPressHistory.push({
        timestamp: buffer.timestamp,
        characteristics: keyPressCharacteristics,
        keyboardType: keyboardClassification.type,
        confidence: confidence
      });
      
      if (this.keyPressHistory.length > this.maxHistorySize) {
        this.keyPressHistory.shift();
      }
    }

    return {
      isKeyboardSound,
      confidence,
      keyboardType: keyboardClassification.type,
      keyPressCharacteristics,
      typingPattern,
      deviceIndicators
    };
  }

  private initializeKeyboardSignatures(): void {
    // Mechanical keyboard signature
    this.keyboardSignatures.set('mechanical', {
      attackTime: [0.001, 0.005], // Very fast attack
      peakFrequency: [2000, 8000], // High frequency click
      spectralSpread: [1000, 4000], // Wide spectrum
      sustainTime: [0.01, 0.05], // Short sustain
      releaseTime: [0.05, 0.2], // Medium release
      harmonicContent: 0.3, // Moderate harmonics
      noiseContent: 0.7 // High noise content
    });

    // Membrane keyboard signature
    this.keyboardSignatures.set('membrane', {
      attackTime: [0.005, 0.02], // Slower attack
      peakFrequency: [500, 3000], // Lower frequency
      spectralSpread: [300, 1500], // Narrower spectrum
      sustainTime: [0.02, 0.1], // Longer sustain
      releaseTime: [0.1, 0.5], // Longer release
      harmonicContent: 0.5, // More harmonics
      noiseContent: 0.4 // Less noise
    });

    // Laptop keyboard signature
    this.keyboardSignatures.set('laptop', {
      attackTime: [0.002, 0.01], // Fast attack
      peakFrequency: [1000, 5000], // Mid-high frequency
      spectralSpread: [500, 2500], // Medium spectrum
      sustainTime: [0.005, 0.03], // Very short sustain
      releaseTime: [0.02, 0.1], // Short release
      harmonicContent: 0.4, // Moderate harmonics
      noiseContent: 0.5 // Medium noise
    });

    // Virtual/on-screen keyboard signature
    this.keyboardSignatures.set('virtual', {
      attackTime: [0.01, 0.05], // Artificial attack
      peakFrequency: [800, 2000], // Synthesized frequency
      spectralSpread: [200, 800], // Narrow spectrum
      sustainTime: [0.05, 0.2], // Artificial sustain
      releaseTime: [0.1, 0.3], // Artificial release
      harmonicContent: 0.8, // High harmonics (synthetic)
      noiseContent: 0.1 // Low noise
    });
  }

  private analyzeTransients(buffer: AudioBuffer): TransientAnalysis {
    const data = buffer.data;
    
    // Find attack point
    const attackPoint = this.findAttackPoint(data);
    const peakPoint = this.findPeakPoint(data, attackPoint);
    const releasePoint = this.findReleasePoint(data, peakPoint);
    
    // Calculate timing characteristics
    const sampleRate = this.config.sampleRate;
    const attackTime = attackPoint >= 0 ? (peakPoint - attackPoint) / sampleRate : 0;
    const sustainTime = peakPoint >= 0 && releasePoint >= 0 ? (releasePoint - peakPoint) / sampleRate : 0;
    const releaseTime = releasePoint >= 0 ? (data.length - releasePoint) / sampleRate : 0;
    
    // Calculate energy characteristics
    const peakEnergy = peakPoint >= 0 ? Math.abs(data[peakPoint]) : 0;
    const totalEnergy = this.calculateRMSEnergy(data);
    const transientRatio = peakEnergy / Math.max(totalEnergy, 0.001);
    
    // Analyze attack sharpness
    const attackSharpness = this.calculateAttackSharpness(data, attackPoint, peakPoint);
    
    return {
      hasTransient: attackPoint >= 0 && peakPoint >= 0,
      attackTime,
      sustainTime,
      releaseTime,
      peakEnergy,
      transientRatio,
      attackSharpness,
      attackPoint,
      peakPoint,
      releasePoint
    };
  }

  private analyzeSpectralCharacteristics(frequencyAnalysis: FrequencyAnalysis): SpectralAnalysis {
    // Find peak frequency
    const peakFrequency = this.findPeakFrequency(frequencyAnalysis);
    
    // Calculate spectral spread
    const spectralSpread = this.calculateSpectralSpread(frequencyAnalysis);
    
    // Analyze frequency distribution
    const lowFreqEnergy = this.getEnergyInRange(frequencyAnalysis, 0, 1000);
    const midFreqEnergy = this.getEnergyInRange(frequencyAnalysis, 1000, 4000);
    const highFreqEnergy = this.getEnergyInRange(frequencyAnalysis, 4000, 8000);
    const totalEnergy = lowFreqEnergy + midFreqEnergy + highFreqEnergy;
    
    const frequencyDistribution = {
      low: lowFreqEnergy / Math.max(totalEnergy, 0.001),
      mid: midFreqEnergy / Math.max(totalEnergy, 0.001),
      high: highFreqEnergy / Math.max(totalEnergy, 0.001)
    };
    
    // Calculate harmonic vs noise content
    const harmonicContent = this.calculateHarmonicContent(frequencyAnalysis);
    const noiseContent = 1 - harmonicContent;
    
    // Analyze spectral shape
    const spectralTilt = this.calculateSpectralTilt(frequencyAnalysis);
    const spectralFlatness = this.calculateSpectralFlatness(frequencyAnalysis);
    
    return {
      peakFrequency,
      spectralSpread,
      frequencyDistribution,
      harmonicContent,
      noiseContent,
      spectralTilt,
      spectralFlatness,
      spectralCentroid: frequencyAnalysis.spectralCentroid,
      spectralRolloff: frequencyAnalysis.spectralRolloff
    };
  }

  private classifyKeyboardType(transientAnalysis: TransientAnalysis, spectralAnalysis: SpectralAnalysis): {
    type: 'mechanical' | 'membrane' | 'laptop' | 'virtual' | 'unknown';
    confidence: number;
  } {
    let bestMatch = 'unknown' as const;
    let bestScore = 0;
    
    for (const [keyboardType, signature] of this.keyboardSignatures) {
      const score = this.calculateKeyboardSignatureMatch(transientAnalysis, spectralAnalysis, signature);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = keyboardType as any;
      }
    }
    
    return {
      type: bestMatch,
      confidence: bestScore
    };
  }

  private analyzeKeyPressCharacteristics(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis) {
    const transientAnalysis = this.analyzeTransients(buffer);
    const spectralAnalysis = this.analyzeSpectralCharacteristics(frequencyAnalysis);
    
    return {
      attackTime: transientAnalysis.attackTime,
      sustainTime: transientAnalysis.sustainTime,
      releaseTime: transientAnalysis.releaseTime,
      peakFrequency: spectralAnalysis.peakFrequency,
      spectralSpread: spectralAnalysis.spectralSpread
    };
  }

  private analyzeTypingPattern(transientAnalysis: TransientAnalysis, keyPressCharacteristics: any) {
    const typingPattern = this.typingPatternAnalyzer.analyze(this.keyPressHistory);
    
    return {
      isRhythmic: typingPattern.isRhythmic,
      estimatedWPM: typingPattern.estimatedWPM,
      burstTyping: typingPattern.burstTyping,
      pausePattern: typingPattern.pausePattern
    };
  }

  private analyzeDeviceIndicators(spectralAnalysis: SpectralAnalysis, typingPattern: any) {
    // External device indicators
    const externalDevice = this.detectExternalDevice(spectralAnalysis);
    
    // Bluetooth keyboard indicators
    const bluetoothKeyboard = this.detectBluetoothKeyboard(spectralAnalysis);
    
    // Mechanical switch indicators
    const mechanicalSwitch = this.detectMechanicalSwitch(spectralAnalysis);
    
    // Touch typing indicators
    const touchTyping = this.detectTouchTyping(typingPattern);
    
    return {
      externalDevice,
      bluetoothKeyboard,
      mechanicalSwitch,
      touchTyping
    };
  }

  private classifyAsKeyboardSound(
    transientAnalysis: TransientAnalysis,
    spectralAnalysis: SpectralAnalysis,
    keyboardClassification: any
  ): boolean {
    // Multiple criteria for keyboard sound detection
    const criteria = [
      transientAnalysis.hasTransient,
      transientAnalysis.attackTime < 0.05, // Fast attack
      spectralAnalysis.peakFrequency > 500, // Sufficient frequency content
      spectralAnalysis.noiseContent > 0.2, // Some noise content
      keyboardClassification.confidence > 0.4
    ];
    
    // Require at least 4 out of 5 criteria
    const matchedCriteria = criteria.filter(Boolean).length;
    return matchedCriteria >= 4;
  }

  private calculateConfidence(
    transientAnalysis: TransientAnalysis,
    spectralAnalysis: SpectralAnalysis,
    keyboardClassification: any
  ): number {
    let confidence = 0;
    
    // Transient characteristics confidence
    if (transientAnalysis.hasTransient) {
      confidence += 0.3;
      
      // Attack time confidence
      if (transientAnalysis.attackTime < 0.02) {
        confidence += 0.1;
      }
      
      // Transient ratio confidence
      if (transientAnalysis.transientRatio > 0.5) {
        confidence += 0.1;
      }
    }
    
    // Spectral characteristics confidence
    if (spectralAnalysis.peakFrequency > 1000 && spectralAnalysis.peakFrequency < 6000) {
      confidence += 0.2;
    }
    
    // Keyboard type classification confidence
    confidence += keyboardClassification.confidence * 0.3;
    
    return Math.min(1.0, Math.max(0.0, confidence));
  }

  // Helper methods for transient analysis
  private findAttackPoint(data: Float32Array): number {
    const threshold = 0.1;
    const windowSize = 10;
    
    for (let i = windowSize; i < data.length - windowSize; i++) {
      const currentEnergy = this.calculateWindowEnergy(data, i, windowSize);
      const prevEnergy = this.calculateWindowEnergy(data, i - windowSize, windowSize);
      
      if (currentEnergy > threshold && currentEnergy > prevEnergy * 3) {
        return i;
      }
    }
    
    return -1;
  }

  private findPeakPoint(data: Float32Array, attackPoint: number): number {
    if (attackPoint < 0) return -1;
    
    let maxValue = 0;
    let peakPoint = attackPoint;
    
    // Look for peak within reasonable window after attack
    const searchWindow = Math.min(1000, data.length - attackPoint);
    
    for (let i = attackPoint; i < attackPoint + searchWindow; i++) {
      if (Math.abs(data[i]) > maxValue) {
        maxValue = Math.abs(data[i]);
        peakPoint = i;
      }
    }
    
    return peakPoint;
  }

  private findReleasePoint(data: Float32Array, peakPoint: number): number {
    if (peakPoint < 0) return -1;
    
    const peakValue = Math.abs(data[peakPoint]);
    const releaseThreshold = peakValue * 0.1; // 10% of peak
    
    for (let i = peakPoint; i < data.length; i++) {
      if (Math.abs(data[i]) < releaseThreshold) {
        return i;
      }
    }
    
    return data.length - 1;
  }

  private calculateAttackSharpness(data: Float32Array, attackPoint: number, peakPoint: number): number {
    if (attackPoint < 0 || peakPoint < 0 || peakPoint <= attackPoint) return 0;
    
    const attackDuration = peakPoint - attackPoint;
    const peakValue = Math.abs(data[peakPoint]);
    const attackValue = attackPoint > 0 ? Math.abs(data[attackPoint]) : 0;
    
    // Sharpness is rate of change
    return attackDuration > 0 ? (peakValue - attackValue) / attackDuration : 0;
  }

  // Helper methods for spectral analysis
  private findPeakFrequency(frequencyAnalysis: FrequencyAnalysis): number {
    let maxMagnitude = 0;
    let peakFrequency = 0;
    
    for (let i = 0; i < frequencyAnalysis.frequencies.length; i++) {
      if (frequencyAnalysis.magnitudes[i] > maxMagnitude) {
        maxMagnitude = frequencyAnalysis.magnitudes[i];
        peakFrequency = frequencyAnalysis.frequencies[i];
      }
    }
    
    return peakFrequency;
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

  private calculateHarmonicContent(frequencyAnalysis: FrequencyAnalysis): number {
    // Simplified harmonic content calculation
    const peakFreq = this.findPeakFrequency(frequencyAnalysis);
    if (peakFreq === 0) return 0;
    
    let harmonicEnergy = 0;
    let totalEnergy = 0;
    
    // Check for harmonics
    for (let h = 1; h <= 5; h++) {
      const harmonicFreq = peakFreq * h;
      harmonicEnergy += this.getEnergyAtFrequency(frequencyAnalysis, harmonicFreq, 50);
    }
    
    totalEnergy = frequencyAnalysis.magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    
    return totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
  }

  private calculateSpectralTilt(frequencyAnalysis: FrequencyAnalysis): number {
    // Calculate slope of spectral envelope
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
    
    return (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
  }

  private calculateSpectralFlatness(frequencyAnalysis: FrequencyAnalysis): number {
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

  private calculateKeyboardSignatureMatch(
    transientAnalysis: TransientAnalysis,
    spectralAnalysis: SpectralAnalysis,
    signature: KeyboardSignature
  ): number {
    let score = 0;
    let criteria = 0;
    
    // Attack time match
    if (this.isInRange(transientAnalysis.attackTime, signature.attackTime)) {
      score += 1;
    }
    criteria++;
    
    // Peak frequency match
    if (this.isInRange(spectralAnalysis.peakFrequency, signature.peakFrequency)) {
      score += 1;
    }
    criteria++;
    
    // Spectral spread match
    if (this.isInRange(spectralAnalysis.spectralSpread, signature.spectralSpread)) {
      score += 1;
    }
    criteria++;
    
    // Sustain time match
    if (this.isInRange(transientAnalysis.sustainTime, signature.sustainTime)) {
      score += 1;
    }
    criteria++;
    
    // Release time match
    if (this.isInRange(transientAnalysis.releaseTime, signature.releaseTime)) {
      score += 1;
    }
    criteria++;
    
    // Harmonic content match
    const harmonicDiff = Math.abs(spectralAnalysis.harmonicContent - signature.harmonicContent);
    if (harmonicDiff < 0.2) {
      score += 1;
    }
    criteria++;
    
    // Noise content match
    const noiseDiff = Math.abs(spectralAnalysis.noiseContent - signature.noiseContent);
    if (noiseDiff < 0.2) {
      score += 1;
    }
    criteria++;
    
    return criteria > 0 ? score / criteria : 0;
  }

  // Device detection methods
  private detectExternalDevice(spectralAnalysis: SpectralAnalysis): boolean {
    // External devices often have different acoustic characteristics
    // due to distance and room acoustics
    const hasRoomReflections = spectralAnalysis.spectralFlatness < 0.3;
    const distanceIndicators = spectralAnalysis.frequencyDistribution.high < 0.3;
    
    return hasRoomReflections || distanceIndicators;
  }

  private detectBluetoothKeyboard(spectralAnalysis: SpectralAnalysis): boolean {
    // Bluetooth keyboards might have slight audio processing artifacts
    const hasCompressionArtifacts = spectralAnalysis.spectralTilt > 1.0;
    const limitedBandwidth = spectralAnalysis.spectralRolloff < 6000;
    
    return hasCompressionArtifacts && limitedBandwidth;
  }

  private detectMechanicalSwitch(spectralAnalysis: SpectralAnalysis): boolean {
    // Mechanical switches have characteristic click sounds
    const hasClickSignature = spectralAnalysis.peakFrequency > 2000 && 
                             spectralAnalysis.noiseContent > 0.5;
    const sharpTransient = spectralAnalysis.frequencyDistribution.high > 0.4;
    
    return hasClickSignature && sharpTransient;
  }

  private detectTouchTyping(typingPattern: any): boolean {
    // Touch typing has characteristic rhythm and speed
    return typingPattern.isRhythmic && 
           typingPattern.estimatedWPM > 30 && 
           !typingPattern.burstTyping;
  }

  // Utility methods
  private calculateRMSEnergy(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private calculateWindowEnergy(data: Float32Array, start: number, length: number): number {
    let sum = 0;
    for (let i = start; i < Math.min(start + length, data.length); i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / length);
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

  private isInRange(value: number, range: [number, number]): boolean {
    return value >= range[0] && value <= range[1];
  }

  // Public methods
  getKeyPressHistory(): KeyPressEvent[] {
    return [...this.keyPressHistory];
  }

  clearHistory(): void {
    this.keyPressHistory = [];
  }

  getTypingStatistics() {
    return this.typingPatternAnalyzer.getStatistics(this.keyPressHistory);
  }
}

// Supporting interfaces and classes
interface TransientAnalysis {
  hasTransient: boolean;
  attackTime: number;
  sustainTime: number;
  releaseTime: number;
  peakEnergy: number;
  transientRatio: number;
  attackSharpness: number;
  attackPoint: number;
  peakPoint: number;
  releasePoint: number;
}

interface SpectralAnalysis {
  peakFrequency: number;
  spectralSpread: number;
  frequencyDistribution: {
    low: number;
    mid: number;
    high: number;
  };
  harmonicContent: number;
  noiseContent: number;
  spectralTilt: number;
  spectralFlatness: number;
  spectralCentroid: number;
  spectralRolloff: number;
}

interface KeyboardSignature {
  attackTime: [number, number];
  peakFrequency: [number, number];
  spectralSpread: [number, number];
  sustainTime: [number, number];
  releaseTime: [number, number];
  harmonicContent: number;
  noiseContent: number;
}

interface KeyPressEvent {
  timestamp: number;
  characteristics: any;
  keyboardType: string;
  confidence: number;
}

class TypingPatternAnalyzer {
  analyze(keyPressHistory: KeyPressEvent[]) {
    if (keyPressHistory.length < 5) {
      return {
        isRhythmic: false,
        estimatedWPM: 0,
        burstTyping: false,
        pausePattern: 'unknown' as const
      };
    }

    const intervals = this.calculateIntervals(keyPressHistory);
    const isRhythmic = this.analyzeRhythm(intervals);
    const estimatedWPM = this.estimateWPM(intervals);
    const burstTyping = this.detectBurstTyping(intervals);
    const pausePattern = this.analyzePausePattern(intervals);

    return {
      isRhythmic,
      estimatedWPM,
      burstTyping,
      pausePattern
    };
  }

  private calculateIntervals(keyPressHistory: KeyPressEvent[]): number[] {
    const intervals: number[] = [];
    
    for (let i = 1; i < keyPressHistory.length; i++) {
      const interval = keyPressHistory[i].timestamp - keyPressHistory[i - 1].timestamp;
      intervals.push(interval);
    }
    
    return intervals;
  }

  private analyzeRhythm(intervals: number[]): boolean {
    if (intervals.length < 3) return false;
    
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + (interval - mean) ** 2, 0) / intervals.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    
    return coefficientOfVariation < 0.5; // Relatively consistent timing
  }

  private estimateWPM(intervals: number[]): number {
    if (intervals.length === 0) return 0;
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const avgIntervalSeconds = avgInterval / 1000;
    
    // Assume average of 5 characters per word
    const charactersPerSecond = 1 / avgIntervalSeconds;
    const wordsPerMinute = (charactersPerSecond / 5) * 60;
    
    return Math.min(200, Math.max(0, wordsPerMinute)); // Reasonable WPM range
  }

  private detectBurstTyping(intervals: number[]): boolean {
    if (intervals.length < 5) return false;
    
    // Look for patterns of very fast typing followed by pauses
    let burstCount = 0;
    let fastSequence = 0;
    
    for (const interval of intervals) {
      if (interval < 100) { // Very fast typing (< 100ms between keys)
        fastSequence++;
      } else {
        if (fastSequence >= 3) { // Burst of at least 3 fast key presses
          burstCount++;
        }
        fastSequence = 0;
      }
    }
    
    return burstCount >= 2; // At least 2 bursts detected
  }

  private analyzePausePattern(intervals: number[]): 'natural' | 'artificial' | 'unknown' {
    if (intervals.length < 10) return 'unknown';
    
    const longPauses = intervals.filter(interval => interval > 1000).length;
    const shortPauses = intervals.filter(interval => interval < 200).length;
    const mediumPauses = intervals.length - longPauses - shortPauses;
    
    const pauseDistribution = {
      short: shortPauses / intervals.length,
      medium: mediumPauses / intervals.length,
      long: longPauses / intervals.length
    };
    
    // Natural typing has a mix of pause lengths
    if (pauseDistribution.medium > 0.5 && pauseDistribution.long > 0.1) {
      return 'natural';
    }
    
    // Artificial typing might have very regular patterns
    if (pauseDistribution.short > 0.8 || pauseDistribution.long > 0.5) {
      return 'artificial';
    }
    
    return 'unknown';
  }

  getStatistics(keyPressHistory: KeyPressEvent[]) {
    const intervals = this.calculateIntervals(keyPressHistory);
    
    return {
      totalKeyPresses: keyPressHistory.length,
      averageInterval: intervals.length > 0 ? intervals.reduce((sum, i) => sum + i, 0) / intervals.length : 0,
      estimatedWPM: this.estimateWPM(intervals),
      rhythmScore: this.analyzeRhythm(intervals) ? 1 : 0,
      burstTypingDetected: this.detectBurstTyping(intervals),
      pausePattern: this.analyzePausePattern(intervals)
    };
  }
}