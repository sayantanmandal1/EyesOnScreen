/**
 * Camera Preview Component
 * Displays live camera feed with toggle functionality
 */

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../store';

export const CameraPreview = ({
  stream,
  streamManager,
  className = '',
  showControls = true,
  onStreamError,
  onStreamReconnected,
}) => {
  const videoRef = useRef(null);
  const { privacySettings, updatePrivacySettings, showAlert } = useAppStore();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [streamError, setStreamError] = useState(null);

  // Set up video element with stream
  useEffect(() => {
    if (videoRef.current && stream && privacySettings.videoPreviewEnabled) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream, privacySettings.videoPreviewEnabled]);

  // Set up stream manager event listeners
  useEffect(() => {
    if (!streamManager) return;

    const handleStreamError = (error) => {
      setStreamError(error.message);
      onStreamError?.(error);
      showAlert('soft', 'Camera connection lost. Attempting to reconnect...');
    };

    const handleReconnectAttempt = (attempt) => {
      setIsReconnecting(true);
      showAlert('soft', `Reconnecting camera... (${attempt})`);
    };

    const handleReconnectSuccess = (newStream) => {
      setIsReconnecting(false);
      setStreamError(null);
      onStreamReconnected?.(newStream);
      showAlert('soft', 'Camera reconnected successfully');
    };

    const handleReconnectFailed = (error) => {
      setIsReconnecting(false);
      setStreamError(error.message);
      showAlert('hard', 'Failed to reconnect camera. Please refresh the page.');
    };

    streamManager.on('streamError', handleStreamError);
    streamManager.on('reconnectAttempt', handleReconnectAttempt);
    streamManager.on('reconnectSuccess', handleReconnectSuccess);
    streamManager.on('reconnectFailed', handleReconnectFailed);

    return () => {
      streamManager.off('streamError');
      streamManager.off('reconnectAttempt');
      streamManager.off('reconnectSuccess');
      streamManager.off('reconnectFailed');
    };
  }, [streamManager, onStreamError, onStreamReconnected, showAlert]);

  const togglePreview = useCallback(() => {
    updatePrivacySettings({
      videoPreviewEnabled: !privacySettings.videoPreviewEnabled,
    });
  }, [privacySettings.videoPreviewEnabled, updatePrivacySettings]);

  const handleManualReconnect = useCallback(async () => {
    if (!streamManager) return;

    try {
      setIsReconnecting(true);
      await streamManager.reconnect();
    } catch (error) {
      console.error('Manual reconnect failed:', error);
    }
  }, [streamManager]);

  return (
    <div className={`relative ${className}`}>
      {/* Video Preview */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden">
        {privacySettings.videoPreviewEnabled && stream ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} // Mirror the video
          />
        ) : (
          <div className="w-full h-48 flex items-center justify-center bg-gray-800">
            <div className="text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">
                {!stream ? 'No camera stream' : 'Preview disabled'}
              </p>
            </div>
          </div>
        )}

        {/* Status Overlays */}
        {isReconnecting && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-center text-white">
              <svg className="animate-spin w-8 h-8 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm">Reconnecting...</p>
            </div>
          </div>
        )}

        {streamError && !isReconnecting && (
          <div className="absolute inset-0 bg-red-900 bg-opacity-75 flex items-center justify-center">
            <div className="text-center text-white p-4">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm mb-2">Camera Error</p>
              <p className="text-xs opacity-75 mb-3">{streamError}</p>
              {streamManager && (
                <button
                  onClick={handleManualReconnect}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded transition-colors"
                >
                  Retry Connection
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={togglePreview}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                privacySettings.videoPreviewEnabled
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {privacySettings.videoPreviewEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                )}
              </svg>
              <span>{privacySettings.videoPreviewEnabled ? 'Hide Preview' : 'Show Preview'}</span>
            </button>
          </div>

          {/* Stream Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              stream && !streamError ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-xs text-gray-600">
              {stream && !streamError ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};