/**
 * Re-calibration options and quality scoring display
 */

import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';

interface RecalibrationOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRecalibration: (options: RecalibrationConfig) => void;
}

interface RecalibrationConfig {
  fullRecalibration: boolean;
  selectedSteps: string[];
  quickMode: boolean;
  enhancedAccuracy: boolean;
}

export const RecalibrationOptions: React.FC<RecalibrationOptionsProps> = ({
  isOpen,
  onClose,
  onStartRecalibration
}) => {
  const { calibrationProfile } = useAppStore();
  const [config, setConfig] = useState<RecalibrationConfig>({
    fullRecalibration: false,
    selectedSteps: [],
    quickMode: false,
    enhancedAccuracy: false
  });

  if (!isOpen) return null;

  const calibrationSteps = [
    {
      id: 'gaze-calibration',
      name: 'Gaze Calibration',
      description: 'Re-calibrate eye tracking accuracy',
      duration: '30-45 seconds',
      recommended: calibrationProfile?.quality && calibrationProfile.quality < 0.85,
      currentQuality: calibrationProfile?.quality ? Math.round(calibrationProfile.quality * 100) : 0
    },
    {
      id: 'head-pose-calibration',
      name: 'Head Movement Range',
      description: 'Re-establish head movement boundaries',
      duration: '15-20 seconds',
      recommended: false,
      currentQuality: 85 // Mock quality for head pose
    },
    {
      id: 'environment-baseline',
      name: 'Environment Baseline',
      description: 'Update lighting and background baseline',
      duration: '10-15 seconds',
      recommended: true, // Often needs updating due to lighting changes
      currentQuality: 78 // Mock quality for environment
    }
  ];

  const handleStepToggle = (stepId: string) => {
    setConfig(prev => ({
      ...prev,
      selectedSteps: prev.selectedSteps.includes(stepId)
        ? prev.selectedSteps.filter(id => id !== stepId)
        : [...prev.selectedSteps, stepId]
    }));
  };

  const handleFullRecalibration = () => {
    setConfig({
      fullRecalibration: true,
      selectedSteps: calibrationSteps.map(step => step.id),
      quickMode: false,
      enhancedAccuracy: true
    });
  };

  const handleQuickRecalibration = () => {
    const recommendedSteps = calibrationSteps
      .filter(step => step.recommended)
      .map(step => step.id);
    
    setConfig({
      fullRecalibration: false,
      selectedSteps: recommendedSteps,
      quickMode: true,
      enhancedAccuracy: false
    });
  };

  const getEstimatedDuration = () => {
    if (config.fullRecalibration) {
      return config.enhancedAccuracy ? '90-120 seconds' : '60-90 seconds';
    }
    
    const selectedStepDurations = calibrationSteps
      .filter(step => config.selectedSteps.includes(step.id))
      .map(step => {
        switch (step.id) {
          case 'gaze-calibration': return config.enhancedAccuracy ? 45 : 30;
          case 'head-pose-calibration': return 20;
          case 'environment-baseline': return 15;
          default: return 10;
        }
      });
    
    const totalSeconds = selectedStepDurations.reduce((sum, duration) => sum + duration, 0);
    return `${totalSeconds}-${totalSeconds + 15} seconds`;
  };

  const canStartRecalibration = config.fullRecalibration || config.selectedSteps.length > 0;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recalibration-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 id="recalibration-title" className="text-xl font-semibold text-gray-900">
              Re-calibration Options
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="Close re-calibration options"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Current calibration quality */}
          {calibrationProfile && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Current Calibration Quality
              </h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Overall Quality</span>
                <span className={`text-sm font-medium ${
                  calibrationProfile.quality >= 0.8 
                    ? 'text-green-600' 
                    : calibrationProfile.quality >= 0.6 
                    ? 'text-yellow-600' 
                    : 'text-red-600'
                }`}>
                  {Math.round(calibrationProfile.quality * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    calibrationProfile.quality >= 0.8 
                      ? 'bg-green-500' 
                      : calibrationProfile.quality >= 0.6 
                      ? 'bg-yellow-500' 
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${calibrationProfile.quality * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Created {new Date(calibrationProfile.createdAt || Date.now()).toLocaleString()}
              </div>
            </div>
          )}

          {/* Quick options */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Quick Options
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={handleFullRecalibration}
                className={`p-4 border-2 rounded-lg text-left transition-colors ${
                  config.fullRecalibration
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">Full Re-calibration</div>
                <div className="text-sm text-gray-600 mt-1">
                  Complete calibration from scratch with enhanced accuracy
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  Recommended for best results
                </div>
              </button>
              
              <button
                onClick={handleQuickRecalibration}
                className={`p-4 border-2 rounded-lg text-left transition-colors ${
                  config.quickMode && !config.fullRecalibration
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">Quick Re-calibration</div>
                <div className="text-sm text-gray-600 mt-1">
                  Re-calibrate only the components that need improvement
                </div>
                <div className="text-xs text-green-600 mt-2">
                  Faster option
                </div>
              </button>
            </div>
          </div>

          {/* Individual step selection */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Custom Selection
            </h3>
            <div className="space-y-3">
              {calibrationSteps.map((step) => (
                <label
                  key={step.id}
                  className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                    config.selectedSteps.includes(step.id) || config.fullRecalibration
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={config.selectedSteps.includes(step.id) || config.fullRecalibration}
                    onChange={() => !config.fullRecalibration && handleStepToggle(step.id)}
                    disabled={config.fullRecalibration}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">
                        {step.name}
                        {step.recommended && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {step.duration}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {step.description}
                    </div>
                    <div className="flex items-center mt-2">
                      <span className="text-xs text-gray-500 mr-2">Current quality:</span>
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-1 mr-2">
                          <div
                            className={`h-1 rounded-full ${
                              step.currentQuality >= 80 
                                ? 'bg-green-500' 
                                : step.currentQuality >= 60 
                                ? 'bg-yellow-500' 
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${step.currentQuality}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">
                          {step.currentQuality}%
                        </span>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced options */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Advanced Options
            </h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.enhancedAccuracy}
                  onChange={(e) => setConfig(prev => ({ ...prev, enhancedAccuracy: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="ml-3">
                  <div className="font-medium text-gray-900">Enhanced Accuracy Mode</div>
                  <div className="text-sm text-gray-600">
                    Use more calibration points and longer collection time for better accuracy
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Summary */}
          {canStartRecalibration && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-900 mb-2">Re-calibration Summary</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <div>
                  <strong>Steps to re-calibrate:</strong> {
                    config.fullRecalibration 
                      ? 'All steps' 
                      : config.selectedSteps.length === 0 
                      ? 'None selected' 
                      : config.selectedSteps.map(id => 
                          calibrationSteps.find(s => s.id === id)?.name
                        ).join(', ')
                  }
                </div>
                <div>
                  <strong>Estimated duration:</strong> {getEstimatedDuration()}
                </div>
                {config.enhancedAccuracy && (
                  <div>
                    <strong>Mode:</strong> Enhanced accuracy (longer but more precise)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onStartRecalibration(config)}
            disabled={!canStartRecalibration}
            className={`px-6 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              canStartRecalibration
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Start Re-calibration
          </button>
        </div>
      </div>
    </div>
  );
};