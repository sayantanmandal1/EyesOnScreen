/**
 * Military-Grade Gaze Tracking System Integration
 * Combines sub-pixel iris tracking with comprehensive eye behavior analysis
 * Requirements: 5.3, 5.5, 7.10
 */

import { MilitaryGradeGazeTracker, SubPixelIrisData, PrecisionGazeVector, ScreenIntersection, GazeDeviationAnalysis } from './MilitaryGradeGazeTracker';
import { EyeBehaviorAnalyzer, BlinkPattern, EyeMovementPattern, AttentionFocus, OffScreenGazeAlert, TemporalGazeConsistency } from './EyeBehaviorAnalyzer';
import { VisionError } from './types';

export interface MilitaryGradeGazeData {
  timestamp: number;
  
  // Sub-pixel iris tracking
  leftIris: SubPixelIrisData;
  rightIris: SubPixelIrisData;
  
  // Precision gaze vector
  gazeVector: PrecisionGazeVector;
  screenIntersection: ScreenIntersection;
  deviationAnalysis: GazeDeviationAnalysis;
  
  // Eye behavior analysis
  blinkPattern: BlinkPattern;
  eyeMovements: EyeMovementPattern[];
  attentionFocus: AttentionFocus;
  offScreenAlert: OffScreenGazeAlert | null;
  temporalConsistency: TemporalGazeConsistency;
  
  // Overall assessment
  overallConfidence: number;
  securityRisk: 'none' | 'low' | 'medium' | 'high';
  alerts: string[];
}

export interface MilitaryGradeConfig {
  precisionThreshold: number; // degrees
  confidenceThreshold: number;
  screenGeometry: {
    width: number;
    height: number;
    distance: number;
    position: { x: number; y: number; z: number };
  };
  alertThresholds: {
    offScreenDuration: number;
    deviationLimit: number;
    confidenceLimit: number;
  };
}

export class MilitaryGradeGazeSystem {
  private gazeTracker: MilitaryGradeGazeTracker;
  private behaviorAnalyzer: EyeBehaviorAnalyzer;
  private config: MilitaryGradeConfig;
  private isActive = false;
  private dataHistory: MilitaryGradeGazeData[] = [];

  constructor(config: Partial<MilitaryGradeConfig> = {}) {
    this.config = {
      precisionThreshold: 1.0, // 1 degree precision requirement
      confidenceThreshold: 0.7,
      screenGeometry: {
        width: 1920,
        height: 1080,
        distance: 600,
        position: { x: 0, y: 0, z: 0 }
      },
      alertThresholds: {
        offScreenDuration: 2000,
        deviationLimit: 2.0,
        confidenceLimit: 0.5
      },
      ...config
    };

    this.gazeTracker = new MilitaryGradeGazeTracker();
    this.behaviorAnalyzer = new EyeBehaviorAnalyzer({
      width: this.config.screenGeometry.width,
      height: this.config.screenGeometry.height
    });
  }

  /**
   * Initialize the military-grade gaze tracking system
   */
  async initialize(): Promise<void> {
    try {
      // Initialize components
      await this.gazeTracker.resetHistory();
      this.behaviorAnalyzer.resetAnalysis();
      
      this.isActive = true;
      console.log('Military-grade gaze tracking system initialized');
    } catch (error) {
      throw new VisionError(`Failed to initialize military-grade gaze system: ${error}`, {
        code: 'MODEL_LOAD_FAILED',
        details: { error }
      });
    }
  }

  /**
   * Process frame with military-grade analysis
   */
  async processFrame(
    imageData: ImageData,
    faceLandmarks: Float32Array,
    headPose: { yaw: number; pitch: number; roll: number },
    eyeRegions: {
      left: { x: number; y: number; width: number; height: number };
      right: { x: number; y: number; width: number; height: number };
    }
  ): Promise<MilitaryGradeGazeData> {
    if (!this.isActive) {
      throw new VisionError('Military-grade gaze system not initialized', {
        code: 'FACE_DETECTION_FAILED',
        details: {}
      });
    }

    const timestamp = Date.now();

    try {
      // 1. Sub-pixel iris detection
      const leftIris = await this.gazeTracker.detectSubPixelIris(imageData, eyeRegions.left);
      const rightIris = await this.gazeTracker.detectSubPixelIris(imageData, eyeRegions.right);

      // 2. Calculate precision gaze vector
      const gazeVector = this.gazeTracker.calculatePrecisionGazeVector(leftIris, rightIris, headPose);
      
      // 3. Calculate screen intersection
      const screenIntersection = this.gazeTracker.calculateScreenIntersection(gazeVector, this.config.screenGeometry);
      
      // 4. Analyze gaze deviation
      const deviationAnalysis = this.gazeTracker.analyzeGazeDeviation(gazeVector);
      
      // 5. Add to gaze history
      this.gazeTracker.addGazeToHistory(gazeVector);

      // 6. Analyze blink patterns
      const blinkAnalysis = this.behaviorAnalyzer.analyzeBlinkPattern(faceLandmarks, timestamp);

      // 7. Recognize eye movement patterns
      const gazePosition = {
        x: screenIntersection.x,
        y: screenIntersection.y,
        timestamp,
        confidence: screenIntersection.confidence
      };
      
      const eyeMovements = this.behaviorAnalyzer.recognizeEyeMovementPatterns(gazePosition);

      // 8. Monitor attention focus
      const attentionFocus = this.behaviorAnalyzer.monitorAttentionFocus(gazePosition);

      // 9. Detect off-screen gaze
      const offScreenAlert = this.behaviorAnalyzer.detectOffScreenGaze(gazePosition);

      // 10. Validate temporal consistency
      const temporalConsistency = this.behaviorAnalyzer.validateTemporalGazeConsistency(gazePosition);

      // 11. Calculate overall confidence and security assessment
      const confidenceScore = this.gazeTracker.getGazeConfidenceScore(gazeVector, screenIntersection);
      const overallConfidence = this.calculateOverallConfidence(confidenceScore, temporalConsistency, attentionFocus);
      
      // 12. Assess security risk
      const { securityRisk, alerts } = this.assessSecurityRisk(
        deviationAnalysis,
        offScreenAlert,
        temporalConsistency,
        overallConfidence,
        blinkAnalysis.pattern
      );

      const gazeData: MilitaryGradeGazeData = {
        timestamp,
        leftIris,
        rightIris,
        gazeVector,
        screenIntersection,
        deviationAnalysis,
        blinkPattern: blinkAnalysis.pattern,
        eyeMovements,
        attentionFocus,
        offScreenAlert,
        temporalConsistency,
        overallConfidence,
        securityRisk,
        alerts
      };

      // Store in history
      this.dataHistory.push(gazeData);
      
      // Keep only last 100 samples
      if (this.dataHistory.length > 100) {
        this.dataHistory.shift();
      }

      return gazeData;

    } catch (error) {
      throw new VisionError(`Military-grade gaze processing failed: ${error}`, {
        code: 'FACE_DETECTION_FAILED',
        details: { error, timestamp }
      });
    }
  }

  /**
   * Calculate overall confidence from multiple sources
   */
  private calculateOverallConfidence(
    gazeConfidence: any,
    temporalConsistency: TemporalGazeConsistency,
    attentionFocus: AttentionFocus
  ): number {
    return (
      gazeConfidence.overall * 0.4 +
      temporalConsistency.consistencyScore * 0.3 +
      attentionFocus.focusLevel * 0.2 +
      attentionFocus.confidence * 0.1
    );
  }

  /**
   * Assess security risk based on multiple factors
   */
  private assessSecurityRisk(
    deviationAnalysis: GazeDeviationAnalysis,
    offScreenAlert: OffScreenGazeAlert | null,
    temporalConsistency: TemporalGazeConsistency,
    overallConfidence: number,
    blinkPattern: BlinkPattern
  ): { securityRisk: 'none' | 'low' | 'medium' | 'high'; alerts: string[] } {
    const alerts: string[] = [];
    let riskScore = 0;

    // Check gaze deviation
    if (!deviationAnalysis.isWithinThreshold) {
      riskScore += 0.3;
      alerts.push(`Gaze deviation exceeds ${this.config.precisionThreshold}° threshold`);
    }

    if (deviationAnalysis.alertLevel === 'high') {
      riskScore += 0.4;
      alerts.push('High gaze deviation detected - possible attention issues');
    }

    // Check off-screen behavior
    if (offScreenAlert) {
      if (offScreenAlert.severity === 'high') {
        riskScore += 0.5;
        alerts.push(`Eyes off screen for ${offScreenAlert.duration}ms - ${offScreenAlert.direction} direction`);
      } else if (offScreenAlert.severity === 'medium') {
        riskScore += 0.3;
        alerts.push(`Moderate off-screen gaze detected - ${offScreenAlert.direction} direction`);
      } else {
        riskScore += 0.1;
        alerts.push(`Brief off-screen gaze - ${offScreenAlert.direction} direction`);
      }
    }

    // Check temporal consistency
    if (temporalConsistency.validationStatus === 'invalid') {
      riskScore += 0.6;
      alerts.push('Invalid gaze tracking data - possible system manipulation');
    } else if (temporalConsistency.validationStatus === 'suspicious') {
      riskScore += 0.3;
      alerts.push('Suspicious gaze patterns detected');
    }

    // Check overall confidence
    if (overallConfidence < this.config.alertThresholds.confidenceLimit) {
      riskScore += 0.2;
      alerts.push(`Low tracking confidence: ${(overallConfidence * 100).toFixed(1)}%`);
    }

    // Check fatigue indicators
    if (blinkPattern.fatigueIndicators.isFatigued) {
      if (blinkPattern.fatigueIndicators.level === 'severe') {
        riskScore += 0.3;
        alerts.push('Severe fatigue detected - may affect performance');
      } else if (blinkPattern.fatigueIndicators.level === 'moderate') {
        riskScore += 0.2;
        alerts.push('Moderate fatigue detected');
      }
    }

    // Determine risk level
    let securityRisk: 'none' | 'low' | 'medium' | 'high' = 'none';
    
    if (riskScore >= 0.8) {
      securityRisk = 'high';
    } else if (riskScore >= 0.5) {
      securityRisk = 'medium';
    } else if (riskScore >= 0.2) {
      securityRisk = 'low';
    }

    return { securityRisk, alerts };
  }

  /**
   * Get real-time monitoring status
   */
  getMonitoringStatus(): {
    isActive: boolean;
    currentPrecision: number;
    averageConfidence: number;
    recentAlerts: string[];
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
  } {
    const recentData = this.dataHistory.slice(-10);
    
    if (recentData.length === 0) {
      return {
        isActive: this.isActive,
        currentPrecision: 0,
        averageConfidence: 0,
        recentAlerts: [],
        systemHealth: 'poor'
      };
    }

    const avgConfidence = recentData.reduce((sum, d) => sum + d.overallConfidence, 0) / recentData.length;
    const avgPrecision = recentData.reduce((sum, d) => sum + d.gazeVector.precision, 0) / recentData.length;
    
    const recentAlerts = recentData
      .flatMap(d => d.alerts)
      .slice(-5); // Last 5 alerts

    let systemHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    
    if (avgConfidence >= 0.9 && avgPrecision >= 0.9) {
      systemHealth = 'excellent';
    } else if (avgConfidence >= 0.8 && avgPrecision >= 0.8) {
      systemHealth = 'good';
    } else if (avgConfidence >= 0.6 && avgPrecision >= 0.6) {
      systemHealth = 'fair';
    }

    return {
      isActive: this.isActive,
      currentPrecision: avgPrecision,
      averageConfidence: avgConfidence,
      recentAlerts,
      systemHealth
    };
  }

  /**
   * Get comprehensive analysis report
   */
  getAnalysisReport(): {
    totalFramesProcessed: number;
    averagePrecision: number;
    averageConfidence: number;
    securityIncidents: number;
    behaviorSummary: any;
    performanceMetrics: {
      precisionAchievement: number; // % of frames meeting 1-degree requirement
      confidenceStability: number;
      alertFrequency: number;
    };
  } {
    if (this.dataHistory.length === 0) {
      return {
        totalFramesProcessed: 0,
        averagePrecision: 0,
        averageConfidence: 0,
        securityIncidents: 0,
        behaviorSummary: {},
        performanceMetrics: {
          precisionAchievement: 0,
          confidenceStability: 0,
          alertFrequency: 0
        }
      };
    }

    const totalFrames = this.dataHistory.length;
    const avgPrecision = this.dataHistory.reduce((sum, d) => sum + d.gazeVector.precision, 0) / totalFrames;
    const avgConfidence = this.dataHistory.reduce((sum, d) => sum + d.overallConfidence, 0) / totalFrames;
    
    const securityIncidents = this.dataHistory.filter(d => 
      d.securityRisk === 'high' || d.securityRisk === 'medium'
    ).length;

    const precisionFrames = this.dataHistory.filter(d => 
      d.deviationAnalysis.isWithinThreshold
    ).length;
    
    const precisionAchievement = (precisionFrames / totalFrames) * 100;

    // Calculate confidence stability (coefficient of variation)
    const confidences = this.dataHistory.map(d => d.overallConfidence);
    const confidenceMean = avgConfidence;
    const confidenceVariance = confidences.reduce((sum, c) => sum + Math.pow(c - confidenceMean, 2), 0) / totalFrames;
    const confidenceStdDev = Math.sqrt(confidenceVariance);
    const confidenceStability = confidenceMean > 0 ? 1 - (confidenceStdDev / confidenceMean) : 0;

    const totalAlerts = this.dataHistory.reduce((sum, d) => sum + d.alerts.length, 0);
    const alertFrequency = totalAlerts / totalFrames;

    const behaviorSummary = this.behaviorAnalyzer.getBehaviorAnalysisSummary();

    return {
      totalFramesProcessed: totalFrames,
      averagePrecision,
      averageConfidence,
      securityIncidents,
      behaviorSummary,
      performanceMetrics: {
        precisionAchievement,
        confidenceStability,
        alertFrequency
      }
    };
  }

  /**
   * Update system configuration
   */
  updateConfig(newConfig: Partial<MilitaryGradeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update behavior analyzer screen bounds if changed
    if (newConfig.screenGeometry) {
      this.behaviorAnalyzer.updateScreenBounds({
        width: this.config.screenGeometry.width,
        height: this.config.screenGeometry.height
      });
    }
  }

  /**
   * Reset system state
   */
  reset(): void {
    this.gazeTracker.resetHistory();
    this.behaviorAnalyzer.resetAnalysis();
    this.dataHistory = [];
  }

  /**
   * Shutdown system
   */
  shutdown(): void {
    this.isActive = false;
    this.reset();
    this.gazeTracker.dispose();
  }

  /**
   * Export data for external analysis
   */
  exportData(): {
    config: MilitaryGradeConfig;
    dataHistory: MilitaryGradeGazeData[];
    exportTimestamp: number;
    systemInfo: {
      version: string;
      capabilities: string[];
    };
  } {
    return {
      config: this.config,
      dataHistory: [...this.dataHistory],
      exportTimestamp: Date.now(),
      systemInfo: {
        version: '1.0.0',
        capabilities: [
          'Sub-pixel iris tracking',
          '1-degree gaze precision',
          'Corneal reflection analysis',
          'Real-time screen intersection',
          'Blink pattern analysis',
          'Eye movement recognition',
          'Attention focus monitoring',
          'Off-screen gaze detection',
          'Temporal consistency validation',
          'Military-grade security assessment'
        ]
      }
    };
  }
}