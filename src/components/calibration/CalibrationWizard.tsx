/**
 * CalibrationWizard - Multi-step calibration interface with progress indicators
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { CalibrationStep, CalibrationPoint } from '../../lib/calibration/types';
import { CalibrationDots } from './CalibrationDots';
import { HeadMovementGuide } from './HeadMovementGuide';
import { EnvironmentCheck } from './EnvironmentCheck';
import { CalibrationProgress } from './CalibrationProgress';
import { CalibrationQualityFeedback } from './CalibrationQualityFeedback';

interface CalibrationWizardProps {
  onComplete: (success: boolean) => void;
  onCancel: () => void;
}

export const CalibrationWizard: React.FC<CalibrationWizardProps> = ({
  onComplete,
  onCancel
}) => {
  const { 
    calibrationSession, 
    setCalibrationSession,
    calibrationProfile,
    setCalibrationProfile 
  } = useAppStore();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQualityFeedback, setShowQualityFeedback] = useState(false);

  // Initialize calibration session
  useEffect(() => {
    if (!calibrationSession) {
      initializeCalibration();
    }
  }, []);

  const initializeCalibration = useCallback(() => {
    const steps: CalibrationStep[] = [
      {
        id: 'gaze-calibration',
        name: 'Gaze Calibration',
        description: 'Look at each dot as it appears on screen',
        duration: 30000, // 30 seconds
        points: generateCalibrationPoints(),
        instructions: [
          'Keep your head still and centered',
          'Look directly at each dot when it appears',
          'Wait for the dot to disappear before moving your eyes'
        ],
        completed: false
      },
      {
        id: 'head-pose-calibration', 
        name: 'Head Movement Calibration',
        description: 'Follow the guided head movements',
        duration: 15000, // 15 seconds
        instructions: [
          'Move your head slowly in each direction',
          'Keep your eyes looking at the center',
          'Return to center position between movements'
        ],
        completed: false
      },
      {
        id: 'environment-baseline',
        name: 'Environment Setup',
        description: 'Establishing lighting and environment baseline',
        duration: 10000, // 10 seconds
        instructions: [
          'Sit still and look at the camera',
          'Ensure consistent lighting',
          'Remove any distracting objects from view'
        ],
        completed: false
      }
    ];

    const session = {
      id: `calibration-${Date.now()}`,
      startTime: Date.now(),
      steps,
      currentStepIndex: 0,
      overallQuality: 0,
      status: 'in-progress' as const
    };

    setCalibrationSession(session);
  }, [setCalibrationSession]);

  const generateCalibrationPoints = (): CalibrationPoint[] => {
    const points: CalibrationPoint[] = [];
    const positions = [
      { x: 0.1, y: 0.1 }, // Top-left
      { x: 0.5, y: 0.1 }, // Top-center
      { x: 0.9, y: 0.1 }, // Top-right
      { x: 0.1, y: 0.5 }, // Middle-left
      { x: 0.5, y: 0.5 }, // Center
      { x: 0.9, y: 0.5 }, // Middle-right
      { x: 0.1, y: 0.9 }, // Bottom-left
      { x: 0.5, y: 0.9 }, // Bottom-center
      { x: 0.9, y: 0.9 }  // Bottom-right
    ];

    positions.forEach((pos, index) => {
      points.push({
        id: `point-${index}`,
        x: pos.x,
        y: pos.y,
        completed: false
      });
    });

    return points;
  };

  const handleStepComplete = useCallback(async (stepData: any) => {
    if (!calibrationSession) return;

    setIsProcessing(true);
    
    try {
      // Update current step as completed
      const updatedSteps = [...calibrationSession.steps];
      updatedSteps[currentStep] = {
        ...updatedSteps[currentStep],
        completed: true
      };

      const updatedSession = {
        ...calibrationSession,
        steps: updatedSteps,
        currentStepIndex: currentStep + 1
      };

      setCalibrationSession(updatedSession);

      // Check if all steps are completed
      if (currentStep >= calibrationSession.steps.length - 1) {
        await finalizeCalibration(updatedSession);
      } else {
        setCurrentStep(currentStep + 1);
      }
    } catch (error) {
      console.error('Error completing calibration step:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [calibrationSession, currentStep, setCalibrationSession]);

  const finalizeCalibration = async (session: any) => {
    // Calculate overall quality and create calibration profile
    const quality = calculateOverallQuality(session);
    
    if (quality >= 0.8) {
      // Create calibration profile from session data
      const profile = await createCalibrationProfile(session);
      setCalibrationProfile(profile);
      
      const finalSession = {
        ...session,
        endTime: Date.now(),
        overallQuality: quality,
        profile,
        status: 'completed' as const
      };
      
      setCalibrationSession(finalSession);
      onComplete(true);
    } else {
      setShowQualityFeedback(true);
    }
  };

  const calculateOverallQuality = (session: any): number => {
    // Placeholder implementation - will be enhanced in task 4.2
    return 0.85; // Mock quality score
  };

  const createCalibrationProfile = async (session: any) => {
    // Placeholder implementation - will be enhanced in task 4.2
    return {
      ipd: 65, // Mock interpupillary distance
      earBaseline: 0.3,
      gazeMapping: {
        homography: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        bias: [0, 0]
      },
      headPoseBounds: {
        yawRange: [-20, 20] as [number, number],
        pitchRange: [-15, 15] as [number, number]
      },
      lightingBaseline: {
        histogram: new Array(256).fill(0),
        mean: 128,
        variance: 50
      },
      quality: 0.85
    };
  }; 
 const handleRetryCalibration = () => {
    setShowQualityFeedback(false);
    setCurrentStep(0);
    initializeCalibration();
  };

  if (!calibrationSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white">Initializing calibration...</div>
      </div>
    );
  }

  if (showQualityFeedback) {
    return (
      <CalibrationQualityFeedback
        quality={calibrationSession.overallQuality}
        onRetry={handleRetryCalibration}
        onCancel={onCancel}
      />
    );
  }

  const currentStepData = calibrationSession.steps[currentStep];

  return (
    <div className="fixed inset-0 bg-gray-900 z-50">
      <div className="flex flex-col h-full">
        {/* Header with progress */}
        <div className="bg-gray-800 p-4">
          <CalibrationProgress
            steps={calibrationSession.steps}
            currentStep={currentStep}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {currentStepData.name}
            </h2>
            <p className="text-gray-300 mb-4">
              {currentStepData.description}
            </p>
            
            {/* Instructions */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">Instructions:</h3>
              <ul className="text-gray-300 text-left space-y-1">
                {currentStepData.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-400 mr-2">•</span>
                    {instruction}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Step-specific content */}
          <div className="flex-1 w-full max-w-4xl">
            {currentStepData.id === 'gaze-calibration' && (
              <CalibrationDots
                points={currentStepData.points || []}
                onComplete={handleStepComplete}
                isProcessing={isProcessing}
              />
            )}
            
            {currentStepData.id === 'head-pose-calibration' && (
              <HeadMovementGuide
                onComplete={handleStepComplete}
                isProcessing={isProcessing}
              />
            )}
            
            {currentStepData.id === 'environment-baseline' && (
              <EnvironmentCheck
                onComplete={handleStepComplete}
                isProcessing={isProcessing}
              />
            )}
          </div>
        </div>

        {/* Footer with controls */}
        <div className="bg-gray-800 p-4 flex justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            disabled={isProcessing}
          >
            Cancel
          </button>
          
          <div className="text-gray-400 text-sm">
            Step {currentStep + 1} of {calibrationSession.steps.length}
          </div>
        </div>
      </div>
    </div>
  );
};