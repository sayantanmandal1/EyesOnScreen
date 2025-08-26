/**
 * Real-time monitoring status display with indicators for eyes, head pose, and lighting
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';

export const MonitoringStatusDisplay = ({
  className = '',
  compact = false,
  showDetails = true
}) => {
  const { currentSignals, monitoring, privacySettings } = useAppStore();
  const [lastUpdateTime, setLastUpdateTime] = useState(0);

  useEffect(() => {
    if (currentSignals) {
      setLastUpdateTime(Date.now());
    }
  }, [currentSignals]);

  const getStatusColor = (isGood, confidence = 1) => {
    if (!isGood) return 'text-red-500 bg-red-100';
    if (confidence < 0.7) return 'text-yellow-500 bg-yellow-100';
    return 'text-green-500 bg-green-100';
  };

  const getStatusIcon = (isGood, confidence = 1) => {
    if (!isGood) return '❌';
    if (confidence < 0.7) return '⚠️';
    return '✅';
  };

  const formatConfidence = (confidence) => {
    return Math.round(confidence * 100);
  };

  const isStale = Date.now() - lastUpdateTime > 2000; // 2 seconds

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {/* Compact status indicators */}
        <div className="flex items-center space-x-1">
          <div
            className={`w-3 h-3 rounded-full ${
              currentSignals?.eyesOnScreen 
                ? 'bg-green-500' 
                : 'bg-red-500'
            } ${isStale ? 'opacity-50' : ''}`}
            title="Eyes on screen"
          />
          <div
            className={`w-3 h-3 rounded-full ${
              currentSignals?.faceDetected 
                ? 'bg-green-500' 
                : 'bg-red-500'
            } ${isStale ? 'opacity-50' : ''}`}
            title="Face detected"
          />
          <div
            className={`w-3 h-3 rounded-full ${
              currentSignals?.environmentScore && currentSignals.environmentScore.lighting > 0.7
                ? 'bg-green-500' 
                : 'bg-yellow-500'
            } ${isStale ? 'opacity-50' : ''}`}
            title="Environment quality"
          />
        </div>
        
        {monitoring.isActive && (
          <div className="text-xs text-gray-500">
            Monitoring
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Monitoring Status
        </h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            monitoring.isActive && !isStale ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`} />
          <span className="text-sm text-gray-600">
            {monitoring.isActive ? (isStale ? 'Stale' : 'Active') : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Main status indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Eyes Status */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Eyes</span>
            <span className="text-lg">
              {getStatusIcon(currentSignals?.eyesOnScreen || false, currentSignals?.gazeVector?.confidence)}
            </span>
          </div>
          <div className={`text-sm font-medium ${
            getStatusColor(currentSignals?.eyesOnScreen || false, currentSignals?.gazeVector?.confidence)
          }`}>
            {currentSignals?.eyesOnScreen ? 'On Screen' : 'Off Screen'}
          </div>
          {showDetails && currentSignals?.gazeVector && (
            <div className="text-xs text-gray-500 mt-1">
              Confidence: {formatConfidence(currentSignals.gazeVector.confidence)}%
            </div>
          )}
        </div>

        {/* Head Pose Status */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Head Pose</span>
            <span className="text-lg">
              {getStatusIcon(
                currentSignals?.headPose ? 
                  Math.abs(currentSignals.headPose.yaw) < 20 && Math.abs(currentSignals.headPose.pitch) < 15 
                  : false,
                currentSignals?.headPose?.confidence
              )}
            </span>
          </div>
          <div className={`text-sm font-medium ${
            getStatusColor(
              currentSignals?.headPose ? 
                Math.abs(currentSignals.headPose.yaw) < 20 && Math.abs(currentSignals.headPose.pitch) < 15 
                : false,
              currentSignals?.headPose?.confidence
            )
          }`}>
            {currentSignals?.headPose ? 'Good Position' : 'Unknown'}
          </div>
          {showDetails && currentSignals?.headPose && (
            <div className="text-xs text-gray-500 mt-1">
              Y: {Math.round(currentSignals.headPose.yaw)}° 
              P: {Math.round(currentSignals.headPose.pitch)}°
            </div>
          )}
        </div>

        {/* Environment Status */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Environment</span>
            <span className="text-lg">
              {getStatusIcon(
                currentSignals?.environmentScore ? 
                  currentSignals.environmentScore.lighting > 0.7 && 
                  currentSignals.environmentScore.shadowStability > 0.8
                  : false
              )}
            </span>
          </div>
          <div className={`text-sm font-medium ${
            getStatusColor(
              currentSignals?.environmentScore ? 
                currentSignals.environmentScore.lighting > 0.7 && 
                currentSignals.environmentScore.shadowStability > 0.8
                : false
            )
          }`}>
            {currentSignals?.environmentScore ? 'Stable' : 'Unknown'}
          </div>
          {showDetails && currentSignals?.environmentScore && (
            <div className="text-xs text-gray-500 mt-1">
              Light: {formatConfidence(currentSignals.environmentScore.lighting)}%
            </div>
          )}
        </div>
      </div>

      {/* Detailed metrics */}
      {showDetails && currentSignals && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Detailed Metrics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-gray-500">Face Detected:</span>
              <div className="font-medium">
                {currentSignals.faceDetected ? 'Yes' : 'No'}
              </div>
            </div>
            
            {currentSignals.gazeVector && (
              <>
                <div>
                  <span className="text-gray-500">Gaze X:</span>
                  <div className="font-medium">
                    {currentSignals.gazeVector.x.toFixed(3)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Gaze Y:</span>
                  <div className="font-medium">
                    {currentSignals.gazeVector.y.toFixed(3)}
                  </div>
                </div>
              </>
            )}
            
            {currentSignals.headPose && (
              <div>
                <span className="text-gray-500">Head Roll:</span>
                <div className="font-medium">
                  {Math.round(currentSignals.headPose.roll)}°
                </div>
              </div>
            )}
            
            {currentSignals.environmentScore && (
              <>
                <div>
                  <span className="text-gray-500">Secondary Faces:</span>
                  <div className="font-medium">
                    {currentSignals.environmentScore.secondaryFaces}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Device Objects:</span>
                  <div className="font-medium">
                    {currentSignals.environmentScore.deviceLikeObjects}
                  </div>
                </div>
              </>
            )}
            
            <div>
              <span className="text-gray-500">Last Update:</span>
              <div className="font-medium">
                {isStale ? 'Stale' : 'Live'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance metrics */}
      {showDetails && monitoring.performanceMetrics && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Performance</h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-gray-500">FPS:</span>
              <div className="font-medium">
                {Math.round(monitoring.performanceMetrics.fps)}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Latency:</span>
              <div className="font-medium">
                {Math.round(monitoring.performanceMetrics.latency)}ms
              </div>
            </div>
            <div>
              <span className="text-gray-500">Memory:</span>
              <div className="font-medium">
                {Math.round(monitoring.performanceMetrics.memoryUsage)}MB
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy controls */}
      {privacySettings.videoPreviewEnabled && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Video preview enabled</span>
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};