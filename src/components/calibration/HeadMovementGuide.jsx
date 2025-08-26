/**
 * HeadMovementGuide - Guided head movement instructions and validation
 */

import { useState, useEffect, useCallback } from 'react';

const MOVEMENT_SEQUENCE = [
  { direction: 'center', instruction: 'Look straight ahead', duration: 2000 },
  { direction: 'left', instruction: 'Turn your head left', duration: 3000 },
  { direction: 'center', instruction: 'Return to center', duration: 2000 },
  { direction: 'right', instruction: 'Turn your head right', duration: 3000 },
  { direction: 'center', instruction: 'Return to center', duration: 2000 },
  { direction: 'up', instruction: 'Tilt your head up slightly', duration: 3000 },
  { direction: 'center', instruction: 'Return to center', duration: 2000 },
  { direction: 'down', instruction: 'Tilt your head down slightly', duration: 3000 },
  { direction: 'center', instruction: 'Return to center', duration: 2000 }
];

export const HeadMovementGuide = ({
  onComplete,
  isProcessing,
  cameraStream
}) => {
  const [currentMovementIndex, setCurrentMovementIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [collectedData, setCollectedData] = useState([]);
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(true);

  // Start countdown
  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      setShowCountdown(false);
      setIsActive(true);
    }
  }, [countdown, showCountdown]);

  // Handle movement sequence
  useEffect(() => {
    if (!isActive || currentMovementIndex >= MOVEMENT_SEQUENCE.length) return;

    const currentMovement = MOVEMENT_SEQUENCE[currentMovementIndex];
    
    const collectMovementData = () => {
      // Mock head pose data collection
      const movementData = {
        direction: currentMovement.direction,
        yaw: getYawForDirection(currentMovement.direction),
        pitch: getPitchForDirection(currentMovement.direction),
        roll: 0,
        timestamp: Date.now(),
        confidence: 0.85 + Math.random() * 0.15
      };

      setCollectedData(prev => [...prev, movementData]);
    };

    // Collect data during movement
    const dataInterval = setInterval(collectMovementData, 100);
    
    // Move to next movement after duration
    const movementTimer = setTimeout(() => {
      clearInterval(dataInterval);
      
      if (currentMovementIndex < MOVEMENT_SEQUENCE.length - 1) {
        setCurrentMovementIndex(currentMovementIndex + 1);
      } else {
        completeCalibration();
      }
    }, currentMovement.duration);

    return () => {
      clearInterval(dataInterval);
      clearTimeout(movementTimer);
    };
  }, [isActive, currentMovementIndex]);

  const getYawForDirection = (direction) => {
    switch (direction) {
      case 'left': return -15 + Math.random() * 5;
      case 'right': return 15 + Math.random() * 5;
      case 'center': return Math.random() * 4 - 2;
      default: return 0;
    }
  };

  const getPitchForDirection = (direction) => {
    switch (direction) {
      case 'up': return -10 + Math.random() * 3;
      case 'down': return 10 + Math.random() * 3;
      case 'center': return Math.random() * 4 - 2;
      default: return 0;
    }
  };

  const completeCalibration = useCallback(() => {
    setIsActive(false);
    
    // Ensure camera is still active
    if (!cameraStream || !cameraStream.active) {
      console.warn('Camera stream not active during head movement calibration completion');
    }
    
    onComplete({
      data: collectedData,
      quality: calculateMovementQuality(collectedData)
    });
  }, [collectedData, onComplete, cameraStream]);

  const calculateMovementQuality = (data) => {
    if (data.length === 0) return 0;
    
    const avgConfidence = data.reduce((sum, d) => sum + d.confidence, 0) / data.length;
    return Math.min(avgConfidence, 1.0);
  };

  // Check camera status
  if (!cameraStream || !cameraStream.active) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Camera Not Active</div>
          <p className="text-gray-300">
            Camera must be active for head movement calibration
          </p>
        </div>
      </div>
    );
  }

  if (showCountdown) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl font-bold text-white mb-4">
            {countdown || 'BEGIN!'}
          </div>
          <p className="text-gray-300">
            Prepare to move your head as instructed
          </p>
          <p className="text-green-400 text-sm mt-2">
            ✓ Camera Active
          </p>
        </div>
      </div>
    );
  }

  const currentMovement = MOVEMENT_SEQUENCE[currentMovementIndex];
  const progress = ((currentMovementIndex + 1) / MOVEMENT_SEQUENCE.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="w-64 bg-gray-600 rounded-full h-3">
          <div 
            className="bg-blue-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-center text-gray-300 text-sm mt-2">
          Movement {currentMovementIndex + 1} of {MOVEMENT_SEQUENCE.length}
        </div>
      </div>

      {/* Current instruction */}
      {isActive && currentMovement && (
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-4">
            {currentMovement.instruction}
          </div>
          
          {/* Visual direction indicator */}
          <div className="relative w-32 h-32 mx-auto mb-6">
            <HeadDirectionIndicator direction={currentMovement.direction} />
          </div>
          
          <div className="text-gray-300">
            Keep your eyes looking at the center of the screen
          </div>
        </div>
      )}

      {/* Completion message */}
      {!isActive && currentMovementIndex >= MOVEMENT_SEQUENCE.length && (
        <div className="text-center">
          <div className="text-green-400 text-4xl mb-4">✓</div>
          <div className="text-white text-xl">Head movement calibration complete!</div>
          <div className="text-gray-300 text-sm mt-2">
            Processing movement data...
          </div>
        </div>
      )}
    </div>
  );
};

const HeadDirectionIndicator = ({ direction }) => {
  const getArrowStyle = () => {
    const baseClasses = "absolute w-8 h-8 text-blue-400 transition-all duration-500";
    
    switch (direction) {
      case 'left':
        return `${baseClasses} left-0 top-1/2 transform -translate-y-1/2 scale-150`;
      case 'right':
        return `${baseClasses} right-0 top-1/2 transform -translate-y-1/2 scale-150`;
      case 'up':
        return `${baseClasses} top-0 left-1/2 transform -translate-x-1/2 scale-150`;
      case 'down':
        return `${baseClasses} bottom-0 left-1/2 transform -translate-x-1/2 scale-150`;
      case 'center':
        return `${baseClasses} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 scale-150`;
      default:
        return baseClasses;
    }
  };

  const getArrowIcon = () => {
    switch (direction) {
      case 'left': return '←';
      case 'right': return '→';
      case 'up': return '↑';
      case 'down': return '↓';
      case 'center': return '●';
      default: return '●';
    }
  };

  return (
    <div className="relative w-full h-full border-2 border-gray-600 rounded-full">
      {/* Center dot */}
      <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-gray-400 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
      
      {/* Direction arrows */}
      <div className="absolute left-0 top-1/2 w-6 h-6 text-gray-500 transform -translate-y-1/2 flex items-center justify-center">←</div>
      <div className="absolute right-0 top-1/2 w-6 h-6 text-gray-500 transform -translate-y-1/2 flex items-center justify-center">→</div>
      <div className="absolute top-0 left-1/2 w-6 h-6 text-gray-500 transform -translate-x-1/2 flex items-center justify-center">↑</div>
      <div className="absolute bottom-0 left-1/2 w-6 h-6 text-gray-500 transform -translate-x-1/2 flex items-center justify-center">↓</div>
      
      {/* Active direction indicator */}
      <div className={getArrowStyle()}>
        <div className="flex items-center justify-center w-full h-full">
          {getArrowIcon()}
        </div>
      </div>
    </div>
  );
};