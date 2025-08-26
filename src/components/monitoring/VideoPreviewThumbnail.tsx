/**
 * Video preview thumbnail with privacy controls
 */

import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';

interface VideoPreviewThumbnailProps {
  stream: MediaStream | null;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  showControls?: boolean;
  showOverlay?: boolean;
}

export const VideoPreviewThumbnail: React.FC<VideoPreviewThumbnailProps> = ({
  stream,
  className = '',
  size = 'medium',
  showControls = true,
  showOverlay = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { privacySettings, updatePrivacySettings, currentSignals } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPrivacyMask, setShowPrivacyMask] = useState(false);

  // Set up video element with stream
  useEffect(() => {
    if (videoRef.current && stream && privacySettings.videoPreviewEnabled) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream, privacySettings.videoPreviewEnabled]);

  // Draw privacy mask or landmarks overlay
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !showOverlay) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawOverlay = () => {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (showPrivacyMask) {
        // Draw privacy mask
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add privacy message
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Privacy Mode', canvas.width / 2, canvas.height / 2);
        ctx.font = '12px Arial';
        ctx.fillText('Video processing active', canvas.width / 2, canvas.height / 2 + 20);
      } else if (currentSignals?.landmarks) {
        // Draw face landmarks (simplified)
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#3b82f6';

        // Draw face outline (simplified)
        if (currentSignals.faceDetected) {
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const faceWidth = canvas.width * 0.3;
          const faceHeight = canvas.height * 0.4;

          ctx.strokeRect(
            centerX - faceWidth / 2,
            centerY - faceHeight / 2,
            faceWidth,
            faceHeight
          );

          // Draw eye indicators
          const eyeY = centerY - faceHeight * 0.1;
          const eyeSize = 4;
          
          // Left eye
          ctx.fillRect(centerX - faceWidth * 0.15 - eyeSize / 2, eyeY - eyeSize / 2, eyeSize, eyeSize);
          // Right eye
          ctx.fillRect(centerX + faceWidth * 0.15 - eyeSize / 2, eyeY - eyeSize / 2, eyeSize, eyeSize);

          // Draw gaze direction indicator
          if (currentSignals.gazeVector && currentSignals.eyesOnScreen) {
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            const gazeLength = 30;
            const gazeX = centerX + currentSignals.gazeVector.x * gazeLength;
            const gazeY = eyeY + currentSignals.gazeVector.y * gazeLength;
            
            ctx.beginPath();
            ctx.moveTo(centerX, eyeY);
            ctx.lineTo(gazeX, gazeY);
            ctx.stroke();
          }
        }

        // Draw status indicators
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillStyle = currentSignals.eyesOnScreen ? '#10b981' : '#ef4444';
        ctx.fillText(
          currentSignals.eyesOnScreen ? '✓ Eyes On Screen' : '✗ Eyes Off Screen',
          10,
          canvas.height - 10
        );
      }
    };

    const interval = setInterval(drawOverlay, 100); // Update overlay 10 times per second
    return () => clearInterval(interval);
  }, [currentSignals, showOverlay, showPrivacyMask]);

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-24 h-18';
      case 'large':
        return 'w-64 h-48';
      default:
        return 'w-32 h-24';
    }
  };

  const togglePreview = () => {
    updatePrivacySettings({
      videoPreviewEnabled: !privacySettings.videoPreviewEnabled,
    });
  };

  const togglePrivacyMask = () => {
    setShowPrivacyMask(!showPrivacyMask);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main video container */}
      <div className={`
        relative bg-gray-900 rounded-lg overflow-hidden border-2 transition-all duration-300
        ${isExpanded ? 'w-64 h-48' : getSizeClasses()}
        ${privacySettings.videoPreviewEnabled ? 'border-green-500' : 'border-gray-600'}
      `}>
        {privacySettings.videoPreviewEnabled && stream ? (
          <>
            {/* Video element */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} // Mirror the video
            />
            
            {/* Overlay canvas */}
            {showOverlay && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="text-center text-gray-400">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-xs">
                {!stream ? 'No Stream' : 'Preview Off'}
              </p>
            </div>
          </div>
        )}

        {/* Status indicators overlay */}
        <div className="absolute top-2 left-2 flex space-x-1">
          {/* Recording indicator */}
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Monitoring active" />
          
          {/* Privacy mask indicator */}
          {showPrivacyMask && (
            <div className="w-2 h-2 bg-blue-500 rounded-full" title="Privacy mask active" />
          )}
        </div>

        {/* Expand button */}
        {showControls && (
          <button
            onClick={toggleExpanded}
            className="absolute top-2 right-2 w-6 h-6 bg-black bg-opacity-50 hover:bg-opacity-75 rounded text-white text-xs flex items-center justify-center transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={togglePreview}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                privacySettings.videoPreviewEnabled
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {privacySettings.videoPreviewEnabled ? 'Hide' : 'Show'}
            </button>
            
            {privacySettings.videoPreviewEnabled && (
              <button
                onClick={togglePrivacyMask}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  showPrivacyMask
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showPrivacyMask ? 'Unmask' : 'Mask'}
              </button>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              stream && privacySettings.videoPreviewEnabled ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            <span className="text-gray-600">
              {stream && privacySettings.videoPreviewEnabled ? 'Live' : 'Off'}
            </span>
          </div>
        </div>
      )}

      {/* Privacy notice */}
      {privacySettings.videoPreviewEnabled && (
        <div className="mt-1 text-xs text-gray-500 text-center">
          Video processed locally only
        </div>
      )}
    </div>
  );
};