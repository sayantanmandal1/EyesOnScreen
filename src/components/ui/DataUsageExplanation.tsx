/**
 * Data usage explanation and opt-in controls
 */

import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';

interface DataUsageExplanationProps {
  isOpen: boolean;
  onClose: () => void;
  showOptInControls?: boolean;
}

export const DataUsageExplanation: React.FC<DataUsageExplanationProps> = ({
  isOpen,
  onClose,
  showOptInControls = true,
}) => {
  const { privacySettings, updatePrivacySettings } = useAppStore();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const dataCategories = [
    {
      id: 'vision',
      title: 'Computer Vision Data',
      icon: '👁️',
      description: 'Eye tracking and facial landmark data',
      details: [
        'Eye gaze coordinates (x, y) relative to screen',
        'Pupil diameter and iris center positions',
        'Facial landmark points (468 coordinates)',
        'Head pose angles (yaw, pitch, roll)',
        'Blink detection and timing',
        'Confidence scores for all measurements'
      ],
      purpose: 'Detect when eyes are looking away from screen or at unauthorized materials',
      retention: 'Processed in real-time, stored locally for session duration'
    },
    {
      id: 'environment',
      title: 'Environmental Monitoring',
      icon: '🌍',
      description: 'Lighting and background analysis',
      details: [
        'Ambient lighting histogram and variance',
        'Shadow detection and stability analysis',
        'Background motion detection',
        'Secondary face detection (other people)',
        'Device-like object detection (phones, tablets)',
        'Lighting change anomaly detection'
      ],
      purpose: 'Ensure test environment integrity and detect unauthorized assistance',
      retention: 'Baseline stored during calibration, changes logged during quiz'
    },
    {
      id: 'behavioral',
      title: 'Behavioral Patterns',
      icon: '📊',
      description: 'Quiz interaction and timing data',
      details: [
        'Question viewing time and answer submission timing',
        'Mouse movement patterns and click locations',
        'Keyboard input timing (not content)',
        'Tab focus changes and window visibility',
        'Fullscreen mode compliance',
        'Copy/paste attempt detection'
      ],
      purpose: 'Identify suspicious behavior patterns and academic integrity violations',
      retention: 'Stored for entire quiz session and review period'
    },
    {
      id: 'performance',
      title: 'System Performance',
      icon: '⚡',
      description: 'Technical metrics and diagnostics',
      details: [
        'Frame processing rate (FPS)',
        'Computer vision processing latency',
        'Memory usage and CPU utilization',
        'Browser compatibility and feature support',
        'Error logs and diagnostic information',
        'Network connectivity status'
      ],
      purpose: 'Ensure system reliability and troubleshoot technical issues',
      retention: 'Aggregated metrics stored, detailed logs cleared after session'
    }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-usage-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 id="data-usage-title" className="text-2xl font-bold text-gray-900">
              Data Usage Explanation
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="Close data usage explanation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-600 mt-2">
            Understand exactly what data is collected, how it&apos;s used, and your privacy controls.
          </p>
        </div>

        <div className="p-6">
          {/* Privacy-First Approach */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-green-900">Privacy-First Design</h3>
                <div className="text-sm text-green-700 mt-1 space-y-1">
                  <p>✅ All video processing happens locally on your device</p>
                  <p>✅ No raw video or audio is ever transmitted</p>
                  <p>✅ No facial recognition or biometric identification</p>
                  <p>✅ Data is anonymized and encrypted</p>
                  <p>✅ You control what data is shared and for how long</p>
                </div>
              </div>
            </div>
          </div>

          {/* Data Categories */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Data Collection Categories
            </h3>
            
            {dataCategories.map((category) => (
              <div key={category.id} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleSection(category.id)}
                  className="w-full px-4 py-4 text-left flex items-center justify-between hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <h4 className="font-medium text-gray-900">{category.title}</h4>
                      <p className="text-sm text-gray-600">{category.description}</p>
                    </div>
                  </div>
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedSection === category.id ? 'rotate-180' : ''
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSection === category.id && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">Data Points Collected:</h5>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {category.details.map((detail, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-blue-500 mr-2">•</span>
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">Purpose:</h5>
                        <p className="text-sm text-gray-600 mb-3">{category.purpose}</p>
                        <h5 className="font-medium text-gray-900 mb-2">Retention:</h5>
                        <p className="text-sm text-gray-600">{category.retention}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Data Flow Diagram */}
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Flow</h3>
            <div className="flex items-center justify-between text-sm">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="font-medium">Camera</p>
                <p className="text-gray-600">Video Stream</p>
              </div>
              
              <div className="flex-1 mx-4">
                <div className="border-t-2 border-dashed border-gray-300 relative">
                  <div className="absolute -top-2 right-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="font-medium">Local Processing</p>
                <p className="text-gray-600">Your Browser</p>
              </div>
              
              <div className="flex-1 mx-4">
                <div className="border-t-2 border-dashed border-gray-300 relative">
                  <div className="absolute -top-2 right-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <p className="font-medium">Local Storage</p>
                <p className="text-gray-600">IndexedDB</p>
              </div>
            </div>
            <div className="text-center mt-4 text-xs text-gray-500">
              Raw video never leaves your device • Only anonymized metrics optionally shared
            </div>
          </div>

          {/* Opt-in Controls */}
          {showOptInControls && (
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">
                Your Data Control Options
              </h3>
              
              <div className="space-y-4">
                <label className="flex items-start justify-between">
                  <div className="flex-1 mr-4">
                    <div className="font-medium text-blue-900">Server Synchronization</div>
                    <div className="text-sm text-blue-700 mt-1">
                      Upload anonymized monitoring logs for institutional review. 
                      Helps instructors verify academic integrity while maintaining your privacy.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={privacySettings.serverSyncEnabled}
                    onChange={(e) => updatePrivacySettings({ serverSyncEnabled: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                  />
                </label>
                
                <label className="flex items-start justify-between">
                  <div className="flex-1 mr-4">
                    <div className="font-medium text-blue-900">Extended Data Retention</div>
                    <div className="text-sm text-blue-700 mt-1">
                      Keep monitoring data for {privacySettings.dataRetentionDays} days instead of deleting after session. 
                      Useful for academic appeals or review processes.
                    </div>
                  </div>
                  <select
                    value={privacySettings.dataRetentionDays}
                    onChange={(e) => updatePrivacySettings({ dataRetentionDays: parseInt(e.target.value) })}
                    className="border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </label>
              </div>
              
              <div className="mt-4 text-xs text-blue-600">
                💡 You can change these settings at any time in the Privacy Settings panel
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};