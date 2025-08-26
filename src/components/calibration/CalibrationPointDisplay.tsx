/**
 * Enhanced calibration point display system with visual feedback
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CalibrationPoint } from '../../lib/calibration/types';
import { MediaPipeResults } from '../../types/common';

interface CalibrationPointDisplayProps {
  points: CalibrationPoint[];
  currentPointIndex: number;
  onPointComplete: (pointIndex: number, data: MediaPipeResults) => void;
  showProgress?: boolean;
  allowRetry?: boolean;
  pointDuration?: number;
}

export const CalibrationPointDisplay: React.FC<CalibrationPointDisplayProps> = ({
  points,
  currentPointIndex,
  onPointComplete,
  showProgress = true,
  allowRetry = true,
  pointDuration = 3000
}) => {
  const [isActive, setIsActive] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [pointStartTime, setPointStartTime] = useState(0);

  const currentPoint = points[currentPointIndex];

  // Start point display when currentPointIndex changes
  useEffect(() => {
    if (currentPoint && !currentPoint.completed) {
      startPointDisplay();
    }
  }, [currentPointIndex, currentPoint]);

  const startPointDisplay = useCallback(() => {
    setIsActive(true);
    setPointStartTime(Date.now());
    setCountdown(pointDuration);

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 100) {
          clearInterval(interval);
          completePoint();
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [pointDuration]);

  const completePoint = useCallback(() => {
    if (!currentPoint) return;

    const completionData = {
      pointId: currentPoint.id,
      position: { x: currentPoint.x, y: currentPoint.y },
      startTime: pointStartTime,
      endTime: Date.now(),
      duration: Date.now() - pointStartTime,
      // Mock gaze data - in real implementation this would come from eye tracking
      gazeAccuracy: 0.85 + Math.random() * 0.1,
      gazeStability: 0.8 + Math.random() * 0.15
    };

    setIsActive(false);
    onPointComplete(currentPointIndex, completionData);
  }, [currentPoint, currentPointIndex, pointStartTime, onPointComplete]);

  const getPointStyle = (point: CalibrationPoint, index: number) => {
    const baseStyle = {
      position: 'absolute' as const,
      left: `${point.x * 100}%`,
      top: `${point.y * 100}%`,
      transform: 'translate(-50%, -50%)',
      transition: 'all 0.3s ease-in-out'
    };

    if (index === currentPointIndex && isActive) {
      return {
        ...baseStyle,
        zIndex: 10
      };
    }

    return {
      ...baseStyle,
      zIndex: point.completed ? 5 : 1
    };
  };

  const getPointClassName = (point: CalibrationPoint, index: number) => {
    const baseClasses = 'rounded-full flex items-center justify-center font-bold';
    
    if (index === currentPointIndex && isActive) {
      return `${baseClasses} w-16 h-16 bg-blue-500 text-white shadow-lg animate-pulse`;
    }
    
    if (point.completed) {
      return `${baseClasses} w-8 h-8 bg-green-500 text-white`;
    }
    
    if (index < currentPointIndex) {
      return `${baseClasses} w-6 h-6 bg-gray-500 text-white opacity-50`;
    }
    
    return `${baseClasses} w-6 h-6 bg-gray-300 text-gray-600 opacity-30`;
  };

  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* Calibration points */}
      {points.map((point, index) => (
        <div
          key={point.id}
          style={getPointStyle(point, index)}
          className={getPointClassName(point, index)}
        >
          {index === currentPointIndex && isActive ? (
            <div className="relative">
              {/* Countdown ring */}
              <svg className="absolute inset-0 w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="4"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="white"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (countdown / pointDuration)}`}
                  className="transition-all duration-100 ease-linear"
                />
              </svg>
              
              {/* Center dot */}
              <div className="w-4 h-4 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
          ) : point.completed ? (
            '✓'
          ) : (
            index + 1
          )}
        </div>
      ))}

      {/* Progress indicator */}
      {showProgress && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 rounded-lg p-4">
          <div className="text-white text-sm mb-2">
            Calibration Progress
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-32 bg-gray-600 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(points.filter(p => p.completed).length / points.length) * 100}%` 
                }}
              />
            </div>
            <span className="text-white text-xs">
              {points.filter(p => p.completed).length}/{points.length}
            </span>
          </div>
        </div>
      )}

      {/* Current point instructions */}
      {currentPoint && isActive && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 rounded-lg p-4 text-center">
          <div className="text-white text-lg font-semibold mb-2">
            Look at the blue dot
          </div>
          <div className="text-gray-300 text-sm">
            Keep your head still and focus on the center
          </div>
          <div className="text-blue-400 text-xs mt-2">
            Point {currentPointIndex + 1} of {points.length}
          </div>
        </div>
      )}

      {/* Completion message */}
      {points.every(p => p.completed) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-green-600 rounded-lg p-6 text-center">
            <div className="text-white text-2xl font-bold mb-2">
              ✓ Gaze Calibration Complete!
            </div>
            <div className="text-green-100 text-sm">
              Processing calibration data...
            </div>
          </div>
        </div>
      )}

      {/* Retry option for failed points */}
      {allowRetry && currentPoint && !currentPoint.completed && (
        <div className="absolute top-4 right-4 bg-yellow-600 rounded-lg p-3">
          <div className="text-white text-sm">
            Retrying point {currentPointIndex + 1}
          </div>
          <div className="text-yellow-100 text-xs">
            Calibrating...
          </div>
        </div>
      )}

      {/* Quality indicators for completed points */}
      {points.some(p => p.completed && p.quality !== undefined) && (
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 rounded-lg p-3">
          <div className="text-white text-xs mb-1">Point Quality</div>
          <div className="flex space-x-1">
            {points.map((point, index) => (
              point.completed && point.quality !== undefined ? (
                <div
                  key={point.id}
                  className={`w-2 h-2 rounded-full ${
                    point.quality > 0.8 
                      ? 'bg-green-500' 
                      : point.quality > 0.6 
                      ? 'bg-yellow-500' 
                      : 'bg-red-500'
                  }`}
                  title={`Point ${index + 1}: ${Math.round(point.quality * 100)}%`}
                />
              ) : (
                <div key={point.id} className="w-2 h-2 rounded-full bg-gray-600" />
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
};