/**
 * Outlier Detection for signal processing
 * 
 * Provides various methods to detect and filter outliers in temporal data
 */

import { CircularBuffer } from './CircularBuffer';

export interface OutlierDetectionResult {
  isOutlier: boolean;
  confidence: number;
  filteredValue: number;
  originalValue: number;
}

export class OutlierDetector {
  private buffer: CircularBuffer<number>;
  private zScoreThreshold: number;
  private iqrMultiplier: number;

  constructor(
    windowSize = 10,
    zScoreThreshold = 2.5,
    iqrMultiplier = 1.5
  ) {
    this.buffer = new CircularBuffer<number>(windowSize);
    this.zScoreThreshold = zScoreThreshold;
    this.iqrMultiplier = iqrMultiplier;
  }

  /**
   * Process a new value and detect outliers
   */
  process(value: number): OutlierDetectionResult {
    this.buffer.push(value);

    const result: OutlierDetectionResult = {
      isOutlier: false,
      confidence: 0,
      filteredValue: value,
      originalValue: value
    };

    // Need at least 3 values for outlier detection
    if (this.buffer.getSize() < 3) {
      return result;
    }

    // Use both Z-score and IQR methods
    const zScoreResult = this.detectByZScore(value);
    const iqrResult = this.detectByIQR(value);

    // Combine results
    result.isOutlier = zScoreResult.isOutlier || iqrResult.isOutlier;
    result.confidence = Math.max(zScoreResult.confidence, iqrResult.confidence);

    // If outlier detected, use filtered value
    if (result.isOutlier) {
      result.filteredValue = this.getFilteredValue(value);
    }

    return result;
  }

  /**
   * Detect outliers using Z-score method
   */
  private detectByZScore(value: number): { isOutlier: boolean; confidence: number } {
    const mean = this.buffer.mean();
    const stdDev = this.buffer.standardDeviation();

    if (stdDev === 0) {
      return { isOutlier: false, confidence: 0 };
    }

    const zScore = Math.abs((value - mean) / stdDev);
    const isOutlier = zScore > this.zScoreThreshold;
    const confidence = Math.min(zScore / this.zScoreThreshold, 1);

    return { isOutlier, confidence };
  }

  /**
   * Detect outliers using Interquartile Range (IQR) method
   */
  private detectByIQR(value: number): { isOutlier: boolean; confidence: number } {
    const values = this.buffer.toArray().slice(0, -1); // Exclude current value
    if (values.length < 4) {
      return { isOutlier: false, confidence: 0 };
    }

    values.sort((a, b) => a - b);
    
    const q1Index = Math.floor(values.length * 0.25);
    const q3Index = Math.floor(values.length * 0.75);
    const q1 = values[q1Index];
    const q3 = values[q3Index];
    const iqr = q3 - q1;

    if (iqr === 0) {
      return { isOutlier: false, confidence: 0 };
    }

    const lowerBound = q1 - this.iqrMultiplier * iqr;
    const upperBound = q3 + this.iqrMultiplier * iqr;

    const isOutlier = value < lowerBound || value > upperBound;
    
    let confidence = 0;
    if (isOutlier) {
      const distanceFromBound = value < lowerBound 
        ? Math.abs(value - lowerBound) 
        : Math.abs(value - upperBound);
      confidence = Math.min(distanceFromBound / iqr, 1);
    }

    return { isOutlier, confidence };
  }

  /**
   * Get filtered value when outlier is detected
   */
  private getFilteredValue(outlierValue: number): number {
    const values = this.buffer.toArray().slice(0, -1); // Exclude outlier
    
    if (values.length === 0) {
      return outlierValue;
    }

    // Use median of recent values as filtered value
    const sortedValues = values.slice().sort((a, b) => a - b);
    const midIndex = Math.floor(sortedValues.length / 2);
    
    if (sortedValues.length % 2 === 0) {
      return (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2;
    } else {
      return sortedValues[midIndex];
    }
  }

  /**
   * Set Z-score threshold
   */
  setZScoreThreshold(threshold: number): void {
    this.zScoreThreshold = threshold;
  }

  /**
   * Set IQR multiplier
   */
  setIQRMultiplier(multiplier: number): void {
    this.iqrMultiplier = multiplier;
  }

  /**
   * Reset the detector
   */
  reset(): void {
    this.buffer.clear();
  }

  /**
   * Get current buffer statistics
   */
  getStatistics(): {
    mean: number;
    variance: number;
    standardDeviation: number;
    min: number | undefined;
    max: number | undefined;
    size: number;
  } {
    return {
      mean: this.buffer.mean(),
      variance: this.buffer.variance(),
      standardDeviation: this.buffer.standardDeviation(),
      min: this.buffer.min(),
      max: this.buffer.max(),
      size: this.buffer.getSize()
    };
  }
}