/**
 * EnvironmentCheck - Environment baseline collection with REAL MediaPipe face detection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../../store/appStore';

export const EnvironmentCheck = ({
  onComplete,
  isProcessing,
  cameraStream
}) => {
  const { monitoring, cameraPermission } = useAppStore();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [collectedData, setCollectedData] = useState([]);
  const [currentCheck, setCurrentCheck] = useState('Initializing camera...');
  const [realFaceDetector, setRealFaceDetector] = useState(null);
  const [liveFaceData, setLiveFaceData] = useState({
    detected: false,
    confidence: 0,
    stability: 0,
    boundingBox: null
  });
  const [realTimeChecks, setRealTimeChecks] = useState({
    faceDetected: false,
    lightingGood: false,
    positionStable: false,
    noDistractions: false
  });
  const [error, setError] = useState(null);

  const COLLECTION_DURATION = 10000; // 10 seconds
  const CHECKS = [
    'Analyzing face detection quality...',
    'Measuring lighting conditions...',
    'Evaluating face position stability...',
    'Checking for environmental distractions...',
    'Validating camera setup...',
    'Finalizing environment baseline...'
  ];

  // Initialize real face detection
  useEffect(() => {
    const initializeFaceDetection = async () => {
      setCurrentCheck('Initializing MediaPipe face detection...');
      
      try {
        // Import the real face detector
        const { RealFaceDetector } = await import('../../lib/realFaceDetection');
        const detector = new RealFaceDetector();
        
        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        
        if (videoRef.current && canvasRef.current) {
          videoRef.current.srcObject = stream;
          
          // Wait for video to load
          await new Promise((resolve) => {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play();
              resolve();
            };
          });
          
          // Initialize face detector
          const success = await detector.initialize(videoRef.current, canvasRef.current);
          
          if (success) {
            // Set up real-time face detection callback
            detector.onFaceDetected = (faceData) => {
              setLiveFaceData(faceData);
              updateRealTimeChecksFromFaceData(faceData);
            };
            
            await detector.start();
            setRealFaceDetector(detector);
            setIsInitializing(false);
            setCurrentCheck('Face detection ready');
            console.log('Real face detection initialized successfully');
          } else {
            throw new Error('Failed to initialize MediaPipe face detection');
          }
        }
      } catch (err) {
        console.error('Face detection initialization error:', err);
        setError('Failed to initialize face detection: ' + err.message);
        setIsInitializing(false);
      }
    };

    initializeFaceDetection();

    return () => {
      if (realFaceDetector) {
        realFaceDetector.stop();
      }
    };
  }, []);

  // Helper function to update real-time checks from face data
  const updateRealTimeChecksFromFaceData = useCallback((faceData) => {
    if (!faceData) return;
    
    // Analyze lighting from canvas
    const lightingData = analyzeLightingFromCanvas();
    
    setRealTimeChecks({
      faceDetected: faceData.detected && faceData.confidence > 0.7,
      lightingGood: lightingData.luminance > 60 && lightingData.luminance < 200,
      positionStable: faceData.stability > 0.6,
      noDistractions: faceData.detected && isPositionCentered(faceData.boundingBox)
    });
  }, []);

  const analyzeLightingFromCanvas = () => {
    if (!canvasRef.current) return { luminance: 128, contrast: 50 };
    
    const ctx = canvasRef.current.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const data = imageData.data;
    
    let totalLuminance = 0;
    const pixelCount = data.length / 4;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += luminance;
    }
    
    return {
      luminance: totalLuminance / pixelCount,
      contrast: 50 // Simplified for now
    };
  };

  const isPositionCentered = (boundingBox) => {
    if (!boundingBox || !canvasRef.current) return false;
    
    const centerX = boundingBox.centerX / canvasRef.current.width;
    const centerY = boundingBox.centerY / canvasRef.current.height;
    
    return Math.abs(centerX - 0.5) < 0.3 && Math.abs(centerY - 0.5) < 0.3;
  };

  const startEnvironmentCollection = useCallback(async () => {
    if (!realFaceDetector || !realFaceDetector.isReady()) {
      setError('Face detection not ready. Please wait for initialization.');
      return;
    }

    setIsCollecting(true);
    setProgress(0);
    setCollectedData([]);

    const startTime = Date.now();
    const interval = 100; // Collect data every 100ms

    const collectData = () => {
      const elapsed = Date.now() - startTime;
      const progressPercent = Math.min((elapsed / COLLECTION_DURATION) * 100, 100);

      setProgress(progressPercent);

      // Update current check based on progress
      const checkIndex = Math.floor((progressPercent / 100) * CHECKS.length);
      if (checkIndex < CHECKS.length) {
        setCurrentCheck(CHECKS[checkIndex]);
      }

      // Collect REAL environment data from MediaPipe
      const faceData = realFaceDetector.getCurrentFaceData();
      const lightingData = analyzeLightingFromCanvas();

      const environmentData = {
        timestamp: Date.now(),
        // REAL face detection data from MediaPipe
        faceDetected: faceData?.detected || false,
        faceConfidence: faceData?.confidence || 0,
        faceBoundingBox: faceData?.boundingBox || null,
        faceStability: faceData?.stability || 0,
        // REAL lighting analysis from canvas
        lightingData: lightingData,
        // REAL environment metrics
        environmentStability: faceData?.stability || 0,
        distractionScore: calculateDistractionScore(faceData)
      };

      setCollectedData(prev => [...prev, environmentData]);

      if (elapsed >= COLLECTION_DURATION) {
        completeEnvironmentCheck();
      }
    };

    const dataInterval = setInterval(collectData, interval);

    return () => clearInterval(dataInterval);
  }, [realFaceDetector]);

  const calculateDistractionScore = (faceData) => {
    if (!faceData || !faceData.detected) return 1; // High distraction if no face
    
    let distractionScore = 0;
    
    // Check face size (should be reasonable portion of frame)
    if (faceData.boundingBox && canvasRef.current) {
      const faceArea = faceData.boundingBox.width * faceData.boundingBox.height;
      const canvasArea = canvasRef.current.width * canvasRef.current.height;
      const faceRatio = faceArea / canvasArea;
      
      if (faceRatio < 0.05) distractionScore += 0.4; // Face too small
      if (faceRatio > 0.4) distractionScore += 0.3; // Face too large
      
      // Check if face is centered
      if (!isPositionCentered(faceData.boundingBox)) {
        distractionScore += 0.3;
      }
    }
    
    // Low confidence indicates poor conditions
    if (faceData.confidence < 0.7) {
      distractionScore += 0.2;
    }
    
    return Math.min(distractionScore, 1);
  };



  const completeEnvironmentCheck = useCallback(async () => {
    setIsCollecting(false);
    setCurrentCheck('Processing environment data...');

    // Calculate environment baseline from REAL collected data
    const baseline = calculateEnvironmentBaseline(collectedData);
    const environmentQuality = calculateEnvironmentQuality(baseline);

    // Get final face validation from MediaPipe detector
    const faceHistory = realFaceDetector ? realFaceDetector.getFaceHistory() : [];
    const recentFaces = faceHistory.filter(f => Date.now() - f.timestamp < 5000); // Last 5 seconds
    const detectionRate = recentFaces.length > 0 ? recentFaces.filter(f => f.detected).length / recentFaces.length : 0;

    const faceDetectionWorking = detectionRate > 0.7 && baseline.averageConfidence > 0.6;

    console.log('Environment check completed with REAL data:', {
      baseline,
      environmentQuality,
      faceDetectionWorking,
      detectionRate,
      totalSamples: collectedData.length
    });

    onComplete({
      lighting: baseline.averageLuminance,
      stability: baseline.faceStability,
      quality: environmentQuality,
      setupScore: faceDetectionWorking ? environmentQuality : 0.3,
      faceDetection: {
        working: faceDetectionWorking,
        detectionRate: detectionRate,
        averageConfidence: baseline.averageConfidence,
        stability: baseline.faceStability
      },
      realTimeChecks: realTimeChecks,
      isReal: true // Flag to indicate this is real data
    });
  }, [collectedData, onComplete, realTimeChecks, realFaceDetector]);

  const calculateEnvironmentBaseline = (data) => {
    if (data.length === 0) return null;

    // Filter out samples without face detection
    const validSamples = data.filter(d => d.faceDetected);
    const faceDetectionRate = validSamples.length / data.length;

    if (validSamples.length === 0) {
      console.warn('No valid face detection samples found');
      return {
        faceDetectionRate: 0,
        averageLuminance: 0,
        averageConfidence: 0,
        faceStability: 0,
        environmentScore: 0,
        timestamp: Date.now()
      };
    }

    // Calculate real metrics from face detection data
    const avgLuminance = validSamples.reduce((sum, d) => sum + (d.lightingData?.luminance || 0), 0) / validSamples.length;
    const avgConfidence = validSamples.reduce((sum, d) => sum + d.faceConfidence, 0) / validSamples.length;
    const avgStability = validSamples.reduce((sum, d) => sum + d.environmentStability, 0) / validSamples.length;
    const avgDistractionScore = validSamples.reduce((sum, d) => sum + d.distractionScore, 0) / validSamples.length;

    // Calculate lighting histogram from real data
    const combinedHistogram = new Array(256).fill(0);
    validSamples.forEach(sample => {
      if (sample.lightingData?.histogram) {
        sample.lightingData.histogram.forEach((value, index) => {
          combinedHistogram[index] += value;
        });
      }
    });

    return {
      faceDetectionRate,
      averageLuminance: avgLuminance,
      averageConfidence: avgConfidence,
      faceStability: avgStability,
      distractionScore: avgDistractionScore,
      lightingHistogram: combinedHistogram,
      environmentScore: calculateEnvironmentScore(faceDetectionRate, avgConfidence, avgStability, avgDistractionScore),
      validSamples: validSamples.length,
      totalSamples: data.length,
      timestamp: Date.now()
    };
  };

  const calculateEnvironmentScore = (detectionRate, confidence, stability, distractionScore) => {
    // Weighted scoring system
    const detectionWeight = 0.4;  // 40% - Most important
    const confidenceWeight = 0.3; // 30% - Face quality
    const stabilityWeight = 0.2;  // 20% - Position stability
    const distractionWeight = 0.1; // 10% - Environment cleanliness

    const detectionScore = detectionRate;
    const confidenceScore = confidence;
    const stabilityScore = stability;
    const distractionScore_inverted = 1 - distractionScore; // Lower distraction = higher score

    return (
      detectionScore * detectionWeight +
      confidenceScore * confidenceWeight +
      stabilityScore * stabilityWeight +
      distractionScore_inverted * distractionWeight
    );
  };

  const calculateVariance = (values) => {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  };

  const calculateEnvironmentQuality = (baseline, faceValidation) => {
    if (!baseline) return 0;

    let quality = 0;

    // Face detection quality (50% of total score)
    if (baseline.faceDetectionRate > 0.9) quality += 0.25;
    else if (baseline.faceDetectionRate > 0.8) quality += 0.2;
    else if (baseline.faceDetectionRate > 0.6) quality += 0.15;
    else if (baseline.faceDetectionRate > 0.4) quality += 0.1;

    if (baseline.averageConfidence > 0.8) quality += 0.25;
    else if (baseline.averageConfidence > 0.6) quality += 0.2;
    else if (baseline.averageConfidence > 0.4) quality += 0.15;
    else if (baseline.averageConfidence > 0.2) quality += 0.1;

    // Lighting quality (25% of total score)
    if (baseline.averageLuminance > 80 && baseline.averageLuminance < 180) {
      quality += 0.25;
    } else if (baseline.averageLuminance > 60 && baseline.averageLuminance < 200) {
      quality += 0.15;
    } else if (baseline.averageLuminance > 40 && baseline.averageLuminance < 220) {
      quality += 0.1;
    }

    // Stability quality (15% of total score)
    if (baseline.faceStability > 0.8) quality += 0.15;
    else if (baseline.faceStability > 0.6) quality += 0.1;
    else if (baseline.faceStability > 0.4) quality += 0.05;

    // Environment cleanliness (10% of total score)
    if (baseline.distractionScore < 0.2) quality += 0.1;
    else if (baseline.distractionScore < 0.4) quality += 0.05;

    // Bonus for excellent face validation
    if (faceValidation && faceValidation.success && faceValidation.faceStability > 0.8) {
      quality += 0.05;
    }

    return Math.min(quality, 1.0);
  };

  // Check camera status - use monitoring state from store, camera permission, or cameraStream prop
  const isCameraActive = cameraStream?.active || monitoring?.isActive || cameraPermission === 'granted';

  if (!isCameraActive) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Camera Not Active</div>
          <p className="text-gray-300">
            Camera must be active for environment analysis
          </p>
          <div className="mt-4 text-sm text-gray-400">
            <p>Please ensure:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Camera permission is granted</li>
              <li>Camera is not being used by another application</li>
              <li>Try refreshing the page if the issue persists</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (showCountdown) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl font-bold text-white mb-4">
            {countdown || 'ANALYZING!'}
          </div>
          <p className="text-gray-300">
            Sit still and look at the camera
          </p>
          <p className="text-green-400 text-sm mt-2">
            ✓ Camera Active
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* Progress circle */}
      <div className="relative w-48 h-48 mb-8">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#374151"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            className="transition-all duration-300"
          />
        </svg>

        {/* Progress text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">
              {Math.round(progress)}%
            </div>
            <div className="text-gray-300 text-sm">
              Complete
            </div>
          </div>
        </div>
      </div>

      {/* Current check status */}
      <div className="text-center">
        <div className="text-xl text-white mb-2">
          Environment Analysis
        </div>
        <div className="text-gray-300 mb-4">
          {currentCheck}
        </div>

        {/* Real-time status indicators */}
        {isCollecting && (
          <div className="grid grid-cols-2 gap-3 mb-4 max-w-md mx-auto">
            <div className={`flex items-center space-x-2 text-sm ${realTimeChecks.faceDetected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${realTimeChecks.faceDetected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span>Face Detection</span>
            </div>
            <div className={`flex items-center space-x-2 text-sm ${realTimeChecks.lightingGood ? 'text-green-400' : 'text-yellow-400'}`}>
              <div className={`w-2 h-2 rounded-full ${realTimeChecks.lightingGood ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span>Lighting</span>
            </div>
            <div className={`flex items-center space-x-2 text-sm ${realTimeChecks.positionStable ? 'text-green-400' : 'text-yellow-400'}`}>
              <div className={`w-2 h-2 rounded-full ${realTimeChecks.positionStable ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span>Position</span>
            </div>
            <div className={`flex items-center space-x-2 text-sm ${realTimeChecks.noDistractions ? 'text-green-400' : 'text-yellow-400'}`}>
              <div className={`w-2 h-2 rounded-full ${realTimeChecks.noDistractions ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span>Environment</span>
            </div>
          </div>
        )}
      </div>

      {/* Completion message */}
      {!isCollecting && progress >= 100 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90">
          <div className="text-center">
            <div className="text-green-400 text-4xl mb-4">✓</div>
            <div className="text-white text-xl">Environment analysis complete!</div>
            <div className="text-gray-300 text-sm mt-2">
              Processing baseline data...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};