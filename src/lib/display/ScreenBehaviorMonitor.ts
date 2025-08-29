/**
 * Screen Behavior Monitoring System
 * 
 * Monitors cursor position, window focus, application switching, screen sharing,
 * remote desktop detection, virtual machine displays, and fullscreen enforcement.
 */

import {
  ScreenBehaviorMonitoring,
  CursorAnalysis,
  WindowFocusAnalysis,
  FocusChange,
  ScreenSharingDetection,
  FullscreenStatus,
  FullscreenViolation,
  VMDisplayDetection,
  DisplayThreat,
  DisplayEvent,
  DisplayEventHandler
} from './types';

export class ScreenBehaviorMonitor {
  private eventHandlers: DisplayEventHandler[] = [];
  private monitoringInterval?: number;
  private cursorTracker?: CursorTracker;
  private windowFocusTracker?: WindowFocusTracker;
  private screenSharingDetector?: ScreenSharingDetector;
  private fullscreenEnforcer?: FullscreenEnforcer;
  private vmDisplayDetector?: VMDisplayDetector;
  private isMonitoring = false;

  constructor() {
    this.initializeComponents();
  }

  /**
   * Initialize monitoring components
   */
  private initializeComponents(): void {
    this.cursorTracker = new CursorTracker();
    this.windowFocusTracker = new WindowFocusTracker();
    this.screenSharingDetector = new ScreenSharingDetector();
    this.fullscreenEnforcer = new FullscreenEnforcer();
    this.vmDisplayDetector = new VMDisplayDetector();
  }

  /**
   * Start comprehensive screen behavior monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Start individual components
    this.cursorTracker?.start();
    this.windowFocusTracker?.start();
    this.screenSharingDetector?.start();
    this.fullscreenEnforcer?.start();
    this.vmDisplayDetector?.start();

    // Start periodic monitoring
    this.monitoringInterval = window.setInterval(() => {
      this.performMonitoring();
    }, 100); // 10 FPS monitoring

    console.log('Screen behavior monitoring started');
  }

  /**
   * Stop screen behavior monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Stop individual components
    this.cursorTracker?.stop();
    this.windowFocusTracker?.stop();
    this.screenSharingDetector?.stop();
    this.fullscreenEnforcer?.stop();
    this.vmDisplayDetector?.stop();

    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Screen behavior monitoring stopped');
  }

  /**
   * Perform comprehensive monitoring check
   */
  private performMonitoring(): void {
    try {
      const monitoring: ScreenBehaviorMonitoring = {
        cursorTracking: this.cursorTracker?.getAnalysis() || this.getEmptyCursorAnalysis(),
        windowFocus: this.windowFocusTracker?.getAnalysis() || this.getEmptyWindowFocusAnalysis(),
        screenSharing: this.screenSharingDetector?.getDetection() || this.getEmptyScreenSharingDetection(),
        fullscreenEnforcement: this.fullscreenEnforcer?.getStatus() || this.getEmptyFullscreenStatus(),
        virtualMachineDisplay: this.vmDisplayDetector?.getDetection() || this.getEmptyVMDisplayDetection()
      };

      this.checkForViolations(monitoring);
    } catch (error) {
      console.error('Screen behavior monitoring error:', error);
    }
  }

  /**
   * Check for security violations
   */
  private checkForViolations(monitoring: ScreenBehaviorMonitoring): void {
    const threats: DisplayThreat[] = [];

    // Check cursor violations
    if (monitoring.cursorTracking.outsideViewport || monitoring.cursorTracking.automatedBehavior) {
      threats.push({
        id: `cursor-violation-${Date.now()}`,
        type: 'focus_violation',
        severity: monitoring.cursorTracking.automatedBehavior ? 'high' : 'medium',
        message: 'Suspicious cursor behavior detected',
        details: { cursorAnalysis: monitoring.cursorTracking },
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Check window focus violations
    if (monitoring.windowFocus.applicationSwitching || monitoring.windowFocus.suspiciousApplications.length > 0) {
      threats.push({
        id: `focus-violation-${Date.now()}`,
        type: 'focus_violation',
        severity: 'high',
        message: 'Application switching or suspicious applications detected',
        details: { windowFocus: monitoring.windowFocus },
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Check screen sharing violations
    if (monitoring.screenSharing.isScreenSharing || monitoring.screenSharing.remoteDesktopDetected) {
      threats.push({
        id: `screen-sharing-${Date.now()}`,
        type: 'screen_sharing',
        severity: 'critical',
        message: 'Screen sharing or remote desktop detected',
        details: { screenSharing: monitoring.screenSharing },
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Check fullscreen violations
    if (monitoring.fullscreenEnforcement.bypassAttempts > 0) {
      threats.push({
        id: `fullscreen-bypass-${Date.now()}`,
        type: 'fullscreen_bypass',
        severity: 'high',
        message: `Fullscreen bypass attempts detected: ${monitoring.fullscreenEnforcement.bypassAttempts}`,
        details: { fullscreen: monitoring.fullscreenEnforcement },
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Check VM display violations
    if (monitoring.virtualMachineDisplay.isVirtualDisplay) {
      threats.push({
        id: `vm-display-${Date.now()}`,
        type: 'vm_display',
        severity: 'critical',
        message: 'Virtual machine display detected',
        details: { vmDisplay: monitoring.virtualMachineDisplay },
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Emit threat events
    threats.forEach(threat => {
      this.emitEvent('threat_detected', threat);
    });
  }

  /**
   * Get current monitoring status
   */
  public getMonitoringStatus(): ScreenBehaviorMonitoring {
    return {
      cursorTracking: this.cursorTracker?.getAnalysis() || this.getEmptyCursorAnalysis(),
      windowFocus: this.windowFocusTracker?.getAnalysis() || this.getEmptyWindowFocusAnalysis(),
      screenSharing: this.screenSharingDetector?.getDetection() || this.getEmptyScreenSharingDetection(),
      fullscreenEnforcement: this.fullscreenEnforcer?.getStatus() || this.getEmptyFullscreenStatus(),
      virtualMachineDisplay: this.vmDisplayDetector?.getDetection() || this.getEmptyVMDisplayDetection()
    };
  }

  // Empty state getters
  private getEmptyCursorAnalysis(): CursorAnalysis {
    return {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      outsideViewport: false,
      suspiciousMovement: false,
      automatedBehavior: false,
      confidence: 0
    };
  }

  private getEmptyWindowFocusAnalysis(): WindowFocusAnalysis {
    return {
      currentWindow: '',
      focusChanges: [],
      applicationSwitching: false,
      suspiciousApplications: [],
      backgroundActivity: false
    };
  }

  private getEmptyScreenSharingDetection(): ScreenSharingDetection {
    return {
      isScreenSharing: false,
      remoteDesktopDetected: false,
      screenCastingDetected: false,
      collaborationToolsDetected: [],
      confidence: 0
    };
  }

  private getEmptyFullscreenStatus(): FullscreenStatus {
    return {
      isFullscreen: false,
      enforcementActive: false,
      bypassAttempts: 0,
      violations: []
    };
  }

  private getEmptyVMDisplayDetection(): VMDisplayDetection {
    return {
      isVirtualDisplay: false,
      vmSoftware: [],
      displayDrivers: [],
      resolutionAnomalies: false,
      refreshRateAnomalies: false,
      confidence: 0
    };
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
   * Emit display event
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
   * Cleanup resources
   */
  public dispose(): void {
    this.stopMonitoring();
    this.eventHandlers.length = 0;
    
    this.cursorTracker?.dispose();
    this.windowFocusTracker?.dispose();
    this.screenSharingDetector?.dispose();
    this.fullscreenEnforcer?.dispose();
    this.vmDisplayDetector?.dispose();
  }
}

/**
 * Cursor Position Tracking and Analysis
 */
class CursorTracker {
  private position = { x: 0, y: 0 };
  private velocity = { x: 0, y: 0 };
  private acceleration = { x: 0, y: 0 };
  private lastPosition = { x: 0, y: 0 };
  private lastVelocity = { x: 0, y: 0 };
  private lastTimestamp = 0;
  private movementHistory: Array<{ x: number; y: number; timestamp: number }> = [];
  private isTracking = false;

  public start(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseleave', this.handleMouseLeave);
  }

  public stop(): void {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseleave', this.handleMouseLeave);
  }

  private handleMouseMove = (event: MouseEvent): void => {
    const now = Date.now();
    const dt = now - this.lastTimestamp;
    
    if (dt > 0) {
      // Update position
      this.lastPosition = { ...this.position };
      this.position = { x: event.clientX, y: event.clientY };
      
      // Calculate velocity
      this.lastVelocity = { ...this.velocity };
      this.velocity = {
        x: (this.position.x - this.lastPosition.x) / dt,
        y: (this.position.y - this.lastPosition.y) / dt
      };
      
      // Calculate acceleration
      this.acceleration = {
        x: (this.velocity.x - this.lastVelocity.x) / dt,
        y: (this.velocity.y - this.lastVelocity.y) / dt
      };
      
      // Store in history
      this.movementHistory.push({
        x: this.position.x,
        y: this.position.y,
        timestamp: now
      });
      
      // Keep only last 100 movements
      if (this.movementHistory.length > 100) {
        this.movementHistory.shift();
      }
    }
    
    this.lastTimestamp = now;
  };

  private handleMouseLeave = (): void => {
    // Cursor left the viewport
  };

  public getAnalysis(): CursorAnalysis {
    const outsideViewport = this.isOutsideViewport();
    const suspiciousMovement = this.detectSuspiciousMovement();
    const automatedBehavior = this.detectAutomatedBehavior();
    
    return {
      position: { ...this.position },
      velocity: { ...this.velocity },
      acceleration: { ...this.acceleration },
      outsideViewport,
      suspiciousMovement,
      automatedBehavior,
      confidence: this.calculateConfidence()
    };
  }

  private isOutsideViewport(): boolean {
    return this.position.x < 0 || 
           this.position.y < 0 || 
           this.position.x > window.innerWidth || 
           this.position.y > window.innerHeight;
  }

  private detectSuspiciousMovement(): boolean {
    if (this.movementHistory.length < 10) return false;
    
    // Check for perfectly straight lines (automated movement)
    const recent = this.movementHistory.slice(-10);
    const slopes = [];
    
    for (let i = 1; i < recent.length; i++) {
      const dx = recent[i].x - recent[i-1].x;
      const dy = recent[i].y - recent[i-1].y;
      if (dx !== 0) {
        slopes.push(dy / dx);
      }
    }
    
    // If all slopes are identical, it's likely automated
    if (slopes.length > 5) {
      const firstSlope = slopes[0];
      const identical = slopes.every(slope => Math.abs(slope - firstSlope) < 0.01);
      if (identical) return true;
    }
    
    return false;
  }

  private detectAutomatedBehavior(): boolean {
    if (this.movementHistory.length < 20) return false;
    
    // Check for perfectly timed movements
    const recent = this.movementHistory.slice(-20);
    const intervals = [];
    
    for (let i = 1; i < recent.length; i++) {
      intervals.push(recent[i].timestamp - recent[i-1].timestamp);
    }
    
    // If all intervals are identical, it's likely automated
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const identical = intervals.every(interval => Math.abs(interval - avgInterval) < 5);
    
    return identical && intervals.length > 10;
  }

  private calculateConfidence(): number {
    let confidence = 0.8;
    
    if (this.detectAutomatedBehavior()) confidence *= 0.3;
    if (this.detectSuspiciousMovement()) confidence *= 0.5;
    if (this.isOutsideViewport()) confidence *= 0.7;
    
    return Math.max(0, Math.min(1, confidence));
  }

  public dispose(): void {
    this.stop();
    this.movementHistory.length = 0;
  }
}

/**
 * Window Focus and Application Switching Detection
 */
class WindowFocusTracker {
  private currentWindow = '';
  private focusChanges: FocusChange[] = [];
  private suspiciousApplications: string[] = [];
  private isTracking = false;
  private lastFocusTime = Date.now();

  public start(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    window.addEventListener('focus', this.handleWindowFocus);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  public stop(): void {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleWindowFocus = (): void => {
    const now = Date.now();
    const duration = now - this.lastFocusTime;
    
    this.focusChanges.push({
      timestamp: now,
      fromWindow: 'external',
      toWindow: 'quiz-application',
      duration,
      suspicious: duration > 5000 // More than 5 seconds away is suspicious
    });
    
    this.currentWindow = 'quiz-application';
    this.lastFocusTime = now;
    
    // Keep only last 50 focus changes
    if (this.focusChanges.length > 50) {
      this.focusChanges.shift();
    }
  };

  private handleWindowBlur = (): void => {
    const now = Date.now();
    const duration = now - this.lastFocusTime;
    
    this.focusChanges.push({
      timestamp: now,
      fromWindow: 'quiz-application',
      toWindow: 'external',
      duration,
      suspicious: true // Any focus loss is suspicious during quiz
    });
    
    this.currentWindow = 'external';
    this.lastFocusTime = now;
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.handleWindowBlur();
    } else {
      this.handleWindowFocus();
    }
  };

  public getAnalysis(): WindowFocusAnalysis {
    const recentChanges = this.focusChanges.filter(
      change => Date.now() - change.timestamp < 60000 // Last minute
    );
    
    return {
      currentWindow: this.currentWindow,
      focusChanges: [...this.focusChanges],
      applicationSwitching: recentChanges.length > 3,
      suspiciousApplications: [...this.suspiciousApplications],
      backgroundActivity: this.currentWindow !== 'quiz-application'
    };
  }

  public dispose(): void {
    this.stop();
    this.focusChanges.length = 0;
    this.suspiciousApplications.length = 0;
  }
}

/**
 * Screen Sharing and Remote Desktop Detection
 */
class ScreenSharingDetector {
  private isTracking = false;
  private detectionResult: ScreenSharingDetection = {
    isScreenSharing: false,
    remoteDesktopDetected: false,
    screenCastingDetected: false,
    collaborationToolsDetected: [],
    confidence: 0
  };

  public start(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.performDetection();
    
    // Periodic detection
    setInterval(() => {
      if (this.isTracking) {
        this.performDetection();
      }
    }, 5000);
  }

  public stop(): void {
    this.isTracking = false;
  }

  private async performDetection(): Promise<void> {
    try {
      // Check for screen sharing APIs
      const isScreenSharing = await this.detectScreenSharing();
      const remoteDesktopDetected = this.detectRemoteDesktop();
      const screenCastingDetected = this.detectScreenCasting();
      const collaborationTools = this.detectCollaborationTools();
      
      this.detectionResult = {
        isScreenSharing,
        remoteDesktopDetected,
        screenCastingDetected,
        collaborationToolsDetected: collaborationTools,
        confidence: this.calculateConfidence()
      };
    } catch (error) {
      console.warn('Screen sharing detection error:', error);
    }
  }

  private async detectScreenSharing(): Promise<boolean> {
    try {
      // Check if getDisplayMedia is being used
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      let screenSharingActive = false;
      
      // Override to detect usage
      navigator.mediaDevices.getDisplayMedia = function(...args) {
        screenSharingActive = true;
        return originalGetDisplayMedia.apply(this, args);
      };
      
      return screenSharingActive;
    } catch (error) {
      return false;
    }
  }

  private detectRemoteDesktop(): boolean {
    // Check for common remote desktop indicators
    const userAgent = navigator.userAgent.toLowerCase();
    const remoteDesktopIndicators = [
      'teamviewer', 'anydesk', 'chrome remote desktop', 
      'rdp', 'vnc', 'logmein', 'gotomypc'
    ];
    
    return remoteDesktopIndicators.some(indicator => 
      userAgent.includes(indicator)
    );
  }

  private detectScreenCasting(): boolean {
    // Check for screen casting APIs and indicators
    try {
      // Check for Presentation API usage
      if ('presentation' in navigator) {
        const presentation = (navigator as any).presentation;
        return presentation.defaultRequest !== null;
      }
      
      // Check for Cast API
      if ('chrome' in window && 'cast' in (window as any).chrome) {
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  private detectCollaborationTools(): string[] {
    const tools: string[] = [];
    const userAgent = navigator.userAgent.toLowerCase();
    
    const collaborationIndicators = [
      'zoom', 'teams', 'slack', 'discord', 'skype', 
      'webex', 'gotomeeting', 'hangouts'
    ];
    
    collaborationIndicators.forEach(tool => {
      if (userAgent.includes(tool)) {
        tools.push(tool);
      }
    });
    
    return tools;
  }

  private calculateConfidence(): number {
    let confidence = 0.8;
    
    if (this.detectionResult.isScreenSharing) confidence *= 0.2;
    if (this.detectionResult.remoteDesktopDetected) confidence *= 0.1;
    if (this.detectionResult.collaborationToolsDetected.length > 0) confidence *= 0.5;
    
    return Math.max(0, Math.min(1, confidence));
  }

  public getDetection(): ScreenSharingDetection {
    return { ...this.detectionResult };
  }

  public dispose(): void {
    this.stop();
  }
}

/**
 * Fullscreen Enforcement with Bypass Prevention
 */
class FullscreenEnforcer {
  private isEnforcing = false;
  private bypassAttempts = 0;
  private violations: FullscreenViolation[] = [];
  private keyboardHandler?: (event: KeyboardEvent) => void;

  public start(): void {
    if (this.isEnforcing) return;
    
    this.isEnforcing = true;
    this.enforceFullscreen();
    this.setupBypassPrevention();
  }

  public stop(): void {
    if (!this.isEnforcing) return;
    
    this.isEnforcing = false;
    this.removeBypassPrevention();
  }

  private enforceFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(error => {
        console.warn('Fullscreen request failed:', error);
      });
    }
    
    // Monitor fullscreen changes
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  private handleFullscreenChange = (): void => {
    if (!document.fullscreenElement && this.isEnforcing) {
      // Fullscreen was exited, record violation and re-enforce
      this.recordViolation('exit_attempt', 'User exited fullscreen mode');
      
      // Re-request fullscreen after a short delay
      setTimeout(() => {
        if (this.isEnforcing) {
          this.enforceFullscreen();
        }
      }, 100);
    }
  };

  private setupBypassPrevention(): void {
    this.keyboardHandler = (event: KeyboardEvent) => {
      // Block common bypass key combinations
      const blockedCombinations = [
        { key: 'Tab', alt: true }, // Alt+Tab
        { key: 'F4', alt: true }, // Alt+F4
        { key: 'Escape' }, // Escape key
        { key: 'F11' }, // F11 fullscreen toggle
        { key: 'Meta' }, // Windows key
        { key: 'ContextMenu' } // Context menu key
      ];
      
      const isBlocked = blockedCombinations.some(combo => {
        return event.key === combo.key && 
               (!combo.alt || event.altKey) &&
               (!combo.ctrl || event.ctrlKey) &&
               (!combo.shift || event.shiftKey);
      });
      
      if (isBlocked) {
        event.preventDefault();
        event.stopPropagation();
        this.recordViolation('key_combination', `Blocked key combination: ${event.key}`);
        return false;
      }
    };
    
    document.addEventListener('keydown', this.keyboardHandler, true);
    
    // Block right-click context menu
    document.addEventListener('contextmenu', this.handleContextMenu, true);
    
    // Monitor window blur (Alt+Tab detection)
    window.addEventListener('blur', this.handleWindowBlur);
  }

  private removeBypassPrevention(): void {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler, true);
      this.keyboardHandler = undefined;
    }
    
    document.removeEventListener('contextmenu', this.handleContextMenu, true);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    window.removeEventListener('blur', this.handleWindowBlur);
  }

  private handleContextMenu = (event: Event): void => {
    event.preventDefault();
    this.recordViolation('key_combination', 'Right-click context menu blocked');
  };

  private handleWindowBlur = (): void => {
    this.recordViolation('window_switch', 'Window focus lost (possible Alt+Tab)');
  };

  private recordViolation(type: FullscreenViolation['type'], method: string): void {
    this.bypassAttempts++;
    
    const violation: FullscreenViolation = {
      timestamp: Date.now(),
      type,
      blocked: true,
      method
    };
    
    this.violations.push(violation);
    
    // Keep only last 100 violations
    if (this.violations.length > 100) {
      this.violations.shift();
    }
  }

  public getStatus(): FullscreenStatus {
    return {
      isFullscreen: !!document.fullscreenElement,
      enforcementActive: this.isEnforcing,
      bypassAttempts: this.bypassAttempts,
      lastBypassAttempt: this.violations.length > 0 ? 
        this.violations[this.violations.length - 1].timestamp : undefined,
      violations: [...this.violations]
    };
  }

  public dispose(): void {
    this.stop();
    this.violations.length = 0;
  }
}

/**
 * Virtual Machine Display Detection
 */
class VMDisplayDetector {
  private isTracking = false;
  private detectionResult: VMDisplayDetection = {
    isVirtualDisplay: false,
    vmSoftware: [],
    displayDrivers: [],
    resolutionAnomalies: false,
    refreshRateAnomalies: false,
    confidence: 0
  };

  public start(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.performDetection();
  }

  public stop(): void {
    this.isTracking = false;
  }

  private performDetection(): void {
    const vmSoftware = this.detectVMSoftware();
    const displayDrivers = this.detectVMDisplayDrivers();
    const resolutionAnomalies = this.detectResolutionAnomalies();
    const refreshRateAnomalies = this.detectRefreshRateAnomalies();
    
    this.detectionResult = {
      isVirtualDisplay: vmSoftware.length > 0 || displayDrivers.length > 0 || 
                       resolutionAnomalies || refreshRateAnomalies,
      vmSoftware,
      displayDrivers,
      resolutionAnomalies,
      refreshRateAnomalies,
      confidence: this.calculateConfidence()
    };
  }

  private detectVMSoftware(): string[] {
    const vmIndicators: string[] = [];
    const userAgent = navigator.userAgent.toLowerCase();
    
    const vmSoftwarePatterns = [
      'virtualbox', 'vmware', 'qemu', 'kvm', 'xen', 
      'hyper-v', 'parallels', 'vbox', 'bochs'
    ];
    
    vmSoftwarePatterns.forEach(pattern => {
      if (userAgent.includes(pattern)) {
        vmIndicators.push(pattern);
      }
    });
    
    return vmIndicators;
  }

  private detectVMDisplayDrivers(): string[] {
    const drivers: string[] = [];
    
    // Check WebGL renderer for VM-specific drivers
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl) {
        const renderer = gl.getParameter(gl.RENDERER).toLowerCase();
        const vmDriverPatterns = [
          'vmware', 'virtualbox', 'qemu', 'microsoft basic render',
          'llvmpipe', 'software rasterizer'
        ];
        
        vmDriverPatterns.forEach(pattern => {
          if (renderer.includes(pattern)) {
            drivers.push(pattern);
          }
        });
      }
    } catch (error) {
      console.warn('WebGL renderer detection failed:', error);
    }
    
    return drivers;
  }

  private detectResolutionAnomalies(): boolean {
    // Common VM default resolutions
    const vmResolutions = [
      { width: 1024, height: 768 },
      { width: 1280, height: 1024 },
      { width: 800, height: 600 },
      { width: 1152, height: 864 }
    ];
    
    const currentRes = { width: screen.width, height: screen.height };
    
    return vmResolutions.some(vmRes => 
      vmRes.width === currentRes.width && vmRes.height === currentRes.height
    );
  }

  private detectRefreshRateAnomalies(): boolean {
    // VMs often have non-standard or missing refresh rates
    try {
      // Most physical displays have 60Hz, 75Hz, 120Hz, 144Hz, etc.
      const commonRefreshRates = [60, 75, 120, 144, 165, 240];
      
      // This is a placeholder - actual refresh rate detection would require
      // more advanced techniques or browser APIs that may not be available
      return false;
    } catch (error) {
      return false;
    }
  }

  private calculateConfidence(): number {
    let confidence = 0.8;
    
    if (this.detectionResult.vmSoftware.length > 0) confidence *= 0.2;
    if (this.detectionResult.displayDrivers.length > 0) confidence *= 0.3;
    if (this.detectionResult.resolutionAnomalies) confidence *= 0.6;
    if (this.detectionResult.refreshRateAnomalies) confidence *= 0.7;
    
    return Math.max(0, Math.min(1, confidence));
  }

  public getDetection(): VMDisplayDetection {
    return { ...this.detectionResult };
  }

  public dispose(): void {
    this.stop();
  }
}