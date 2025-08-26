/**
 * ToastNotification - Soft alert toast notification component with accessibility
 */

import { useEffect, useState, useRef } from 'react';

export const ToastNotification = ({
  alert,
  onDismiss,
  position = 'top-right',
  duration = 3000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const toastRef = useRef(null);
  const dismissButtonRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 10);
    
    // Announce to screen readers
    const announcement = `Notification: ${alert.message}`;
    const liveRegion = document.getElementById('toast-announcements') || createLiveRegion();
    liveRegion.textContent = announcement;
    
    return () => clearTimeout(timer);
  }, [alert.message]);

  useEffect(() => {
    // Auto-dismiss after duration (unless paused)
    if (!isPaused) {
      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [duration, isPaused]);

  useEffect(() => {
    // Keyboard navigation
    const handleKeyDown = (event) => {
      if (!toastRef.current?.contains(document.activeElement)) return;

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          handleDismiss();
          break;
        case 'Enter':
        case ' ':
          if (document.activeElement === dismissButtonRef.current) {
            event.preventDefault();
            handleDismiss();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const createLiveRegion = () => {
    const existing = document.getElementById('toast-announcements');
    if (existing) return existing;

    const liveRegion = document.createElement('div');
    liveRegion.id = 'toast-announcements';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
    return liveRegion;
  };

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(alert.id);
    }, 300); // Match exit animation duration
  };

  const getPositionClasses = () => {
    const positions = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
    };
    return positions[position];
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

  return (
    <div
      className={`
        fixed z-50 ${getPositionClasses()}
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100 scale-100' 
          : position.includes('right')
            ? 'translate-x-full opacity-0 scale-95'
            : '-translate-x-full opacity-0 scale-95'
        }
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-lg max-w-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-lg" role="img" aria-label="Alert">
              {getAlertIcon()}
            </span>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-yellow-800">
              Proctoring Alert
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              {alert.message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleDismiss}
              className="inline-flex text-yellow-400 hover:text-yellow-600 focus:outline-none focus:text-yellow-600 transition-colors duration-200"
              aria-label="Dismiss alert"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Progress bar for remaining time */}
        <div className="mt-2">
          <div className="w-full bg-yellow-200 rounded-full h-1">
            <div 
              className="bg-yellow-400 h-1 rounded-full transition-all duration-100 ease-linear"
              style={{
                animation: `shrink ${duration}ms linear`,
              }}
            />
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};