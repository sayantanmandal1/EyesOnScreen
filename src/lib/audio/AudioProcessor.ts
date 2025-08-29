/**
 * Core audio processing engine for real-time audio monitoring
 */

import { AudioSignals, AudioConfig, AudioBuffer, FrequencyAnalysis, AudioError } from './types';

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isProcessing = false;
  private config: AudioConfig;
  private onSignalsCallback: ((signals: AudioSignals) => void) | null = null;

  constructor(config: AudioConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

      // Create script processor for real-time analysis
      this.scriptProcessor = this.audioContext.createScriptProcessor(
        this.config.bufferSize, 1, 1
      );

      // Connect audio nodes
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      this.analyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      // Set up audio processing callback
      this.scriptProcessor.onaudioprocess = (event) => {
        if (this.isProcessing) {
          this.processAudioFrame(event);
        }
      };

    } catch (error) {
      const audioError = new Error(`Failed to initialize audio processor: ${error.message}`) as AudioError;
      audioError.code = 'AUDIO_CONTEXT_ERROR';
      audioError.details = { originalError: error };
      throw audioError;
    }
  }

  startProcessing(callback: (signals: AudioSignals) => void): void {
    if (!this.audioContext || !this.analyser) {
      const error = new Error('Audio processor not initialized') as AudioError;
      error.code = 'PROCESSING_ERROR';
      throw error;
    }

    this.onSignalsCallback = callback;
    this.isProcessing = true;

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  stopProcessing(): void {
    this.isProcessing = false;
    this.onSignalsCallback = null;
  }

  private processAudioFrame(event: AudioProcessingEvent): void {
    if (!this.analyser || !this.onSignalsCallback) return;

    const inputBuffer = event.inputBuffer.getChannelData(0);
    const timestamp = Date.now();

    // Create audio buffer
    const audioBuffer: AudioBuffer = {
      data: new Float32Array(inputBuffer),
      timestamp,
      sampleRate: this.config.sampleRate
    };

    // Perform frequency analysis
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    const timeDomainData = new Uint8Array(this.analyser.fftSize);
    
    this.analyser.getByteFrequencyData(frequencyData);
    this.analyser.getByteTimeDomainData(timeDomainData);

    const frequencyAnalysis = this.performFrequencyAnalysis(
      audioBuffer, frequencyData, timeDomainData
    );

    // Generate audio signals
    const signals = this.generateAudioSignals(audioBuffer, frequencyAnalysis, timestamp);
    
    this.onSignalsCallback(signals);
  }

  private performFrequencyAnalysis(
    buffer: AudioBuffer, 
    frequencyData: Uint8Array, 
    timeDomainData: Uint8Array
  ): FrequencyAnalysis {
    const fftSize = this.config.fftSize;
    const sampleRate = this.config.sampleRate;
    
    // Convert to float arrays for processing
    const frequencies = new Float32Array(frequencyData.length);
    const magnitudes = new Float32Array(frequencyData.length);
    
    for (let i = 0; i < frequencyData.length; i++) {
      frequencies[i] = (i * sampleRate) / (2 * frequencyData.length);
      magnitudes[i] = frequencyData[i] / 255.0;
    }

    // Calculate spectral features
    const spectralCentroid = this.calculateSpectralCentroid(frequencies, magnitudes);
    const spectralRolloff = this.calculateSpectralRolloff(frequencies, magnitudes);
    const spectralFlux = this.calculateSpectralFlux(magnitudes);
    const dominantFrequency = this.findDominantFrequency(frequencies, magnitudes);
    const mfcc = this.calculateMFCC(magnitudes);

    return {
      frequencies,
      magnitudes,
      phases: new Float32Array(magnitudes.length), // Simplified - would need FFT for actual phases
      dominantFrequency,
      spectralCentroid,
      spectralRolloff,
      spectralFlux,
      mfcc
    };
  }

  private generateAudioSignals(
    buffer: AudioBuffer, 
    analysis: FrequencyAnalysis, 
    timestamp: number
  ): AudioSignals {
    // Voice activity detection
    const voiceActivity = this.detectVoiceActivity(buffer, analysis);
    
    // Background conversation detection
    const backgroundConversation = this.detectBackgroundConversation(analysis);
    
    // Whisper detection
    const whisperDetected = this.detectWhisper(buffer, analysis);
    
    // Human voice classification
    const humanVoicePresent = this.classifyHumanVoice(analysis);
    
    // Phone call detection
    const phoneCallDetected = this.detectPhoneCall(analysis);
    
    // Keyboard sounds detection
    const keyboardSoundsDetected = this.detectKeyboardSounds(analysis);
    
    // Room acoustics analysis
    const roomAcoustics = this.analyzeRoomAcoustics(buffer, analysis);
    
    // Device sounds detection
    const deviceSounds = this.detectDeviceSounds(analysis);
    
    // Audio fingerprinting
    const audioFingerprint = this.generateAudioFingerprint(analysis);

    return {
      timestamp,
      voiceActivityDetected: voiceActivity.isActive,
      voiceConfidence: voiceActivity.confidence,
      backgroundConversation,
      whisperDetected,
      humanVoicePresent,
      phoneCallDetected,
      keyboardSoundsDetected,
      roomAcoustics,
      deviceSounds,
      audioFingerprint
    };
  }

  private detectVoiceActivity(buffer: AudioBuffer, analysis: FrequencyAnalysis): { isActive: boolean; confidence: number } {
    // Calculate energy in voice frequency range (85-255 Hz fundamental, 1-4 kHz formants)
    const voiceEnergyLow = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 85, 255);
    const voiceEnergyMid = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 1000, 4000);
    const totalEnergy = analysis.magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    
    // Voice activity indicators
    const energyRatio = (voiceEnergyLow + voiceEnergyMid) / Math.max(totalEnergy, 0.001);
    const spectralCentroidInVoiceRange = analysis.spectralCentroid > 500 && analysis.spectralCentroid < 3000;
    const hasHarmonics = this.detectHarmonics(analysis.frequencies, analysis.magnitudes);
    
    const confidence = Math.min(1.0, energyRatio * 2 + (spectralCentroidInVoiceRange ? 0.3 : 0) + (hasHarmonics ? 0.4 : 0));
    const isActive = confidence > this.config.thresholds.voiceActivity;
    
    return { isActive, confidence };
  }

  private detectBackgroundConversation(analysis: FrequencyAnalysis): boolean {
    // Look for multiple voice signatures or overlapping speech patterns
    const multipleVoiceIndicators = this.detectMultipleVoices(analysis);
    const conversationPatterns = this.detectConversationPatterns(analysis);
    
    return multipleVoiceIndicators || conversationPatterns;
  }

  private detectWhisper(buffer: AudioBuffer, analysis: FrequencyAnalysis): boolean {
    // Whispers have lower energy but similar spectral characteristics to normal speech
    const lowEnergy = this.calculateRMSEnergy(buffer.data) < this.config.thresholds.whisperLevel;
    const speechLikeSpectrum = this.hasSpeechLikeSpectrum(analysis);
    const highFrequencyContent = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 2000, 8000) > 0.1;
    
    return lowEnergy && speechLikeSpectrum && highFrequencyContent;
  }

  private classifyHumanVoice(analysis: FrequencyAnalysis): boolean {
    // Human voice characteristics: fundamental frequency, formants, harmonics
    const fundamentalInRange = analysis.dominantFrequency >= 85 && analysis.dominantFrequency <= 255;
    const hasFormants = this.detectFormants(analysis.frequencies, analysis.magnitudes);
    const harmonicStructure = this.detectHarmonics(analysis.frequencies, analysis.magnitudes);
    const spectralShape = this.analyzeSpeechSpectralShape(analysis);
    
    return fundamentalInRange && hasFormants && harmonicStructure && spectralShape;
  }

  private detectPhoneCall(analysis: FrequencyAnalysis): boolean {
    // Phone calls often have compressed frequency range and specific artifacts
    const compressedSpectrum = this.detectCompressedSpectrum(analysis);
    const phoneArtifacts = this.detectPhoneArtifacts(analysis);
    const limitedBandwidth = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 300, 3400) > 
                            this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 0, 300) * 2;
    
    return compressedSpectrum && (phoneArtifacts || limitedBandwidth);
  }

  private detectKeyboardSounds(analysis: FrequencyAnalysis): boolean {
    // Keyboard sounds have characteristic click patterns and frequency signatures
    const clickPattern = this.detectClickPattern(analysis);
    const mechanicalSignature = this.detectMechanicalKeyboardSignature(analysis);
    const shortDuration = true; // Would need temporal analysis for actual implementation
    
    return (clickPattern || mechanicalSignature) && shortDuration;
  }

  private analyzeRoomAcoustics(buffer: AudioBuffer, analysis: FrequencyAnalysis) {
    const reverberation = this.calculateReverberation(buffer);
    const backgroundNoise = this.calculateBackgroundNoise(analysis);
    const environmentType = this.classifyEnvironment(reverberation, backgroundNoise, analysis);
    
    return {
      reverberation,
      backgroundNoise,
      environmentType
    };
  }

  private detectDeviceSounds(analysis: FrequencyAnalysis) {
    return {
      phoneVibration: this.detectPhoneVibration(analysis),
      notificationSounds: this.detectNotificationSounds(analysis),
      electronicBeeps: this.detectElectronicBeeps(analysis)
    };
  }

  private generateAudioFingerprint(analysis: FrequencyAnalysis) {
    return {
      spectralCentroid: analysis.spectralCentroid,
      mfccFeatures: analysis.mfcc,
      voicePrint: this.generateVoicePrint(analysis)
    };
  }

  // Helper methods for audio analysis
  private calculateSpectralCentroid(frequencies: Float32Array, magnitudes: Float32Array): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < frequencies.length; i++) {
      weightedSum += frequencies[i] * magnitudes[i];
      magnitudeSum += magnitudes[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateSpectralRolloff(frequencies: Float32Array, magnitudes: Float32Array): number {
    const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    const threshold = 0.85 * totalEnergy;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      cumulativeEnergy += magnitudes[i] * magnitudes[i];
      if (cumulativeEnergy >= threshold) {
        return frequencies[i];
      }
    }
    
    return frequencies[frequencies.length - 1];
  }

  private calculateSpectralFlux(magnitudes: Float32Array): number {
    // Simplified - would need previous frame for actual flux calculation
    let flux = 0;
    for (let i = 1; i < magnitudes.length; i++) {
      const diff = magnitudes[i] - magnitudes[i - 1];
      flux += diff > 0 ? diff : 0;
    }
    return flux / magnitudes.length;
  }

  private findDominantFrequency(frequencies: Float32Array, magnitudes: Float32Array): number {
    let maxMagnitude = 0;
    let dominantFreq = 0;
    
    for (let i = 0; i < magnitudes.length; i++) {
      if (magnitudes[i] > maxMagnitude) {
        maxMagnitude = magnitudes[i];
        dominantFreq = frequencies[i];
      }
    }
    
    return dominantFreq;
  }

  private calculateMFCC(magnitudes: Float32Array): Float32Array {
    // Simplified MFCC calculation - would need mel filter bank for full implementation
    const mfcc = new Float32Array(13);
    const melFilters = this.createMelFilterBank(magnitudes.length);
    
    for (let i = 0; i < 13; i++) {
      let sum = 0;
      for (let j = 0; j < magnitudes.length; j++) {
        sum += magnitudes[j] * melFilters[i][j];
      }
      mfcc[i] = Math.log(Math.max(sum, 1e-10));
    }
    
    return mfcc;
  }

  private createMelFilterBank(numBins: number): number[][] {
    // Simplified mel filter bank creation
    const numFilters = 13;
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

  private getEnergyInRange(frequencies: Float32Array, magnitudes: Float32Array, minFreq: number, maxFreq: number): number {
    let energy = 0;
    for (let i = 0; i < frequencies.length; i++) {
      if (frequencies[i] >= minFreq && frequencies[i] <= maxFreq) {
        energy += magnitudes[i] * magnitudes[i];
      }
    }
    return energy;
  }

  private detectHarmonics(frequencies: Float32Array, magnitudes: Float32Array): boolean {
    // Look for harmonic structure in the spectrum
    const fundamental = this.findDominantFrequency(frequencies, magnitudes);
    if (fundamental < 85 || fundamental > 255) return false;
    
    let harmonicCount = 0;
    for (let harmonic = 2; harmonic <= 5; harmonic++) {
      const harmonicFreq = fundamental * harmonic;
      const energy = this.getEnergyInRange(frequencies, magnitudes, harmonicFreq - 20, harmonicFreq + 20);
      if (energy > 0.1) harmonicCount++;
    }
    
    return harmonicCount >= 2;
  }

  private detectMultipleVoices(analysis: FrequencyAnalysis): boolean {
    // Simplified - would need more sophisticated analysis for actual implementation
    return analysis.spectralFlux > 0.5 && analysis.spectralCentroid > 1000;
  }

  private detectConversationPatterns(analysis: FrequencyAnalysis): boolean {
    // Look for conversation-like patterns in the audio
    return this.detectHarmonics(analysis.frequencies, analysis.magnitudes) && 
           analysis.spectralCentroid > 800 && analysis.spectralCentroid < 2500;
  }

  private calculateRMSEnergy(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  private hasSpeechLikeSpectrum(analysis: FrequencyAnalysis): boolean {
    const voiceRange = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 300, 3400);
    const totalEnergy = analysis.magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    return voiceRange / Math.max(totalEnergy, 0.001) > 0.6;
  }

  private detectFormants(frequencies: Float32Array, magnitudes: Float32Array): boolean {
    // Look for formant peaks typical of human speech
    const f1Energy = this.getEnergyInRange(frequencies, magnitudes, 500, 1200);
    const f2Energy = this.getEnergyInRange(frequencies, magnitudes, 1200, 2500);
    const f3Energy = this.getEnergyInRange(frequencies, magnitudes, 2500, 3500);
    
    return f1Energy > 0.1 && f2Energy > 0.1 && f3Energy > 0.05;
  }

  private analyzeSpeechSpectralShape(analysis: FrequencyAnalysis): boolean {
    // Human speech has characteristic spectral tilt
    const lowEnergy = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 0, 1000);
    const midEnergy = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 1000, 4000);
    const highEnergy = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 4000, 8000);
    
    return midEnergy > lowEnergy && midEnergy > highEnergy;
  }

  private detectCompressedSpectrum(analysis: FrequencyAnalysis): boolean {
    // Phone calls typically have limited bandwidth
    const phoneRange = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 300, 3400);
    const fullRange = analysis.magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    
    return phoneRange / Math.max(fullRange, 0.001) > 0.8;
  }

  private detectPhoneArtifacts(analysis: FrequencyAnalysis): boolean {
    // Look for compression artifacts and limited dynamic range
    return analysis.spectralFlux < 0.2 && analysis.spectralRolloff < 3500;
  }

  private detectClickPattern(analysis: FrequencyAnalysis): boolean {
    // Keyboard clicks have sharp transients and broad spectrum
    return analysis.spectralFlux > 0.8 && analysis.spectralRolloff > 5000;
  }

  private detectMechanicalKeyboardSignature(analysis: FrequencyAnalysis): boolean {
    // Mechanical keyboards have characteristic frequency signatures
    const clickFreq = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 2000, 8000);
    const totalEnergy = analysis.magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    
    return clickFreq / Math.max(totalEnergy, 0.001) > 0.4;
  }

  private calculateReverberation(buffer: AudioBuffer): number {
    // Simplified reverberation calculation
    const energy = this.calculateRMSEnergy(buffer.data);
    return Math.min(1.0, energy * 2); // Placeholder calculation
  }

  private calculateBackgroundNoise(analysis: FrequencyAnalysis): number {
    // Calculate average noise floor
    const sortedMagnitudes = Array.from(analysis.magnitudes).sort((a, b) => a - b);
    const noiseFloor = sortedMagnitudes.slice(0, Math.floor(sortedMagnitudes.length * 0.1));
    return noiseFloor.reduce((sum, mag) => sum + mag, 0) / noiseFloor.length;
  }

  private classifyEnvironment(reverberation: number, backgroundNoise: number, analysis: FrequencyAnalysis): 'quiet' | 'normal' | 'noisy' | 'public' {
    if (backgroundNoise > 0.3) return 'noisy';
    if (reverberation > 0.7) return 'public';
    if (backgroundNoise < 0.1 && reverberation < 0.3) return 'quiet';
    return 'normal';
  }

  private detectPhoneVibration(analysis: FrequencyAnalysis): boolean {
    // Phone vibrations typically have low frequency components
    const lowFreqEnergy = this.getEnergyInRange(analysis.frequencies, analysis.magnitudes, 20, 200);
    return lowFreqEnergy > 0.2;
  }

  private detectNotificationSounds(analysis: FrequencyAnalysis): boolean {
    // Notification sounds often have pure tones or simple melodies
    const pureTonesDetected = this.detectPureTones(analysis);
    const melodicPattern = analysis.spectralCentroid > 1000 && analysis.spectralFlux > 0.3;
    
    return pureTonesDetected || melodicPattern;
  }

  private detectElectronicBeeps(analysis: FrequencyAnalysis): boolean {
    // Electronic beeps are typically pure tones at specific frequencies
    return this.detectPureTones(analysis) && analysis.dominantFrequency > 800;
  }

  private detectPureTones(analysis: FrequencyAnalysis): boolean {
    // Look for narrow peaks in the spectrum
    const peakCount = this.countSpectralPeaks(analysis.magnitudes);
    return peakCount <= 3 && analysis.dominantFrequency > 0;
  }

  private countSpectralPeaks(magnitudes: Float32Array): number {
    let peakCount = 0;
    const threshold = 0.1;
    
    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (magnitudes[i] > threshold && 
          magnitudes[i] > magnitudes[i - 1] && 
          magnitudes[i] > magnitudes[i + 1]) {
        peakCount++;
      }
    }
    
    return peakCount;
  }

  private generateVoicePrint(analysis: FrequencyAnalysis): Float32Array {
    // Generate a voice fingerprint from MFCC and spectral features
    const voicePrint = new Float32Array(20);
    
    // Copy MFCC features
    for (let i = 0; i < Math.min(13, voicePrint.length); i++) {
      voicePrint[i] = analysis.mfcc[i];
    }
    
    // Add spectral features
    if (voicePrint.length > 13) {
      voicePrint[13] = analysis.spectralCentroid / 4000; // Normalized
      voicePrint[14] = analysis.spectralRolloff / 8000; // Normalized
      voicePrint[15] = analysis.spectralFlux;
      voicePrint[16] = analysis.dominantFrequency / 500; // Normalized
    }
    
    return voicePrint;
  }

  dispose(): void {
    this.stopProcessing();
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }
}