/**
 * Comprehensive Display Monitoring System
 * 
 * Integrates display detection and screen behavior monitoring to provide
 * complete multi-monitor and external display detection capabilities.
 */

import { DisplayDetector } from './DisplayDetector';
import { ScreenBehaviorMonitor } from './ScreenBehaviorMonitor';
import {
  DisplayDetectionConfig,
  DisplayDetectionResult,
  ScreenBehaviorMonitoring,
  DisplayThreat,
  DisplayEvent,
  DisplayEventHandler
} from './types';

export interface DisplayMonitoringConfig extends DisplayDetectionConfig {
  screenBehavior: {
    enabled: boolean;
    cursorTracking: boolean;
    windowFocusMonitoring: boolean;
    screenSharingDetection: boolean;
    fullscreenEnforcement: boolean;
    vmDisplayDetection: boolean;
  };
  alerting: {
    immediateAlerts: boolean;
    threatThreshold: number;
    autoBlock: boolean;
  };
}

export interface DisplayMonitoringResult {
  displayDetection: DisplayDetectionResult;
  screenBehavior: ScreenBehaviorMonitoring;
  overallThreatLevel: 'low' | 'medium' | 'high' | 'critical';
  activeThreats: DisplayThreat[];
  recommendations: string[];
  timestamp: number;
}

export class DisplayMonitoringSystem {
  private config: DisplayMonitoringConfig;
  private displayDetector: DisplayDetector;
  private screenBehaviorMonitor: ScreenBehaviorMonitor;
  private eventHandlers: DisplayEventHandler[] = [];
  private isMonitoring = false;
  private activeThreats: DisplayThreat[] = [];
  private monitoringInterval?: number;

  constructor(config: DisplayMonitoringConfig) {
    this.config = config;
    this.displayDetector = new DisplayDetector(config);
    this.screenBehaviorMonitor = new ScreenBehaviorMonitor();
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for component events
   */
  private setupEventHandlers(): void {
    // Handle display detector events
    this.displayDetector.addEventListener((event) => {
      this.handleDisplayEvent(event);
    });

    // Handle screen behavior monitor events
    this.screenBehaviorMonitor.addEventListener((event) => {
      this.handleScreenBehaviorEvent(event);
    });
  }

  /**
   * Start comprehensive display monitoring
   */
  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.warn('Display monitoring already active');
      return;
    }

    try {
      this.isMonitoring = true;
      
      // Start display detection
      if (this.config.monitoring.enabled) {
        this.displayDetector.startMonitoring();
      }

      // Start screen behavior monitoring
      if (this.config.screenBehavior.enabled) {
        this.screenBehaviorMonitor.startMonitoring();
      }

      // Start periodic comprehensive analysis
      this.monitoringInterval = window.setInterval(() => {
        this.performComprehensiveAnalysis();
      }, 1000); // Every second

      console.log('Display monitoring system started');
      
      // Perform initial analysis
      await this.performComprehensiveAnalysis();
      
    } catch (error) {
      console.error('Failed to start display monitoring:', error);
      this.isMonitoring = false;
      throw error;
    }
  }

  /**
   * Stop display monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Stop components
    this.displayDetector.stopMonitoring();
    this.screenBehaviorMonitor.stopMonitoring();

    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Display monitoring system stopped');
  }

  /**
   * Perform comprehensive analysis of all monitoring data
   */
  private async performComprehensiveAnalysis(): Promise<DisplayMonitoringResult> {
    try {
      // Get current detection results
      const displayDetection = await this.displayDetector.performDetection();
      const screenBehavior = this.screenBehaviorMonitor.getMonitoringStatus();

      // Analyze overall threat level
      const overallThreatLevel = this.calculateOverallThreatLevel(displayDetection, screenBehavior);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(displayDetection, screenBehavior);

      const result: DisplayMonitoringResult = {
        displayDetection,
        screenBehavior,
        overallThreatLevel,
        activeThreats: [...this.activeThreats],
        recommendations,
        timestamp: Date.now()
      };

      // Handle high-priority threats
      if (overallThreatLevel === 'critical' || overallThreatLevel === 'high') {
        this.handleHighPriorityThreats(result);
      }

      // Emit monitoring result event
      this.emitEvent('display_change', result);

      return result;

    } catch (error) {
      console.error('Comprehensive analysis failed:', error);
      throw error;
    }
  }

  /**
   * Calculate overall threat level based on all monitoring data
   */
  private calculateOverallThreatLevel(
    displayDetection: DisplayDetectionResult,
    screenBehavior: ScreenBehaviorMonitoring
  ): 'low' | 'medium' | 'high' | 'critical' {
    let threatScore = 0;

    // Display detection threats
    if (displayDetection.multipleDisplaysDetected) threatScore += 30;
    if (displayDetection.externalDisplaysDetected) threatScore += 25;
    if (displayDetection.tvProjectorDetected) threatScore += 40;
    if (displayDetection.virtualDisplayDetected) threatScore += 50;
    if (displayDetection.reflectionBasedScreens.length > 0) threatScore += 20;
    if (displayDetection.eyeMovementCorrelation.offScreenGazeDetected) threatScore += 35;

    // Screen behavior threats
    if (screenBehavior.cursorTracking.outsideViewport) threatScore += 15;
    if (screenBehavior.cursorTracking.automatedBehavior) threatScore += 25;
    if (screenBehavior.windowFocus.applicationSwitching) threatScore += 30;
    if (screenBehavior.windowFocus.suspiciousApplications.length > 0) threatScore += 20;
    if (screenBehavior.screenSharing.isScreenSharing) threatScore += 50;
    if (screenBehavior.screenSharing.remoteDesktopDetected) threatScore += 60;
    if (screenBehavior.fullscreenEnforcement.bypassAttempts > 0) threatScore += 25;
    if (screenBehavior.virtualMachineDisplay.isVirtualDisplay) threatScore += 45;

    // Determine threat level
    if (threatScore >= 80) return 'critical';
    if (threatScore >= 50) return 'high';
    if (threatScore >= 25) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations based on monitoring results
   */
  private generateRecommendations(
    displayDetection: DisplayDetectionResult,
    screenBehavior: ScreenBehaviorMonitoring
  ): string[] {
    const recommendations: string[] = [];

    // Display-related recommendations
    if (displayDetection.multipleDisplaysDetected) {
      recommendations.push('Disconnect additional monitors and use only the primary display');
    }

    if (displayDetection.externalDisplaysDetected) {
      recommendations.push('Remove external display connections during the quiz');
    }

    if (displayDetection.tvProjectorDetected) {
      recommendations.push('Disconnect TV or projector connections immediately');
    }

    if (displayDetection.virtualDisplayDetected) {
      recommendations.push('Exit virtual machine and use physical hardware only');
    }

    if (displayDetection.reflectionBasedScreens.length > 0) {
      recommendations.push('Remove or cover reflective surfaces that may show additional screens');
    }

    // Screen behavior recommendations
    if (screenBehavior.windowFocus.applicationSwitching) {
      recommendations.push('Close all other applications and focus only on the quiz');
    }

    if (screenBehavior.screenSharing.isScreenSharing) {
      recommendations.push('Stop all screen sharing and remote desktop sessions');
    }

    if (screenBehavior.fullscreenEnforcement.bypassAttempts > 0) {
      recommendations.push('Remain in fullscreen mode throughout the entire quiz');
    }

    if (screenBehavior.cursorTracking.automatedBehavior) {
      recommendations.push('Use manual mouse control only - automated tools are not permitted');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Continue with current setup - no issues detected');
    }

    return recommendations;
  }

  /**
   * Handle high-priority threats
   */
  private handleHighPriorityThreats(result: DisplayMonitoringResult): void {
    if (this.config.alerting.immediateAlerts) {
      // Emit immediate alert
      this.emitEvent('threat_detected', {
        id: `high-priority-${Date.now()}`,
        type: 'multiple_displays',
        severity: result.overallThreatLevel === 'critical' ? 'critical' : 'high',
        message: `High-priority display threat detected: ${result.overallThreatLevel}`,
        details: { monitoringResult: result },
        timestamp: Date.now(),
        resolved: false
      });
    }

    if (this.config.alerting.autoBlock && result.overallThreatLevel === 'critical') {
      // Auto-block functionality would be implemented here
      console.warn('Critical threat detected - auto-block would be triggered');
    }
  }

  /**
   * Handle display detector events
   */
  private handleDisplayEvent(event: DisplayEvent): void {
    if (event.type === 'threat_detected') {
      const threat = event.data as DisplayThreat;
      this.addThreat(threat);
    } else if (event.type === 'threat_resolved') {
      const threat = event.data as DisplayThreat;
      this.resolveThreat(threat.id);
    }

    // Forward event to external handlers
    this.emitEvent(event.type, event.data);
  }

  /**
   * Handle screen behavior monitor events
   */
  private handleScreenBehaviorEvent(event: DisplayEvent): void {
    if (event.type === 'threat_detected') {
      const threat = event.data as DisplayThreat;
      this.addThreat(threat);
    }

    // Forward event to external handlers
    this.emitEvent(event.type, event.data);
  }

  /**
   * Add threat to active threats list
   */
  private addThreat(threat: DisplayThreat): void {
    // Check if threat already exists
    const existingIndex = this.activeThreats.findIndex(t => t.id === threat.id);
    
    if (existingIndex >= 0) {
      // Update existing threat
      this.activeThreats[existingIndex] = threat;
    } else {
      // Add new threat
      this.activeThreats.push(threat);
    }

    // Keep only last 100 threats
    if (this.activeThreats.length > 100) {
      this.activeThreats.shift();
    }
  }

  /**
   * Resolve threat by ID
   */
  private resolveThreat(threatId: string): void {
    const threat = this.activeThreats.find(t => t.id === threatId);
    if (threat) {
      threat.resolved = true;
    }
  }

  /**
   * Get current monitoring status
   */
  public async getCurrentStatus(): Promise<DisplayMonitoringResult> {
    if (!this.isMonitoring) {
      throw new Error('Monitoring is not active');
    }

    return await this.performComprehensiveAnalysis();
  }

  /**
   * Get active threats
   */
  public getActiveThreats(): DisplayThreat[] {
    return this.activeThreats.filter(threat => !threat.resolved);
  }

  /**
   * Clear resolved threats
   */
  public clearResolvedThreats(): void {
    this.activeThreats = this.activeThreats.filter(threat => !threat.resolved);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<DisplayMonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart monitoring if active
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Add event handler
   */
  public addEventListener(handler: DisplayEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove event handler
   */
  public removeEventListener(handler: DisplayEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Emit event to all handlers
   */
  private emitEvent(type: DisplayEvent['type'], data: any): void {
    const event: DisplayEvent = {
      type,
      data,
      timestamp: Date.now()
    };

    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Display event handler error:', error);
      }
    });
  }

  /**
   * Get monitoring statistics
   */
  public getMonitoringStatistics(): {
    isActive: boolean;
    uptime: number;
    threatsDetected: number;
    threatsResolved: number;
    lastAnalysis?: number;
  } {
    const now = Date.now();
    const threatsDetected = this.activeThreats.length;
    const threatsResolved = this.activeThreats.filter(t => t.resolved).length;

    return {
      isActive: this.isMonitoring,
      uptime: this.isMonitoring ? now - (this.activeThreats[0]?.timestamp || now) : 0,
      threatsDetected,
      threatsResolved,
      lastAnalysis: this.displayDetector.getLastDetectionResult()?.timestamp
    };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopMonitoring();
    this.displayDetector.dispose();
    this.screenBehaviorMonitor.dispose();
    this.eventHandlers.length = 0;
    this.activeThreats.length = 0;
  }
}