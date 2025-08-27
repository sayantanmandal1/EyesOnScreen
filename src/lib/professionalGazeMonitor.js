/**
 * Professional Gaze Monitoring System
 * Real-time gaze tracking and integrity monitoring for exam platforms
 * Similar to systems used by HackerRank, Proctorio, etc.
 */

import { gazeTracker } from './gazeTracking';

class ProfessionalGazeMonitor {
  constructor() {
    this.isActive = false;
    this.callbacks = new Map();
    this.monitoringData = [];
    this.alertThresholds = {
      eyesOffScreen: 2000, // 2 seconds
      lookingAway: 1500,   // 1.5 seconds
      noFaceDetected: 3000, // 3 seconds
      lowConfidence: 5000   // 5 seconds of low confidence
    };
    
    this.currentState = {
      eyesOnScreen: true,
      faceDetected: true,
      gazeConfidence: 0,
      lastValidGaze: null,
      alertsTriggered: [],
      riskScore: 0
    };
    
    this.monitoringInterval = null;
    this.performanceMetrics = {
      totalMonitoringTime: 0,
      gazeDataPoints: 0,
      alertsGenerated: 0,
      averageConfidence: 0
    };
  }

  /**
   * Start professional gaze monitoring
   */
  async start(options = {}) {
    if (this.isActive) {
      console.warn('Professional gaze monitoring already active');
      return true;
    }

    try {
      // Ensure gaze tracker is ready
      if (!gazeTracker.isReady()) {
        console.error('Gaze tracker not ready for professional monitoring');
        return false;
      }

      this.isActive = true;
      this.monitoringData = [];
      this.performanceMetrics.totalMonitoringTime = Date.now();

      // Set up real-time gaze callback
      gazeTracker.setRealTimeGazeCallback((gazePoint) => {
        this.processGazeData(gazePoint);
      });

      // Start monitoring loop
      this.startMonitoringLoop();

      console.log('Professional gaze monitoring started');
      return true;
    } catch (error) {
      console.error('Failed to start professional gaze monitoring:', error);
      return false;
    }
  }

  /**
   * Stop professional gaze monitoring
   */
  stop() {
    if (!this.isActive) return;

    this.isActive = false;
    
    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Remove gaze callback
    gazeTracker.removeRealTimeGazeCallback();

    // Calculate final metrics
    this.performanceMetrics.totalMonitoringTime = Date.now() - this.performanceMetrics.totalMonitoringTime;
    
    console.log('Professional gaze monitoring stopped', this.getMonitoringReport());
  }

  /**
   * Process incoming gaze data
   */
  processGazeData(gazePoint) {
    if (!this.isActive) return;

    const timestamp = Date.now();
    this.performanceMetrics.gazeDataPoints++;

    // Validate gaze data
    const isValidGaze = this.validateGazeData(gazePoint);
    const isOnScreen = this.isGazeOnScreen(gazePoint);
    
    // Update current state
    this.currentState.eyesOnScreen = isOnScreen;
    this.currentState.gazeConfidence = gazePoint?.confidence || 0;
    
    if (isValidGaze) {
      this.currentState.lastValidGaze = {
        ...gazePoint,
        timestamp
      };
    }

    // Store monitoring data
    const monitoringPoint = {
      timestamp,
      gaze: gazePoint,
      isValid: isValidGaze,
      isOnScreen: isOnScreen,
      confidence: gazePoint?.confidence || 0,
      riskFactors: this.calculateRiskFactors(gazePoint, isOnScreen, isValidGaze)
    };

    this.monitoringData.push(monitoringPoint);

    // Keep only last 30 seconds of data
    const cutoff = timestamp - 30000;
    this.monitoringData = this.monitoringData.filter(d => d.timestamp >= cutoff);

    // Update performance metrics
    this.updatePerformanceMetrics();

    // Trigger callbacks
    this.triggerCallbacks('gazeData', monitoringPoint);
  }

  /**
   * Validate gaze data quality
   */
  validateGazeData(gazePoint) {
    if (!gazePoint) return false;
    if (gazePoint.x === undefined || gazePoint.y === undefined) return false;
    if (isNaN(gazePoint.x) || isNaN(gazePoint.y)) return false;
    if (gazePoint.confidence < 0.3) return false;
    
    return true;
  }

  /**
   * Check if gaze is on screen
   */
  isGazeOnScreen(gazePoint) {
    if (!gazePoint) return false;
    
    const margin = 50; // Allow small margin outside screen
    return gazePoint.x >= -margin && 
           gazePoint.x <= window.innerWidth + margin &&
           gazePoint.y >= -margin && 
           gazePoint.y <= window.innerHeight + margin;
  }

  /**
   * Calculate risk factors for current gaze state
   */
  calculateRiskFactors(gazePoint, isOnScreen, isValid) {
    const factors = [];
    
    if (!isValid) factors.push('invalid_gaze');
    if (!isOnScreen) factors.push('eyes_off_screen');
    if (gazePoint?.confidence < 0.5) factors.push('low_confidence');
    
    // Check for suspicious patterns
    const recentData = this.monitoringData.slice(-10);
    if (recentData.length >= 5) {
      const offScreenCount = recentData.filter(d => !d.isOnScreen).length;
      if (offScreenCount >= 3) factors.push('frequent_looking_away');
      
      const lowConfidenceCount = recentData.filter(d => d.confidence < 0.4).length;
      if (lowConfidenceCount >= 4) factors.push('poor_tracking_quality');
    }
    
    return factors;
  }

  /**
   * Start monitoring loop for alerts and analysis
   */
  startMonitoringLoop() {
    this.monitoringInterval = setInterval(() => {
      this.analyzeRecentBehavior();
      this.updateRiskScore();
      this.checkForAlerts();
    }, 500); // Check every 500ms
  }

  /**
   * Analyze recent behavior patterns
   */
  analyzeRecentBehavior() {
    const now = Date.now();
    const recentData = this.monitoringData.filter(d => now - d.timestamp <= 5000); // Last 5 seconds
    
    if (recentData.length === 0) return;

    // Calculate behavior metrics
    const offScreenTime = this.calculateOffScreenTime(recentData);
    const averageConfidence = recentData.reduce((sum, d) => sum + d.confidence, 0) / recentData.length;
    const validDataRatio = recentData.filter(d => d.isValid).length / recentData.length;

    // Update current state
    this.currentState.offScreenTime = offScreenTime;
    this.currentState.averageConfidence = averageConfidence;
    this.currentState.validDataRatio = validDataRatio;

    // Trigger behavior analysis callback
    this.triggerCallbacks('behaviorAnalysis', {
      offScreenTime,
      averageConfidence,
      validDataRatio,
      dataPoints: recentData.length
    });
  }

  /**
   * Calculate time spent looking off screen
   */
  calculateOffScreenTime(data) {
    let offScreenTime = 0;
    let lastOffScreenStart = null;

    for (const point of data) {
      if (!point.isOnScreen && !lastOffScreenStart) {
        lastOffScreenStart = point.timestamp;
      } else if (point.isOnScreen && lastOffScreenStart) {
        offScreenTime += point.timestamp - lastOffScreenStart;
        lastOffScreenStart = null;
      }
    }

    // If still off screen, add time to now
    if (lastOffScreenStart) {
      offScreenTime += Date.now() - lastOffScreenStart;
    }

    return offScreenTime;
  }

  /**
   * Update risk score based on recent behavior
   */
  updateRiskScore() {
    let riskScore = 0;
    const now = Date.now();
    
    // Check various risk factors
    const recentData = this.monitoringData.filter(d => now - d.timestamp <= 10000); // Last 10 seconds
    
    if (recentData.length > 0) {
      // Off-screen time penalty
      const offScreenRatio = recentData.filter(d => !d.isOnScreen).length / recentData.length;
      riskScore += offScreenRatio * 30;
      
      // Low confidence penalty
      const lowConfidenceRatio = recentData.filter(d => d.confidence < 0.4).length / recentData.length;
      riskScore += lowConfidenceRatio * 20;
      
      // Invalid data penalty
      const invalidDataRatio = recentData.filter(d => !d.isValid).length / recentData.length;
      riskScore += invalidDataRatio * 25;
    }
    
    // Decay risk score over time
    this.currentState.riskScore = Math.max(0, Math.min(100, riskScore));
  }

  /**
   * Check for alert conditions
   */
  checkForAlerts() {
    const now = Date.now();
    const alerts = [];

    // Eyes off screen alert
    const offScreenTime = this.currentState.offScreenTime || 0;
    if (offScreenTime > this.alertThresholds.eyesOffScreen) {
      alerts.push({
        type: 'eyes_off_screen',
        severity: 'high',
        duration: offScreenTime,
        message: `Eyes have been off screen for ${Math.round(offScreenTime / 1000)} seconds`
      });
    }

    // Low confidence alert
    if (this.currentState.averageConfidence < 0.3) {
      alerts.push({
        type: 'low_tracking_quality',
        severity: 'medium',
        confidence: this.currentState.averageConfidence,
        message: 'Gaze tracking quality is poor. Please ensure good lighting and face visibility.'
      });
    }

    // High risk score alert
    if (this.currentState.riskScore > 70) {
      alerts.push({
        type: 'high_risk_behavior',
        severity: 'high',
        riskScore: this.currentState.riskScore,
        message: 'Suspicious behavior detected. Please focus on the exam.'
      });
    }

    // Trigger alerts
    for (const alert of alerts) {
      if (!this.isAlertRecent(alert.type)) {
        this.triggerAlert(alert);
      }
    }
  }

  /**
   * Check if alert was recently triggered
   */
  isAlertRecent(alertType, timeWindow = 10000) {
    const now = Date.now();
    return this.currentState.alertsTriggered.some(
      alert => alert.type === alertType && (now - alert.timestamp) < timeWindow
    );
  }

  /**
   * Trigger an alert
   */
  triggerAlert(alert) {
    const alertWithTimestamp = {
      ...alert,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };

    this.currentState.alertsTriggered.push(alertWithTimestamp);
    this.performanceMetrics.alertsGenerated++;

    // Keep only last 20 alerts
    if (this.currentState.alertsTriggered.length > 20) {
      this.currentState.alertsTriggered.shift();
    }

    console.warn('Professional gaze monitoring alert:', alert);
    this.triggerCallbacks('alert', alertWithTimestamp);
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics() {
    if (this.monitoringData.length > 0) {
      const validData = this.monitoringData.filter(d => d.isValid);
      this.performanceMetrics.averageConfidence = validData.length > 0
        ? validData.reduce((sum, d) => sum + d.confidence, 0) / validData.length
        : 0;
    }
  }

  /**
   * Register callback for monitoring events
   */
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  /**
   * Remove callback
   */
  off(event, callback) {
    if (this.callbacks.has(event)) {
      const callbacks = this.callbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Trigger callbacks for event
   */
  triggerCallbacks(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in gaze monitoring callback:', error);
        }
      });
    }
  }

  /**
   * Get current monitoring state
   */
  getCurrentState() {
    return { ...this.currentState };
  }

  /**
   * Get monitoring report
   */
  getMonitoringReport() {
    return {
      ...this.performanceMetrics,
      currentState: this.getCurrentState(),
      dataPointsCollected: this.monitoringData.length,
      monitoringDuration: this.isActive 
        ? Date.now() - this.performanceMetrics.totalMonitoringTime
        : this.performanceMetrics.totalMonitoringTime
    };
  }

  /**
   * Export monitoring data for analysis
   */
  exportData() {
    return {
      monitoringData: [...this.monitoringData],
      alerts: [...this.currentState.alertsTriggered],
      metrics: this.getMonitoringReport(),
      exportTimestamp: Date.now()
    };
  }
}

// Export singleton instance
export const professionalGazeMonitor = new ProfessionalGazeMonitor();