/**
 * Advanced room acoustics analysis for environment verification
 */

import { AudioBuffer, FrequencyAnalysis, AudioConfig } from './types';

export interface RoomAcousticsResult {
    roomCharacteristics: {
        size: 'small' | 'medium' | 'large' | 'very_large';
        type: 'bedroom' | 'office' | 'living_room' | 'bathroom' | 'kitchen' | 'outdoor' | 'public_space' | 'unknown';
        acousticQuality: 'dead' | 'normal' | 'live' | 'reverberant';
    };
    reverberation: {
        rt60: number; // Reverberation time in seconds
        earlyReflections: number;
        lateReverberation: number;
        clarity: number;
    };
    backgroundNoise: {
        level: number;
        type: 'silent' | 'quiet' | 'moderate' | 'noisy' | 'very_noisy';
        spectrum: 'pink' | 'white' | 'brown' | 'colored' | 'unknown';
        sources: string[];
    };
    spatialCharacteristics: {
        directToReverbRatio: number;
        stereoWidth: number;
        acousticCenter: number;
        roomModes: number[];
    };
    environmentalFactors: {
        hardSurfaces: boolean;
        softFurnishing: boolean;
        openSpace: boolean;
        enclosedSpace: boolean;
        multipleRooms: boolean;
    };
    suspiciousIndicators: {
        artificialReverb: boolean;
        processedAudio: boolean;
        locationMasking: boolean;
        environmentChange: boolean;
    };
}

export class RoomAcousticsAnalyzer {
    private config: AudioConfig;
    private acousticHistory: AcousticMeasurement[] = [];
    private maxHistorySize = 50;
    private baselineAcoustics: RoomAcousticsResult | null = null;
    private roomSignatures: Map<string, RoomSignature> = new Map();

    constructor(config: AudioConfig) {
        this.config = config;
        this.initializeRoomSignatures();
    }

    analyzeRoomAcoustics(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis): RoomAcousticsResult {
        // Perform comprehensive acoustic analysis
        const reverbAnalysis = this.analyzeReverberation(buffer, frequencyAnalysis);
        const noiseAnalysis = this.analyzeBackgroundNoise(buffer, frequencyAnalysis);
        const spatialAnalysis = this.analyzeSpatialCharacteristics(buffer, frequencyAnalysis);
        const environmentalAnalysis = this.analyzeEnvironmentalFactors(reverbAnalysis, noiseAnalysis, spatialAnalysis);
        const roomClassification = this.classifyRoom(reverbAnalysis, noiseAnalysis, spatialAnalysis);
        const suspiciousIndicators = this.detectSuspiciousIndicators(reverbAnalysis, noiseAnalysis);

        const result: RoomAcousticsResult = {
            roomCharacteristics: roomClassification,
            reverberation: reverbAnalysis,
            backgroundNoise: noiseAnalysis,
            spatialCharacteristics: spatialAnalysis,
            environmentalFactors: environmentalAnalysis,
            suspiciousIndicators
        };

        // Store measurement in history
        this.acousticHistory.push({
            timestamp: buffer.timestamp,
            result,
            buffer: new Float32Array(buffer.data), // Store copy for analysis
            frequencyAnalysis: { ...frequencyAnalysis }
        });

        if (this.acousticHistory.length > this.maxHistorySize) {
            this.acousticHistory.shift();
        }

        return result;
    }

    setBaseline(result: RoomAcousticsResult): void {
        this.baselineAcoustics = { ...result };
    }

    private initializeRoomSignatures(): void {
        // Small bedroom signature
        this.roomSignatures.set('bedroom', {
            rt60Range: [0.2, 0.6],
            frequencyResponse: 'absorptive_high_freq',
            noiseFloor: [-50, -30], // dB
            spatialWidth: [0.2, 0.5],
            roomModes: [50, 80, 120], // Typical small room modes
            characteristics: ['soft_furnishing', 'enclosed_space']
        });

        // Office signature
        this.roomSignatures.set('office', {
            rt60Range: [0.3, 0.8],
            frequencyResponse: 'balanced',
            noiseFloor: [-45, -25],
            spatialWidth: [0.3, 0.7],
            roomModes: [40, 70, 100, 140],
            characteristics: ['hard_surfaces', 'moderate_absorption']
        });

        // Living room signature
        this.roomSignatures.set('living_room', {
            rt60Range: [0.4, 1.2],
            frequencyResponse: 'variable',
            noiseFloor: [-40, -20],
            spatialWidth: [0.5, 0.9],
            roomModes: [30, 50, 80, 110],
            characteristics: ['mixed_surfaces', 'open_space']
        });

        // Bathroom signature
        this.roomSignatures.set('bathroom', {
            rt60Range: [0.8, 2.0],
            frequencyResponse: 'reflective',
            noiseFloor: [-35, -15],
            spatialWidth: [0.1, 0.4],
            roomModes: [60, 100, 150, 200],
            characteristics: ['hard_surfaces', 'small_enclosed']
        });

        // Kitchen signature
        this.roomSignatures.set('kitchen', {
            rt60Range: [0.5, 1.0],
            frequencyResponse: 'mid_absorptive',
            noiseFloor: [-30, -10],
            spatialWidth: [0.3, 0.6],
            roomModes: [45, 75, 110, 160],
            characteristics: ['hard_surfaces', 'appliance_noise']
        });

        // Outdoor signature
        this.roomSignatures.set('outdoor', {
            rt60Range: [0.0, 0.2],
            frequencyResponse: 'no_reflections',
            noiseFloor: [-25, 5],
            spatialWidth: [0.8, 1.0],
            roomModes: [], // No room modes outdoors
            characteristics: ['no_boundaries', 'wind_noise']
        });

        // Public space signature
        this.roomSignatures.set('public_space', {
            rt60Range: [1.0, 3.0],
            frequencyResponse: 'long_reverb',
            noiseFloor: [-20, 10],
            spatialWidth: [0.7, 1.0],
            roomModes: [20, 35, 50, 70],
            characteristics: ['large_space', 'hard_surfaces', 'crowd_noise']
        });
    }

    private analyzeReverberation(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis) {
        // Calculate RT60 (reverberation time)
        const rt60 = this.calculateRT60(buffer);

        // Analyze early reflections (first 50ms)
        const earlyReflections = this.analyzeEarlyReflections(buffer);

        // Analyze late reverberation (after 50ms)
        const lateReverberation = this.analyzeLateReverberation(buffer);

        // Calculate clarity (C50 - ratio of early to late energy)
        const clarity = this.calculateClarity(earlyReflections, lateReverberation);

        return {
            rt60,
            earlyReflections,
            lateReverberation,
            clarity
        };
    }

    private analyzeBackgroundNoise(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis) {
        // Calculate noise level
        const level = this.calculateNoiseLevel(buffer);

        // Classify noise type
        const type = this.classifyNoiseLevel(level);

        // Analyze noise spectrum
        const spectrum = this.analyzeNoiseSpectrum(frequencyAnalysis);

        // Identify noise sources
        const sources = this.identifyNoiseSources(frequencyAnalysis);

        return {
            level,
            type,
            spectrum,
            sources
        };
    }

    private analyzeSpatialCharacteristics(buffer: AudioBuffer, frequencyAnalysis: FrequencyAnalysis) {
        // Calculate direct-to-reverberant ratio
        const directToReverbRatio = this.calculateDirectToReverbRatio(buffer);

        // Analyze stereo width (simplified for mono input)
        const stereoWidth = this.analyzeStereoWidth(buffer);

        // Find acoustic center
        const acousticCenter = this.findAcousticCenter(frequencyAnalysis);

        // Detect room modes
        const roomModes = this.detectRoomModes(frequencyAnalysis);

        return {
            directToReverbRatio,
            stereoWidth,
            acousticCenter,
            roomModes
        };
    }

    private analyzeEnvironmentalFactors(reverbAnalysis: any, noiseAnalysis: any, spatialAnalysis: any) {
        // Detect hard surfaces (high reverberation, bright spectrum)
        const hardSurfaces = reverbAnalysis.rt60 > 0.8 && spatialAnalysis.directToReverbRatio < 0.3;

        // Detect soft furnishing (absorption, warm spectrum)
        const softFurnishing = reverbAnalysis.rt60 < 0.5 && reverbAnalysis.clarity > 0.7;

        // Detect open space (wide stereo image, long reverb)
        const openSpace = spatialAnalysis.stereoWidth > 0.6 && reverbAnalysis.rt60 > 0.6;

        // Detect enclosed space (narrow image, short reverb)
        const enclosedSpace = spatialAnalysis.stereoWidth < 0.4 && reverbAnalysis.rt60 < 0.8;

        // Detect multiple rooms (complex reverb pattern)
        const multipleRooms = this.detectMultipleRooms(reverbAnalysis);

        return {
            hardSurfaces,
            softFurnishing,
            openSpace,
            enclosedSpace,
            multipleRooms
        };
    }

    private classifyRoom(reverbAnalysis: any, noiseAnalysis: any, spatialAnalysis: any) {
        let bestMatch = 'unknown';
        let bestScore = 0;

        // Compare against known room signatures
        for (const [roomType, signature] of this.roomSignatures) {
            const score = this.calculateRoomSignatureMatch(reverbAnalysis, noiseAnalysis, spatialAnalysis, signature);

            if (score > bestScore) {
                bestScore = score;
                bestMatch = roomType;
            }
        }

        // Classify size based on reverberation and spatial characteristics
        const size = this.classifyRoomSize(reverbAnalysis.rt60, spatialAnalysis.stereoWidth);

        // Classify acoustic quality
        const acousticQuality = this.classifyAcousticQuality(reverbAnalysis.rt60, reverbAnalysis.clarity);

        return {
            size,
            type: bestMatch as any,
            acousticQuality
        };
    }

    private detectSuspiciousIndicators(reverbAnalysis: any, noiseAnalysis: any) {
        // Detect artificial reverb (too perfect, unnatural characteristics)
        const artificialReverb = this.detectArtificialReverb(reverbAnalysis);

        // Detect processed audio (compression, EQ artifacts)
        const processedAudio = this.detectProcessedAudio(noiseAnalysis);

        // Detect location masking attempts
        const locationMasking = this.detectLocationMasking(reverbAnalysis, noiseAnalysis);

        // Detect environment changes from baseline
        const environmentChange = this.detectEnvironmentChange(reverbAnalysis, noiseAnalysis);

        return {
            artificialReverb,
            processedAudio,
            locationMasking,
            environmentChange
        };
    }

    // Reverberation analysis methods
    private calculateRT60(buffer: AudioBuffer): number {
        // Simplified RT60 calculation using energy decay
        const data = buffer.data;
        const windowSize = 1024;
        const energyDecay: number[] = [];

        // Calculate energy in overlapping windows
        for (let i = 0; i < data.length - windowSize; i += windowSize / 4) {
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += data[i + j] * data[i + j];
            }
            energyDecay.push(energy / windowSize);
        }

        if (energyDecay.length < 10) return 0;

        // Find decay from peak to -60dB
        const maxEnergy = Math.max(...energyDecay);
        const targetEnergy = maxEnergy * 0.001; // -60dB = 1/1000 of original

        let peakIndex = energyDecay.indexOf(maxEnergy);
        let decayIndex = -1;

        for (let i = peakIndex; i < energyDecay.length; i++) {
            if (energyDecay[i] <= targetEnergy) {
                decayIndex = i;
                break;
            }
        }

        if (decayIndex === -1) return 0;

        // Convert to time
        const sampleRate = this.config.sampleRate;
        const windowOverlap = windowSize / 4;
        const decayTime = (decayIndex - peakIndex) * windowOverlap / sampleRate;

        return Math.min(3.0, Math.max(0.0, decayTime));
    }

    private analyzeEarlyReflections(buffer: AudioBuffer): number {
        // Analyze energy in first 50ms after direct sound
        const sampleRate = this.config.sampleRate;
        const earlyWindow = Math.floor(0.05 * sampleRate); // 50ms

        if (buffer.data.length < earlyWindow) return 0;

        let earlyEnergy = 0;
        for (let i = 0; i < earlyWindow; i++) {
            earlyEnergy += buffer.data[i] * buffer.data[i];
        }

        return Math.sqrt(earlyEnergy / earlyWindow);
    }

    private analyzeLateReverberation(buffer: AudioBuffer): number {
        // Analyze energy after 50ms
        const sampleRate = this.config.sampleRate;
        const earlyWindow = Math.floor(0.05 * sampleRate);

        if (buffer.data.length <= earlyWindow) return 0;

        let lateEnergy = 0;
        const lateLength = buffer.data.length - earlyWindow;

        for (let i = earlyWindow; i < buffer.data.length; i++) {
            lateEnergy += buffer.data[i] * buffer.data[i];
        }

        return lateLength > 0 ? Math.sqrt(lateEnergy / lateLength) : 0;
    }

    private calculateClarity(earlyReflections: number, lateReverberation: number): number {
        // C50 clarity measure
        const totalEnergy = earlyReflections + lateReverberation;
        return totalEnergy > 0 ? earlyReflections / totalEnergy : 0;
    }

    // Noise analysis methods
    private calculateNoiseLevel(buffer: AudioBuffer): number {
        // Calculate RMS level and convert to dB
        let sum = 0;
        for (let i = 0; i < buffer.data.length; i++) {
            sum += buffer.data[i] * buffer.data[i];
        }
        const rms = Math.sqrt(sum / buffer.data.length);

        // Convert to dB (reference: 1.0 = 0 dB)
        return rms > 0 ? 20 * Math.log10(rms) : -100;
    }

    private classifyNoiseLevel(level: number): 'silent' | 'quiet' | 'moderate' | 'noisy' | 'very_noisy' {
        if (level < -60) return 'silent';
        if (level < -40) return 'quiet';
        if (level < -20) return 'moderate';
        if (level < 0) return 'noisy';
        return 'very_noisy';
    }

    private analyzeNoiseSpectrum(frequencyAnalysis: FrequencyAnalysis): 'pink' | 'white' | 'brown' | 'colored' | 'unknown' {
        // Analyze spectral slope to classify noise type
        const spectralSlope = this.calculateSpectralSlope(frequencyAnalysis);

        if (Math.abs(spectralSlope) < 0.5) return 'white'; // Flat spectrum
        if (spectralSlope < -2) return 'brown'; // -6dB/octave
        if (spectralSlope < -1) return 'pink'; // -3dB/octave
        if (Math.abs(spectralSlope) > 2) return 'colored'; // Significant coloration

        return 'unknown';
    }

    private identifyNoiseSources(frequencyAnalysis: FrequencyAnalysis): string[] {
        const sources: string[] = [];

        // HVAC noise (low frequency hum)
        if (this.getEnergyInRange(frequencyAnalysis, 50, 120) > 0.3) {
            sources.push('HVAC');
        }

        // Traffic noise (broadband with low frequency emphasis)
        if (this.getEnergyInRange(frequencyAnalysis, 100, 1000) > 0.4) {
            sources.push('traffic');
        }

        // Computer fan noise (mid-frequency)
        if (this.getEnergyInRange(frequencyAnalysis, 500, 2000) > 0.3) {
            sources.push('computer_fan');
        }

        // Fluorescent light buzz (high frequency)
        if (this.getEnergyInRange(frequencyAnalysis, 8000, 12000) > 0.2) {
            sources.push('fluorescent_lights');
        }

        // Crowd noise (speech-like spectrum)
        if (this.hasSpeechLikeSpectrum(frequencyAnalysis)) {
            sources.push('crowd_noise');
        }

        return sources;
    }

    // Spatial analysis methods
    private calculateDirectToReverbRatio(buffer: AudioBuffer): number {
        const earlyEnergy = this.analyzeEarlyReflections(buffer);
        const lateEnergy = this.analyzeLateReverberation(buffer);
        const totalEnergy = earlyEnergy + lateEnergy;

        return totalEnergy > 0 ? earlyEnergy / totalEnergy : 0;
    }

    private analyzeStereoWidth(buffer: AudioBuffer): number {
        // Simplified stereo width analysis for mono input
        // In practice, would need stereo input for proper analysis
        const energy = this.calculateRMSEnergy(buffer.data);
        const zcr = this.calculateZeroCrossingRate(buffer.data);

        // Estimate width based on energy distribution and complexity
        return Math.min(1.0, energy * zcr * 10);
    }

    private findAcousticCenter(frequencyAnalysis: FrequencyAnalysis): number {
        // Find the frequency where most energy is concentrated
        return frequencyAnalysis.spectralCentroid;
    }

    private detectRoomModes(frequencyAnalysis: FrequencyAnalysis): number[] {
        const modes: number[] = [];
        const peaks = this.findSpectralPeaks(frequencyAnalysis.magnitudes, 0.1);

        // Look for peaks in low frequency range (room modes typically < 300 Hz)
        for (const peak of peaks) {
            const freq = frequencyAnalysis.frequencies[peak];
            if (freq > 20 && freq < 300) {
                modes.push(freq);
            }
        }

        return modes.sort((a, b) => a - b);
    }

    // Classification methods
    private classifyRoomSize(rt60: number, stereoWidth: number): 'small' | 'medium' | 'large' | 'very_large' {
        const sizeScore = rt60 * 0.7 + stereoWidth * 0.3;

        if (sizeScore < 0.3) return 'small';
        if (sizeScore < 0.6) return 'medium';
        if (sizeScore < 0.9) return 'large';
        return 'very_large';
    }

    private classifyAcousticQuality(rt60: number, clarity: number): 'dead' | 'normal' | 'live' | 'reverberant' {
        if (rt60 < 0.3 && clarity > 0.8) return 'dead';
        if (rt60 > 1.5) return 'reverberant';
        if (rt60 > 0.8 && clarity < 0.5) return 'live';
        return 'normal';
    }

    private calculateRoomSignatureMatch(reverbAnalysis: any, noiseAnalysis: any, spatialAnalysis: any, signature: RoomSignature): number {
        let score = 0;
        let criteria = 0;

        // RT60 match
        if (this.isInRange(reverbAnalysis.rt60, signature.rt60Range)) {
            score += 1;
        }
        criteria++;

        // Noise floor match
        if (this.isInRange(noiseAnalysis.level, signature.noiseFloor)) {
            score += 1;
        }
        criteria++;

        // Spatial width match
        if (this.isInRange(spatialAnalysis.stereoWidth, signature.spatialWidth)) {
            score += 1;
        }
        criteria++;

        // Room modes match
        const modeMatch = this.calculateRoomModeMatch(spatialAnalysis.roomModes, signature.roomModes);
        score += modeMatch;
        criteria++;

        return criteria > 0 ? score / criteria : 0;
    }

    // Suspicious indicator detection
    private detectArtificialReverb(reverbAnalysis: any): boolean {
        // Artificial reverb often has unnatural characteristics
        const tooUniform = reverbAnalysis.clarity > 0.95; // Too clean
        const unnaturalDecay = reverbAnalysis.rt60 > 0 && reverbAnalysis.rt60 % 0.1 === 0; // Too precise

        return tooUniform || unnaturalDecay;
    }

    private detectProcessedAudio(noiseAnalysis: any): boolean {
        // Processed audio might have compression artifacts
        const limitedDynamicRange = noiseAnalysis.spectrum === 'colored';
        const unnaturalNoiseFloor = noiseAnalysis.level < -80 || noiseAnalysis.level > -10;

        return limitedDynamicRange || unnaturalNoiseFloor;
    }

    private detectLocationMasking(reverbAnalysis: any, noiseAnalysis: any): boolean {
        // Attempts to mask location might show inconsistencies
        if (!this.baselineAcoustics) return false;

        const reverbChange = Math.abs(reverbAnalysis.rt60 - this.baselineAcoustics.reverberation.rt60);
        const noiseChange = Math.abs(noiseAnalysis.level - this.baselineAcoustics.backgroundNoise.level);

        // Significant changes might indicate masking attempts
        return reverbChange > 0.5 || noiseChange > 20;
    }

    private detectEnvironmentChange(reverbAnalysis: any, noiseAnalysis: any): boolean {
        if (!this.baselineAcoustics) return false;

        const baseline = this.baselineAcoustics;

        // Check for significant changes from baseline
        const reverbChange = Math.abs(reverbAnalysis.rt60 - baseline.reverberation.rt60) > 0.3;
        const clarityChange = Math.abs(reverbAnalysis.clarity - baseline.reverberation.clarity) > 0.3;
        const noiseChange = Math.abs(noiseAnalysis.level - baseline.backgroundNoise.level) > 15;

        return reverbChange || clarityChange || noiseChange;
    }

    // Utility methods
    private calculateSpectralSlope(frequencyAnalysis: FrequencyAnalysis): number {
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

    private getEnergyInRange(frequencyAnalysis: FrequencyAnalysis, minFreq: number, maxFreq: number): number {
        let energy = 0;
        let totalEnergy = 0;

        for (let i = 0; i < frequencyAnalysis.frequencies.length; i++) {
            const freq = frequencyAnalysis.frequencies[i];
            const magnitude = frequencyAnalysis.magnitudes[i];

            totalEnergy += magnitude * magnitude;

            if (freq >= minFreq && freq <= maxFreq) {
                energy += magnitude * magnitude;
            }
        }

        return totalEnergy > 0 ? energy / totalEnergy : 0;
    }

    private hasSpeechLikeSpectrum(frequencyAnalysis: FrequencyAnalysis): boolean {
        const speechEnergy = this.getEnergyInRange(frequencyAnalysis, 300, 3400);
        return speechEnergy > 0.4;
    }

    private calculateRMSEnergy(data: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        return Math.sqrt(sum / data.length);
    }

    private calculateZeroCrossingRate(data: Float32Array): number {
        let crossings = 0;
        for (let i = 1; i < data.length; i++) {
            if ((data[i] >= 0) !== (data[i - 1] >= 0)) {
                crossings++;
            }
        }
        return crossings / data.length;
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

    private detectMultipleRooms(reverbAnalysis: any): boolean {
        // Multiple rooms might show complex reverb patterns
        // This is a simplified detection
        return reverbAnalysis.rt60 > 1.0 && reverbAnalysis.clarity < 0.4;
    }

    private calculateRoomModeMatch(detectedModes: number[], signatureModes: number[]): number {
        if (signatureModes.length === 0) return detectedModes.length === 0 ? 1 : 0;

        let matches = 0;
        for (const signatureMode of signatureModes) {
            for (const detectedMode of detectedModes) {
                if (Math.abs(detectedMode - signatureMode) < 10) { // 10 Hz tolerance
                    matches++;
                    break;
                }
            }
        }

        return matches / signatureModes.length;
    }

    private isInRange(value: number, range: [number, number]): boolean {
        return value >= range[0] && value <= range[1];
    }

    // Public methods
    getAcousticHistory(): AcousticMeasurement[] {
        return [...this.acousticHistory];
    }

    clearHistory(): void {
        this.acousticHistory = [];
    }

    getEnvironmentStability(): number {
        if (this.acousticHistory.length < 5) return 0.5;

        const recent = this.acousticHistory.slice(-5);
        let totalVariation = 0;

        for (let i = 1; i < recent.length; i++) {
            const prev = recent[i - 1].result;
            const curr = recent[i].result;

            const reverbVariation = Math.abs(curr.reverberation.rt60 - prev.reverberation.rt60);
            const noiseVariation = Math.abs(curr.backgroundNoise.level - prev.backgroundNoise.level);

            totalVariation += (reverbVariation + noiseVariation / 20) / 2; // Normalize noise to 0-1 range
        }

        const avgVariation = totalVariation / (recent.length - 1);
        return Math.max(0, 1 - avgVariation * 5); // Convert to stability score
    }
}

// Supporting interfaces
interface AcousticMeasurement {
    timestamp: number;
    result: RoomAcousticsResult;
    buffer: Float32Array;
    frequencyAnalysis: FrequencyAnalysis;
}

interface RoomSignature {
    rt60Range: [number, number];
    frequencyResponse: string;
    noiseFloor: [number, number];
    spatialWidth: [number, number];
    roomModes: number[];
    characteristics: string[];
}