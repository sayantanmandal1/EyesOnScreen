/**
 * Security module type definitions
 */

export interface SecurityConfig {
  permissions: {
    camera: {
      required: true;
      allowOptOut: false;
      continuousVerification: true;
      verificationIntervalMs: number;
    };
    microphone: {
      required: true;
      allowOptOut: false;
      continuousVerification: true;
      verificationIntervalMs: number;
    };
    screen: {
      required: true;
      allowOptOut: false;
      continuousVerification: true;
      verificationIntervalMs: number;
    };
  };
  browserSecurity: {
    blockDeveloperTools: boolean;
    blockExtensions: boolean;
    blockModifications: boolean;
    detectVirtualization: boolean;
  };
  systemIntegrity: {
    monitorApplications: boolean;
    detectScreenRecording: boolean;
    detectRemoteAccess: boolean;
    monitorNetworkConnections: boolean;
  };
  enforcement: {
    immediateBlock: boolean;
    gracePeriodMs: number;
    maxViolations: number;
  };
}

export interface SecurityStatus {
  overall: 'secure' | 'warning' | 'blocked';
  permissions: PermissionStatus;
  browserSecurity: BrowserSecurityStatus;
  vmDetection: VMDetectionResult;
  systemIntegrity: IntegrityCheckResult;
  threats: SecurityThreat[];
  lastUpdated: number;
}

export interface PermissionStatus {
  camera: {
    granted: boolean;
    active: boolean;
    lastVerified: number;
    error?: string;
  };
  microphone: {
    granted: boolean;
    active: boolean;
    lastVerified: number;
    error?: string;
  };
  screen: {
    granted: boolean;
    active: boolean;
    lastVerified: number;
    error?: string;
  };
}

export interface BrowserSecurityStatus {
  developerToolsOpen: boolean;
  extensionsDetected: string[];
  browserModifications: string[];
  securityViolations: string[];
  lastChecked: number;
}

export interface VMDetectionResult {
  isVirtualMachine: boolean;
  isEmulated: boolean;
  detectionMethods: string[];
  confidence: number;
  details: Record<string, unknown>;
}

export interface IntegrityCheckResult {
  unauthorizedSoftware: string[];
  screenRecordingDetected: boolean;
  remoteAccessDetected: boolean;
  suspiciousNetworkActivity: boolean;
  systemModifications: string[];
  lastChecked: number;
}

export interface SecurityThreat {
  id: string;
  type: 'permission_denied' | 'browser_security' | 'vm_detected' | 
        'integrity_violation' | 'unauthorized_software';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, unknown>;
  timestamp: number;
  resolved: boolean;
}

export interface SecurityEvent {
  type: 'threat_detected' | 'threat_resolved' | 'status_changed';
  data: SecurityThreat | SecurityStatus;
  timestamp: number;
}

export type SecurityEventHandler = (event: SecurityEvent) => void;