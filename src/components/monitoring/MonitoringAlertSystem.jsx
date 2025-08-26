/**
 * Monitoring-specific alert toast and modal system
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';

export const MonitoringAlertSystem = ({
  className = ''
}) => {
  const { activeFlags, privacySettings } = useAppStore();
  const [displayedAlerts, setDisplayedAlerts] = useState([]);
  const [hardAlertModal, setHardAlertModal] = useState(null);

  // Convert flags to alert displays
  useEffect(() => {
    const newAlerts = activeFlags
      .filter(flag => !displayedAlerts.some(alert => alert.id === flag.id))
      .map(flag => ({
        id: flag.id,
        type: flag.severity,
        message: getAlertMessage(flag),
        timestamp: flag.timestamp,
        flagEvent: flag,
        acknowledged: false,
        autoHideDelay: flag.severity === 'soft' ? 5000 : undefined
      }));

    if (newAlerts.length > 0) {
      setDisplayedAlerts(prev => [...prev, ...newAlerts]);

      // Show hard alert modal
      const hardAlert = newAlerts.find(alert => alert.type === 'hard');
      if (hardAlert) {
        setHardAlertModal(hardAlert);
        
        // Play audio alert if enabled
        if (privacySettings.audioAlertsEnabled) {
          playAlertSound('hard');
        }
      } else {
        // Play soft alert sound
        if (privacySettings.audioAlertsEnabled) {
          playAlertSound('soft');
        }
      }
    }
  }, [activeFlags, displayedAlerts, privacySettings.audioAlertsEnabled]);

  // Auto-hide soft alerts
  useEffect(() => {
    const timers = displayedAlerts
      .filter(alert => alert.type === 'soft' && !alert.acknowledged && alert.autoHideDelay)
      .map(alert => 
        setTimeout(() => {
          handleDismissAlert(alert.id);
        }, alert.autoHideDelay)
      );

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [displayedAlerts]);

  const getAlertMessage = (flag) => {
    switch (flag.type) {
      case 'EYES_OFF':
        return 'Eyes detected looking away from screen';
      case 'HEAD_POSE':
        return 'Head position outside acceptable range';
      case 'TAB_BLUR':
        return 'Browser tab lost focus or window minimized';
      case 'SECOND_FACE':
        return 'Additional person detected in camera view';
      case 'DEVICE_OBJECT':
        return 'Unauthorized device detected in view';
      case 'SHADOW_ANOMALY':
        return 'Lighting conditions changed significantly';
      case 'FACE_MISSING':
        return 'Face not detected in camera view';
      case 'DOWN_GLANCE':
        return 'Frequent downward glances detected';
      default:
        return 'Academic integrity alert triggered';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'EYES_OFF':
        return '👀';
      case 'HEAD_POSE':
        return '🔄';
      case 'TAB_BLUR':
        return '🪟';
      case 'SECOND_FACE':
        return '👥';
      case 'DEVICE_OBJECT':
        return '📱';
      case 'SHADOW_ANOMALY':
        return '💡';
      case 'FACE_MISSING':
        return '❓';
      case 'DOWN_GLANCE':
        return '👇';
      default:
        return '⚠️';
    }
  };

  const playAlertSound = (type) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === 'hard') {
        // Hard alert: Lower frequency, longer duration
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } else {
        // Soft alert: Higher frequency, shorter duration
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      }
    } catch (error) {
      console.warn('Could not play alert sound:', error);
    }
  };

  const handleDismissAlert = (alertId) => {
    setDisplayedAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const handleAcknowledgeHardAlert = () => {
    if (hardAlertModal) {
      setDisplayedAlerts(prev => 
        prev.map(alert => 
          alert.id === hardAlertModal.id 
            ? { ...alert, acknowledged: true }
            : alert
        )
      );
      setHardAlertModal(null);
    }
  };

  const softAlerts = displayedAlerts.filter(alert => 
    alert.type === 'soft' && !alert.acknowledged
  );

  return (
    <div className={className}>
      {/* Soft Alert Toasts */}
      <div className="fixed top-4 right-4 z-40 space-y-2">
        {softAlerts.map(alert => (
          <div
            key={alert.id}
            className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg max-w-sm animate-slide-in-right"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-2xl">
                  {alert.flagEvent ? getAlertIcon(alert.flagEvent.type) : '⚠️'}
                </span>
              </div>
              <div className="ml-3 flex-1">
                <div className="text-sm font-medium text-yellow-800">
                  Academic Integrity Alert
                </div>
                <div className="text-sm text-yellow-700 mt-1">
                  {alert.message}
                </div>
                <div className="text-xs text-yellow-600 mt-2">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={() => handleDismissAlert(alert.id)}
                className="flex-shrink-0 ml-2 text-yellow-400 hover:text-yellow-600 focus:outline-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Progress bar for auto-hide */}
            {alert.autoHideDelay && (
              <div className="mt-3 w-full bg-yellow-200 rounded-full h-1">
                <div 
                  className="bg-yellow-500 h-1 rounded-full animate-shrink"
                  style={{ animationDuration: `${alert.autoHideDelay}ms` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Hard Alert Modal */}
      {hardAlertModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hard-alert-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-scale-in">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">
                      {hardAlertModal.flagEvent ? getAlertIcon(hardAlertModal.flagEvent.type) : '🚨'}
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 id="hard-alert-title" className="text-lg font-semibold text-red-900">
                    Academic Integrity Violation
                  </h3>
                  <p className="text-sm text-red-700">
                    Immediate attention required
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  {hardAlertModal.message}
                </p>
                
                {hardAlertModal.flagEvent && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>
                        <strong>Alert Type:</strong> {hardAlertModal.flagEvent.type.replace('_', ' ')}
                      </div>
                      <div>
                        <strong>Confidence:</strong> {Math.round(hardAlertModal.flagEvent.confidence * 100)}%
                      </div>
                      <div>
                        <strong>Time:</strong> {new Date(hardAlertModal.timestamp).toLocaleTimeString()}
                      </div>
                      {hardAlertModal.flagEvent.questionId && (
                        <div>
                          <strong>Question:</strong> {hardAlertModal.flagEvent.questionId}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                  What should I do?
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Return to proper position facing the camera</li>
                  <li>• Ensure no unauthorized materials are visible</li>
                  <li>• Keep your eyes focused on the screen</li>
                  <li>• Maintain consistent lighting conditions</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleAcknowledgeHardAlert}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  I Understand - Continue Quiz
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert summary indicator */}
      {displayedAlerts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-30">
          <div className="bg-white rounded-full shadow-lg border border-gray-200 p-2 flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-700 pr-2">
              {displayedAlerts.filter(a => !a.acknowledged).length} active alerts
            </span>
          </div>
        </div>
      )}
    </div>
  );
};