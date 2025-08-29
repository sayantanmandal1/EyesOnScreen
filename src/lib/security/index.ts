/**
 * Advanced System Access and Security Foundation
 * 
 * This module provides enterprise-grade security enforcement for the proctored quiz system.
 * It implements mandatory permissions, browser security detection, VM detection, and
 * continuous system integrity monitoring.
 */

export { SecurityManager } from './SecurityManager';
export { PermissionEnforcer } from './PermissionEnforcer';
export { BrowserSecurityDetector } from './BrowserSecurityDetector';
export { VirtualMachineDetector } from './VirtualMachineDetector';
export { SystemIntegrityMonitor } from './SystemIntegrityMonitor';
export { ContinuousVerifier } from './ContinuousVerifier';

export type {
  SecurityConfig,
  SecurityStatus,
  SecurityThreat,
  PermissionStatus,
  BrowserSecurityStatus,
  VMDetectionResult,
  IntegrityCheckResult
} from './types';