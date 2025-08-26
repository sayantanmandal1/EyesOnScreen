/**
 * Enhanced Calibration Wizard with improved step-by-step guidance
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { CalibrationStep, CalibrationPoint } from '../../lib/calibration/types';
import { CalibrationDots } from './CalibrationDots';
import { HeadMovementGuide } from './HeadMovementGuide';
import { EnvironmentCheck } from './EnvironmentCheck';
import { CalibrationProgress } from './CalibrationProgress';
import { CalibrationQualityFeedback } from './CalibrationQualityFeedback';

interface EnhancedCalibrationWizardProps {
  onComplete: (success: boolean) => void;
  onCancel: () => void;
  showDetailedInstructions?: boolean;
}

export const EnhancedCalibrationWizard: React.FC<EnhancedCalibrationWizardProps> = ({
  onComplete,
  onCancel,
  showDetailedInstructions = true
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
  const [stepStartTime, setStepStartTime] = useState<number>(0);
  const [showInstructions, setShowInstructions] = useState(true);
  const [calibrationAttempts, setCalibrationAttempts] = useState(1);

  // Initialize calibration session
  useEffect(() => {
    if (!calibrationSession) {
      initializeCalibration();
    }
  }, []);

  // Start step timer when step changes
  useEffect(() => {
    setStepStartTime(Date.now());
    setShowInstructions(showDetailedInstructions);
  }, [currentStep, showDetailedInstructions]);

  const initializeCalibration = useCallback(() => {
    const steps: CalibrationStep[] = [
      {
        id: 'setup-check',
        name: 'Setup Verification',
        description: 'Verify your camera and environment setup',
        duration: 15000,
        instructions: [
          'Position yourself arm\'s length from the screen',
          'Ensure your face is well-lit and clearly visible',
          'Remove glasses if they cause glare',
          'Make sure no one else is in the camera frame'
        ],
        tips: [
          'Good lighting improves calibration accuracy',
          'A stable sitting position helps maintain consistency',
          'Clean your camera lens for better detection'
        ],
        completed: false
      },
      {
        id: 'gaze-calibration',
        name: 'Gaze Calibration',
        description: 'Look at each dot as it appears on screen',
        duration: 45000, // Extended for better accuracy
        points: generateCalibrationPoints(),
        instructions: [
          'Keep your head still and centered throughout',
          'Look directly at each dot when it appears',
          'Focus on the center of each dot',
          'Wait for the dot to disappear before moving your eyes',
          'Blink normally but avoid excessive blinking'
        ],
        tips: [
          'The more accurately you look at each dot, the better the calibration',
          'If you make a mistake, the system will automatically retry that point',
          'This step is crucial for accurate eye tracking'
        ],
        completed: false
      },
      {
        id: 'head-pose-calibration', 
        name: 'Head Movement Calibration',
        description: 'Follow the guided head movements',
        duration: 20000,
        instructions: [
          'Move your head slowly and smoothly',
          'Keep your eyes looking at the center target',
          'Return to center position between movements',
          'Don\'t move too quickly or the system may miss the movement'
        ],
        tips: [
          'This helps the system understand your natural head movement range',
          'Smooth movements work better than jerky ones',
          'The system learns your personal movement boundaries'
        ],
        completed: false
      },
      {
        id: 'environment-baseline',
        name: 'Environment Baseline',
        description: 'Establishing lighting and environment baseline',
        duration: 15000,
        instructions: [
          'Sit still and look directly at the camera',
          'Maintain consistent lighting',
          'Keep the same posture you\'ll use during the quiz',
          'Ensure no shadows fall across your face'
        ],
        tips: [
          'This creates a baseline for detecting environmental changes',
          'Consistent lighting throughout the quiz improves accuracy',
          'The system will alert you if conditions change significantly'
        ],
        completed: false
      }
    ];

    const session = {
      id: `calibration-${Date.now()}-attempt-${calibrationAttempts}`,
      startTime: Date.now(),
      steps,
      currentStepIndex: 0,
      overallQuality: 0,
      status: 'in-progress' as const,
      attemptNumber: calibrationAttempts
    };

    setCalibrationSession(session);
  }, [setCalibrationSession, calibrationAttempts]);

  const generateCalibrationPoints = (): CalibrationPoint[] => {
    const points: CalibrationPoint[] = [];
    // Enhanced 9-point calibration with better coverage
    const positions = [
      { x: 0.15, y: 0.15 }, // Top-left (moved slightly inward)
      { x: 0.5, y: 0.15 },  // Top-center
      { x: 0.85, y: 0.15 }, // Top-right (moved slightly inward)
      { x: 0.15, y: 0.5 },  // Middle-left
      { x: 0.5, y: 0.5 },   // Center
      { x: 0.85, y: 0.5 },  // Middle-right
      { x: 0.15, y: 0.85 }, // Bottom-left (moved slightly inward)
      { x: 0.5, y: 0.85 },  // Bottom-center
      { x: 0.85, y: 0.85 }  // Bottom-right (moved slightly inward)
    ];

    positions.forEach((pos, index) => {
      points.push({
        id: `point-${index}`,
        x: pos.x,
        y: pos.y,
        completed: false,
        attempts: 0,
        quality: 0
      });
    });

    return points;
  };

  const handleStepComplete = useCallback(async (stepData: any) => {
    if (!calibrationSession) return;

    setIsProcessing(true);
    
    try {
      const stepDuration = Date.now() - stepStartTime;
      
      // Update current step as completed with timing data
      const updatedSteps = [...calibrationSession.steps];
      updatedSteps[currentStep] = {
        ...updatedSteps[currentStep],
        completed: true,
        completionTime: stepDuration,
        data: stepData
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
  }, [calibrationSession, currentStep, stepStartTime, setCalibrationSession]);

  const finalizeCalibration = async (session: any) => {
    // Calculate overall quality with enhanced metrics
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
    // Enhanced quality calculation based on multiple factors
    let totalQuality = 0;
    let qualityFactors = 0;

    session.steps.forEach((step: any) => {
      if (step.completed && step.data) {
        switch (step.id) {
          case 'gaze-calibration':
            // Factor in gaze accuracy and consistency
            const gazeQuality = step.data.averageAccuracy || 0.8;
            totalQuality += gazeQuality * 0.4; // 40% weight
            qualityFactors += 0.4;
            break;
          case 'head-pose-calibration':
            // Factor in head pose range and smoothness
            const headPoseQuality = step.data.rangeQuality || 0.85;
            totalQuality += headPoseQuality * 0.3; // 30% weight
            qualityFactors += 0.3;
            break;
          case 'environment-baseline':
            // Factor in lighting stability and face detection
            const envQuality = step.data.stabilityScore || 0.9;
            totalQuality += envQuality * 0.2; // 20% weight
            qualityFactors += 0.2;
            break;
          case 'setup-check':
            // Factor in initial setup quality
            const setupQuality = step.data.setupScore || 0.85;
            totalQuality += setupQuality * 0.1; // 10% weight
            qualityFactors += 0.1;
            break;
        }
      }
    });

    return qualityFactors > 0 ? totalQuality / qualityFactors : 0.5;
  };

  const createCalibrationProfile = async (session: any) => {
    // Enhanced profile creation with real data from calibration
    const gazeData = session.steps.find((s: any) => s.id === 'gaze-calibration')?.data;
    const headPoseData = session.steps.find((s: any) => s.id === 'head-pose-calibration')?.data;
    const envData = session.steps.find((s: any) => s.id === 'environment-baseline')?.data;

    return {
      id: `profile-${Date.now()}`,
      createdAt: Date.now(),
      ipd: gazeData?.interpupillaryDistance || 65,
      earBaseline: gazeData?.eyeAspectRatio || 0.3,
      gazeMapping: {
        homography: gazeData?.homographyMatrix || [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        bias: gazeData?.calibrationBias || [0, 0]
      },
      headPoseBounds: {
        yawRange: headPoseData?.yawRange || [-20, 20] as [number, number],
        pitchRange: headPoseData?.pitchRange || [-15, 15] as [number, number]
      },
      lightingBaseline: {
        histogram: envData?.lightingHistogram || new Array(256).fill(0),
        mean: envData?.lightingMean || 128,
        variance: envData?.lightingVariance || 50
      },
      quality: calculateOverallQuality(session),
      attemptNumber: calibrationAttempts,
      sessionDuration: Date.now() - session.startTime
    };
  };

  const handleRetryCalibration = () => {
    setShowQualityFeedback(false);
    setCurrentStep(0);
    setCalibrationAttempts(prev => prev + 1);
    initializeCalibration();
  };

  const handleSkipInstructions = () => {
    setShowInstructions(false);
  };

  if (!calibrationSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-white">Initializing calibration...</div>
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
        attemptNumber={calibrationAttempts}
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
          
          {/* Attempt indicator */}
          {calibrationAttempts > 1 && (
            <div className="text-center mt-2">
              <span className="text-sm text-gray-400">
                Calibration Attempt #{calibrationAttempts}
              </span>
            </div>
          )}
        </div>

        {/* Instructions overlay */}
        {showInstructions && (
          <div className="absolute inset-0 bg-black bg-opacity-75 z-10 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
              <h3 className="text-xl font-bold text-white mb-4">
                {currentStepData.name} - Instructions
              </h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <h4 className="text-lg font-semibold text-blue-400 mb-2">What to do:</h4>
                  <ul className="text-gray-300 space-y-1">
                    {currentStepData.instructions.map((instruction, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-400 mr-2 mt-1">•</span>
                        {instruction}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {currentStepData.tips && (
                  <div>
                    <h4 className="text-lg font-semibold text-green-400 mb-2">Tips for success:</h4>
                    <ul className="text-gray-300 space-y-1">
                      {currentStepData.tips.map((tip, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-green-400 mr-2 mt-1">💡</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between">
                <button
                  onClick={handleSkipInstructions}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Skip Instructions
                </button>
                <button
                  onClick={handleSkipInstructions}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Start {currentStepData.name}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {currentStepData.name}
            </h2>
            <p className="text-gray-300 mb-4">
              {currentStepData.description}
            </p>
            
            {/* Quick instructions */}
            {!showInstructions && (
              <button
                onClick={() => setShowInstructions(true)}
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                Show detailed instructions
              </button>
            )}
          </div>

          {/* Step-specific content */}
          <div className="flex-1 w-full max-w-4xl">
            {currentStepData.id === 'setup-check' && (
              <EnvironmentCheck
                onComplete={handleStepComplete}
                isProcessing={isProcessing}
                enhanced={true}
              />
            )}
            
            {currentStepData.id === 'gaze-calibration' && (
              <CalibrationDots
                points={currentStepData.points || []}
                onComplete={handleStepComplete}
                isProcessing={isProcessing}
                showProgress={true}
                allowRetry={true}
              />
            )}
            
            {currentStepData.id === 'head-pose-calibration' && (
              <HeadMovementGuide
                onComplete={handleStepComplete}
                isProcessing={isProcessing}
                showVisualFeedback={true}
              />
            )}
            
            {currentStepData.id === 'environment-baseline' && (
              <EnvironmentCheck
                onComplete={handleStepComplete}
                isProcessing={isProcessing}
                mode="baseline"
              />
            )}
          </div>
        </div>

        {/* Footer with controls */}
        <div className="bg-gray-800 p-4 flex justify-between items-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            disabled={isProcessing}
          >
            Cancel Calibration
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="text-gray-400 text-sm">
              Step {currentStep + 1} of {calibrationSession.steps.length}
            </div>
            
            {currentStepData.duration && (
              <div className="text-gray-400 text-sm">
                ~{Math.round(currentStepData.duration / 1000)}s remaining
              </div>
            )}
          </div>
          
          <button
            onClick={() => setShowInstructions(true)}
            className="px-4 py-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
            disabled={isProcessing}
          >
            Help
          </button>
        </div>
      </div>
    </div>
  );
};