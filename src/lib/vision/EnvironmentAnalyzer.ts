/**
 * Environment analysis for lighting stability and shadow detection
 */

export interface LightingAnalysis {
  histogram: number[];
  mean: number;
  variance: number;
  stability: number; // 0-1, higher is more stable
  backlightingSeverity: number; // 0-1, higher is more severe
}

export interface ShadowAnalysis {
  gradientMagnitude: number;
  spatialVariance: number;
  stability: number; // 0-1, higher is more stable
  anomalyDetected: boolean;
}

export interface EnvironmentAnalysis {
  lighting: LightingAnalysis;
  shadow: ShadowAnalysis;
  overallScore: number; // 0-1, higher is better environment
  warnings: string[];
}

export interface EnvironmentAnalyzerConfig {
  histogramBins: number;
  gradientThreshold: number;
  stabilityWindowSize: number;
  backlightingThreshold: number;
  shadowAnomalyThreshold: number;
}

export class EnvironmentAnalyzer {
  private config: EnvironmentAnalyzerConfig;
  private lightingHistory: LightingAnalysis[] = [];
  private shadowHistory: ShadowAnalysis[] = [];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(config: Partial<EnvironmentAnalyzerConfig> = {}) {
    this.config = {
      histogramBins: 256,
      gradientThreshold: 0.1,
      stabilityWindowSize: 30, // frames
      backlightingThreshold: 0.7,
      shadowAnomalyThreshold: 0.6,
      ...config
    };

    // Create canvas for image processing
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Analyze environment conditions from video frame
   */
  analyzeFrame(videoElement: HTMLVideoElement): EnvironmentAnalysis {
    // Set canvas size to match video
    this.canvas.width = videoElement.videoWidth;
    this.canvas.height = videoElement.videoHeight;

    // Draw video frame to canvas
    this.ctx.drawImage(videoElement, 0, 0);
    
    // Get image data
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Perform lighting analysis
    const lighting = this.analyzeLighting(imageData);
    
    // Perform shadow analysis
    const shadow = this.analyzeShadows(imageData);
    
    // Update history
    this.updateHistory(lighting, shadow);
    
    // Calculate overall score and warnings
    const overallScore = this.calculateOverallScore(lighting, shadow);
    const warnings = this.generateWarnings(lighting, shadow);

    return {
      lighting,
      shadow,
      overallScore,
      warnings
    };
  }

  /**
   * Analyze lighting conditions and stability
   */
  private analyzeLighting(imageData: ImageData): LightingAnalysis {
    const { data, width, height } = imageData;
    const histogram = new Array(this.config.histogramBins).fill(0);
    let sum = 0;
    let pixelCount = 0;

    // Calculate histogram and mean
    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale using luminance formula
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[gray]++;
      sum += gray;
      pixelCount++;
    }

    const mean = sum / pixelCount;

    // Calculate variance
    let variance = 0;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      variance += Math.pow(gray - mean, 2);
    }
    variance /= pixelCount;

    // Calculate stability based on history
    const stability = this.calculateLightingStability(histogram, mean, variance);

    // Detect backlighting severity
    const backlightingSeverity = this.detectBacklighting(histogram, mean);

    return {
      histogram,
      mean,
      variance,
      stability,
      backlightingSeverity
    };
  }

  /**
   * Analyze shadows using spatial gradient analysis
   */
  private analyzeShadows(imageData: ImageData): ShadowAnalysis {
    const { data, width, height } = imageData;
    const gradients: number[] = [];

    // Calculate spatial gradients using Sobel operator
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Get surrounding pixels (grayscale)
        const pixels = [
          this.getGrayscale(data, (y - 1) * width + (x - 1), 4),
          this.getGrayscale(data, (y - 1) * width + x, 4),
          this.getGrayscale(data, (y - 1) * width + (x + 1), 4),
          this.getGrayscale(data, y * width + (x - 1), 4),
          this.getGrayscale(data, y * width + (x + 1), 4),
          this.getGrayscale(data, (y + 1) * width + (x - 1), 4),
          this.getGrayscale(data, (y + 1) * width + x, 4),
          this.getGrayscale(data, (y + 1) * width + (x + 1), 4)
        ];

        // Sobel X gradient
        const gx = (-1 * pixels[0]) + (1 * pixels[2]) + 
                   (-2 * pixels[3]) + (2 * pixels[4]) + 
                   (-1 * pixels[5]) + (1 * pixels[7]);

        // Sobel Y gradient
        const gy = (-1 * pixels[0]) + (-2 * pixels[1]) + (-1 * pixels[2]) + 
                   (1 * pixels[5]) + (2 * pixels[6]) + (1 * pixels[7]);

        // Gradient magnitude
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        gradients.push(magnitude);
      }
    }

    // Calculate gradient statistics
    const gradientMagnitude = gradients.reduce((sum, g) => sum + g, 0) / gradients.length;
    
    // Calculate spatial variance of gradients
    const gradientMean = gradientMagnitude;
    const spatialVariance = gradients.reduce((sum, g) => sum + Math.pow(g - gradientMean, 2), 0) / gradients.length;

    // Calculate stability based on history
    const stability = this.calculateShadowStability(gradientMagnitude, spatialVariance);

    // Detect shadow anomalies
    const anomalyDetected = this.detectShadowAnomaly(gradientMagnitude, spatialVariance, stability);

    return {
      gradientMagnitude,
      spatialVariance,
      stability,
      anomalyDetected
    };
  }

  /**
   * Get grayscale value from image data
   */
  private getGrayscale(data: Uint8ClampedArray, pixelIndex: number, stride: number): number {
    const i = pixelIndex * stride;
    return Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  /**
   * Calculate lighting stability based on historical data
   */
  private calculateLightingStability(histogram: number[], mean: number, variance: number): number {
    if (this.lightingHistory.length < 2) {
      return 1.0; // Assume stable initially
    }

    // Compare with recent history
    const recentHistory = this.lightingHistory.slice(-5);
    let stabilityScore = 1.0;

    // Check mean stability
    const meanDiffs = recentHistory.map(h => Math.abs(h.mean - mean));
    const meanStability = 1.0 - Math.min(1.0, meanDiffs.reduce((sum, d) => sum + d, 0) / (meanDiffs.length * 50));

    // Check variance stability
    const varianceDiffs = recentHistory.map(h => Math.abs(h.variance - variance));
    const varianceStability = 1.0 - Math.min(1.0, varianceDiffs.reduce((sum, d) => sum + d, 0) / (varianceDiffs.length * 1000));

    // Check histogram similarity using chi-square test
    let histogramStability = 1.0;
    if (recentHistory.length > 0) {
      const lastHistogram = recentHistory[recentHistory.length - 1].histogram;
      let chiSquare = 0;
      for (let i = 0; i < histogram.length; i++) {
        const expected = lastHistogram[i];
        const observed = histogram[i];
        if (expected > 0) {
          chiSquare += Math.pow(observed - expected, 2) / expected;
        }
      }
      histogramStability = Math.max(0, 1.0 - chiSquare / 10000);
    }

    stabilityScore = (meanStability + varianceStability + histogramStability) / 3;
    return Math.max(0, Math.min(1, stabilityScore));
  }

  /**
   * Detect backlighting severity
   */
  private detectBacklighting(histogram: number[], mean: number): number {
    // Check for bimodal distribution indicating backlighting
    const totalPixels = histogram.reduce((sum, count) => sum + count, 0);
    
    // Find peaks in histogram
    const peaks: number[] = [];
    for (let i = 1; i < histogram.length - 1; i++) {
      if (histogram[i] > histogram[i - 1] && histogram[i] > histogram[i + 1] && histogram[i] > totalPixels * 0.01) {
        peaks.push(i);
      }
    }

    // Check for dark peak (shadows) and bright peak (background)
    const darkPeaks = peaks.filter(p => p < 85); // Dark region
    const brightPeaks = peaks.filter(p => p > 170); // Bright region

    let backlightingSeverity = 0;

    if (darkPeaks.length > 0 && brightPeaks.length > 0) {
      // Bimodal distribution detected
      const darkPeak = Math.max(...darkPeaks.map(p => histogram[p]));
      const brightPeak = Math.max(...brightPeaks.map(p => histogram[p]));
      const midRange = histogram.slice(85, 170).reduce((sum, count) => sum + count, 0);
      
      // Severity based on peak heights and valley depth
      const peakRatio = Math.min(darkPeak, brightPeak) / Math.max(darkPeak, brightPeak);
      const valleyDepth = 1.0 - (midRange / totalPixels) / 0.3; // Expected mid-range proportion
      
      backlightingSeverity = Math.min(1.0, peakRatio * valleyDepth * 2);
    }

    return backlightingSeverity;
  }

  /**
   * Calculate shadow stability based on historical data
   */
  private calculateShadowStability(gradientMagnitude: number, spatialVariance: number): number {
    if (this.shadowHistory.length < 2) {
      return 1.0; // Assume stable initially
    }

    const recentHistory = this.shadowHistory.slice(-5);
    
    // Check gradient magnitude stability
    const gradientDiffs = recentHistory.map(h => Math.abs(h.gradientMagnitude - gradientMagnitude));
    const gradientStability = 1.0 - Math.min(1.0, gradientDiffs.reduce((sum, d) => sum + d, 0) / (gradientDiffs.length * 20));

    // Check spatial variance stability
    const varianceDiffs = recentHistory.map(h => Math.abs(h.spatialVariance - spatialVariance));
    const varianceStability = 1.0 - Math.min(1.0, varianceDiffs.reduce((sum, d) => sum + d, 0) / (varianceDiffs.length * 100));

    return (gradientStability + varianceStability) / 2;
  }

  /**
   * Detect shadow anomalies
   */
  private detectShadowAnomaly(gradientMagnitude: number, spatialVariance: number, stability: number): boolean {
    // Anomaly if gradient magnitude is unusually high (sharp shadows)
    const highGradient = gradientMagnitude > this.config.gradientThreshold * 100;
    
    // Anomaly if spatial variance is high (inconsistent lighting)
    const highVariance = spatialVariance > 500;
    
    // Anomaly if stability is low
    const lowStability = stability < this.config.shadowAnomalyThreshold;

    return highGradient || highVariance || lowStability;
  }

  /**
   * Update historical data
   */
  private updateHistory(lighting: LightingAnalysis, shadow: ShadowAnalysis): void {
    this.lightingHistory.push(lighting);
    this.shadowHistory.push(shadow);

    // Keep only recent history
    if (this.lightingHistory.length > this.config.stabilityWindowSize) {
      this.lightingHistory.shift();
    }
    if (this.shadowHistory.length > this.config.stabilityWindowSize) {
      this.shadowHistory.shift();
    }
  }

  /**
   * Calculate overall environment score
   */
  private calculateOverallScore(lighting: LightingAnalysis, shadow: ShadowAnalysis): number {
    // Weight different factors
    const lightingWeight = 0.4;
    const shadowWeight = 0.3;
    const stabilityWeight = 0.3;

    const lightingScore = Math.max(0, 1.0 - lighting.backlightingSeverity);
    const shadowScore = shadow.anomalyDetected ? 0.3 : 1.0;
    const stabilityScore = (lighting.stability + shadow.stability) / 2;

    return (lightingScore * lightingWeight + 
            shadowScore * shadowWeight + 
            stabilityScore * stabilityWeight);
  }

  /**
   * Generate warnings based on analysis
   */
  private generateWarnings(lighting: LightingAnalysis, shadow: ShadowAnalysis): string[] {
    const warnings: string[] = [];

    if (lighting.backlightingSeverity > this.config.backlightingThreshold) {
      warnings.push('Severe backlighting detected. Please adjust your position or lighting.');
    }

    if (lighting.stability < 0.5) {
      warnings.push('Unstable lighting conditions. Please ensure consistent lighting.');
    }

    if (shadow.anomalyDetected) {
      warnings.push('Shadow anomalies detected. Please check for objects casting shadows.');
    }

    if (shadow.stability < 0.5) {
      warnings.push('Unstable shadow conditions. Please minimize movement of objects around you.');
    }

    if (lighting.variance > 2000) {
      warnings.push('High lighting variance detected. Please ensure even lighting across your face.');
    }

    return warnings;
  }

  /**
   * Get baseline lighting conditions for calibration
   */
  getBaselineLighting(): LightingAnalysis | null {
    if (this.lightingHistory.length === 0) {
      return null;
    }

    // Return average of recent stable measurements
    const stableHistory = this.lightingHistory.filter(h => h.stability > 0.7);
    if (stableHistory.length === 0) {
      return this.lightingHistory[this.lightingHistory.length - 1];
    }

    // Calculate average
    const avgHistogram = new Array(this.config.histogramBins).fill(0);
    let avgMean = 0;
    let avgVariance = 0;
    let avgStability = 0;
    let avgBacklighting = 0;

    stableHistory.forEach(h => {
      h.histogram.forEach((count, i) => avgHistogram[i] += count);
      avgMean += h.mean;
      avgVariance += h.variance;
      avgStability += h.stability;
      avgBacklighting += h.backlightingSeverity;
    });

    const count = stableHistory.length;
    avgHistogram.forEach((_, i) => avgHistogram[i] /= count);
    avgMean /= count;
    avgVariance /= count;
    avgStability /= count;
    avgBacklighting /= count;

    return {
      histogram: avgHistogram,
      mean: avgMean,
      variance: avgVariance,
      stability: avgStability,
      backlightingSeverity: avgBacklighting
    };
  }

  /**
   * Reset analysis history
   */
  reset(): void {
    this.lightingHistory = [];
    this.shadowHistory = [];
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.reset();
    // Canvas will be garbage collected
  }
}