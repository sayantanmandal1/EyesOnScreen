/**
 * CalibrationDots - 9-point calibration dot display system
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CalibrationPoint } from '../../lib/calibration/types';
import { MediaPipeResults } from '../../types/common';

interface CalibrationDotsProps {
  points: CalibrationPoint[];
  onComplete: (data: { points: CalibrationPoint[]; quality: number }) => void;
  isProcessing: boolean;
}

export const CalibrationDots: React.FC<CalibrationDotsProps> = ({
  points,
  onComplete,
  isProcessing
}) => {
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectedData, setCollectedData] = useState<MediaPipeResults[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(true);

  // Start countdown when component mounts
  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      setShowCountdown(false);
      startCalibration();
    }
  }, [countdown, showCountdown]);

  const startCalibration = useCallback(() => {
    setCurrentPointIndex(0);
    setIsCollecting(true);
  }, []);

  // Handle point collection
  useEffect(() => {
    if (!isCollecting || currentPointIndex >= points.length) return;

    const collectPointData = async () => {
      // Wait for point to be displayed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Collect gaze data for this point (mock implementation)
      const pointData = {
        screenPoint: {
          x: points[currentPointIndex].x * window.innerWidth,
          y: points[currentPointIndex].y * window.innerHeight
        },
        gazePoint: {
          x: points[currentPointIndex].x * window.innerWidth + (Math.random() - 0.5) * 20,
          y: points[currentPointIndex].y * window.innerHeight + (Math.random() - 0.5) * 20
        },
        timestamp: Date.now(),
        confidence: 0.8 + Math.random() * 0.2,
        headPose: { yaw: 0, pitch: 0, roll: 0 }
      };

      setCollectedData(prev => [...prev, pointData]);
      
      // Move to next point or complete
      if (currentPointIndex < points.length - 1) {
        setCurrentPointIndex(currentPointIndex + 1);
      } else {
        completeCalibration();
      }
    };

    const timer = setTimeout(collectPointData, 2000); // Show each point for 2 seconds
    return () => clearTimeout(timer);
  }, [isCollecting, currentPointIndex, points]);

  const completeCalibration = useCallback(() => {
    setIsCollecting(false);
    onComplete({
      type: 'gaze-calibration',
      data: collectedData,
      quality: calculateCalibrationQuality(collectedData)
    });
  }, [collectedData, onComplete]);

  const calculateCalibrationQuality = (data: MediaPipeResults[]): number => {
    // Simple quality calculation based on data consistency
    if (data.length < points.length) return 0;
    
    const avgConfidence = data.reduce((sum, d) => sum + d.confidence, 0) / data.length;
    return Math.min(avgConfidence, 1.0);
  };

  if (showCountdown) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl font-bold text-white mb-4">
            {countdown || 'GO!'}
          </div>
          <p className="text-gray-300">
            Get ready to look at the calibration points
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Calibration points */}
      {points.map((point, index) => (
        <CalibrationDot
          key={point.id}
          point={point}
          isActive={index === currentPointIndex && isCollecting}
          isCompleted={index < currentPointIndex}
        />
      ))}

      {/* Progress indicator */}
      {isCollecting && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-gray-800 rounded-lg px-4 py-2">
            <div className="text-white text-sm">
              Point {currentPointIndex + 1} of {points.length}
            </div>
            <div className="w-48 bg-gray-600 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentPointIndex + 1) / points.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Completion message */}
      {!isCollecting && currentPointIndex >= points.length && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-green-400 text-2xl mb-2">✓</div>
            <div className="text-white text-lg">Gaze calibration complete!</div>
            <div className="text-gray-300 text-sm mt-2">
              Processing calibration data...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CalibrationDotProps {
  point: CalibrationPoint;
  isActive: boolean;
  isCompleted: boolean;
}

const CalibrationDot: React.FC<CalibrationDotProps> = ({
  point,
  isActive,
  isCompleted
}) => {
  const style = {
    position: 'absolute' as const,
    left: `${point.x * 100}%`,
    top: `${point.y * 100}%`,
    transform: 'translate(-50%, -50%)',
    transition: 'all 0.3s ease-in-out'
  };

  return (
    <div style={style}>
      <div
        className={`
          w-6 h-6 rounded-full border-2 transition-all duration-300
          ${isActive 
            ? 'bg-blue-500 border-blue-300 scale-150 animate-pulse' 
            : isCompleted
            ? 'bg-green-500 border-green-300'
            : 'bg-gray-600 border-gray-400 opacity-50'
          }
        `}
      >
        {isCompleted && (
          <div className="flex items-center justify-center h-full">
            <span className="text-white text-xs">✓</span>
          </div>
        )}
      </div>
      
      {/* Ripple effect for active dot */}
      {isActive && (
        <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-75" />
      )}
    </div>
  );
};