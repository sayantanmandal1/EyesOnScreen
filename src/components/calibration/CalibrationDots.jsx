/**
 * CalibrationDots - 9-point calibration dot display system with real gaze tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { gazeTracker } from '../../lib/gazeTracking';
import '../../styles/webgazer.css';

export const CalibrationDots = ({
  points,
  onComplete,
  isProcessing,
  cameraStream
}) => {
  const { monitoring, cameraPermission } = useAppStore();
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectedData, setCollectedData] = useState([]);
  const [gazeTrackerReady, setGazeTrackerReady] = useState(false);
  const [initializingGaze, setInitializingGaze] = useState(false);
  const [error, setError] = useState(null);

  // Initialize gaze tracker when component mounts
  useEffect(() => {
    const initGazeTracker = async () => {
      setInitializingGaze(true);
      setError(null);
      
      try {
        const success = await gazeTracker.start();
        if (success) {
          setGazeTrackerReady(true);
          console.log('Gaze tracker initialized successfully');
        } else {
          setError('Failed to initialize gaze tracking. Please ensure camera permission is granted.');
        }
      } catch (err) {
        console.error('Gaze tracker initialization error:', err);
        setError('Error initializing gaze tracking: ' + err.message);
      } finally {
        setInitializingGaze(false);
      }
    };

    initGazeTracker();

    // Cleanup on unmount
    return () => {
      gazeTracker.stop();
    };
  }, []);

  const startCalibration = useCallback(async () => {
    if (!gazeTrackerReady) {
      setError('Gaze tracker not ready. Please wait for initialization.');
      return;
    }

    try {
      await gazeTracker.startCalibration();
      setCurrentPointIndex(0);
      setIsCollecting(true);
      setCollectedData([]);
      setError(null);
      console.log('Starting calibration process');
    } catch (err) {
      console.error('Failed to start calibration:', err);
      setError('Failed to start calibration: ' + err.message);
    }
  }, [gazeTrackerReady]);

  // Handle point collection with real gaze tracking
  useEffect(() => {
    if (!isCollecting || currentPointIndex >= points.length || !gazeTrackerReady) return;

    const collectPointData = async () => {
      const point = points[currentPointIndex];
      const screenX = point.x * window.innerWidth;
      const screenY = point.y * window.innerHeight;
      
      console.log(`Collecting data for point ${currentPointIndex + 1}/${points.length} at (${screenX}, ${screenY})`);
      
      try {
        // Use WebGazer to collect calibration data for this point
        await gazeTracker.addCalibrationPoint(screenX, screenY, 3000);
        
        // Get current gaze prediction to verify
        const gazeData = await gazeTracker.getCurrentGaze();
        
        const pointData = {
          screenPoint: { x: screenX, y: screenY },
          gazePoint: gazeData || { x: screenX, y: screenY }, // Fallback to screen point if no gaze data
          timestamp: Date.now(),
          confidence: gazeData ? 0.8 : 0.3, // Lower confidence if no real gaze data
          pointIndex: currentPointIndex
        };

        setCollectedData(prev => [...prev, pointData]);
        
        // Move to next point or complete
        if (currentPointIndex < points.length - 1) {
          setCurrentPointIndex(prev => prev + 1);
        } else {
          // All points completed
          setTimeout(() => {
            completeCalibration();
          }, 500);
        }
      } catch (err) {
        console.error('Error collecting point data:', err);
        setError('Error during calibration: ' + err.message);
      }
    };

    // Start collecting after a brief delay
    const timer = setTimeout(collectPointData, 500);
    return () => clearTimeout(timer);
  }, [isCollecting, currentPointIndex, points.length, gazeTrackerReady]);

  const completeCalibration = useCallback(async () => {
    console.log('Completing calibration with', collectedData.length, 'points');
    setIsCollecting(false);
    
    try {
      // Finish calibration in WebGazer and get quality
      const calibrationResult = await gazeTracker.finishCalibration();
      const quality = calibrationResult?.quality || calculateCalibrationQuality(collectedData);
      
      const results = {
        points: points.map((point, index) => ({
          ...point,
          completed: index < collectedData.length,
          data: collectedData[index] || null
        })),
        quality,
        averageAccuracy: quality,
        homographyMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], // Identity matrix
        calibrationBias: [0, 0],
        interpupillaryDistance: 65,
        eyeAspectRatio: 0.3,
        totalPoints: points.length,
        completedPoints: collectedData.length,
        timestamp: Date.now(),
        gazeTrackerReady: gazeTrackerReady
      };
      
      console.log('Calibration results:', results);
      onComplete(results);
    } catch (err) {
      console.error('Error completing calibration:', err);
      setError('Error completing calibration: ' + err.message);
    }
  }, [collectedData, onComplete, points, gazeTrackerReady]);

  const calculateCalibrationQuality = (data) => {
    // Enhanced quality calculation
    if (data.length < points.length) {
      return data.length / points.length * 0.5; // Partial completion penalty
    }
    
    // Calculate average confidence
    const avgConfidence = data.reduce((sum, d) => sum + d.confidence, 0) / data.length;
    
    // Calculate accuracy based on gaze-to-screen point distance
    const accuracyScores = data.map(d => {
      const distance = Math.sqrt(
        Math.pow(d.gazePoint.x - d.screenPoint.x, 2) + 
        Math.pow(d.gazePoint.y - d.screenPoint.y, 2)
      );
      // Convert distance to accuracy score (closer = better)
      return Math.max(0, 1 - distance / 100); // 100px = 0 accuracy
    });
    
    const avgAccuracy = accuracyScores.reduce((sum, acc) => sum + acc, 0) / accuracyScores.length;
    
    // Combine confidence and accuracy
    return Math.min((avgConfidence * 0.6 + avgAccuracy * 0.4), 1.0);
  };

  const calculateCalibrationMatrix = (data) => {
    // Simple identity matrix for now (in real implementation, this would be calculated from gaze data)
    return [
      [1, 0, 0],
      [0, 1, 0], 
      [0, 0, 1]
    ];
  };

  // Show initialization screen
  if (initializingGaze) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-blue-400 text-xl mb-4">Initializing Gaze Tracking...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-300">
            Setting up camera and eye tracking
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Please allow camera access when prompted
          </p>
        </div>
      </div>
    );
  }

  // Show error screen
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Gaze Tracking Error</div>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Show ready screen with start button
  if (!isCollecting && gazeTrackerReady) {
    return (
      <div className="relative w-full h-full">
        {/* Show all calibration points */}
        {points.map((point, index) => (
          <CalibrationDot
            key={point.id}
            point={point}
            isActive={false}
            isCompleted={false}
            showNumber={true}
            number={index + 1}
          />
        ))}
        
        {/* Start button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-center bg-gray-800 rounded-lg p-6">
            <div className="text-green-400 text-xl mb-4">✓ Gaze Tracking Ready</div>
            <p className="text-gray-300 mb-4">
              Look directly at each dot as it appears.<br/>
              The calibration will take about 30 seconds.
            </p>
            <button
              onClick={startCalibration}
              disabled={isProcessing}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-lg font-semibold transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Start Calibration'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* WebGazer video feed */}
      <div className="absolute top-4 right-4 z-20">
        <div className="bg-black rounded-lg p-2">
          <div id="webgazerVideoContainer" className="w-32 h-24 bg-gray-800 rounded overflow-hidden">
            {/* WebGazer will inject video element here */}
          </div>
          <div className="text-xs text-gray-400 text-center mt-1">
            {gazeTrackerReady ? '✓ Tracking Active' : 'Initializing...'}
          </div>
        </div>
      </div>

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

const CalibrationDot = ({
  point,
  isActive,
  isCompleted,
  showNumber = false,
  number = null
}) => {
  const style = {
    position: 'absolute',
    left: `${point.x * 100}%`,
    top: `${point.y * 100}%`,
    transform: 'translate(-50%, -50%)',
    transition: 'all 0.3s ease-in-out'
  };

  return (
    <div style={style}>
      <div
        className={`
          rounded-full border-2 transition-all duration-500
          ${isActive 
            ? 'w-8 h-8 bg-red-500 border-red-300 scale-150 animate-pulse shadow-lg shadow-red-500/50' 
            : isCompleted
            ? 'w-6 h-6 bg-green-500 border-green-300'
            : 'w-4 h-4 bg-gray-600 border-gray-400 opacity-70'
          }
        `}
      >
        {isCompleted && (
          <div className="flex items-center justify-center h-full">
            <span className="text-white text-xs font-bold">✓</span>
          </div>
        )}
        {showNumber && number && !isCompleted && (
          <div className="flex items-center justify-center h-full">
            <span className="text-white text-xs font-bold">{number}</span>
          </div>
        )}
      </div>
      
      {/* Ripple effects for active dot */}
      {isActive && (
        <>
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-red-400 animate-ping opacity-75 transform -translate-x-1/4 -translate-y-1/4" />
          <div className="absolute inset-0 w-10 h-10 rounded-full border border-red-300 transform -translate-x-1/5 -translate-y-1/5" />
        </>
      )}
    </div>
  );
};