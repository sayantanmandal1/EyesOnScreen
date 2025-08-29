/**
 * SecurityDemo - Demonstration component for the security system
 * 
 * Shows how to integrate the security system into a quiz application
 * with proper error handling and user feedback.
 */

'use client';

import React, { useState } from 'react';
import { SecurityGuard } from './SecurityGuard';
import { useSecurity, useThreatMonitoring } from '../../hooks/useSecurity';
import type { SecurityThreat } from '../../lib/security/types';

const SecurityDemo: React.FC = () => {
  const [quizStarted, setQuizStarted] = useState(false);
  const [securityReady, setSecurityReady] = useState(false);

  const {
    status,
    isInitializing,
    isInitialized,
    isSecure,
    error,
    initialize
  } = useSecurity({
    config: {
      permissions: {
        camera: {
          required: true,
          allowOptOut: false,
          continuousVerification: true,
          verificationIntervalMs: 5000
        },
        microphone: {
          required: true,
          allowOptOut: false,
          continuousVerification: true,
          verificationIntervalMs: 5000
        },
        screen: {
          required: true,
          allowOptOut: false,
          continuousVerification: true,
          verificationIntervalMs: 10000
        }
      },
      browserSecurity: {
        blockDeveloperTools: true,
        blockExtensions: true,
        blockModifications: true,
        detectVirtualization: true
      },
      systemIntegrity: {
        monitorApplications: true,
        detectScreenRecording: true,
        detectRemoteAccess: true,
        monitorNetworkConnections: true
      },
      enforcement: {
        immediateBlock: true,
        gracePeriodMs: 0,
        maxViolations: 0
      }
    },
    onSecurityReady: () => {
      setSecurityReady(true);
      console.log('Security system ready - quiz can start');
    },
    onSecurityBlocked: (threats: SecurityThreat[]) => {
      setQuizStarted(false);
      setSecurityReady(false);
      console.log('Security blocked:', threats);
    },
    onSecurityWarning: (threats: SecurityThreat[]) => {
      console.log('Security warning:', threats);
    },
    onThreatDetected: (threat: SecurityThreat) => {
      console.log('Threat detected:', threat);
    }
  });

  const {
    activeThreats,
    criticalThreats,
    hasCriticalThreats,
    threatCount,
    highestSeverity
  } = useThreatMonitoring();

  const handleStartQuiz = () => {
    if (isSecure && securityReady) {
      setQuizStarted(true);
    }
  };

  const handleInitializeSecurity = async () => {
    try {
      await initialize();
    } catch (error) {
      console.error('Failed to initialize security:', error);
    }
  };

  const renderSecurityStatus = () => {
    if (!status) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Security Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overall Status */}
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
              status.overall === 'secure' ? 'bg-green-100 text-green-600' :
              status.overall === 'warning' ? 'bg-yellow-100 text-yellow-600' :
              'bg-red-100 text-red-600'
            }`}>
              {status.overall === 'secure' ? '✓' : 
               status.overall === 'warning' ? '⚠' : '✗'}
            </div>
            <p className="text-sm font-medium capitalize">{status.overall}</p>
          </div>

          {/* Permissions */}
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
              status.permissions.camera.granted && 
              status.permissions.microphone.granted && 
              status.permissions.screen.granted ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              📹
            </div>
            <p className="text-sm font-medium">Permissions</p>
            <p className="text-xs text-gray-500">
              {[
                status.permissions.camera.granted ? 'Camera' : null,
                status.permissions.microphone.granted ? 'Mic' : null,
                status.permissions.screen.granted ? 'Screen' : null
              ].filter(Boolean).join(', ') || 'None'}
            </p>
          </div>

          {/* Browser Security */}
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
              !status.browserSecurity.developerToolsOpen && 
              status.browserSecurity.extensionsDetected.length === 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              🔒
            </div>
            <p className="text-sm font-medium">Browser</p>
            <p className="text-xs text-gray-500">
              {status.browserSecurity.securityViolations.length} violations
            </p>
          </div>

          {/* VM Detection */}
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
              !status.vmDetection.isVirtualMachine && !status.vmDetection.isEmulated ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              💻
            </div>
            <p className="text-sm font-medium">Environment</p>
            <p className="text-xs text-gray-500">
              {status.vmDetection.isVirtualMachine ? 'VM Detected' : 
               status.vmDetection.isEmulated ? 'Emulated' : 'Native'}
            </p>
          </div>
        </div>

        {/* Threats */}
        {threatCount > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <h4 className="font-medium text-red-800 mb-2">
              Active Threats ({threatCount})
            </h4>
            <div className="space-y-2">
              {activeThreats.slice(0, 3).map(threat => (
                <div key={threat.id} className="text-sm">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    threat.severity === 'critical' ? 'bg-red-500' :
                    threat.severity === 'high' ? 'bg-orange-500' :
                    threat.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}></span>
                  {threat.message}
                </div>
              ))}
              {threatCount > 3 && (
                <p className="text-sm text-gray-600">
                  +{threatCount - 3} more threats
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderQuizInterface = () => {
    if (!quizStarted) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Quiz Interface</h3>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <h4 className="font-medium text-blue-800 mb-2">Sample Question 1</h4>
            <p className="text-blue-700 mb-3">
              What is the primary purpose of the security system in this quiz application?
            </p>
            <div className="space-y-2">
              <label className="flex items-center">
                <input type="radio" name="q1" className="mr-2" />
                <span>To prevent cheating and ensure academic integrity</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="q1" className="mr-2" />
                <span>To collect user data for analytics</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="q1" className="mr-2" />
                <span>To improve user experience</span>
              </label>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setQuizStarted(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              End Quiz
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Next Question
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Security System Demo
          </h1>
          <p className="text-gray-600 mb-4">
            This demo shows the Advanced System Access and Security Foundation in action.
            The system enforces mandatory permissions, detects security threats, and monitors
            for cheating attempts in real-time.
          </p>

          <div className="flex space-x-4">
            {!isInitialized && (
              <button
                onClick={handleInitializeSecurity}
                disabled={isInitializing}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isInitializing ? 'Initializing...' : 'Initialize Security'}
              </button>
            )}

            {isInitialized && securityReady && !quizStarted && (
              <button
                onClick={handleStartQuiz}
                disabled={!isSecure}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Start Quiz
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {renderSecurityStatus()}
        {renderQuizInterface()}

        {/* Security Guard Component */}
        <SecurityGuard
          onSecurityReady={() => setSecurityReady(true)}
          onSecurityBlocked={(threats) => {
            setQuizStarted(false);
            setSecurityReady(false);
          }}
          config={{
            permissions: {
              camera: {
                required: true,
                allowOptOut: false,
                continuousVerification: true,
                verificationIntervalMs: 5000
              },
              microphone: {
                required: true,
                allowOptOut: false,
                continuousVerification: true,
                verificationIntervalMs: 5000
              },
              screen: {
                required: true,
                allowOptOut: false,
                continuousVerification: true,
                verificationIntervalMs: 10000
              }
            }
          }}
        />
      </div>
    </div>
  );
};

export default SecurityDemo;