/**
 * useSecurity - React hook for security management
 * 
 * Provides a convenient interface for integrating security functionality
 * into React components with automatic cleanup and state management.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { SecurityManager } from '../lib/security/SecurityManager';
import type { 
  SecurityConfig, 
  SecurityStatus, 
  SecurityThreat, 
  SecurityEvent 
} from '../lib/security/types';

interface UseSecurityOptions {
  config?: Partial<SecurityConfig>;
  autoInitialize?: boolean;
  onSecurityReady?: () => void;
  onSecurityBlocked?: (threats: SecurityThreat[]) => void;
  onSecurityWarning?: (threats: SecurityThreat[]) => void;
  onThreatDetected?: (threat: SecurityThreat) => void;
}

interface UseSecurityReturn {
  // State
  status: SecurityStatus | null;
  isInitializing: boolean;
  isInitialized: boolean;
  isSecure: boolean;
  error: string | null;
  activeThreats: SecurityThreat[];
  
  // Actions
  initialize: () => Promise<SecurityStatus>;
  recheckSecurity: () => Promise<SecurityStatus>;
  destroy: () => void;
  
  // Security manager instance (for advanced usage)
  securityManager: SecurityManager | null;
}

export const useSecurity = (options: UseSecurityOptions = {}): UseSecurityReturn => {
  const {
    config,
    autoInitialize = false,
    onSecurityReady,
    onSecurityBlocked,
    onSecurityWarning,
    onThreatDetected
  } = options;

  // State
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const securityManagerRef = useRef<SecurityManager | null>(null);
  const callbacksRef = useRef({
    onSecurityReady,
    onSecurityBlocked,
    onSecurityWarning,
    onThreatDetected
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onSecurityReady,
      onSecurityBlocked,
      onSecurityWarning,
      onThreatDetected
    };
  }, [onSecurityReady, onSecurityBlocked, onSecurityWarning, onThreatDetected]);

  // Initialize security manager
  useEffect(() => {
    const manager = new SecurityManager(config);
    securityManagerRef.current = manager;

    // Setup event handler
    const handleSecurityEvent = (event: SecurityEvent) => {
      const callbacks = callbacksRef.current;
      
      if (event.type === 'status_changed') {
        const newStatus = event.data as SecurityStatus;
        setStatus(newStatus);

        // Call appropriate callbacks based on security status
        if (newStatus.overall === 'secure' && callbacks.onSecurityReady) {
          callbacks.onSecurityReady();
        } else if (newStatus.overall === 'blocked' && callbacks.onSecurityBlocked) {
          callbacks.onSecurityBlocked(newStatus.threats.filter(t => !t.resolved));
        } else if (newStatus.overall === 'warning' && callbacks.onSecurityWarning) {
          callbacks.onSecurityWarning(newStatus.threats.filter(t => !t.resolved));
        }
      } else if (event.type === 'threat_detected') {
        const threat = event.data as SecurityThreat;
        if (callbacks.onThreatDetected) {
          callbacks.onThreatDetected(threat);
        }
      }
    };

    manager.addEventListener(handleSecurityEvent);

    // Auto-initialize if requested
    if (autoInitialize) {
      initialize();
    }

    // Cleanup function
    return () => {
      manager.removeEventListener(handleSecurityEvent);
      manager.destroy();
      securityManagerRef.current = null;
    };
  }, [config]); // Only recreate when config changes

  // Initialize security
  const initialize = useCallback(async (): Promise<SecurityStatus> => {
    const manager = securityManagerRef.current;
    if (!manager) {
      throw new Error('Security manager not available');
    }

    if (isInitialized) {
      return status!;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const newStatus = await manager.initialize();
      setStatus(newStatus);
      setIsInitialized(true);
      setIsInitializing(false);
      return newStatus;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Security initialization failed';
      setError(errorMessage);
      setIsInitializing(false);
      throw err;
    }
  }, [isInitialized, status]);

  // Recheck security
  const recheckSecurity = useCallback(async (): Promise<SecurityStatus> => {
    const manager = securityManagerRef.current;
    if (!manager) {
      throw new Error('Security manager not available');
    }

    if (!isInitialized) {
      throw new Error('Security not initialized');
    }

    try {
      const newStatus = await manager.recheckSecurity();
      setStatus(newStatus);
      return newStatus;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Security recheck failed';
      setError(errorMessage);
      throw err;
    }
  }, [isInitialized]);

  // Destroy security manager
  const destroy = useCallback(() => {
    const manager = securityManagerRef.current;
    if (manager) {
      manager.destroy();
      securityManagerRef.current = null;
    }
    
    setStatus(null);
    setIsInitialized(false);
    setIsInitializing(false);
    setError(null);
  }, []);

  // Derived state
  const isSecure = status?.overall === 'secure' ?? false;
  const activeThreats = status?.threats.filter(t => !t.resolved) ?? [];

  return {
    // State
    status,
    isInitializing,
    isInitialized,
    isSecure,
    error,
    activeThreats,
    
    // Actions
    initialize,
    recheckSecurity,
    destroy,
    
    // Security manager instance
    securityManager: securityManagerRef.current
  };
};

// Convenience hooks for specific security aspects

/**
 * Hook for monitoring permission status
 */
export const usePermissionStatus = (config?: Partial<SecurityConfig>) => {
  const { status } = useSecurity({ config });
  
  return {
    permissions: status?.permissions ?? null,
    cameraGranted: status?.permissions.camera.granted ?? false,
    microphoneGranted: status?.permissions.microphone.granted ?? false,
    screenGranted: status?.permissions.screen.granted ?? false,
    allPermissionsGranted: status ? 
      status.permissions.camera.granted && 
      status.permissions.microphone.granted && 
      status.permissions.screen.granted : false
  };
};

/**
 * Hook for monitoring browser security
 */
export const useBrowserSecurity = (config?: Partial<SecurityConfig>) => {
  const { status } = useSecurity({ config });
  
  return {
    browserSecurity: status?.browserSecurity ?? null,
    developerToolsOpen: status?.browserSecurity.developerToolsOpen ?? false,
    extensionsDetected: status?.browserSecurity.extensionsDetected ?? [],
    browserModifications: status?.browserSecurity.browserModifications ?? [],
    hasSecurityViolations: status?.browserSecurity.securityViolations.length > 0 ?? false
  };
};

/**
 * Hook for monitoring VM detection
 */
export const useVMDetection = (config?: Partial<SecurityConfig>) => {
  const { status } = useSecurity({ config });
  
  return {
    vmDetection: status?.vmDetection ?? null,
    isVirtualMachine: status?.vmDetection.isVirtualMachine ?? false,
    isEmulated: status?.vmDetection.isEmulated ?? false,
    detectionConfidence: status?.vmDetection.confidence ?? 0,
    detectionMethods: status?.vmDetection.detectionMethods ?? []
  };
};

/**
 * Hook for monitoring system integrity
 */
export const useSystemIntegrity = (config?: Partial<SecurityConfig>) => {
  const { status } = useSecurity({ config });
  
  return {
    systemIntegrity: status?.systemIntegrity ?? null,
    unauthorizedSoftware: status?.systemIntegrity.unauthorizedSoftware ?? [],
    screenRecordingDetected: status?.systemIntegrity.screenRecordingDetected ?? false,
    remoteAccessDetected: status?.systemIntegrity.remoteAccessDetected ?? false,
    suspiciousNetworkActivity: status?.systemIntegrity.suspiciousNetworkActivity ?? false,
    systemModifications: status?.systemIntegrity.systemModifications ?? []
  };
};

/**
 * Hook for threat monitoring
 */
export const useThreatMonitoring = (config?: Partial<SecurityConfig>) => {
  const { status, activeThreats } = useSecurity({ config });
  
  const criticalThreats = activeThreats.filter(t => t.severity === 'critical');
  const highThreats = activeThreats.filter(t => t.severity === 'high');
  const mediumThreats = activeThreats.filter(t => t.severity === 'medium');
  const lowThreats = activeThreats.filter(t => t.severity === 'low');
  
  return {
    allThreats: status?.threats ?? [],
    activeThreats,
    criticalThreats,
    highThreats,
    mediumThreats,
    lowThreats,
    hasCriticalThreats: criticalThreats.length > 0,
    hasHighThreats: highThreats.length > 0,
    threatCount: activeThreats.length,
    highestSeverity: criticalThreats.length > 0 ? 'critical' :
                    highThreats.length > 0 ? 'high' :
                    mediumThreats.length > 0 ? 'medium' :
                    lowThreats.length > 0 ? 'low' : null
  };
};