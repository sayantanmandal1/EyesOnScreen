/**
 * EnvironmentCalibrator - Lighting histogram analysis and baseline storage
 */

import { EnvironmentCalibrationData } from './types';

export class EnvironmentCalibrator {
  private calibrationData: EnvironmentCalibrationData[] = [];
  private baseline: EnvironmentBaseline | null = null;

  /**
   * Add environment calibration data point
   */
  addCalibrationData(data: EnvironmentCalibrationData): void {
    this.calibrationData.push(data);
  }

  /**
   * Clear all calibration data
   */
  clearCalibrationData(): void {
    this.calibrationData = [];
    this.baseline = null;
  }

  /**
   * Analyze lighting histogram from image data
   */
  analyzeLightingHistogram(imageData: ImageData): number[] {
    const histogram = new Array(256).fill(0);
    const data = imageData.data;

    // Calculate luminance for each pixel and build histogram
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate luminance using standard formula
      const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      histogram[luminance]++;
    }

    // Normalize histogram
    const totalPixels = imageData.width * imageData.height;
    return histogram.map(count => count / totalPixels);
  }

  /**
   * Measure shadow stability over time
   */
  measureShadowStability(frames: ImageData[]): number {
    if (frames.length < 2) return 1.0; // Perfect stability with single frame

    const totalVariance = 0;
    const shadowScores: number[] = [];

    // Calculate shadow score for each frame
    frames.forEach(frame => {
      const shadowScore = this.calculateShadowScore(frame);
      shadowScores.push(shadowScore);
    });

    // Calculate variance of shadow scores
    const mean = shadowScores.reduce((sum, score) => sum + score, 0) / shadowScores.length;
    const variance = shadowScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / shadowScores.length;

    // Convert variance to stability score (lower variance = higher stability)
    return Math.max(0, 1 - variance * 10); // Scale factor to normalize
  }

  /**
   * Calculate shadow score for a single frame
   */
  private calculateShadowScore(imageData: ImageData): number {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    let totalGradient = 0;
    let gradientCount = 0;

    // Calculate spatial gradients to detect shadows
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Get luminance of current pixel and neighbors
        const current = this.getLuminance(data[idx], data[idx + 1], data[idx + 2]);
        const right = this.getLuminance(data[idx + 4], data[idx + 5], data[idx + 6]);
        const down = this.getLuminance(data[idx + width * 4], data[idx + width * 4 + 1], data[idx + width * 4 + 2]);
        
        // Calculate gradient magnitude
        const gradX = Math.abs(right - current);
        const gradY = Math.abs(down - current);
        const gradient = Math.sqrt(gradX * gradX + gradY * gradY);
        
        totalGradient += gradient;
        gradientCount++;
      }
    }

    // Return normalized shadow score (higher = more shadows)
    return gradientCount > 0 ? (totalGradient / gradientCount) / 255 : 0;
  }

  /**
   * Calculate luminance from RGB values
   */
  private getLuminance(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /**
   * Calculate interpupillary distance from face landmarks
   */
  calculateIPD(leftEyeLandmarks: number[][], rightEyeLandmarks: number[][]): number {
    if (leftEyeLandmarks.length === 0 || rightEyeLandmarks.length === 0) {
      return 65; // Default IPD in mm
    }

    // Calculate center of each eye
    const leftEyeCenter = this.calculateCentroid(leftEyeLandmarks);
    const rightEyeCenter = this.calculateCentroid(rightEyeLandmarks);

    // Calculate distance in pixels
    const pixelDistance = Math.sqrt(
      Math.pow(rightEyeCenter[0] - leftEyeCenter[0], 2) +
      Math.pow(rightEyeCenter[1] - leftEyeCenter[1], 2)
    );

    // Convert to mm (approximate conversion based on typical face size)
    // This is a rough approximation - in practice, you'd need camera calibration
    const mmPerPixel = 0.2; // Approximate conversion factor
    return pixelDistance * mmPerPixel;
  }

  /**
   * Calculate eye aspect ratio baseline
   */
  calculateEAR(eyeLandmarks: number[][]): number {
    if (eyeLandmarks.length < 6) {
      return 0.3; // Default EAR
    }

    // Calculate vertical distances
    const vertical1 = this.calculateDistance(eyeLandmarks[1], eyeLandmarks[5]);
    const vertical2 = this.calculateDistance(eyeLandmarks[2], eyeLandmarks[4]);
    
    // Calculate horizontal distance
    const horizontal = this.calculateDistance(eyeLandmarks[0], eyeLandmarks[3]);

    // Calculate EAR
    return (vertical1 + vertical2) / (2 * horizontal);
  }

  /**
   * Detect baseline blink rate
   */
  detectBaselineBlinkRate(earValues: number[], timeSpanMs: number): number {
    if (earValues.length === 0 || timeSpanMs <= 0) return 0;

    const earThreshold = 0.25; // Typical blink threshold
    let blinkCount = 0;
    let inBlink = false;

    // Detect blinks as EAR drops below threshold
    for (const ear of earValues) {
      if (ear < earThreshold && !inBlink) {
        blinkCount++;
        inBlink = true;
      } else if (ear >= earThreshold) {
        inBlink = false;
      }
    }

    // Convert to blinks per minute
    return (blinkCount / timeSpanMs) * 60000;
  }

  /**
   * Calculate centroid of landmarks
   */
  private calculateCentroid(landmarks: number[][]): number[] {
    const sum = landmarks.reduce(
      (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
      [0, 0]
    );
    return [sum[0] / landmarks.length, sum[1] / landmarks.length];
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(point1: number[], point2: number[]): number {
    return Math.sqrt(
      Math.pow(point2[0] - point1[0], 2) +
      Math.pow(point2[1] - point1[1], 2)
    );
  }

  /**
   * Create environment baseline from collected data
   */
  createBaseline(): EnvironmentBaseline | null {
    if (this.calibrationData.length === 0) return null;

    // Calculate average histogram
    const avgHistogram = new Array(256).fill(0);
    this.calibrationData.forEach(sample => {
      sample.lightingHistogram.forEach((value, index) => {
        avgHistogram[index] += value;
      });
    });
    avgHistogram.forEach((_, index) => {
      avgHistogram[index] /= this.calibrationData.length;
    });

    // Calculate lighting statistics
    const mean = this.calculateHistogramMean(avgHistogram);
    const variance = this.calculateHistogramVariance(avgHistogram, mean);

    // Calculate shadow stability
    const shadowScores = this.calibrationData.map(d => d.shadowScore);
    const avgShadowScore = shadowScores.reduce((sum, score) => sum + score, 0) / shadowScores.length;
    const shadowStability = 1 - avgShadowScore; // Higher stability = lower shadow score

    // Calculate face and object counts
    const maxFaceCount = Math.max(...this.calibrationData.map(d => d.faceCount));
    const maxObjectCount = Math.max(...this.calibrationData.map(d => d.objectCount));

    this.baseline = {
      lightingHistogram: avgHistogram,
      mean,
      variance,
      shadowStability,
      faceCount: maxFaceCount,
      objectCount: maxObjectCount,
      timestamp: Date.now(),
      quality: this.calculateBaselineQuality(shadowStability, variance, maxFaceCount, maxObjectCount)
    };

    return this.baseline;
  }

  /**
   * Calculate histogram mean
   */
  private calculateHistogramMean(histogram: number[]): number {
    let sum = 0;
    let totalCount = 0;

    histogram.forEach((count, intensity) => {
      sum += intensity * count;
      totalCount += count;
    });

    return totalCount > 0 ? sum / totalCount : 128;
  }

  /**
   * Calculate histogram variance
   */
  private calculateHistogramVariance(histogram: number[], mean: number): number {
    let sum = 0;
    let totalCount = 0;

    histogram.forEach((count, intensity) => {
      sum += count * Math.pow(intensity - mean, 2);
      totalCount += count;
    });

    return totalCount > 0 ? sum / totalCount : 0;
  }

  /**
   * Calculate baseline quality score
   */
  private calculateBaselineQuality(shadowStability: number, variance: number, faceCount: number, objectCount: number): number {
    let quality = 0.5; // Base quality

    // Good shadow stability
    if (shadowStability > 0.8) quality += 0.2;
    else if (shadowStability > 0.6) quality += 0.1;

    // Good lighting variance (not too high, not too low)
    if (variance > 500 && variance < 2000) quality += 0.2;
    else if (variance > 200 && variance < 3000) quality += 0.1;

    // Single face detected
    if (faceCount === 1) quality += 0.2;
    else if (faceCount > 1) quality -= 0.1;

    // No distracting objects
    if (objectCount === 0) quality += 0.1;
    else quality -= objectCount * 0.05;

    return Math.max(0, Math.min(1, quality));
  }

  /**
   * Get current baseline
   */
  getBaseline(): EnvironmentBaseline | null {
    return this.baseline;
  }

  /**
   * Get calibration data count
   */
  getDataCount(): number {
    return this.calibrationData.length;
  }

  /**
   * Validate environment against baseline
   */
  validateEnvironment(currentData: EnvironmentCalibrationData): EnvironmentValidation {
    if (!this.baseline) {
      return {
        isValid: false,
        issues: ['No baseline available'],
        confidence: 0
      };
    }

    const issues: string[] = [];
    let confidence = 1.0;

    // Check lighting consistency
    const lightingDiff = Math.abs(this.calculateHistogramMean(currentData.lightingHistogram) - this.baseline.mean);
    if (lightingDiff > 30) {
      issues.push('Lighting conditions have changed significantly');
      confidence -= 0.3;
    }

    // Check shadow stability
    if (Math.abs(currentData.shadowScore - (1 - this.baseline.shadowStability)) > 0.2) {
      issues.push('Shadow conditions are unstable');
      confidence -= 0.2;
    }

    // Check face count
    if (currentData.faceCount !== this.baseline.faceCount) {
      issues.push('Number of faces in frame has changed');
      confidence -= 0.3;
    }

    // Check object count
    if (currentData.objectCount > this.baseline.objectCount) {
      issues.push('Additional objects detected in frame');
      confidence -= 0.2;
    }

    return {
      isValid: issues.length === 0,
      issues,
      confidence: Math.max(0, confidence)
    };
  }
}

interface EnvironmentBaseline {
  lightingHistogram: number[];
  mean: number;
  variance: number;
  shadowStability: number;
  faceCount: number;
  objectCount: number;
  timestamp: number;
  quality: number;
}

interface EnvironmentValidation {
  isValid: boolean;
  issues: string[];
  confidence: number;
}