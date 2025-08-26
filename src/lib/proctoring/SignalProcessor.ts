/**
 * SignalProcessor - Multi-signal decision engine
 * 
 * Combines multiple vision signals to make robust decisions about user behavior
 */

import { VisionSignals, CalibrationProfile } from '../vision/types';
import { ProctorConfig } from './types';
import { FilteredSignals } from './TemporalFilterSystem';
import { CircularBuffer } from './filters/CircularBuffer';

export interface DecisionResult {
  eyesOnScreen: boolean;
  confidence: number;
  breakdown: {
    gaze: {
      score: number;
      weight: number;
      contribution: number;
    };
    headPose: {
      score: number;
      weight: number;
      contribution: number;
    };
    environment: {
      score: number;
      weight: number;
      contribution: number;
    };
    temporal: {
      score: number;
      weight: number;
      contribution: number;
    };
  };
  flags: string[];
  metadata: {
    processingTime: number;
    signalQuality: number;
    temporalConsistency: number;
  };
}

export interface SignalWeights {
  gaze: number;
  headPose: number;
  environment: number;
  temporal: number;
}

export interface ThresholdConfig {
  eyesOnScreen: {
    gazeAngleThreshold: number; // degrees
    headYawThreshold: number; // degrees
    headPitchThreshold: number; // degrees
    confidenceThreshold: number; // 0-1
    temporalConsistencyThreshold: number; // 0-1
  };
  environment: {
    lightingMin: number;
    lightingMax: number;
    shadowStabilityMin: number;
    secondaryFaceThreshold: number;
    deviceObjectThreshold: number;
  };
  temporal: {
    stabilityThreshold: number;
    consistencyFrames: number;
    outlierToleranceRatio: number;
  };
}

export class SignalProcessor {
  private config: ProctorConfig;
  private calibrationProfile: CalibrationProfile | null = null;
  private thresholds: ThresholdConfig;
  private weights: SignalWeights;
  
  // Temporal consistency tracking
  private decisionHistory: CircularBuffer<boolean>;
  private confidenceHistory: CircularBuffer<number>;
  private gazeHistory: CircularBuffer<{ x: number; y: number; z: number }>;
  private headPoseHistory: CircularBuffer<{ yaw: number; pitch: number; roll: number }>;
  
  // Performance tracking
  private processingTimes: CircularBuffer<number>;

  constructor(config: ProctorConfig, calibrationProfile?: CalibrationProfile) {
    this.config = config;
    this.calibrationProfile = calibrationProfile || null;
    
    this.initializeThresholds();
    this.initializeWeights();
    this.initializeBuffers();
  }

  private initializeThresholds(): void {
    this.thresholds = {
      eyesOnScreen: {
        gazeAngleThreshold: 15, // degrees from screen center
        headYawThreshold: this.config.thresholds.headYawMax,
        headPitchThreshold: this.config.thresholds.headPitchMax,
        confidenceThreshold: this.config.thresholds.gazeConfidence,
        temporalConsistencyThreshold: 0.7
      },
      environment: {
        lightingMin: 0.3,
        lightingMax: 0.9,
        shadowStabilityMin: 0.6,
        secondaryFaceThreshold: 0.5,
        deviceObjectThreshold: 0.3
      },
      temporal: {
        stabilityThreshold: 0.6,
        consistencyFrames: 5,
        outlierToleranceRatio: 0.2
      }
    };
  }

  private initializeWeights(): void {
    this.weights = {
      gaze: 0.4,
      headPose: 0.25,
      environment: 0.2,
      temporal: 0.15
    };
  }

  private initializeBuffers(): void {
    const bufferSize = 30;
    
    this.decisionHistory = new CircularBuffer<boolean>(bufferSize);
    this.confidenceHistory = new CircularBuffer<number>(bufferSize);
    this.gazeHistory = new CircularBuffer<{ x: number; y: number; z: number }>(bufferSize);
    this.headPoseHistory = new CircularBuffer<{ yaw: number; pitch: number; roll: number }>(bufferSize);
    this.processingTimes = new CircularBuffer<number>(10);
  }

  /**
   * Process filtered signals and make eyes-on-screen decision
   */
  process(signals: FilteredSignals): DecisionResult {
    const startTime = performance.now();

    // Evaluate individual signal components
    const gazeScore = this.evaluateGazeSignal(signals);
    const headPoseScore = this.evaluateHeadPoseSignal(signals);
    const environmentScore = this.evaluateEnvironmentSignal(signals);
    const temporalScore = this.evaluateTemporalConsistency(signals);

    // Calculate weighted decision
    const weightedScore = 
      gazeScore.score * this.weights.gaze +
      headPoseScore.score * this.weights.headPose +
      environmentScore.score * this.weights.environment +
      temporalScore.score * this.weights.temporal;

    // Apply temporal consistency requirements
    const finalDecision = this.applyTemporalConsistency(weightedScore > 0.5);
    const finalConfidence = this.calculateFinalConfidence(weightedScore, signals);

    // Update history
    this.updateHistory(signals, finalDecision, finalConfidence);

    // Collect flags
    const flags = this.collectFlags(signals, gazeScore, headPoseScore, environmentScore);

    const processingTime = performance.now() - startTime;
    this.processingTimes.push(processingTime);

    return {
      eyesOnScreen: finalDecision,
      confidence: finalConfidence,
      breakdown: {
        gaze: {
          score: gazeScore.score,
          weight: this.weights.gaze,
          contribution: gazeScore.score * this.weights.gaze
        },
        headPose: {
          score: headPoseScore.score,
          weight: this.weights.headPose,
          contribution: headPoseScore.score * this.weights.headPose
        },
        environment: {
          score: environmentScore.score,
          weight: this.weights.environment,
          contribution: environmentScore.score * this.weights.environment
        },
        temporal: {
          score: temporalScore.score,
          weight: this.weights.temporal,
          contribution: temporalScore.score * this.weights.temporal
        }
      },
      flags,
      metadata: {
        processingTime,
        signalQuality: this.calculateSignalQuality(signals),
        temporalConsistency: this.calculateTemporalConsistency()
      }
    };
  }

  /**
   * Evaluate gaze signal component
   */
  private evaluateGazeSignal(signals: FilteredSignals): { score: number; details: any } {
    if (!signals.faceDetected || signals.gazeVector.confidence < this.thresholds.eyesOnScreen.confidenceThreshold) {
      return { score: 0, details: { reason: 'low_confidence_or_no_face' } };
    }

    // Calculate gaze angle from screen center
    const gazeAngle = this.calculateGazeAngle(signals.gazeVector);
    const angleScore = Math.max(0, 1 - gazeAngle / this.thresholds.eyesOnScreen.gazeAngleThreshold);
    
    // Apply confidence weighting
    const confidenceWeight = Math.min(1, signals.gazeVector.confidence / this.thresholds.eyesOnScreen.confidenceThreshold);
    
    // Apply stability bonus
    const stabilityBonus = signals.stability.gaze * 0.2;
    
    const finalScore = Math.min(1, (angleScore * confidenceWeight) + stabilityBonus);

    return {
      score: finalScore,
      details: {
        gazeAngle,
        angleScore,
        confidenceWeight,
        stabilityBonus,
        rawConfidence: signals.gazeVector.confidence
      }
    };
  }

  /**
   * Evaluate head pose signal component
   */
  private evaluateHeadPoseSignal(signals: FilteredSignals): { score: number; details: any } {
    if (signals.headPose.confidence < 0.5) {
      return { score: 0.5, details: { reason: 'low_confidence' } }; // Neutral score for low confidence
    }

    // Check if head pose is within acceptable bounds
    const yawInBounds = Math.abs(signals.headPose.yaw) <= this.thresholds.eyesOnScreen.headYawThreshold;
    const pitchInBounds = Math.abs(signals.headPose.pitch) <= this.thresholds.eyesOnScreen.headPitchThreshold;

    // Calculate pose deviation score
    const yawScore = Math.max(0, 1 - Math.abs(signals.headPose.yaw) / this.thresholds.eyesOnScreen.headYawThreshold);
    const pitchScore = Math.max(0, 1 - Math.abs(signals.headPose.pitch) / this.thresholds.eyesOnScreen.headPitchThreshold);
    
    // Combine yaw and pitch scores
    const poseScore = (yawScore + pitchScore) / 2;
    
    // Apply confidence weighting
    const confidenceWeight = signals.headPose.confidence;
    
    // Apply stability bonus
    const stabilityBonus = signals.stability.headPose * 0.15;
    
    const finalScore = Math.min(1, (poseScore * confidenceWeight) + stabilityBonus);

    return {
      score: finalScore,
      details: {
        yawInBounds,
        pitchInBounds,
        yawScore,
        pitchScore,
        poseScore,
        confidenceWeight,
        stabilityBonus,
        rawYaw: signals.headPose.yaw,
        rawPitch: signals.headPose.pitch
      }
    };
  }

  /**
   * Evaluate environment signal component
   */
  private evaluateEnvironmentSignal(signals: FilteredSignals): { score: number; details: any } {
    const env = signals.environmentScore;
    
    // Lighting score
    const lightingInRange = env.lighting >= this.thresholds.environment.lightingMin && 
                           env.lighting <= this.thresholds.environment.lightingMax;
    const lightingScore = lightingInRange ? 1 : Math.max(0, 1 - Math.abs(env.lighting - 0.6) * 2);
    
    // Shadow stability score
    const shadowScore = env.shadowStability >= this.thresholds.environment.shadowStabilityMin ? 1 : 
                       env.shadowStability / this.thresholds.environment.shadowStabilityMin;
    
    // Secondary objects penalty
    const secondaryFacePenalty = Math.min(1, env.secondaryFaces / this.thresholds.environment.secondaryFaceThreshold);
    const devicePenalty = Math.min(1, env.deviceLikeObjects / this.thresholds.environment.deviceObjectThreshold);
    const objectPenalty = (secondaryFacePenalty + devicePenalty) / 2;
    
    // Lighting stability bonus
    const lightingStabilityBonus = signals.stability.lighting * 0.1;
    
    const finalScore = Math.max(0, Math.min(1, 
      (lightingScore * 0.4 + shadowScore * 0.4 - objectPenalty * 0.2) + lightingStabilityBonus
    ));

    return {
      score: finalScore,
      details: {
        lightingInRange,
        lightingScore,
        shadowScore,
        secondaryFacePenalty,
        devicePenalty,
        objectPenalty,
        lightingStabilityBonus,
        rawLighting: env.lighting,
        rawShadowStability: env.shadowStability
      }
    };
  }

  /**
   * Evaluate temporal consistency
   */
  private evaluateTemporalConsistency(signals: FilteredSignals): { score: number; details: any } {
    if (this.decisionHistory.getSize() < this.thresholds.temporal.consistencyFrames) {
      return { score: 0.5, details: { reason: 'insufficient_history' } };
    }

    // Calculate consistency of recent decisions
    const recentDecisions = this.decisionHistory.toArray().slice(-this.thresholds.temporal.consistencyFrames);
    const positiveDecisions = recentDecisions.filter(d => d).length;
    const consistencyRatio = positiveDecisions / recentDecisions.length;
    
    // Calculate confidence stability
    const recentConfidences = this.confidenceHistory.toArray().slice(-this.thresholds.temporal.consistencyFrames);
    const confidenceVariance = this.calculateVariance(recentConfidences);
    const confidenceStability = Math.max(0, 1 - confidenceVariance * 5);
    
    // Calculate signal stability
    const gazeStability = signals.stability.gaze;
    const headPoseStability = signals.stability.headPose;
    const overallStability = (gazeStability + headPoseStability) / 2;
    
    const finalScore = (consistencyRatio * 0.4 + confidenceStability * 0.3 + overallStability * 0.3);

    return {
      score: finalScore,
      details: {
        consistencyRatio,
        confidenceStability,
        confidenceVariance,
        gazeStability,
        headPoseStability,
        overallStability,
        recentDecisionCount: recentDecisions.length
      }
    };
  }

  /**
   * Apply temporal consistency requirements before final decision
   */
  private applyTemporalConsistency(rawDecision: boolean): boolean {
    if (this.decisionHistory.getSize() < this.thresholds.temporal.consistencyFrames) {
      return rawDecision;
    }

    const recentDecisions = this.decisionHistory.toArray().slice(-this.thresholds.temporal.consistencyFrames);
    const positiveCount = recentDecisions.filter(d => d).length;
    const consistencyRatio = positiveCount / recentDecisions.length;

    // Require temporal consistency for positive decisions
    if (rawDecision && consistencyRatio < this.thresholds.eyesOnScreen.temporalConsistencyThreshold) {
      return false;
    }

    // Require temporal consistency for negative decisions
    if (!rawDecision && (1 - consistencyRatio) < this.thresholds.eyesOnScreen.temporalConsistencyThreshold) {
      return true;
    }

    return rawDecision;
  }

  /**
   * Calculate final confidence score
   */
  private calculateFinalConfidence(weightedScore: number, signals: FilteredSignals): number {
    const baseConfidence = Math.min(1, Math.max(0, weightedScore));
    
    // Apply signal quality penalty
    const signalQuality = this.calculateSignalQuality(signals);
    const qualityPenalty = (1 - signalQuality) * 0.3;
    
    // Apply temporal consistency bonus
    const temporalConsistency = this.calculateTemporalConsistency();
    const consistencyBonus = temporalConsistency * 0.2;
    
    return Math.min(1, Math.max(0, baseConfidence - qualityPenalty + consistencyBonus));
  }

  /**
   * Calculate gaze angle from screen center
   */
  private calculateGazeAngle(gazeVector: { x: number; y: number; z: number }): number {
    // Normalize gaze vector
    const magnitude = Math.sqrt(gazeVector.x ** 2 + gazeVector.y ** 2 + gazeVector.z ** 2);
    if (magnitude === 0) return 90; // Maximum angle for zero vector
    
    const normalizedZ = gazeVector.z / magnitude;
    
    // Calculate angle from forward direction (screen normal)
    const angle = Math.acos(Math.max(-1, Math.min(1, normalizedZ))) * (180 / Math.PI);
    
    return angle;
  }

  /**
   * Calculate signal quality
   */
  private calculateSignalQuality(signals: FilteredSignals): number {
    const faceQuality = signals.faceDetected ? 1 : 0;
    const gazeQuality = signals.gazeVector.confidence;
    const headPoseQuality = signals.headPose.confidence;
    const landmarkQuality = signals.confidence.landmarks;
    
    return (faceQuality * 0.3 + gazeQuality * 0.3 + headPoseQuality * 0.2 + landmarkQuality * 0.2);
  }

  /**
   * Calculate temporal consistency
   */
  private calculateTemporalConsistency(): number {
    if (this.confidenceHistory.getSize() < 3) return 0.5;
    
    const recentConfidences = this.confidenceHistory.toArray().slice(-10);
    const variance = this.calculateVariance(recentConfidences);
    
    return Math.max(0, 1 - variance * 3);
  }

  /**
   * Calculate variance of array
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Collect flags based on signal analysis
   */
  private collectFlags(
    signals: FilteredSignals,
    gazeScore: { score: number; details: any },
    headPoseScore: { score: number; details: any },
    environmentScore: { score: number; details: any }
  ): string[] {
    const flags: string[] = [];

    // Gaze-related flags
    if (gazeScore.score < 0.3) {
      flags.push('low_gaze_score');
    }
    if (gazeScore.details.gazeAngle > this.thresholds.eyesOnScreen.gazeAngleThreshold) {
      flags.push('gaze_off_screen');
    }

    // Head pose flags
    if (!headPoseScore.details.yawInBounds) {
      flags.push('head_yaw_out_of_bounds');
    }
    if (!headPoseScore.details.pitchInBounds) {
      flags.push('head_pitch_out_of_bounds');
    }

    // Environment flags
    if (!environmentScore.details.lightingInRange) {
      flags.push('poor_lighting');
    }
    if (environmentScore.details.secondaryFacePenalty > 0) {
      flags.push('secondary_face_detected');
    }
    if (environmentScore.details.devicePenalty > 0) {
      flags.push('device_like_object_detected');
    }

    // Signal quality flags
    if (signals.gazeVector.confidence < this.thresholds.eyesOnScreen.confidenceThreshold) {
      flags.push('low_gaze_confidence');
    }
    if (signals.headPose.confidence < 0.5) {
      flags.push('low_head_pose_confidence');
    }

    // Stability flags
    if (signals.stability.gaze < this.thresholds.temporal.stabilityThreshold) {
      flags.push('unstable_gaze');
    }
    if (signals.stability.headPose < this.thresholds.temporal.stabilityThreshold) {
      flags.push('unstable_head_pose');
    }

    return flags;
  }

  /**
   * Update historical data
   */
  private updateHistory(signals: FilteredSignals, decision: boolean, confidence: number): void {
    this.decisionHistory.push(decision);
    this.confidenceHistory.push(confidence);
    
    if (signals.gazeVector.confidence > 0.1) {
      this.gazeHistory.push({
        x: signals.gazeVector.x,
        y: signals.gazeVector.y,
        z: signals.gazeVector.z
      });
    }
    
    if (signals.headPose.confidence > 0.1) {
      this.headPoseHistory.push({
        yaw: signals.headPose.yaw,
        pitch: signals.headPose.pitch,
        roll: signals.headPose.roll
      });
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: ProctorConfig): void {
    this.config = config;
    this.initializeThresholds();
  }

  /**
   * Update calibration profile
   */
  updateCalibrationProfile(profile: CalibrationProfile): void {
    this.calibrationProfile = profile;
    
    // Update thresholds based on calibration
    if (profile.headPoseBounds) {
      this.thresholds.eyesOnScreen.headYawThreshold = 
        Math.abs(profile.headPoseBounds.yawRange[1] - profile.headPoseBounds.yawRange[0]) / 2;
      this.thresholds.eyesOnScreen.headPitchThreshold = 
        Math.abs(profile.headPoseBounds.pitchRange[1] - profile.headPoseBounds.pitchRange[0]) / 2;
    }
  }

  /**
   * Update signal weights
   */
  updateWeights(weights: Partial<SignalWeights>): void {
    this.weights = { ...this.weights, ...weights };
    
    // Normalize weights to sum to 1
    const total = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (total > 0) {
      Object.keys(this.weights).forEach(key => {
        this.weights[key as keyof SignalWeights] /= total;
      });
    }
  }

  /**
   * Reset all history
   */
  reset(): void {
    this.decisionHistory.clear();
    this.confidenceHistory.clear();
    this.gazeHistory.clear();
    this.headPoseHistory.clear();
    this.processingTimes.clear();
  }

  /**
   * Get processing statistics
   */
  getStatistics(): {
    averageProcessingTime: number;
    decisionConsistency: number;
    confidenceStability: number;
    historySize: number;
  } {
    return {
      averageProcessingTime: this.processingTimes.mean(),
      decisionConsistency: this.calculateTemporalConsistency(),
      confidenceStability: 1 - this.calculateVariance(this.confidenceHistory.toArray()),
      historySize: this.decisionHistory.getSize()
    };
  }
}