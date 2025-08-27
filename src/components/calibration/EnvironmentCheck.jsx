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

  // Show error screen
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Environment Check Error</div>
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

  // Show initialization screen
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-blue-400 text-xl mb-4">Initializing Face Detection</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-300 mb-2">{currentCheck}</p>
          <p className="text-sm text-gray-400">
            Please allow camera access when prompted
          </p>
        </div>
      </div>
    );
  }

  // Show ready screen with start button
  if (!isCollecting && !isInitializing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-green-400 text-xl mb-4">✓ Face Detection Ready</div>
          <p className="text-gray-300 mb-4">
            Environment analysis will take 10 seconds.<br/>
            Please sit still and look at the camera.
          </p>
          <button
            onClick={startEnvironmentCollection}
            disabled={isProcessing}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-lg font-semibold transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Start Environment Check'}
          </button>
        </div>
      </div>
    );
  }

  // Main collection interface with live video
  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* Hidden video element for MediaPipe */}
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        muted
        playsInline
      />
      
      {/* Live video canvas with face detection overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="rounded-lg border-2 border-gray-600 bg-black"
          />
          
          {/* Live face detection status overlay */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
            {liveFaceData.detected ? (
              <span className="text-green-400">
                ✓ Face Detected ({Math.round(liveFaceData.confidence * 100)}%)
              </span>
            ) : (
              <span className="text-red-400">⚠ No Face Detected</span>
            )}
          </div>
          
          {/* Stability indicator */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
            Stability: {Math.round(liveFaceData.stability * 100)}%
          </div>
        </div>
      </div>

      {/* Progress and status overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white text-lg font-semibold">Environment Analysis</span>
            <span className="text-white text-lg">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current status */}
        <div className="text-center mb-4">
          <div className="text-gray-300 text-sm mb-3">{currentCheck}</div>
          
          {/* Real-time status grid */}
          <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
            <div className={`flex flex-col items-center space-y-1 text-xs ${realTimeChecks.faceDetected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-3 h-3 rounded-full ${realTimeChecks.faceDetected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span>Face</span>
            </div>
            <div className={`flex flex-col items-center space-y-1 text-xs ${realTimeChecks.lightingGood ? 'text-green-400' : 'text-yellow-400'}`}>
              <div className={`w-3 h-3 rounded-full ${realTimeChecks.lightingGood ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span>Light</span>
            </div>
            <div className={`flex flex-col items-center space-y-1 text-xs ${realTimeChecks.positionStable ? 'text-green-400' : 'text-yellow-400'}`}>
              <div className={`w-3 h-3 rounded-full ${realTimeChecks.positionStable ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span>Position</span>
            </div>
            <div className={`flex flex-col items-center space-y-1 text-xs ${realTimeChecks.noDistractions ? 'text-green-400' : 'text-yellow-400'}`}>
              <div className={`w-3 h-3 rounded-full ${realTimeChecks.noDistractions ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span>Focus</span>
            </div>
          </div>
        </div>
      </div>

      {/* Completion overlay */}
      {!isCollecting && progress >= 100 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
          <div className="text-center">
            <div className="text-green-400 text-6xl mb-4">✓</div>
            <div className="text-white text-2xl mb-2">Environment Analysis Complete!</div>
            <div className="text-gray-300">
              Processing baseline data...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};