/**
 * Full-screen consent modal with privacy explanation
 */

import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';

interface ConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onAccept,
  onDecline,
}) => {
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);
  const [hasReadDataUsage, setHasReadDataUsage] = useState(false);
  const { privacySettings, updatePrivacySettings } = useAppStore();

  if (!isOpen) return null;

  const canProceed = hasReadPrivacy && hasReadDataUsage;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      aria-describedby="consent-description"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-y-auto p-8 m-4">
        <div className="text-center mb-6">
          <h1 id="consent-title" className="text-3xl font-bold text-gray-900 mb-2">
            Eyes-On-Screen Proctored Quiz
          </h1>
          <p id="consent-description" className="text-lg text-gray-600">
            Informed Consent and Privacy Agreement
          </p>
        </div>

        <div className="space-y-6">
          {/* Privacy and Data Processing Section */}
          <section className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                1
              </span>
              Privacy and Data Processing
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>Local Processing:</strong> All video data from your camera is processed 
                locally on your device. No raw video footage is transmitted to external servers.
              </p>
              <p>
                <strong>Computer Vision:</strong> We use advanced computer vision technology to 
                monitor your eye movements, head position, and environment to ensure academic integrity.
              </p>
              <p>
                <strong>Data Collection:</strong> We collect anonymized monitoring data including:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Eye gaze coordinates and confidence scores</li>
                <li>Head pose angles (yaw, pitch, roll)</li>
                <li>Environmental lighting conditions</li>
                <li>Quiz answers and timing information</li>
                <li>Academic integrity flags and risk scores</li>
              </ul>
              <p>
                <strong>No Personal Identification:</strong> The system does not perform facial 
                recognition or store any personally identifiable biometric data.
              </p>
            </div>
            <label className="flex items-center mt-4">
              <input
                type="checkbox"
                checked={hasReadPrivacy}
                onChange={(e) => setHasReadPrivacy(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                aria-describedby="privacy-confirmation"
              />
              <span id="privacy-confirmation" className="ml-2 text-sm text-gray-700">
                I have read and understand the privacy and data processing information
              </span>
            </label>
          </section>

          {/* Data Usage and Retention Section */}
          <section className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                2
              </span>
              Data Usage and Retention
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>Purpose:</strong> Collected data is used solely for academic integrity 
                monitoring and quiz administration. Data helps detect potential cheating behaviors 
                such as looking away from the screen, unauthorized assistance, or environmental tampering.
              </p>
              <p>
                <strong>Storage:</strong> Monitoring data is stored locally in your browser's 
                secure storage (IndexedDB) and automatically deleted after {privacySettings.dataRetentionDays} days.
              </p>
              <p>
                <strong>Export Options:</strong> You can export your session data in JSON, CSV, 
                or PDF formats for your records or academic review purposes.
              </p>
              <p>
                <strong>Optional Server Sync:</strong> You may optionally choose to sync anonymized 
                monitoring logs to secure servers for institutional review. This is entirely optional 
                and can be disabled at any time.
              </p>
            </div>
            <label className="flex items-center mt-4">
              <input
                type="checkbox"
                checked={hasReadDataUsage}
                onChange={(e) => setHasReadDataUsage(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                aria-describedby="data-usage-confirmation"
              />
              <span id="data-usage-confirmation" className="ml-2 text-sm text-gray-700">
                I have read and understand the data usage and retention policies
              </span>
            </label>
          </section>

          {/* Camera and Monitoring Requirements */}
          <section className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                3
              </span>
              Camera and Monitoring Requirements
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>Camera Access:</strong> This quiz requires access to your camera for 
                real-time proctoring. You will be prompted to grant camera permissions.
              </p>
              <p>
                <strong>Environment Setup:</strong> Please ensure:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>You are in a well-lit, private room</li>
                <li>No other people are visible in the camera frame</li>
                <li>Remove phones, tablets, or other devices from view</li>
                <li>Avoid backlighting (sitting in front of windows)</li>
              </ul>
              <p>
                <strong>Monitoring Alerts:</strong> The system will alert you if it detects 
                potential academic integrity violations. You can acknowledge these alerts and continue.
              </p>
            </div>
          </section>

          {/* Privacy Settings */}
          <section className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                4
              </span>
              Privacy Settings
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-gray-900 font-medium">Video Preview</span>
                  <p className="text-sm text-gray-600">Show live camera preview during quiz</p>
                </div>
                <input
                  type="checkbox"
                  checked={privacySettings.videoPreviewEnabled}
                  onChange={(e) => updatePrivacySettings({ videoPreviewEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-gray-900 font-medium">Audio Alerts</span>
                  <p className="text-sm text-gray-600">Play sound notifications for alerts</p>
                </div>
                <input
                  type="checkbox"
                  checked={privacySettings.audioAlertsEnabled}
                  onChange={(e) => updatePrivacySettings({ audioAlertsEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-gray-900 font-medium">Server Sync (Optional)</span>
                  <p className="text-sm text-gray-600">Upload anonymized logs for institutional review</p>
                </div>
                <input
                  type="checkbox"
                  checked={privacySettings.serverSyncEnabled}
                  onChange={(e) => updatePrivacySettings({ serverSyncEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </label>
            </div>
          </section>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={onDecline}
            className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Decline and Exit
          </button>
          
          <button
            onClick={onAccept}
            disabled={!canProceed}
            className={`px-8 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              canProceed
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            aria-describedby={!canProceed ? 'consent-requirement' : undefined}
          >
            I Consent - Begin Quiz
          </button>
        </div>
        
        {!canProceed && (
          <p id="consent-requirement" className="text-sm text-red-600 text-center mt-2">
            Please read and acknowledge all sections above to continue
          </p>
        )}
      </div>
    </div>
  );
};