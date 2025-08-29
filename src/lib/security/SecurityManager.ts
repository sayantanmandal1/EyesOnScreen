/**
 * SecurityManager - Main orchestrator for all security enforcement
 * 
 * Coordinates all security components and provides a unified interface
 * for security status monitoring and threat response.
 */

import { PermissionEnforcer } from './PermissionEnforcer';
import { BrowserSecurityDetector } from './BrowserSecurityDetector';
import { VirtualMachineDetector } from './VirtualMachineDetector';
import { SystemIntegrityMonitor } from './SystemIntegrityMonitor';
import { ContinuousVerifier } from './ContinuousVerifier';
import type {
  SecurityConfig,
  SecurityStatus,
  SecurityThreat,
  SecurityEvent,
  SecurityEventHandler
} from './types';

export class SecurityManager {
  private config: SecurityConfig;
  private permissionEnforcer: PermissionEnforcer;
  private browserSecurityDetector: BrowserSecurityDetector;
  private vmDetector: VirtualMachineDetector;
  private integrityMonitor: SystemIntegrityMonitor;
  private continuousVerifier: ContinuousVerifier;
  private eventHandlers: Set<SecurityEventHandler> = new Set();
  private currentStatus: SecurityStatus;
  private isInitialized = false;
  private isDestroyed = false;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = this.mergeWithDefaults(config);
    this.currentStatus = this.createInitialStatus();
    
    // Initialize security components
    this.permissionEnforcer = new PermissionEnforcer(this.config.permissions);
    this.browserSecurityDetector = new BrowserSecurityDetector(this.config.browserSecurity);
    this.vmDetector = new VirtualMachineDetector();
    this.integrityMonitor = new SystemIntegrityMonitor(this.config.systemIntegrity);
    this.continuousVerifier = new ContinuousVerifier(this.config);

    this.setupEventHandlers();
  }

  /**
   * Initialize the security system and perform initial checks
   */
  async initialize(): Promise<SecurityStatus> {
    if (this.isInitialized) {
      throw new Error('SecurityManager already initialized');
    }

    try {
      // Perform initial security checks
      await this.performInitialSecurityChecks();
      
      // Start continuous monitoring
      await this.startContinuousMonitoring();
      
      this.isInitialized = true;
      this.emitEvent({
        type: 'status_changed',
        data: this.currentStatus,
        timestamp: Date.now()
      });

      return this.currentStatus;
    } catch (error) {
      const threat: SecurityThreat = {
        id: `init_error_${Date.now()}`,
        type: 'integrity_violation',
        severity: 'critical',
        message: `Security initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : error },
        timestamp: Date.now(),
        resolved: false
      };
      
      this.addThreat(threat);
      throw error;
    }
  }

  /**
   * Get current security status
   */
  getStatus(): SecurityStatus {
    return { ...this.currentStatus };
  }

  /**
   * Check if the system is secure for quiz execution
   */
  isSecure(): boolean {
    return this.currentStatus.overall === 'secure';
  }

  /**
   * Get active security threats
   */
  getActiveThreats(): SecurityThreat[] {
    return this.currentStatus.threats.filter(threat => !threat.resolved);
  }

  /**
   * Add event handler for security events
   */
  addEventListener(handler: SecurityEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  removeEventListener(handler: SecurityEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Force a complete security re-check
   */
  async recheckSecurity(): Promise<SecurityStatus> {
    if (!this.isInitialized) {
      throw new Error('SecurityManager not initialized');
    }

    await this.performSecurityChecks();
    return this.currentStatus;
  }

  /**
   * Destroy the security manager and cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.continuousVerifier.stop();
    this.integrityMonitor.stop();
    this.browserSecurityDetector.stop();
    this.eventHandlers.clear();
    this.isDestroyed = true;
  }

  private mergeWithDefaults(config: Partial<SecurityConfig>): SecurityConfig {
    return {
      permissions: {
        camera: {
          required: true,
          allowOptOut: false,
          continuousVerification: true,
          verificationIntervalMs: 5000,
          ...config.permissions?.camera
        },
        microphone: {
          required: true,
          allowOptOut: false,
          continuousVerification: true,
          verificationIntervalMs: 5000,
          ...config.permissions?.microphone
        },
        screen: {
          required: true,
          allowOptOut: false,
          continuousVerification: true,
          verificationIntervalMs: 10000,
          ...config.permissions?.screen
        }
      },
      browserSecurity: {
        blockDeveloperTools: true,
        blockExtensions: true,
        blockModifications: true,
        detectVirtualization: true,
        ...config.browserSecurity
      },
      systemIntegrity: {
        monitorApplications: true,
        detectScreenRecording: true,
        detectRemoteAccess: true,
        monitorNetworkConnections: true,
        ...config.systemIntegrity
      },
      enforcement: {
        immediateBlock: true,
        gracePeriodMs: 0,
        maxViolations: 0,
        ...config.enforcement
      }
    };
  }

  private createInitialStatus(): SecurityStatus {
    return {
      overall: 'warning',
      permissions: {
        camera: { granted: false, active: false, lastVerified: 0 },
        microphone: { granted: false, active: false, lastVerified: 0 },
        screen: { granted: false, active: false, lastVerified: 0 }
      },
      browserSecurity: {
        developerToolsOpen: false,
        extensionsDetected: [],
        browserModifications: [],
        securityViolations: [],
        lastChecked: 0
      },
      vmDetection: {
        isVirtualMachine: false,
        isEmulated: false,
        detectionMethods: [],
        confidence: 0,
        details: {}
      },
      systemIntegrity: {
        unauthorizedSoftware: [],
        screenRecordingDetected: false,
        remoteAccessDetected: false,
        suspiciousNetworkActivity: false,
        systemModifications: [],
        lastChecked: 0
      },
      threats: [],
      lastUpdated: Date.now()
    };
  }

  private setupEventHandlers(): void {
    // Handle permission events
    this.permissionEnforcer.addEventListener((event) => {
      this.currentStatus.permissions = event.permissions;
      this.updateOverallStatus();
      
      if (event.threat) {
        this.addThreat(event.threat);
      }
    });

    // Handle browser security events
    this.browserSecurityDetector.addEventListener((event) => {
      this.currentStatus.browserSecurity = event.status;
      this.updateOverallStatus();
      
      if (event.threats) {
        event.threats.forEach(threat => this.addThreat(threat));
      }
    });

    // Handle VM detection events
    this.vmDetector.addEventListener((event) => {
      this.currentStatus.vmDetection = event.result;
      this.updateOverallStatus();
      
      if (event.threat) {
        this.addThreat(event.threat);
      }
    });

    // Handle integrity monitoring events
    this.integrityMonitor.addEventListener((event) => {
      this.currentStatus.systemIntegrity = event.result;
      this.updateOverallStatus();
      
      if (event.threats) {
        event.threats.forEach(threat => this.addThreat(threat));
      }
    });
  }

  private async performInitialSecurityChecks(): Promise<void> {
    // Check for virtual machine/emulation
    const vmResult = await this.vmDetector.detect();
    this.currentStatus.vmDetection = vmResult;
    
    if (vmResult.isVirtualMachine || vmResult.isEmulated) {
      this.addThreat({
        id: `vm_detected_${Date.now()}`,
        type: 'vm_detected',
        severity: 'critical',
        message: 'Virtual machine or emulated environment detected',
        details: vmResult,
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Check browser security
    const browserStatus = await this.browserSecurityDetector.performCheck();
    this.currentStatus.browserSecurity = browserStatus;

    // Request mandatory permissions
    await this.permissionEnforcer.enforcePermissions();
  }

  private async performSecurityChecks(): Promise<void> {
    const [vmResult, browserStatus, integrityResult] = await Promise.all([
      this.vmDetector.detect(),
      this.browserSecurityDetector.performCheck(),
      this.integrityMonitor.performCheck()
    ]);

    this.currentStatus.vmDetection = vmResult;
    this.currentStatus.browserSecurity = browserStatus;
    this.currentStatus.systemIntegrity = integrityResult;
    this.updateOverallStatus();
  }

  private async startContinuousMonitoring(): Promise<void> {
    // Start continuous verification
    this.continuousVerifier.start();
    
    // Start browser security monitoring
    this.browserSecurityDetector.startMonitoring();
    
    // Start system integrity monitoring
    this.integrityMonitor.startMonitoring();
  }

  private addThreat(threat: SecurityThreat): void {
    this.currentStatus.threats.push(threat);
    this.updateOverallStatus();
    
    this.emitEvent({
      type: 'threat_detected',
      data: threat,
      timestamp: Date.now()
    });
  }

  private updateOverallStatus(): void {
    const activeThreats = this.getActiveThreats();
    const criticalThreats = activeThreats.filter(t => t.severity === 'critical');
    const highThreats = activeThreats.filter(t => t.severity === 'high');

    if (criticalThreats.length > 0) {
      this.currentStatus.overall = 'blocked';
    } else if (highThreats.length > 0 || activeThreats.length > 0) {
      this.currentStatus.overall = 'warning';
    } else {
      // Check if all required permissions are granted and active
      const { camera, microphone, screen } = this.currentStatus.permissions;
      if (camera.granted && camera.active && 
          microphone.granted && microphone.active && 
          screen.granted && screen.active) {
        this.currentStatus.overall = 'secure';
      } else {
        this.currentStatus.overall = 'warning';
      }
    }

    this.currentStatus.lastUpdated = Date.now();
  }

  private emitEvent(event: SecurityEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in security event handler:', error);
      }
    });
  }
}