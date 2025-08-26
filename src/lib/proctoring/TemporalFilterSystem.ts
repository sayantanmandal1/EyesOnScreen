/**
 * Temporal Filter System
 * 
 * Combines multiple filtering techniques for robust signal processing
 */

import { VisionSignals } from '../vision/types';
import { KalmanFilter, VectorKalmanFilter } from './filters/KalmanFilter';
import { ExponentialMovingAverage, VectorExponentialMovingAverage } from './filters/ExponentialMovingAverage';
import { CircularBuffer } from './filters/CircularBuffer';
import { OutlierDetector } from './filters/OutlierDetector';

export interface FilteredSignals extends VisionSignals {
  confidence: {
    overall: number;
    gaze: number;
    headPose: number;
    landmarks: number;
    environment: number;
  };
  stability: {
    gaze: number;
    headPose: number;
    lighting: number;
  };
}

export interface FilterConfig {
  kalman: {
    processNoise: number;
    measurementNoise: number;
  };
  ema: {
    alpha: number;
  };
  outlier: {
    windowSize: number;
    zScoreThreshold: number;
    iqrMultiplier: number;
  };
  buffer: {
    size: number;
  };
}

export class TemporalFilterSystem {
  private config: FilterConfig;
  
  // Landmark filtering (468 landmarks * 3 coordinates)
  private landmarkKalmanFilter!: VectorKalmanFilter;
  
  // Gaze vector filtering
  private gazeKalmanFilter!: VectorKalmanFilter;
  private gazeEMAFilter!: VectorExponentialMovingAverage;
  private gazeOutlierDetector!: OutlierDetector;
  
  // Head pose filtering
  private headPoseKalmanFilter!: VectorKalmanFilter;
  private headPoseEMAFilter!: VectorExponentialMovingAverage;
  private headPoseOutlierDetector!: OutlierDetector;
  
  // Environment filtering
  private lightingEMAFilter!: ExponentialMovingAverage;
  private shadowEMAFilter!: ExponentialMovingAverage;
  
  // Signal buffers for stability analysis
  private gazeBuffer!: CircularBuffer<{ x: number; y: number; z: number; confidence: number }>;
  private headPoseBuffer!: CircularBuffer<{ yaw: number; pitch: number; roll: number; confidence: number }>;
  private lightingBuffer!: CircularBuffer<number>;
  
  // Confidence tracking
  private confidenceBuffer!: CircularBuffer<number>;

  constructor(config?: Partial<FilterConfig>) {
    this.config = {
      kalman: {
        processNoise: 0.01,
        measurementNoise: 0.1,
        ...config?.kalman
      },
      ema: {
        alpha: 0.3,
        ...config?.ema
      },
      outlier: {
        windowSize: 10,
        zScoreThreshold: 2.5,
        iqrMultiplier: 1.5,
        ...config?.outlier
      },
      buffer: {
        size: 30,
        ...config?.buffer
      }
    };

    this.initializeFilters();
  }

  private initializeFilters(): void {
    // Landmark filtering (468 * 3 = 1404 dimensions)
    this.landmarkKalmanFilter = new VectorKalmanFilter(
      1404,
      this.config.kalman.processNoise,
      this.config.kalman.measurementNoise
    );

    // Gaze filtering (3D vector)
    this.gazeKalmanFilter = new VectorKalmanFilter(
      3,
      this.config.kalman.processNoise,
      this.config.kalman.measurementNoise
    );
    this.gazeEMAFilter = new VectorExponentialMovingAverage(3, this.config.ema.alpha);
    this.gazeOutlierDetector = new OutlierDetector(
      this.config.outlier.windowSize,
      this.config.outlier.zScoreThreshold,
      this.config.outlier.iqrMultiplier
    );

    // Head pose filtering (3D rotation)
    this.headPoseKalmanFilter = new VectorKalmanFilter(
      3,
      this.config.kalman.processNoise,
      this.config.kalman.measurementNoise
    );
    this.headPoseEMAFilter = new VectorExponentialMovingAverage(3, this.config.ema.alpha);
    this.headPoseOutlierDetector = new OutlierDetector(
      this.config.outlier.windowSize,
      this.config.outlier.zScoreThreshold,
      this.config.outlier.iqrMultiplier
    );

    // Environment filtering
    this.lightingEMAFilter = new ExponentialMovingAverage(this.config.ema.alpha);
    this.shadowEMAFilter = new ExponentialMovingAverage(this.config.ema.alpha);

    // Signal buffers
    this.gazeBuffer = new CircularBuffer(this.config.buffer.size);
    this.headPoseBuffer = new CircularBuffer(this.config.buffer.size);
    this.lightingBuffer = new CircularBuffer(this.config.buffer.size);
    this.confidenceBuffer = new CircularBuffer(this.config.buffer.size);
  }

  /**
   * Process raw vision signals through temporal filters
   */
  process(rawSignals: VisionSignals): FilteredSignals {
    const filtered: FilteredSignals = {
      ...rawSignals,
      confidence: {
        overall: 0,
        gaze: 0,
        headPose: 0,
        landmarks: 0,
        environment: 0
      },
      stability: {
        gaze: 0,
        headPose: 0,
        lighting: 0
      }
    };

    // Filter landmarks if face is detected
    if (rawSignals.faceDetected && rawSignals.landmarks.length > 0) {
      const landmarkArray = Array.from(rawSignals.landmarks);
      const filteredLandmarks = this.landmarkKalmanFilter.update(landmarkArray);
      filtered.landmarks = new Float32Array(filteredLandmarks);
      filtered.confidence.landmarks = this.calculateLandmarkConfidence(rawSignals.landmarks);
    }

    // Filter gaze vector
    if (rawSignals.gazeVector.confidence > 0.1) {
      const gazeVector = [
        rawSignals.gazeVector.x,
        rawSignals.gazeVector.y,
        rawSignals.gazeVector.z
      ];

      // Apply Kalman filtering
      const kalmanFiltered = this.gazeKalmanFilter.update(gazeVector);
      
      // Apply EMA filtering
      const emaFiltered = this.gazeEMAFilter.update(kalmanFiltered);
      
      // Check for outliers
      const gazeNorm = Math.sqrt(emaFiltered[0] ** 2 + emaFiltered[1] ** 2 + emaFiltered[2] ** 2);
      const outlierResult = this.gazeOutlierDetector.process(gazeNorm);
      
      // Use filtered values
      filtered.gazeVector = {
        x: emaFiltered[0],
        y: emaFiltered[1],
        z: emaFiltered[2],
        confidence: rawSignals.gazeVector.confidence * (1 - outlierResult.confidence * 0.5)
      };

      // Store in buffer for stability analysis
      this.gazeBuffer.push(filtered.gazeVector);
      filtered.confidence.gaze = this.calculateGazeConfidence(filtered.gazeVector);
      filtered.stability.gaze = this.calculateGazeStability();
    }

    // Filter head pose
    if (rawSignals.headPose.confidence > 0.1) {
      const headPoseVector = [
        rawSignals.headPose.yaw,
        rawSignals.headPose.pitch,
        rawSignals.headPose.roll
      ];

      // Apply Kalman filtering
      const kalmanFiltered = this.headPoseKalmanFilter.update(headPoseVector);
      
      // Apply EMA filtering
      const emaFiltered = this.headPoseEMAFilter.update(kalmanFiltered);
      
      // Check for outliers
      const poseNorm = Math.sqrt(emaFiltered[0] ** 2 + emaFiltered[1] ** 2 + emaFiltered[2] ** 2);
      const outlierResult = this.headPoseOutlierDetector.process(poseNorm);
      
      // Use filtered values
      filtered.headPose = {
        yaw: emaFiltered[0],
        pitch: emaFiltered[1],
        roll: emaFiltered[2],
        confidence: rawSignals.headPose.confidence * (1 - outlierResult.confidence * 0.5)
      };

      // Store in buffer for stability analysis
      this.headPoseBuffer.push(filtered.headPose);
      filtered.confidence.headPose = this.calculateHeadPoseConfidence(filtered.headPose);
      filtered.stability.headPose = this.calculateHeadPoseStability();
    }

    // Filter environment signals
    const filteredLighting = this.lightingEMAFilter.update(rawSignals.environmentScore.lighting);
    const filteredShadow = this.shadowEMAFilter.update(rawSignals.environmentScore.shadowStability);
    
    filtered.environmentScore = {
      ...rawSignals.environmentScore,
      lighting: filteredLighting,
      shadowStability: filteredShadow
    };

    this.lightingBuffer.push(filteredLighting);
    filtered.confidence.environment = this.calculateEnvironmentConfidence(filtered.environmentScore);
    filtered.stability.lighting = this.calculateLightingStability();

    // Calculate overall confidence
    filtered.confidence.overall = this.calculateOverallConfidence(filtered.confidence);

    // Store overall confidence for tracking
    this.confidenceBuffer.push(filtered.confidence.overall);

    return filtered;
  }

  /**
   * Calculate landmark confidence based on detection quality
   */
  private calculateLandmarkConfidence(landmarks: Float32Array): number {
    if (landmarks.length === 0) return 0;

    // Check for valid landmark coordinates
    let validCount = 0;
    for (let i = 0; i < landmarks.length; i += 3) {
      const x = landmarks[i];
      const y = landmarks[i + 1];
      const z = landmarks[i + 2];
      
      if (!isNaN(x) && !isNaN(y) && !isNaN(z) && 
          x !== 0 && y !== 0 && z !== 0) {
        validCount++;
      }
    }

    return validCount / (landmarks.length / 3);
  }

  /**
   * Calculate gaze confidence
   */
  private calculateGazeConfidence(gazeVector: { x: number; y: number; z: number; confidence: number }): number {
    const magnitude = Math.sqrt(gazeVector.x ** 2 + gazeVector.y ** 2 + gazeVector.z ** 2);
    const normalizedMagnitude = Math.min(magnitude, 1);
    return gazeVector.confidence * normalizedMagnitude;
  }

  /**
   * Calculate head pose confidence
   */
  private calculateHeadPoseConfidence(headPose: { yaw: number; pitch: number; roll: number; confidence: number }): number {
    // Penalize extreme poses
    const maxAngle = Math.max(Math.abs(headPose.yaw), Math.abs(headPose.pitch), Math.abs(headPose.roll));
    const anglePenalty = Math.max(0, 1 - maxAngle / 45); // Penalize angles > 45 degrees
    return headPose.confidence * anglePenalty;
  }

  /**
   * Calculate environment confidence
   */
  private calculateEnvironmentConfidence(envScore: { lighting: number; shadowStability: number; secondaryFaces: number; deviceLikeObjects: number }): number {
    const lightingScore = Math.max(0, 1 - Math.abs(envScore.lighting - 0.5) * 2);
    const shadowScore = envScore.shadowStability;
    const objectPenalty = Math.max(0, 1 - (envScore.secondaryFaces + envScore.deviceLikeObjects) * 0.5);
    
    return (lightingScore + shadowScore + objectPenalty) / 3;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(confidence: { gaze: number; headPose: number; landmarks: number; environment: number }): number {
    const weights = {
      gaze: 0.3,
      headPose: 0.25,
      landmarks: 0.25,
      environment: 0.2
    };

    return (
      confidence.gaze * weights.gaze +
      confidence.headPose * weights.headPose +
      confidence.landmarks * weights.landmarks +
      confidence.environment * weights.environment
    );
  }

  /**
   * Calculate gaze stability
   */
  private calculateGazeStability(): number {
    if (this.gazeBuffer.getSize() < 3) return 0;

    const recentGazes = this.gazeBuffer.toArray().slice(-10);
    let totalVariation = 0;

    for (let i = 1; i < recentGazes.length; i++) {
      const prev = recentGazes[i - 1];
      const curr = recentGazes[i];
      
      const variation = Math.sqrt(
        (curr.x - prev.x) ** 2 +
        (curr.y - prev.y) ** 2 +
        (curr.z - prev.z) ** 2
      );
      
      totalVariation += variation;
    }

    const avgVariation = totalVariation / (recentGazes.length - 1);
    return Math.max(0, 1 - avgVariation * 10); // Scale and invert
  }

  /**
   * Calculate head pose stability
   */
  private calculateHeadPoseStability(): number {
    if (this.headPoseBuffer.getSize() < 3) return 0;

    const recentPoses = this.headPoseBuffer.toArray().slice(-10);
    let totalVariation = 0;

    for (let i = 1; i < recentPoses.length; i++) {
      const prev = recentPoses[i - 1];
      const curr = recentPoses[i];
      
      const variation = Math.sqrt(
        (curr.yaw - prev.yaw) ** 2 +
        (curr.pitch - prev.pitch) ** 2 +
        (curr.roll - prev.roll) ** 2
      );
      
      totalVariation += variation;
    }

    const avgVariation = totalVariation / (recentPoses.length - 1);
    return Math.max(0, 1 - avgVariation / 10); // Scale and invert
  }

  /**
   * Calculate lighting stability
   */
  private calculateLightingStability(): number {
    if (this.lightingBuffer.getSize() < 3) return 0;

    const variance = this.lightingBuffer.variance();
    return Math.max(0, 1 - variance * 10); // Scale and invert
  }

  /**
   * Reset all filters
   */
  reset(): void {
    this.landmarkKalmanFilter.reset();
    this.gazeKalmanFilter.reset();
    this.gazeEMAFilter.reset();
    this.gazeOutlierDetector.reset();
    this.headPoseKalmanFilter.reset();
    this.headPoseEMAFilter.reset();
    this.headPoseOutlierDetector.reset();
    this.lightingEMAFilter.reset();
    this.shadowEMAFilter.reset();
    
    this.gazeBuffer.clear();
    this.headPoseBuffer.clear();
    this.lightingBuffer.clear();
    this.confidenceBuffer.clear();
  }

  /**
   * Update filter configuration
   */
  updateConfig(newConfig: Partial<FilterConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      kalman: { ...this.config.kalman, ...newConfig.kalman },
      ema: { ...this.config.ema, ...newConfig.ema },
      outlier: { ...this.config.outlier, ...newConfig.outlier },
      buffer: { ...this.config.buffer, ...newConfig.buffer }
    };

    // Reinitialize filters with new config
    this.initializeFilters();
  }

  /**
   * Get current filter statistics
   */
  getStatistics(): {
    gazeStability: number;
    headPoseStability: number;
    lightingStability: number;
    overallConfidence: number;
    bufferSizes: {
      gaze: number;
      headPose: number;
      lighting: number;
      confidence: number;
    };
  } {
    return {
      gazeStability: this.calculateGazeStability(),
      headPoseStability: this.calculateHeadPoseStability(),
      lightingStability: this.calculateLightingStability(),
      overallConfidence: this.confidenceBuffer.mean(),
      bufferSizes: {
        gaze: this.gazeBuffer.getSize(),
        headPose: this.headPoseBuffer.getSize(),
        lighting: this.lightingBuffer.getSize(),
        confidence: this.confidenceBuffer.getSize()
      }
    };
  }
}