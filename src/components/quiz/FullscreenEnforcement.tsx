/**
 * FullscreenEnforcement - Component for enforcing and managing fullscreen mode
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Maximize, X } from 'lucide-react';

export interface FullscreenEnforcementProps {
  isRequired: boolean;
  isFullscreen: boolean;
  onRequestFullscreen: () => Promise<boolean>;
  onDismiss?: () => void;
  className?: string;
}

export const FullscreenEnforcement: React.FC<FullscreenEnforcementProps> = ({
  isRequired,
  isFullscreen,
  onRequestFullscreen,
  onDismiss,
  className = ''
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);

  // Show modal when fullscreen is required but not active
  const shouldShow = isRequired && !isFullscreen;

  const handleRequestFullscreen = async () => {
    setIsRequesting(true);
    setRequestFailed(false);

    try {
      const success = await onRequestFullscreen();
      if (!success) {
        setRequestFailed(true);
      }
    } catch (error) {
      console.error('Fullscreen request failed:', error);
      setRequestFailed(true);
    } finally {
      setIsRequesting(false);
    }
  };

  // Reset failed state when fullscreen status changes
  useEffect(() => {
    if (isFullscreen) {
      setRequestFailed(false);
    }
  }, [isFullscreen]);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-semibold text-gray-900">
              Fullscreen Required
            </h2>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            This quiz requires fullscreen mode to ensure academic integrity. 
            Please enable fullscreen to continue.
          </p>
          
          {requestFailed && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-red-700 text-sm">
                Failed to enable fullscreen mode. Please try again or check your browser settings.
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-blue-700 text-sm">
              <strong>Note:</strong> Exiting fullscreen mode during the quiz will be flagged 
              as a potential integrity violation.
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleRequestFullscreen}
            disabled={isRequesting}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                     flex items-center justify-center space-x-2"
          >
            <Maximize className="w-4 h-4" />
            <span>
              {isRequesting ? 'Requesting...' : 'Enable Fullscreen'}
            </span>
          </button>
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>
            If you&apos;re having trouble with fullscreen mode, try using F11 or check your 
            browser&apos;s fullscreen settings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FullscreenEnforcement;