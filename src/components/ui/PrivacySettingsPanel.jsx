/**
 * Privacy settings panel with toggle controls
 */

import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';

export const PrivacySettingsPanel = ({
  isOpen,
  onClose,
}) => {
  const { privacySettings, updatePrivacySettings } = useAppStore();
  const [tempSettings, setTempSettings] = useState(privacySettings);

  const handleSave = () => {
    updatePrivacySettings(tempSettings);
    onClose();
  };

  const handleCancel = () => {
    setTempSettings(privacySettings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-settings-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 id="privacy-settings-title" className="text-xl font-semibold text-gray-900">
              Privacy Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="Close privacy settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Video Preview Setting */}
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-4">
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                Video Preview
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Show a live preview of your camera feed during the quiz. This helps you ensure 
                proper positioning and lighting, but can be disabled for privacy.
              </p>
              <div className="text-xs text-gray-500">
                <strong>Note:</strong> Video processing continues regardless of preview visibility. 
                No video data is transmitted externally.
              </div>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={tempSettings.videoPreviewEnabled}
                onChange={(e) => setTempSettings(prev => ({
                  ...prev,
                  videoPreviewEnabled: e.target.checked
                }))}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-900">
                {tempSettings.videoPreviewEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          {/* Audio Alerts Setting */}
          <div className="flex items-start justify-between border-t border-gray-200 pt-6">
            <div className="flex-1 mr-4">
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                Audio Alerts
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Play sound notifications when academic integrity alerts are triggered. 
                Sounds help ensure you notice important warnings during the quiz.
              </p>
              <div className="text-xs text-gray-500">
                <strong>Note:</strong> Visual alerts will still appear even if audio is disabled.
              </div>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={tempSettings.audioAlertsEnabled}
                onChange={(e) => setTempSettings(prev => ({
                  ...prev,
                  audioAlertsEnabled: e.target.checked
                }))}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-900">
                {tempSettings.audioAlertsEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          {/* Server Sync Setting */}
          <div className="flex items-start justify-between border-t border-gray-200 pt-6">
            <div className="flex-1 mr-4">
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                Server Synchronization
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Optional
                </span>
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Upload anonymized monitoring logs to secure servers for institutional review. 
                This enables instructors to review academic integrity reports.
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <div><strong>Uploaded data includes:</strong> Gaze coordinates, head pose angles, 
                timing data, and integrity flags</div>
                <div><strong>Never uploaded:</strong> Raw video, audio, personal identification, 
                or biometric templates</div>
                <div><strong>Security:</strong> All data is encrypted in transit and at rest</div>
              </div>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={tempSettings.serverSyncEnabled}
                onChange={(e) => setTempSettings(prev => ({
                  ...prev,
                  serverSyncEnabled: e.target.checked
                }))}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-900">
                {tempSettings.serverSyncEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          {/* Data Retention Setting */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Data Retention
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              How long to keep monitoring data stored locally in your browser. 
              Data is automatically deleted after this period.
            </p>
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">
                Retention Period:
              </label>
              <select
                value={tempSettings.dataRetentionDays}
                onChange={(e) => setTempSettings(prev => ({
                  ...prev,
                  dataRetentionDays: parseInt(e.target.value)
                }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>

          {/* Data Management Actions */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Data Management
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  // This would trigger data export functionality
                  console.log('Export data requested');
                }}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="font-medium text-gray-900">Export My Data</div>
                <div className="text-sm text-gray-600">
                  Download all stored monitoring data in JSON, CSV, or PDF format
                </div>
              </button>
              
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete all stored data? This action cannot be undone.')) {
                    // This would trigger data deletion
                    console.log('Delete data requested');
                  }
                }}
                className="w-full text-left px-4 py-3 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <div className="font-medium text-red-900">Delete All Data</div>
                <div className="text-sm text-red-600">
                  Permanently remove all stored calibration profiles and monitoring logs
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};