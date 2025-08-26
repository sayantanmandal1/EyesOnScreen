/**
 * Camera Permission Request Modal
 * Displays camera permission request with retry functionality
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { CameraPermissionManager, DEFAULT_CAMERA_CONFIG } from '../../lib/camera';
import { useAppStore } from '../../store';

export const CameraPermissionModal = ({
  isOpen,
  onPermissionGranted,
  onPermissionDenied,
}) => {
  const { setCameraPermission, showAlert } = useAppStore();
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const permissionManager = useMemo(() => {
    const manager = new CameraPermissionManager(DEFAULT_CAMERA_CONFIG);

    manager.on('permissionGranted', (stream) => {
      setCameraPermission('granted');
      onPermissionGranted(stream);
      setError(null);
      setIsRequesting(false);
    });

    manager.on('permissionDenied', (error) => {
      setCameraPermission('denied');
      setError(manager.getErrorMessage(error));
      setIsRequesting(false);
      onPermissionDenied();
    });

    manager.on('permissionError', (error) => {
      setError(manager.getErrorMessage(error));
      setIsRequesting(false);
    });

    manager.on('retryAttempt', (attempt) => {
      setRetryCount(attempt);
      showAlert('soft', `Retry attempt ${attempt}...`);
    });

    return manager;
  }, [setCameraPermission, onPermissionGranted, onPermissionDenied, showAlert]);

  const handleRequestPermission = useCallback(async () => {
    setIsRequesting(true);
    setError(null);

    try {
      await permissionManager.requestPermission();
    } catch (err) {
      // Error handling is done through event listeners
      console.error('Camera permission request failed:', err);
    }
  }, [permissionManager]);

  const handleRetryPermission = useCallback(async () => {
    setIsRequesting(true);
    setError(null);

    try {
      await permissionManager.retryPermission();
    } catch (err) {
      // Error handling is done through event listeners
      console.error('Camera permission retry failed:', err);
    }
  }, [permissionManager]);

  const handleResetAndRetry = useCallback(() => {
    permissionManager.resetState();
    setRetryCount(0);
    setError(null);
    handleRequestPermission();
  }, [permissionManager, handleRequestPermission]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Camera Access Required
            </h2>
            <p className="text-gray-600 mb-4">
              This quiz requires camera access for proctoring. Your video is processed locally on your device and is not transmitted to our servers.
            </p>
          </div>

          <div className="mb-6 text-left">
            <h3 className="font-semibold text-gray-900 mb-2">Privacy Information:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• All video processing happens on your device</li>
              <li>• No video data is sent to our servers</li>
              <li>• Only monitoring logs are stored locally</li>
              <li>• You can delete all data after the quiz</li>
            </ul>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            {!error ? (
              <button
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRequesting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Requesting Access...
                  </span>
                ) : (
                  'Allow Camera Access'
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleRetryPermission}
                  disabled={isRequesting || retryCount >= DEFAULT_CAMERA_CONFIG.maxRetries}
                  className="w-full bg-orange-600 text-white py-3 px-4 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRequesting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Retrying... ({retryCount}/{DEFAULT_CAMERA_CONFIG.maxRetries})
                    </span>
                  ) : (
                    `Retry (${retryCount}/${DEFAULT_CAMERA_CONFIG.maxRetries})`
                  )}
                </button>

                <button
                  onClick={handleResetAndRetry}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Start Over
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <p>
              If you continue to have issues, please check your browser settings and ensure camera access is not blocked.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};