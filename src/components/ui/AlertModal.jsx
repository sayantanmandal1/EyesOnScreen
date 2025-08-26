/**
 * AlertModal - Hard alert modal dialog with sound and full accessibility
 */

import { useEffect, useRef } from 'react';

export const AlertModal = ({
  alert,
  onAcknowledge,
  onDismiss,
}) => {
  const modalRef = useRef(null);
  const acknowledgeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    // Store previous focus
    previousFocusRef.current = document.activeElement;

    // Focus the acknowledge button when modal opens
    if (acknowledgeButtonRef.current) {
      acknowledgeButtonRef.current.focus();
    }

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Announce to screen readers
    const announcement = `Alert: ${alert.message}. Press Enter or Space to acknowledge.`;
    const liveRegion = document.getElementById('alert-announcements') || createLiveRegion();
    liveRegion.textContent = announcement;

    return () => {
      document.body.style.overflow = 'unset';
      // Restore previous focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [alert.message]);

  useEffect(() => {
    // Focus trap within modal
    const handleTabKey = (event) => {
      if (event.key !== 'Tab') return;

      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Handle escape key
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        handleAcknowledge();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const createLiveRegion = () => {
    const existing = document.getElementById('alert-announcements');
    if (existing) return existing;

    const liveRegion = document.createElement('div');
    liveRegion.id = 'alert-announcements';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
    return liveRegion;
  };

  const handleAcknowledge = () => {
    onAcknowledge(alert.id);
  };

  const handleBackdropClick = (event) => {
    if (event.target === modalRef.current) {
      // Don't allow dismissing hard alerts by clicking backdrop
      // User must acknowledge
      return;
    }
  };

  const getAlertIcon = () => {
    if (alert.flagEvent) {
      const icons = {
        EYES_OFF: '👀',
        HEAD_POSE: '🔄',
        TAB_BLUR: '🔄',
        SECOND_FACE: '👥',
        DEVICE_OBJECT: '📱',
        SHADOW_ANOMALY: '💡',
        FACE_MISSING: '❓',
        DOWN_GLANCE: '👇',
      };
      return icons[alert.flagEvent.type] || '⚠️';
    }
    return '⚠️';
  };

  const getAlertColor = () => {
    if (alert.flagEvent) {
      const severityColors = {
        EYES_OFF: 'red',
        HEAD_POSE: 'orange',
        TAB_BLUR: 'red',
        SECOND_FACE: 'red',
        DEVICE_OBJECT: 'red',
        SHADOW_ANOMALY: 'orange',
        FACE_MISSING: 'orange',
        DOWN_GLANCE: 'orange',
      };
      return severityColors[alert.flagEvent.type] || 'red';
    }
    return 'red';
  };

  const color = getAlertColor();
  const colorClasses = {
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-400',
      title: 'text-red-800',
      message: 'text-red-700',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      icon: 'text-orange-400',
      title: 'text-orange-800',
      message: 'text-orange-700',
      button: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
    },
  };

  const classes = colorClasses[color];

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="alert-modal-title"
      aria-describedby="alert-modal-description"
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className={`${classes.bg} ${classes.border} border rounded-lg p-4`}>
            <div className="flex">
              <div className="flex-shrink-0">
                <div className={`${classes.icon} text-2xl`} role="img" aria-label="Alert">
                  {getAlertIcon()}
                </div>
              </div>
              <div className="ml-3 flex-1">
                <h3 
                  id="alert-modal-title"
                  className={`text-lg font-medium ${classes.title}`}
                >
                  Proctoring Violation Detected
                </h3>
                <div className="mt-2">
                  <p 
                    id="alert-modal-description"
                    className={`text-sm ${classes.message}`}
                  >
                    {alert.message}
                  </p>
                </div>
                
                {/* Additional details if available */}
                {alert.flagEvent && (
                  <div className="mt-3 text-xs text-gray-600">
                    <p>Detection time: {new Date(alert.timestamp).toLocaleTimeString()}</p>
                    <p>Confidence: {Math.round((alert.flagEvent.confidence || 0) * 100)}%</p>
                    {alert.flagEvent.questionId && (
                      <p>Question: {alert.flagEvent.questionId}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-5 sm:mt-6">
            <button
              ref={acknowledgeButtonRef}
              type="button"
              className={`
                w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 
                ${classes.button}
                text-base font-medium text-white 
                focus:outline-none focus:ring-2 focus:ring-offset-2 
                sm:text-sm transition-colors duration-200
              `}
              onClick={handleAcknowledge}
            >
              I Understand - Continue Quiz
            </button>
            
            <p className="mt-2 text-xs text-gray-500 text-center">
              This incident has been logged. Please ensure you follow all proctoring guidelines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};