/**
 * CalibrationWizard - Multi-step calibration interface with progress indicators
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { CalibrationDots } from './CalibrationDots';
import { HeadMovementGuide } from './HeadMovementGuide';
import { EnvironmentCheck } from './EnvironmentCheck';
import { CalibrationProgress } from './CalibrationProgress';
import { CalibrationQualityFeedback } from './CalibrationQualityFeedback';
import { useCameraManager } from '../../lib/camera/useCameraManager';

export const CalibrationWizard = ({
  onComplete,
  onCancel
}) => {
  const {
    calibrationSession,
    setCalibrationSession,
    setCalibrationProfile
  } = useAppStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQualityFeedback, setShowQualityFeedback] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Initialize camera manager
  const {
    currentStream,
    isInitializing: isCameraInitializing,
    initializeStream,
    cleanup: cleanupCamera
  } = useCameraManager({
    autoStart: true,
    onStreamError: (error) => {
      setCameraError(`Camera error: ${error.message}`);
    },
    onStreamReconnected: () => {
      setCameraError(null);
    }
  });

  // Initialize calibration session and ensure camera is ready
  useEffect(() => {
    if (!calibrationSession) {
      initializeCalibration();
    }
  }, []);

  // Ensure camera is active during calibration
  useEffect(() => {
    if (!currentStream && !isCameraInitializing) {
      initializeStream().catch((error) => {
        setCameraError(`Failed to initialize camera: ${error.message}`);
      });
    }
  }, [currentStream, isCameraInitializing, initializeStream]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      cleanupCamera();
    };
  }, [cleanupCamera]);

  const initializeCalibration = useCallback(() => {
    const steps = [
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
      status: 'in-progress'
    };

    setCalibrationSession(session);
  }, [setCalibrationSession]);

  const generateCalibrationPoints = () => {
    const points = [];
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

  const handleStepComplete = useCallback(async () => {
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

  const finalizeCalibration = async (session) => {
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
        status: 'completed'
      };

      setCalibrationSession(finalSession);
      onComplete(true);
    } else {
      setShowQualityFeedback(true);
    }
  };

  const calculateOverallQuality = () => {
    // Placeholder implementation - will be enhanced in task 4.2
    return 0.85; // Mock quality score
  };

  const createCalibrationProfile = async () => {
    // Placeholder implementation - will be enhanced in task 4.2
    return {
      ipd: 65, // Mock interpupillary distance
      earBaseline: 0.3,
      gazeMapping: {
        homography: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        bias: [0, 0]
      },
      headPoseBounds: {
        yawRange: [-20, 20],
        pitchRange: [-15, 15]
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

  // Show camera error if present
  if (cameraError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Camera Error</div>
          <div className="text-gray-300 mb-6">{cameraError}</div>
          <div className="space-x-4">
            <button
              onClick={() => {
                setCameraError(null);
                initializeStream().catch((error) => {
                  setCameraError(`Failed to initialize camera: ${error.message}`);
                });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry Camera
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading while camera initializes
  if (isCameraInitializing || !currentStream) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Initializing Camera...</div>
          <div className="text-gray-300">Please allow camera access to continue</div>
        </div>
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
                cameraStream={currentStream}
              />
            )}

            {currentStepData.id === 'head-pose-calibration' && (
              <HeadMovementGuide
                onComplete={handleStepComplete}
                isProcessing={isProcessing}
                cameraStream={currentStream}
              />
            )}

            {currentStepData.id === 'environment-baseline' && (
              <EnvironmentCheck
                onComplete={handleStepComplete}
                isProcessing={isProcessing}
                cameraStream={currentStream}
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