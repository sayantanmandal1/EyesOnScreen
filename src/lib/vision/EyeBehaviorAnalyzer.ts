/**
 * Comprehensive Eye Behavior Analysis System
 * Blink pattern analysis, eye movement recognition, and attention monitoring
 * Requirements: 5.5, 7.10
 */

import { VisionError } from './types';

export interface BlinkData {
  timestamp: number;
  duration: number; // milliseconds
  intensity: number; // 0-1, how complete the blink was
  type: 'voluntary' | 'involuntary' | 'partial';
  eyeAspectRatio: number;
}

export interface BlinkPattern {
  frequency: number; // blinks per minute
  averageDuration: number;
  regularityScore: number; // 0-1, how regular the pattern is
  readingIndicators: {
    isReading: boolean;
    confidence: number;
    evidence: string[];
  };
  fatigueIndicators: {
    isFatigued: boolean;
    level: 'none' | 'mild' | 'moderate' | 'severe';
    evidence: string[];
  };
}

export interface EyeMovementPattern {
  type: 'saccade' | 'fixation' | 'smooth_pursuit' | 'drift';
  startTime: number;
  endTime: number;
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  velocity: number; // degrees per second
  amplitude: number; // degrees
  direction: number; // radians
  confidence: number;
}

export interface AttentionFocus {
  isAttentive: boolean;
  focusLevel: number; // 0-1
  focusRegion: { x: number; y: number; width: number; height: number } | null;
  dwellTime: number; // milliseconds in current focus region
  scanPattern: 'focused' | 'scanning' | 'distracted' | 'off_screen';
  confidence: number;
}

export interface OffScreenGazeAlert {
  timestamp: number;
  duration: number;
  direction: 'left' | 'right' | 'up' | 'down' | 'unknown';
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  triggerReason: string;
}

export interface TemporalGazeConsistency {
  isConsistent: boolean;
  consistencyScore: number; // 0-1
  anomalies: Array<{
    timestamp: number;
    type: 'sudden_jump' | 'impossible_velocity' | 'tracking_loss' | 'calibration_drift';
    severity: number;
    description: string;
  }>;
  validationStatus: 'valid' | 'suspicious' | 'invalid';
}

export class EyeBehaviorAnalyzer {
  private blinkHistory: BlinkData[] = [];
  private eyeMovementHistory: EyeMovementPattern[] = [];
  private gazePositionHistory: Array<{ x: number; y: number; timestamp: number; confidence: number }> = [];
  private attentionHistory: AttentionFocus[] = [];
  private offScreenAlerts: OffScreenGazeAlert[] = [];
  
  // Analysis parameters
  private readonly BLINK_EAR_THRESHOLD = 0.25; // Eye Aspect Ratio threshold for blink detection
  private readonly SACCADE_VELOCITY_THRESHOLD = 30; // degrees/second
  private readonly FIXATION_DURATION_MIN = 100; // milliseconds
  private readonly ATTENTION_FOCUS_RADIUS = 50; // pixels
  private readonly OFF_SCREEN_ALERT_DELAY = 1000; // milliseconds
  
  // Screen boundaries for off-screen detection
  private screenBounds = {
    width: 1920,
    height: 1080
  };

  constructor(screenBounds?: { width: number; height: number }) {
    if (screenBounds) {
      this.screenBounds = screenBounds;
    }
  }

  /**
   * Analyze blink patterns for reading detection and fatigue assessment
   */
  analyzeBlinkPattern(
    eyeLandmarks: Float32Array,
    timestamp: number
  ): { currentBlink: BlinkData | null; pattern: BlinkPattern } {
    // Calculate Eye Aspect Ratio (EAR) for blink detection
    const leftEAR = this.calculateEyeAspectRatio(eyeLandmarks, 'left');
    const rightEAR = this.calculateEyeAspectRatio(eyeLandmarks, 'right');
    const avgEAR = (leftEAR + rightEAR) / 2;
    
    // Detect blink
    const currentBlink = this.detectBlink(avgEAR, timestamp);
    
    // Analyze overall blink pattern
    const pattern = this.analyzeOverallBlinkPattern();
    
    return { currentBlink, pattern };
  }

  /**
   * Calculate Eye Aspect Ratio for blink detection
   */
  private calculateEyeAspectRatio(landmarks: Float32Array, eye: 'left' | 'right'): number {
    // MediaPipe FaceMesh landmark indices for eyes
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    
    const indices = eye === 'left' ? leftEyeIndices : rightEyeIndices;
    
    if (landmarks.length < 468 * 3) {
      return 0.3; // Default EAR when landmarks unavailable
    }
    
    // Get eye corner points
    const outerCorner = { x: landmarks[indices[0] * 3], y: landmarks[indices[0] * 3 + 1] };
    const innerCorner = { x: landmarks[indices[8] * 3], y: landmarks[indices[8] * 3 + 1] };
    
    // Get vertical eye points
    const topPoints = [
      { x: landmarks[indices[1] * 3], y: landmarks[indices[1] * 3 + 1] },
      { x: landmarks[indices[2] * 3], y: landmarks[indices[2] * 3 + 1] },
      { x: landmarks[indices[3] * 3], y: landmarks[indices[3] * 3 + 1] }
    ];
    
    const bottomPoints = [
      { x: landmarks[indices[5] * 3], y: landmarks[indices[5] * 3 + 1] },
      { x: landmarks[indices[6] * 3], y: landmarks[indices[6] * 3 + 1] },
      { x: landmarks[indices[7] * 3], y: landmarks[indices[7] * 3 + 1] }
    ];
    
    // Calculate vertical distances
    let totalVerticalDistance = 0;
    for (let i = 0; i < topPoints.length; i++) {
      const distance = Math.sqrt(
        Math.pow(topPoints[i].x - bottomPoints[i].x, 2) +
        Math.pow(topPoints[i].y - bottomPoints[i].y, 2)
      );
      totalVerticalDistance += distance;
    }
    
    // Calculate horizontal distance
    const horizontalDistance = Math.sqrt(
      Math.pow(outerCorner.x - innerCorner.x, 2) +
      Math.pow(outerCorner.y - innerCorner.y, 2)
    );
    
    // Eye Aspect Ratio
    const ear = totalVerticalDistance / (3 * horizontalDistance);
    
    return Math.max(0, Math.min(1, ear));
  }

  /**
   * Detect individual blink events
   */
  private detectBlink(ear: number, timestamp: number): BlinkData | null {
    // Check if EAR indicates a blink
    if (ear < this.BLINK_EAR_THRESHOLD) {
      // Check if this is a new blink or continuation
      const lastBlink = this.blinkHistory[this.blinkHistory.length - 1];
      
      if (!lastBlink || timestamp - lastBlink.timestamp > 500) {
        // New blink detected
        const blinkData: BlinkData = {
          timestamp,
          duration: 0, // Will be updated when blink ends
          intensity: 1 - ear / this.BLINK_EAR_THRESHOLD,
          type: this.classifyBlinkType(ear, timestamp),
          eyeAspectRatio: ear
        };
        
        this.blinkHistory.push(blinkData);
        return blinkData;
      } else {
        // Update ongoing blink
        lastBlink.duration = timestamp - lastBlink.timestamp;
        lastBlink.intensity = Math.max(lastBlink.intensity, 1 - ear / this.BLINK_EAR_THRESHOLD);
        return lastBlink;
      }
    }
    
    return null;
  }

  /**
   * Classify blink type based on characteristics
   */
  private classifyBlinkType(ear: number, timestamp: number): 'voluntary' | 'involuntary' | 'partial' {
    // Partial blink if EAR doesn't go low enough
    if (ear > this.BLINK_EAR_THRESHOLD * 0.7) {
      return 'partial';
    }
    
    // Check recent blink frequency for voluntary vs involuntary classification
    const recentBlinks = this.blinkHistory.filter(b => timestamp - b.timestamp < 5000);
    
    if (recentBlinks.length > 3) {
      return 'voluntary'; // Frequent blinking suggests voluntary
    }
    
    return 'involuntary';
  }

  /**
   * Analyze overall blink pattern for reading and fatigue detection
   */
  private analyzeOverallBlinkPattern(): BlinkPattern {
    const now = Date.now();
    const recentBlinks = this.blinkHistory.filter(b => now - b.timestamp < 60000); // Last minute
    
    // Calculate frequency (blinks per minute)
    const frequency = recentBlinks.length;
    
    // Calculate average duration
    const validBlinks = recentBlinks.filter(b => b.duration > 0);
    const averageDuration = validBlinks.length > 0
      ? validBlinks.reduce((sum, b) => sum + b.duration, 0) / validBlinks.length
      : 0;
    
    // Calculate regularity score
    const regularityScore = this.calculateBlinkRegularity(recentBlinks);
    
    // Detect reading indicators
    const readingIndicators = this.detectReadingFromBlinks(recentBlinks);
    
    // Detect fatigue indicators
    const fatigueIndicators = this.detectFatigueFromBlinks(recentBlinks);
    
    return {
      frequency,
      averageDuration,
      regularityScore,
      readingIndicators,
      fatigueIndicators
    };
  }

  /**
   * Calculate blink regularity score
   */
  private calculateBlinkRegularity(blinks: BlinkData[]): number {
    if (blinks.length < 3) return 0.5;
    
    // Calculate intervals between blinks
    const intervals: number[] = [];
    for (let i = 1; i < blinks.length; i++) {
      intervals.push(blinks[i].timestamp - blinks[i - 1].timestamp);
    }
    
    // Calculate coefficient of variation
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
    
    // Convert to regularity score (lower CV = higher regularity)
    return Math.max(0, 1 - coefficientOfVariation);
  }

  /**
   * Detect reading behavior from blink patterns
   */
  private detectReadingFromBlinks(blinks: BlinkData[]): {
    isReading: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;
    
    // Reading typically shows reduced blink frequency (10-15 blinks/min vs normal 15-20)
    if (blinks.length < 15) {
      evidence.push('Reduced blink frequency consistent with reading');
      confidence += 0.3;
    }
    
    // Reading shows more regular blink patterns
    const regularity = this.calculateBlinkRegularity(blinks);
    if (regularity > 0.6) {
      evidence.push('Regular blink pattern suggests focused reading');
      confidence += 0.2;
    }
    
    // Longer blink durations during reading
    const avgDuration = blinks.filter(b => b.duration > 0)
      .reduce((sum, b) => sum + b.duration, 0) / Math.max(1, blinks.filter(b => b.duration > 0).length);
    
    if (avgDuration > 150) {
      evidence.push('Longer blink durations indicate reading concentration');
      confidence += 0.2;
    }
    
    // More involuntary blinks during reading
    const involuntaryRatio = blinks.filter(b => b.type === 'involuntary').length / Math.max(1, blinks.length);
    if (involuntaryRatio > 0.7) {
      evidence.push('High ratio of involuntary blinks suggests natural reading');
      confidence += 0.3;
    }
    
    const isReading = confidence > 0.5;
    
    return { isReading, confidence, evidence };
  }

  /**
   * Detect fatigue from blink patterns
   */
  private detectFatigueFromBlinks(blinks: BlinkData[]): {
    isFatigued: boolean;
    level: 'none' | 'mild' | 'moderate' | 'severe';
    evidence: string[];
  } {
    const evidence: string[] = [];
    let fatigueScore = 0;
    
    // Increased blink frequency indicates fatigue
    if (blinks.length > 25) {
      evidence.push('Elevated blink frequency suggests fatigue');
      fatigueScore += 0.3;
    }
    
    // Longer blink durations indicate fatigue
    const avgDuration = blinks.filter(b => b.duration > 0)
      .reduce((sum, b) => sum + b.duration, 0) / Math.max(1, blinks.filter(b => b.duration > 0).length);
    
    if (avgDuration > 200) {
      evidence.push('Prolonged blink durations indicate fatigue');
      fatigueScore += 0.4;
    }
    
    // More partial blinks indicate fatigue
    const partialBlinkRatio = blinks.filter(b => b.type === 'partial').length / Math.max(1, blinks.length);
    if (partialBlinkRatio > 0.3) {
      evidence.push('High ratio of partial blinks suggests eye fatigue');
      fatigueScore += 0.3;
    }
    
    // Irregular blink patterns indicate fatigue
    const regularity = this.calculateBlinkRegularity(blinks);
    if (regularity < 0.4) {
      evidence.push('Irregular blink patterns suggest fatigue');
      fatigueScore += 0.2;
    }
    
    let level: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
    if (fatigueScore > 0.8) level = 'severe';
    else if (fatigueScore > 0.6) level = 'moderate';
    else if (fatigueScore > 0.3) level = 'mild';
    
    return {
      isFatigued: fatigueScore > 0.3,
      level,
      evidence
    };
  }

  /**
   * Recognize eye movement patterns (saccades, fixations, etc.)
   */
  recognizeEyeMovementPatterns(
    gazePosition: { x: number; y: number; timestamp: number; confidence: number }
  ): EyeMovementPattern[] {
    // Add to gaze history
    this.gazePositionHistory.push(gazePosition);
    
    // Keep only last 5 seconds of data
    const cutoff = gazePosition.timestamp - 5000;
    this.gazePositionHistory = this.gazePositionHistory.filter(g => g.timestamp >= cutoff);
    
    // Analyze recent movements
    const newPatterns = this.analyzeRecentMovements();
    
    // Add to movement history
    this.eyeMovementHistory.push(...newPatterns);
    
    // Keep only last 30 seconds of movement patterns
    const movementCutoff = gazePosition.timestamp - 30000;
    this.eyeMovementHistory = this.eyeMovementHistory.filter(m => m.endTime >= movementCutoff);
    
    return newPatterns;
  }

  /**
   * Analyze recent gaze movements to identify patterns
   */
  private analyzeRecentMovements(): EyeMovementPattern[] {
    const patterns: EyeMovementPattern[] = [];
    
    if (this.gazePositionHistory.length < 3) {
      return patterns;
    }
    
    // Analyze movement segments
    for (let i = 1; i < this.gazePositionHistory.length; i++) {
      const prev = this.gazePositionHistory[i - 1];
      const curr = this.gazePositionHistory[i];
      
      // Calculate movement characteristics
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      );
      
      const duration = curr.timestamp - prev.timestamp;
      const velocity = duration > 0 ? (distance / duration) * 1000 : 0; // pixels per second
      
      // Convert to degrees (approximate)
      const pixelsPerDegree = 30; // Approximate conversion
      const velocityDegrees = velocity / pixelsPerDegree;
      const amplitudeDegrees = distance / pixelsPerDegree;
      
      const direction = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      
      // Classify movement type
      let type: 'saccade' | 'fixation' | 'smooth_pursuit' | 'drift';
      let confidence = Math.min(prev.confidence, curr.confidence);
      
      if (velocityDegrees > this.SACCADE_VELOCITY_THRESHOLD) {
        type = 'saccade';
      } else if (distance < 10 && duration > this.FIXATION_DURATION_MIN) {
        type = 'fixation';
      } else if (velocityDegrees > 5 && velocityDegrees <= this.SACCADE_VELOCITY_THRESHOLD) {
        type = 'smooth_pursuit';
      } else {
        type = 'drift';
        confidence *= 0.7; // Lower confidence for drift movements
      }
      
      patterns.push({
        type,
        startTime: prev.timestamp,
        endTime: curr.timestamp,
        startPosition: { x: prev.x, y: prev.y },
        endPosition: { x: curr.x, y: curr.y },
        velocity: velocityDegrees,
        amplitude: amplitudeDegrees,
        direction,
        confidence
      });
    }
    
    return patterns;
  }

  /**
   * Monitor attention focus and scanning patterns
   */
  monitorAttentionFocus(
    gazePosition: { x: number; y: number; timestamp: number; confidence: number }
  ): AttentionFocus {
    // Determine current focus region
    const focusRegion = this.determineFocusRegion(gazePosition);
    
    // Calculate dwell time in current region
    const dwellTime = this.calculateDwellTime(focusRegion, gazePosition.timestamp);
    
    // Analyze scan pattern
    const scanPattern = this.analyzeScanPattern();
    
    // Calculate focus level
    const focusLevel = this.calculateFocusLevel(focusRegion, dwellTime, scanPattern);
    
    // Determine if user is attentive
    const isAttentive = focusLevel > 0.6 && gazePosition.confidence > 0.5;
    
    const attention: AttentionFocus = {
      isAttentive,
      focusLevel,
      focusRegion,
      dwellTime,
      scanPattern,
      confidence: gazePosition.confidence
    };
    
    // Add to attention history
    this.attentionHistory.push(attention);
    
    // Keep only last 30 seconds
    const cutoff = gazePosition.timestamp - 30000;
    this.attentionHistory = this.attentionHistory.filter(a => a.dwellTime >= cutoff);
    
    return attention;
  }

  /**
   * Determine current focus region
   */
  private determineFocusRegion(
    gazePosition: { x: number; y: number }
  ): { x: number; y: number; width: number; height: number } | null {
    // Check if gaze is on screen
    if (gazePosition.x < 0 || gazePosition.x > this.screenBounds.width ||
        gazePosition.y < 0 || gazePosition.y > this.screenBounds.height) {
      return null;
    }
    
    // Create focus region around current gaze position
    const radius = this.ATTENTION_FOCUS_RADIUS;
    
    return {
      x: Math.max(0, gazePosition.x - radius),
      y: Math.max(0, gazePosition.y - radius),
      width: Math.min(this.screenBounds.width - Math.max(0, gazePosition.x - radius), radius * 2),
      height: Math.min(this.screenBounds.height - Math.max(0, gazePosition.y - radius), radius * 2)
    };
  }

  /**
   * Calculate dwell time in current focus region
   */
  private calculateDwellTime(
    focusRegion: { x: number; y: number; width: number; height: number } | null,
    currentTime: number
  ): number {
    if (!focusRegion) return 0;
    
    // Find when user first entered this region
    let entryTime = currentTime;
    
    for (let i = this.gazePositionHistory.length - 1; i >= 0; i--) {
      const gaze = this.gazePositionHistory[i];
      
      // Check if gaze is within focus region
      if (gaze.x >= focusRegion.x && gaze.x <= focusRegion.x + focusRegion.width &&
          gaze.y >= focusRegion.y && gaze.y <= focusRegion.y + focusRegion.height) {
        entryTime = gaze.timestamp;
      } else {
        break;
      }
    }
    
    return currentTime - entryTime;
  }

  /**
   * Analyze scanning pattern from recent eye movements
   */
  private analyzeScanPattern(): 'focused' | 'scanning' | 'distracted' | 'off_screen' {
    const recentMovements = this.eyeMovementHistory.filter(m => 
      Date.now() - m.endTime < 5000
    );
    
    if (recentMovements.length === 0) {
      return 'off_screen';
    }
    
    // Count movement types
    const saccades = recentMovements.filter(m => m.type === 'saccade').length;
    const fixations = recentMovements.filter(m => m.type === 'fixation').length;
    const pursuits = recentMovements.filter(m => m.type === 'smooth_pursuit').length;
    
    // Calculate movement dispersion
    const positions = recentMovements.map(m => m.endPosition);
    const dispersion = this.calculatePositionDispersion(positions);
    
    // Classify pattern
    if (fixations > saccades && dispersion < 100) {
      return 'focused';
    } else if (saccades > fixations && dispersion > 200) {
      return 'scanning';
    } else if (dispersion > 300 || pursuits > saccades + fixations) {
      return 'distracted';
    } else {
      return 'focused';
    }
  }

  /**
   * Calculate position dispersion
   */
  private calculatePositionDispersion(positions: Array<{ x: number; y: number }>): number {
    if (positions.length === 0) return 0;
    
    // Calculate centroid
    const centroid = {
      x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
      y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length
    };
    
    // Calculate average distance from centroid
    const avgDistance = positions.reduce((sum, p) => {
      return sum + Math.sqrt(Math.pow(p.x - centroid.x, 2) + Math.pow(p.y - centroid.y, 2));
    }, 0) / positions.length;
    
    return avgDistance;
  }

  /**
   * Calculate focus level
   */
  private calculateFocusLevel(
    focusRegion: { x: number; y: number; width: number; height: number } | null,
    dwellTime: number,
    scanPattern: 'focused' | 'scanning' | 'distracted' | 'off_screen'
  ): number {
    let focusLevel = 0;
    
    // Base level from scan pattern
    switch (scanPattern) {
      case 'focused': focusLevel = 0.8; break;
      case 'scanning': focusLevel = 0.5; break;
      case 'distracted': focusLevel = 0.2; break;
      case 'off_screen': focusLevel = 0; break;
    }
    
    // Adjust based on dwell time
    if (dwellTime > 2000) {
      focusLevel = Math.min(1, focusLevel + 0.2);
    } else if (dwellTime < 500) {
      focusLevel = Math.max(0, focusLevel - 0.3);
    }
    
    // Adjust based on focus region
    if (!focusRegion) {
      focusLevel = 0;
    }
    
    return focusLevel;
  }

  /**
   * Detect off-screen gaze with immediate alerts
   */
  detectOffScreenGaze(
    gazePosition: { x: number; y: number; timestamp: number; confidence: number }
  ): OffScreenGazeAlert | null {
    const isOffScreen = gazePosition.x < 0 || gazePosition.x > this.screenBounds.width ||
                       gazePosition.y < 0 || gazePosition.y > this.screenBounds.height;
    
    if (!isOffScreen) {
      return null; // Gaze is on screen
    }
    
    // Determine direction
    let direction: 'left' | 'right' | 'up' | 'down' | 'unknown' = 'unknown';
    
    if (gazePosition.x < 0) direction = 'left';
    else if (gazePosition.x > this.screenBounds.width) direction = 'right';
    else if (gazePosition.y < 0) direction = 'up';
    else if (gazePosition.y > this.screenBounds.height) direction = 'down';
    
    // Check if this is a continuation of existing off-screen period
    const lastAlert = this.offScreenAlerts[this.offScreenAlerts.length - 1];
    
    if (lastAlert && gazePosition.timestamp - lastAlert.timestamp < 2000) {
      // Update existing alert
      lastAlert.duration = gazePosition.timestamp - (lastAlert.timestamp - lastAlert.duration);
      return lastAlert;
    }
    
    // Create new alert if off-screen duration exceeds threshold
    const offScreenDuration = this.calculateOffScreenDuration(gazePosition.timestamp);
    
    if (offScreenDuration >= this.OFF_SCREEN_ALERT_DELAY) {
      const severity = this.calculateOffScreenSeverity(offScreenDuration, direction);
      
      const alert: OffScreenGazeAlert = {
        timestamp: gazePosition.timestamp,
        duration: offScreenDuration,
        direction,
        severity,
        confidence: gazePosition.confidence,
        triggerReason: `Eyes off screen for ${offScreenDuration}ms in ${direction} direction`
      };
      
      this.offScreenAlerts.push(alert);
      
      // Keep only last 20 alerts
      if (this.offScreenAlerts.length > 20) {
        this.offScreenAlerts.shift();
      }
      
      return alert;
    }
    
    return null;
  }

  /**
   * Calculate how long gaze has been off screen
   */
  private calculateOffScreenDuration(currentTime: number): number {
    // Find last on-screen gaze position
    for (let i = this.gazePositionHistory.length - 1; i >= 0; i--) {
      const gaze = this.gazePositionHistory[i];
      
      if (gaze.x >= 0 && gaze.x <= this.screenBounds.width &&
          gaze.y >= 0 && gaze.y <= this.screenBounds.height) {
        return currentTime - gaze.timestamp;
      }
    }
    
    // If no on-screen position found, return maximum duration
    return 10000;
  }

  /**
   * Calculate severity of off-screen gaze
   */
  private calculateOffScreenSeverity(
    duration: number,
    direction: 'left' | 'right' | 'up' | 'down' | 'unknown'
  ): 'low' | 'medium' | 'high' {
    if (duration > 5000) return 'high';
    if (duration > 2000) return 'medium';
    return 'low';
  }

  /**
   * Validate temporal gaze consistency
   */
  validateTemporalGazeConsistency(
    gazePosition: { x: number; y: number; timestamp: number; confidence: number }
  ): TemporalGazeConsistency {
    const anomalies: Array<{
      timestamp: number;
      type: 'sudden_jump' | 'impossible_velocity' | 'tracking_loss' | 'calibration_drift';
      severity: number;
      description: string;
    }> = [];
    
    // Check for sudden jumps
    if (this.gazePositionHistory.length > 0) {
      const lastGaze = this.gazePositionHistory[this.gazePositionHistory.length - 1];
      const distance = Math.sqrt(
        Math.pow(gazePosition.x - lastGaze.x, 2) + 
        Math.pow(gazePosition.y - lastGaze.y, 2)
      );
      
      const timeDiff = gazePosition.timestamp - lastGaze.timestamp;
      const velocity = timeDiff > 0 ? distance / timeDiff : 0;
      
      // Check for impossible velocities (>1000 pixels/ms = >1000000 pixels/second)
      if (velocity > 1000) {
        anomalies.push({
          timestamp: gazePosition.timestamp,
          type: 'impossible_velocity',
          severity: Math.min(1, velocity / 2000),
          description: `Impossible gaze velocity: ${velocity.toFixed(2)} pixels/ms`
        });
      }
      
      // Check for sudden jumps (>200 pixels in <50ms)
      if (distance > 200 && timeDiff < 50) {
        anomalies.push({
          timestamp: gazePosition.timestamp,
          type: 'sudden_jump',
          severity: Math.min(1, distance / 500),
          description: `Sudden gaze jump: ${distance.toFixed(2)} pixels in ${timeDiff}ms`
        });
      }
    }
    
    // Check for tracking loss (low confidence)
    if (gazePosition.confidence < 0.3) {
      anomalies.push({
        timestamp: gazePosition.timestamp,
        type: 'tracking_loss',
        severity: 1 - gazePosition.confidence,
        description: `Low tracking confidence: ${gazePosition.confidence.toFixed(3)}`
      });
    }
    
    // Check for calibration drift
    const driftScore = this.calculateCalibrationDrift();
    if (driftScore > 0.7) {
      anomalies.push({
        timestamp: gazePosition.timestamp,
        type: 'calibration_drift',
        severity: driftScore,
        description: `Potential calibration drift detected: ${driftScore.toFixed(3)}`
      });
    }
    
    // Calculate consistency score
    const severitySum = anomalies.reduce((sum, a) => sum + a.severity, 0);
    const consistencyScore = Math.max(0, 1 - severitySum / 3);
    
    // Determine validation status
    let validationStatus: 'valid' | 'suspicious' | 'invalid' = 'valid';
    if (consistencyScore < 0.3) validationStatus = 'invalid';
    else if (consistencyScore < 0.7) validationStatus = 'suspicious';
    
    return {
      isConsistent: consistencyScore > 0.7,
      consistencyScore,
      anomalies,
      validationStatus
    };
  }

  /**
   * Calculate calibration drift score
   */
  private calculateCalibrationDrift(): number {
    if (this.gazePositionHistory.length < 10) return 0;
    
    // Compare recent gaze patterns with earlier patterns
    const recent = this.gazePositionHistory.slice(-10);
    const earlier = this.gazePositionHistory.slice(-20, -10);
    
    if (earlier.length === 0) return 0;
    
    // Calculate average positions
    const recentAvg = {
      x: recent.reduce((sum, g) => sum + g.x, 0) / recent.length,
      y: recent.reduce((sum, g) => sum + g.y, 0) / recent.length
    };
    
    const earlierAvg = {
      x: earlier.reduce((sum, g) => sum + g.x, 0) / earlier.length,
      y: earlier.reduce((sum, g) => sum + g.y, 0) / earlier.length
    };
    
    // Calculate drift distance
    const drift = Math.sqrt(
      Math.pow(recentAvg.x - earlierAvg.x, 2) + 
      Math.pow(recentAvg.y - earlierAvg.y, 2)
    );
    
    // Normalize to 0-1 score
    return Math.min(1, drift / 100);
  }

  /**
   * Get comprehensive behavior analysis summary
   */
  getBehaviorAnalysisSummary(): {
    blinkPattern: BlinkPattern;
    attentionLevel: number;
    movementPatterns: { [key: string]: number };
    offScreenTime: number;
    consistencyScore: number;
    overallEngagement: number;
  } {
    const now = Date.now();
    
    // Get recent blink pattern
    const recentBlinks = this.blinkHistory.filter(b => now - b.timestamp < 60000);
    const blinkPattern = this.analyzeOverallBlinkPattern();
    
    // Calculate average attention level
    const recentAttention = this.attentionHistory.filter(a => now - a.dwellTime < 30000);
    const attentionLevel = recentAttention.length > 0
      ? recentAttention.reduce((sum, a) => sum + a.focusLevel, 0) / recentAttention.length
      : 0;
    
    // Analyze movement patterns
    const recentMovements = this.eyeMovementHistory.filter(m => now - m.endTime < 30000);
    const movementPatterns = {
      saccades: recentMovements.filter(m => m.type === 'saccade').length,
      fixations: recentMovements.filter(m => m.type === 'fixation').length,
      smoothPursuit: recentMovements.filter(m => m.type === 'smooth_pursuit').length,
      drift: recentMovements.filter(m => m.type === 'drift').length
    };
    
    // Calculate off-screen time
    const recentAlerts = this.offScreenAlerts.filter(a => now - a.timestamp < 60000);
    const offScreenTime = recentAlerts.reduce((sum, a) => sum + a.duration, 0);
    
    // Calculate consistency score
    const recentGaze = this.gazePositionHistory.filter(g => now - g.timestamp < 30000);
    const avgConsistency = recentGaze.length > 0
      ? recentGaze.reduce((sum, g) => sum + g.confidence, 0) / recentGaze.length
      : 0;
    
    // Calculate overall engagement
    const overallEngagement = (
      attentionLevel * 0.4 +
      (blinkPattern.readingIndicators.confidence) * 0.2 +
      (1 - Math.min(1, offScreenTime / 30000)) * 0.2 +
      avgConsistency * 0.2
    );
    
    return {
      blinkPattern,
      attentionLevel,
      movementPatterns,
      offScreenTime,
      consistencyScore: avgConsistency,
      overallEngagement
    };
  }

  /**
   * Reset analysis history
   */
  resetAnalysis(): void {
    this.blinkHistory = [];
    this.eyeMovementHistory = [];
    this.gazePositionHistory = [];
    this.attentionHistory = [];
    this.offScreenAlerts = [];
  }

  /**
   * Update screen bounds for off-screen detection
   */
  updateScreenBounds(bounds: { width: number; height: number }): void {
    this.screenBounds = bounds;
  }
}