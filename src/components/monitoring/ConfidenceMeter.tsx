/**
 * Confidence meter with sparkline visualization
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';

interface ConfidenceMeterProps {
  className?: string;
  showSparkline?: boolean;
  historyLength?: number;
  updateInterval?: number;
}

interface ConfidenceData {
  timestamp: number;
  overall: number;
  gaze: number;
  headPose: number;
  environment: number;
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  className = '',
  showSparkline = true,
  historyLength = 60, // 60 data points for 1 minute at 1Hz
  updateInterval = 1000 // Update every second
}) => {
  const { currentSignals, monitoring } = useAppStore();
  const [confidenceHistory, setConfidenceHistory] = useState<ConfidenceData[]>([]);
  const [currentConfidence, setCurrentConfidence] = useState<ConfidenceData>({
    timestamp: Date.now(),
    overall: 0,
    gaze: 0,
    headPose: 0,
    environment: 0
  });

  const intervalRef = useRef<NodeJS.Timeout>();

  // Update confidence data
  useEffect(() => {
    const updateConfidence = () => {
      if (!currentSignals) return;

      const gazeConfidence = currentSignals.gazeVector?.confidence || 0;
      const headPoseConfidence = currentSignals.headPose?.confidence || 0;
      const environmentConfidence = currentSignals.environmentScore ? 
        (currentSignals.environmentScore.lighting + currentSignals.environmentScore.shadowStability) / 2 : 0;
      
      // Calculate overall confidence as weighted average
      const overallConfidence = (
        gazeConfidence * 0.4 +
        headPoseConfidence * 0.3 +
        environmentConfidence * 0.3
      );

      const newData: ConfidenceData = {
        timestamp: Date.now(),
        overall: overallConfidence,
        gaze: gazeConfidence,
        headPose: headPoseConfidence,
        environment: environmentConfidence
      };

      setCurrentConfidence(newData);

      // Add to history
      setConfidenceHistory(prev => {
        const updated = [...prev, newData];
        return updated.slice(-historyLength); // Keep only recent data
      });
    };

    if (monitoring.isActive) {
      intervalRef.current = setInterval(updateConfidence, updateInterval);
      updateConfidence(); // Initial update
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentSignals, monitoring.isActive, historyLength, updateInterval]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'Excellent';
    if (confidence >= 0.6) return 'Good';
    if (confidence >= 0.4) return 'Fair';
    return 'Poor';
  };

  const formatPercentage = (value: number) => Math.round(value * 100);

  // Generate sparkline path
  const generateSparklinePath = (data: number[], width: number, height: number) => {
    if (data.length < 2) return '';

    const maxValue = Math.max(...data, 1);
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - minValue) / range) * height;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  const sparklineWidth = 120;
  const sparklineHeight = 40;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Confidence Meter
        </h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            monitoring.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`} />
          <span className="text-sm text-gray-600">
            {monitoring.isActive ? 'Live' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Overall confidence display */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Confidence</span>
          <span className={`text-sm font-medium px-2 py-1 rounded ${
            getConfidenceColor(currentConfidence.overall)
          }`}>
            {getConfidenceLabel(currentConfidence.overall)}
          </span>
        </div>
        
        {/* Confidence bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              currentConfidence.overall >= 0.8 
                ? 'bg-green-500' 
                : currentConfidence.overall >= 0.6 
                ? 'bg-yellow-500' 
                : 'bg-red-500'
            }`}
            style={{ width: `${formatPercentage(currentConfidence.overall)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span className="font-medium">
            {formatPercentage(currentConfidence.overall)}%
          </span>
          <span>100%</span>
        </div>
      </div>

      {/* Individual confidence metrics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Gaze</div>
          <div className={`text-lg font-bold ${
            currentConfidence.gaze >= 0.7 ? 'text-green-600' : 
            currentConfidence.gaze >= 0.5 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {formatPercentage(currentConfidence.gaze)}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
            <div
              className={`h-1 rounded-full ${
                currentConfidence.gaze >= 0.7 ? 'bg-green-500' : 
                currentConfidence.gaze >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${formatPercentage(currentConfidence.gaze)}%` }}
            />
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Head Pose</div>
          <div className={`text-lg font-bold ${
            currentConfidence.headPose >= 0.7 ? 'text-green-600' : 
            currentConfidence.headPose >= 0.5 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {formatPercentage(currentConfidence.headPose)}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
            <div
              className={`h-1 rounded-full ${
                currentConfidence.headPose >= 0.7 ? 'bg-green-500' : 
                currentConfidence.headPose >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${formatPercentage(currentConfidence.headPose)}%` }}
            />
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Environment</div>
          <div className={`text-lg font-bold ${
            currentConfidence.environment >= 0.7 ? 'text-green-600' : 
            currentConfidence.environment >= 0.5 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {formatPercentage(currentConfidence.environment)}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
            <div
              className={`h-1 rounded-full ${
                currentConfidence.environment >= 0.7 ? 'bg-green-500' : 
                currentConfidence.environment >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${formatPercentage(currentConfidence.environment)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sparkline visualization */}
      {showSparkline && confidenceHistory.length > 1 && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Confidence Trend</span>
            <span className="text-xs text-gray-500">
              Last {Math.min(confidenceHistory.length, historyLength)} readings
            </span>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3">
            <svg width={sparklineWidth} height={sparklineHeight} className="w-full">
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Overall confidence line */}
              <path
                d={generateSparklinePath(
                  confidenceHistory.map(d => d.overall),
                  sparklineWidth,
                  sparklineHeight
                )}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                className="drop-shadow-sm"
              />
              
              {/* Gaze confidence line */}
              <path
                d={generateSparklinePath(
                  confidenceHistory.map(d => d.gaze),
                  sparklineWidth,
                  sparklineHeight
                )}
                fill="none"
                stroke="#10b981"
                strokeWidth="1"
                opacity="0.7"
              />
              
              {/* Head pose confidence line */}
              <path
                d={generateSparklinePath(
                  confidenceHistory.map(d => d.headPose),
                  sparklineWidth,
                  sparklineHeight
                )}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1"
                opacity="0.7"
              />
              
              {/* Environment confidence line */}
              <path
                d={generateSparklinePath(
                  confidenceHistory.map(d => d.environment),
                  sparklineWidth,
                  sparklineHeight
                )}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="1"
                opacity="0.7"
              />
            </svg>
            
            {/* Legend */}
            <div className="flex items-center justify-center space-x-4 mt-2 text-xs">
              <div className="flex items-center">
                <div className="w-3 h-0.5 bg-blue-500 mr-1"></div>
                <span className="text-gray-600">Overall</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-0.5 bg-green-500 mr-1"></div>
                <span className="text-gray-600">Gaze</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-0.5 bg-yellow-500 mr-1"></div>
                <span className="text-gray-600">Head</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-0.5 bg-purple-500 mr-1"></div>
                <span className="text-gray-600">Env</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      {confidenceHistory.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Average (1min):</span>
              <div className="font-medium">
                {formatPercentage(
                  confidenceHistory.reduce((sum, d) => sum + d.overall, 0) / confidenceHistory.length
                )}%
              </div>
            </div>
            <div>
              <span className="text-gray-500">Stability:</span>
              <div className="font-medium">
                {confidenceHistory.length > 1 ? (
                  Math.abs(
                    confidenceHistory[confidenceHistory.length - 1].overall - 
                    confidenceHistory[0].overall
                  ) < 0.1 ? 'Stable' : 'Variable'
                ) : 'Unknown'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};