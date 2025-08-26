/**
 * Full-screen consent modal with privacy explanation
 */

import { useState } from 'react';
import { useAppStore } from '../../store/appStore';

export const ConsentModal = ({
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
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 id="consent-title" className="text-3xl font-bold text-gray-900 mb-2">
              Eyes-On-Screen Proctored Quiz
            </h1>
            <h2 className="text-xl text-gray-700">
              Informed Consent and Privacy Agreement
            </h2>
            <p id="consent-description" className="text-gray-600 mt-4">
              Please read the following information carefully and adjust your privacy settings before proceeding.
            </p>
          </div>

          {/* Privacy and Data Processing Section */}
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">
              Privacy and Data Processing
            </h3>
            <div className="text-blue-800 space-y-3 text-sm">
              <p>
                <strong>Local Processing:</strong> All video analysis happens on your device. 
                No video data is transmitted to our servers.
              </p>
              <p>
                <strong>Data Collection:</strong> We collect only monitoring logs (gaze patterns, 
                head movements, integrity flags) - not raw video or audio.
              </p>
              <p>
                <strong>Academic Integrity:</strong> This system monitors your behavior during 
                the quiz to ensure academic integrity standards are maintained.
              </p>
              <p>
                <strong>Your Rights:</strong> You can delete all collected data after the quiz. 
                You have full control over your privacy settings.
              </p>
            </div>
            
            <label className="flex items-start mt-4">
              <input
                type="checkbox"
                checked={hasReadPrivacy}
                onChange={(e) => setHasReadPrivacy(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                aria-describedby="privacy-acknowledgment"
              />
              <span id="privacy-acknowledgment" className="ml-3 text-sm text-blue-900">
                I have read and understand the privacy and data processing information above.
              </span>
            </label>
          </div>

          {/* Data Usage and Retention Section */}
          <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-lg font-semibold text-green-900 mb-4">
              Data Usage and Retention
            </h3>
            <div className="text-green-800 space-y-3 text-sm">
              <p>
                <strong>Purpose:</strong> Collected data is used solely for academic integrity 
                monitoring and quiz result validation.
              </p>
              <p>
                <strong>Retention:</strong> Data is stored locally for {privacySettings.dataRetentionDays} days 
                and automatically deleted unless you choose to export it.
              </p>
              <p>
                <strong>Sharing:</strong> Data is only shared if you explicitly choose to upload 
                it to your institution's learning management system.
              </p>
              <p>
                <strong>Security:</strong> All data is encrypted and stored securely on your device.
              </p>
            </div>
            
            <label className="flex items-start mt-4">
              <input
                type="checkbox"
                checked={hasReadDataUsage}
                onChange={(e) => setHasReadDataUsage(e.target.checked)}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-1"
                aria-describedby="data-usage-acknowledgment"
              />
              <span id="data-usage-acknowledgment" className="ml-3 text-sm text-green-900">
                I have read and understand the data usage and retention policies above.
              </span>
            </label>
          </div>

          {/* Camera and Monitoring Requirements */}
          <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-900 mb-4">
              Camera and Monitoring Requirements
            </h3>
            <div className="text-yellow-800 space-y-3 text-sm">
              <p>
                <strong>Camera Access:</strong> This quiz requires camera access to monitor 
                your gaze and head position during the exam.
              </p>
              <p>
                <strong>Environment:</strong> Ensure you're in a well-lit, quiet environment 
                with minimal distractions.
              </p>
              <p>
                <strong>Behavior Monitoring:</strong> The system will flag suspicious activities 
                such as looking away from the screen, multiple faces, or prohibited objects.
              </p>
              <p>
                <strong>Integrity Violations:</strong> Violations may affect your quiz results 
                and will be reported to your instructor.
              </p>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="mb-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Privacy Settings
            </h3>
            <p className="text-gray-700 text-sm mb-4">
              Customize your privacy preferences. You can change these settings at any time during the quiz.
            </p>
            
            <div className="space-y-4">
              {/* Video Preview Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="video-preview" className="text-sm font-medium text-gray-900">
                    Video Preview
                  </label>
                  <p className="text-xs text-gray-600">
                    Show a small preview of your camera feed during the quiz
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="video-preview"
                    type="checkbox"
                    checked={privacySettings.videoPreviewEnabled}
                    onChange={(e) => updatePrivacySettings({ videoPreviewEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Audio Alerts Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="audio-alerts" className="text-sm font-medium text-gray-900">
                    Audio Alerts
                  </label>
                  <p className="text-xs text-gray-600">
                    Play sound notifications for integrity violations
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="audio-alerts"
                    type="checkbox"
                    checked={privacySettings.audioAlertsEnabled}
                    onChange={(e) => updatePrivacySettings({ audioAlertsEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Server Sync Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="server-sync" className="text-sm font-medium text-gray-900">
                    Server Sync (Optional)
                  </label>
                  <p className="text-xs text-gray-600">
                    Automatically upload quiz results to your institution's server
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="server-sync"
                    type="checkbox"
                    checked={privacySettings.serverSyncEnabled}
                    onChange={(e) => updatePrivacySettings({ serverSyncEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-4">
            {!canProceed && (
              <div className="text-center p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">
                  Please read and acknowledge all sections above to continue
                </p>
              </div>
            )}
            
            <div className="flex space-x-4">
              <button
                onClick={onDecline}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Decline and Exit
              </button>
              
              <button
                onClick={onAccept}
                disabled={!canProceed}
                className={`flex-1 px-6 py-3 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                  canProceed
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                I Consent - Begin Quiz
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              By proceeding, you acknowledge that you have read, understood, and agree to the 
              terms outlined above. You can modify your privacy settings at any time during the quiz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};