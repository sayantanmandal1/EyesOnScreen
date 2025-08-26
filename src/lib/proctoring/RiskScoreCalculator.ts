/**
 * RiskScoreCalculator - Calculates cumulative risk scores with configurable weights
 * Implements score decay over time for clean behavior and automatic review marking
 */

import { FlagEvent } from './types';

export interface RiskScoreConfig {
  weights: {
    eyesOff: number; // +3 points per second
    headPose: number; // +2 points per violation
    tabBlur: number; // +5 points per event
    secondFace: number; // +10 points per detection
    deviceObject: number; // +8 points per detection
    shadowAnomaly: number; // +3 points per event
    faceMissing: number; // +4 points per second
    downGlance: number; // +2 points per pattern
  };
  decayRate: number; // Points to decay per second of clean behavior
  maxScore: number; // Maximum possible score (100)
  reviewThreshold: number; // Score at which attempt is marked "Under Review" (60)
  cleanBehaviorWindow: number; // Time window to consider for clean behavior (5000ms)
}

export interface RiskScoreState {
  currentScore: number;
  lastFlagTime: number;
  flagHistory: Array<{
    timestamp: number;
    type: FlagEvent['type'];
    points: number;
    severity: 'soft' | 'hard';
  }>;
  cleanBehaviorStart: number | null;
  isUnderReview: boolean;
  reviewTriggeredAt: number | null;
}

export class RiskScoreCalculator {
  private config: RiskScoreConfig;
  private state: RiskScoreState;

  constructor(config: RiskScoreConfig) {
    this.config = config;
    this.state = this.initializeState();
  }

  private initializeState(): RiskScoreState {
    return {
      currentScore: 0,
      lastFlagTime: 0,
      flagHistory: [],
      cleanBehaviorStart: null,
      isUnderReview: false,
      reviewTriggeredAt: null,
    };
  }

  /**
   * Process a flag event and update the risk score
   */
  public processFlag(flag: FlagEvent): number {
    const now = Date.now();
    
    // Apply decay for time since last flag
    this.applyDecay(now);
    
    // Calculate points for this flag
    const points = this.calculateFlagPoints(flag);
    
    // Add points to current score
    this.state.currentScore = Math.min(
      this.config.maxScore,
      this.state.currentScore + points
    );
    
    // Update state
    this.state.lastFlagTime = now;
    this.state.cleanBehaviorStart = null; // Reset clean behavior tracking
    
    // Add to flag history
    this.state.flagHistory.push({
      timestamp: now,
      type: flag.type,
      points,
      severity: flag.severity,
    });
    
    // Check if score exceeds review threshold
    if (!this.state.isUnderReview && this.state.currentScore >= this.config.reviewThreshold) {
      this.state.isUnderReview = true;
      this.state.reviewTriggeredAt = now;
    }
    
    return this.state.currentScore;
  }

  /**
   * Update score with time-based decay for clean behavior
   */
  public updateScore(currentTime?: number): number {
    const now = currentTime || Date.now();
    this.applyDecay(now);
    return this.state.currentScore;
  }

  private applyDecay(currentTime: number): void {
    if (this.state.lastFlagTime === 0) {
      // No flags yet, start clean behavior tracking
      if (this.state.cleanBehaviorStart === null) {
        this.state.cleanBehaviorStart = currentTime;
      }
      return;
    }

    const timeSinceLastFlag = currentTime - this.state.lastFlagTime;
    
    // Only apply decay if enough time has passed since last flag
    if (timeSinceLastFlag >= this.config.cleanBehaviorWindow) {
      if (this.state.cleanBehaviorStart === null) {
        this.state.cleanBehaviorStart = this.state.lastFlagTime + this.config.cleanBehaviorWindow;
      }
      
      const cleanBehaviorDuration = currentTime - this.state.cleanBehaviorStart;
      const decayAmount = (cleanBehaviorDuration / 1000) * this.config.decayRate;
      
      this.state.currentScore = Math.max(0, this.state.currentScore - decayAmount);
      
      // Update clean behavior start time to current time for continuous decay
      this.state.cleanBehaviorStart = currentTime;
    }
  }

  private calculateFlagPoints(flag: FlagEvent): number {
    const basePoints = this.getBasePointsForFlagType(flag.type);
    
    // Apply severity multiplier
    const severityMultiplier = flag.severity === 'hard' ? 1.5 : 1.0;
    
    // Apply confidence multiplier (higher confidence = more points)
    const confidenceMultiplier = 0.5 + (flag.confidence * 0.5); // Range: 0.5 to 1.0
    
    // Calculate duration-based points for certain flag types
    let durationMultiplier = 1.0;
    if (flag.details && typeof flag.details.duration === 'number') {
      const durationSeconds = flag.details.duration / 1000;
      
      // For duration-based flags, add points per second
      if (['EYES_OFF', 'FACE_MISSING'].includes(flag.type)) {
        durationMultiplier = durationSeconds;
      }
    }
    
    const totalPoints = basePoints * severityMultiplier * confidenceMultiplier * durationMultiplier;
    
    return Math.round(totalPoints * 100) / 100; // Round to 2 decimal places
  }

  private getBasePointsForFlagType(type: FlagEvent['type']): number {
    switch (type) {
      case 'EYES_OFF':
        return this.config.weights.eyesOff;
      case 'HEAD_POSE':
        return this.config.weights.headPose;
      case 'TAB_BLUR':
        return this.config.weights.tabBlur;
      case 'SECOND_FACE':
        return this.config.weights.secondFace;
      case 'DEVICE_OBJECT':
        return this.config.weights.deviceObject;
      case 'SHADOW_ANOMALY':
        return this.config.weights.shadowAnomaly;
      case 'FACE_MISSING':
        return this.config.weights.faceMissing;
      case 'DOWN_GLANCE':
        return this.config.weights.downGlance;
      default:
        return 1; // Default weight for unknown flag types
    }
  }

  /**
   * Get current risk score
   */
  public getCurrentScore(): number {
    return this.updateScore();
  }

  /**
   * Check if attempt should be marked as "Under Review"
   */
  public isUnderReview(): boolean {
    this.updateScore(); // Update score first
    return this.state.isUnderReview;
  }

  /**
   * Get risk level based on current score
   */
  public getRiskLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const score = this.getCurrentScore();
    
    if (score >= this.config.reviewThreshold) {
      return 'critical';
    } else if (score >= this.config.reviewThreshold * 0.75) {
      return 'high';
    } else if (score >= this.config.reviewThreshold * 0.5) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get detailed risk assessment
   */
  public getRiskAssessment(): {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    isUnderReview: boolean;
    flagCount: number;
    lastFlagTime: number;
    cleanBehaviorDuration: number;
    breakdown: Record<FlagEvent['type'], { count: number; totalPoints: number }>;
  } {
    const now = Date.now();
    const score = this.getCurrentScore();
    
    // Calculate flag breakdown
    const breakdown: Record<string, { count: number; totalPoints: number }> = {};
    
    this.state.flagHistory.forEach(flag => {
      if (!breakdown[flag.type]) {
        breakdown[flag.type] = { count: 0, totalPoints: 0 };
      }
      breakdown[flag.type].count++;
      breakdown[flag.type].totalPoints += flag.points;
    });

    // Calculate clean behavior duration
    let cleanBehaviorDuration = 0;
    if (this.state.cleanBehaviorStart !== null) {
      cleanBehaviorDuration = now - this.state.cleanBehaviorStart;
    } else if (this.state.lastFlagTime > 0) {
      const timeSinceLastFlag = now - this.state.lastFlagTime;
      if (timeSinceLastFlag >= this.config.cleanBehaviorWindow) {
        cleanBehaviorDuration = timeSinceLastFlag - this.config.cleanBehaviorWindow;
      }
    }

    return {
      score,
      level: this.getRiskLevel(),
      isUnderReview: this.isUnderReview(),
      flagCount: this.state.flagHistory.length,
      lastFlagTime: this.state.lastFlagTime,
      cleanBehaviorDuration,
      breakdown: breakdown as Record<FlagEvent['type'], { count: number; totalPoints: number }>,
    };
  }

  /**
   * Get flag history
   */
  public getFlagHistory(): Array<{
    timestamp: number;
    type: FlagEvent['type'];
    points: number;
    severity: 'soft' | 'hard';
  }> {
    return [...this.state.flagHistory];
  }

  /**
   * Get score timeline for visualization
   */
  public getScoreTimeline(intervalMs = 1000): Array<{ timestamp: number; score: number }> {
    if (this.state.flagHistory.length === 0) {
      return [{ timestamp: Date.now(), score: 0 }];
    }

    const timeline: Array<{ timestamp: number; score: number }> = [];
    const startTime = this.state.flagHistory[0].timestamp;
    const endTime = Date.now();
    
    let currentScore = 0;
    let flagIndex = 0;
    
    for (let time = startTime; time <= endTime; time += intervalMs) {
      // Add any flags that occurred at this time
      while (flagIndex < this.state.flagHistory.length && 
             this.state.flagHistory[flagIndex].timestamp <= time) {
        currentScore += this.state.flagHistory[flagIndex].points;
        flagIndex++;
      }
      
      // Apply decay (simplified for timeline)
      const timeSinceStart = time - startTime;
      const decayAmount = (timeSinceStart / 1000) * this.config.decayRate * 0.1; // Reduced decay for timeline
      currentScore = Math.max(0, currentScore - decayAmount);
      
      timeline.push({
        timestamp: time,
        score: Math.min(this.config.maxScore, currentScore),
      });
    }
    
    return timeline;
  }

  /**
   * Reset risk score and state
   */
  public reset(): void {
    this.state = this.initializeState();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<RiskScoreConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Re-evaluate under review status with new threshold
    if (config.reviewThreshold !== undefined) {
      if (!this.state.isUnderReview && this.state.currentScore >= this.config.reviewThreshold) {
        this.state.isUnderReview = true;
        this.state.reviewTriggeredAt = Date.now();
      } else if (this.state.isUnderReview && this.state.currentScore < this.config.reviewThreshold) {
        // Optionally reset under review status if score drops below threshold
        // This depends on business requirements
      }
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): RiskScoreConfig {
    return { ...this.config };
  }

  /**
   * Get current state (for debugging)
   */
  public getState(): RiskScoreState {
    return { ...this.state };
  }

  /**
   * Manually mark as under review
   */
  public markUnderReview(reason?: string): void {
    this.state.isUnderReview = true;
    this.state.reviewTriggeredAt = Date.now();
    
    // Add a special flag to history for manual review
    this.state.flagHistory.push({
      timestamp: Date.now(),
      type: 'TAB_BLUR', // Use generic type for manual review
      points: 0,
      severity: 'hard',
    });
  }

  /**
   * Calculate projected score based on current trend
   */
  public getProjectedScore(timeAheadMs: number): number {
    const currentScore = this.getCurrentScore();
    const now = Date.now();
    
    // If no flags yet, score stays at 0
    if (this.state.lastFlagTime === 0) {
      return 0;
    }
    
    const timeSinceLastFlag = now - this.state.lastFlagTime;
    
    // If we're already in clean behavior period, project decay
    if (timeSinceLastFlag >= this.config.cleanBehaviorWindow) {
      const totalCleanTime = timeSinceLastFlag + timeAheadMs;
      const cleanBehaviorTime = totalCleanTime - this.config.cleanBehaviorWindow;
      const decayAmount = (cleanBehaviorTime / 1000) * this.config.decayRate;
      return Math.max(0, currentScore - decayAmount);
    }
    
    // If we'll enter clean behavior period during projection
    const timeUntilCleanBehavior = this.config.cleanBehaviorWindow - timeSinceLastFlag;
    if (timeAheadMs > timeUntilCleanBehavior) {
      const cleanBehaviorTime = timeAheadMs - timeUntilCleanBehavior;
      const decayAmount = (cleanBehaviorTime / 1000) * this.config.decayRate;
      return Math.max(0, currentScore - decayAmount);
    }
    
    // If still within clean behavior window, score stays the same
    return currentScore;
  }
}