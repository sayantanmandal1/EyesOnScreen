/**
 * SecurityGuard - React component for security enforcement UI
 * 
 * Provides user interface for security initialization, status monitoring,
 * and threat handling during quiz sessions.
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { SecurityManager } from '../../lib/security/SecurityManager';
import type { SecurityStatus, SecurityThreat, SecurityEvent } from '../../lib/security/types';

interface SecurityGuardProps {
  onSecurityReady?: () => void;
  onSecurityBlocked?: (threats: SecurityThreat[]) => void;
  onSecurityWarning?: (threats: SecurityThreat[]) => void;
  config?: any;
  children?: React.ReactNode;
}

interface SecurityGuardState {
  status: SecurityStatus | null;
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;
  showPermissionDialog: boolean;
  showThreatDialog: boolean;
  currentThreats: SecurityThreat[];
}

export const SecurityGuard: React.FC<SecurityGuardProps> = ({
  onSecurityReady,
  onSecurityBlocked,
  onSecurityWarning,
  config,
  children
}) => {
  const [state, setState] = useState<SecurityGuardState>({
    status: null,
    isInitializing: false,
    isInitialized: false,
    error: null,
    showPermissionDialog: false,
    showThreatDialog: false,
    currentThreats: []
  });

  const [securityManager, setSecurityManager] = useState<SecurityManager | null>(null);

  // Initialize security manager
  useEffect(() => {
    const manager = new SecurityManager(config);
    setSecurityManager(manager);

    return () => {
      manager.destroy();
    };
  }, [config]);

  // Handle security events
  const handleSecurityEvent = useCallback((event: SecurityEvent) => {
    if (event.type === 'status_changed') {
      const status = event.data as SecurityStatus;
      setState(prev => ({ ...prev, status }));

      // Notify parent components based on security status
      if (status.overall === 'secure' && onSecurityReady) {
        onSecurityReady();
      } else if (status.overall === 'blocked' && onSecurityBlocked) {
        onSecurityBlocked(status.threats.filter(t => !t.resolved));
      } else if (status.overall === 'warning' && onSecurityWarning) {
        onSecurityWarning(status.threats.filter(t => !t.resolved));
      }
    } else if (event.type === 'threat_detected') {
      const threat = event.data as SecurityThreat;
      setState(prev => ({
        ...prev,
        currentThreats: [...prev.currentThreats, threat],
        showThreatDialog: threat.severity === 'critical'
      }));
    }
  }, [onSecurityReady, onSecurityBlocked, onSecurityWarning]);

  // Initialize security when manager is ready
  useEffect(() => {
    if (!securityManager) return;

    const initializeSecurity = async () => {
      setState(prev => ({ ...prev, isInitializing: true, error: null }));

      try {
        // Add event listener
        securityManager.addEventListener(handleSecurityEvent);

        // Initialize security
        const status = await securityManager.initialize();
        
        setState(prev => ({
          ...prev,
          isInitializing: false,
          isInitialized: true,
          status,
          showPermissionDialog: false
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Security initialization failed';
        setState(prev => ({
          ...prev,
          isInitializing: false,
          error: errorMessage,
          showPermissionDialog: errorMessage.includes('permission')
        }));
      }
    };

    initializeSecurity();

    return () => {
      securityManager.removeEventListener(handleSecurityEvent);
    };
  }, [securityManager, handleSecurityEvent]);

  // Handle permission retry
  const handlePermissionRetry = useCallback(async () => {
    if (!securityManager) return;

    setState(prev => ({ ...prev, isInitializing: true, error: null }));

    try {
      const status = await securityManager.initialize();
      setState(prev => ({
        ...prev,
        isInitializing: false,
        isInitialized: true,
        status,
        showPermissionDialog: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Security initialization failed';
      setState(prev => ({
        ...prev,
        isInitializing: false,
        error: errorMessage
      }));
    }
  }, [securityManager]);

  // Handle threat acknowledgment
  const handleThreatAcknowledge = useCallback(() => {
    setState(prev => ({ ...prev, showThreatDialog: false }));
  }, []);

  // Render permission dialog
  const renderPermissionDialog = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Permissions Required</h3>
            <p className="text-sm text-gray-600">Camera, microphone, and screen access are mandatory for quiz security</p>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-2">
            This quiz requires the following permissions to ensure academic integrity:
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>Camera:</strong> Monitor your face and environment</li>
            <li>• <strong>Microphone:</strong> Detect unauthorized audio</li>
            <li>• <strong>Screen Recording:</strong> Monitor screen activity</li>
          </ul>
        </div>

        {state.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-700">{state.error}</p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={handlePermissionRetry}
            disabled={state.isInitializing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {state.isInitializing ? 'Requesting...' : 'Grant Permissions'}
          </button>
        </div>
      </div>
    </div>
  );

  // Render threat dialog
  const renderThreatDialog = () => {
    const criticalThreats = state.currentThreats.filter(t => t.severity === 'critical' && !t.resolved);
    if (criticalThreats.length === 0) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-900">Security Violation Detected</h3>
              <p className="text-sm text-red-600">Quiz access has been blocked</p>
            </div>
          </div>
          
          <div className="mb-4">
            {criticalThreats.map((threat, index) => (
              <div key={threat.id} className="mb-2 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm font-medium text-red-800">{threat.message}</p>
                <p className="text-xs text-red-600 mt-1">
                  Detected at {new Date(threat.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleThreatAcknowledge}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render security status indicator
  const renderSecurityStatus = () => {
    if (!state.status) return null;

    const getStatusColor = () => {
      switch (state.status!.overall) {
        case 'secure': return 'text-green-600 bg-green-100';
        case 'warning': return 'text-yellow-600 bg-yellow-100';
        case 'blocked': return 'text-red-600 bg-red-100';
        default: return 'text-gray-600 bg-gray-100';
      }
    };

    const getStatusIcon = () => {
      switch (state.status!.overall) {
        case 'secure':
          return (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          );
        case 'warning':
          return (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          );
        case 'blocked':
          return (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          );
        default:
          return null;
      }
    };

    return (
      <div className={`fixed top-4 right-4 px-3 py-2 rounded-lg flex items-center space-x-2 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium capitalize">{state.status.overall}</span>
      </div>
    );
  };

  // Render loading state
  if (state.isInitializing) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Initializing Security</h2>
          <p className="text-gray-600">Verifying system integrity and requesting permissions...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (state.error && !state.showPermissionDialog) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Security Error</h2>
          <p className="text-gray-600 mb-4">{state.error}</p>
          <button
            onClick={handlePermissionRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render blocked state
  if (state.status?.overall === 'blocked') {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-red-900 mb-2">Quiz Access Blocked</h2>
          <p className="text-red-600 mb-4">Security violations detected. Quiz cannot proceed.</p>
          <div className="text-left">
            {state.status.threats.filter(t => !t.resolved).map(threat => (
              <div key={threat.id} className="mb-2 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-800">{threat.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Render children when security is ready */}
      {state.isInitialized && state.status?.overall !== 'blocked' && children}
      
      {/* Security status indicator */}
      {renderSecurityStatus()}
      
      {/* Permission dialog */}
      {state.showPermissionDialog && renderPermissionDialog()}
      
      {/* Threat dialog */}
      {state.showThreatDialog && renderThreatDialog()}
    </>
  );
};