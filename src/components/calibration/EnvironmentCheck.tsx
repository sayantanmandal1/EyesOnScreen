/**
 * EnvironmentCheck - Environment baseline collection component
 */

import React, { useState, useEffect, useCallback } from 'react';

interface EnvironmentCheckProps {
  onComplete: (data: any) => void;
  isProcessing: boolean;
}

export const EnvironmentCheck: React.FC<EnvironmentCheckProps> = ({
  onComplete,
  isProcessing
}) => {
  const [isCollecting, setIsCollecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [collectedData, setCollectedData] = useState<any[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(true);
  const [currentCheck, setCurrentCheck] = useState('');

  const COLLECTION_DURATION = 10000; // 10 seconds
  const CHECKS = [
    'Analyzing lighting conditions...',
    'Measuring shadow stability...',
    'Detecting face characteristics...',
    'Checking for distractions...',
    'Finalizing environment baseline...'
  ];

  // Start countdown
  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      setShowCountdown(false);
      startEnvironmentCollection();
    }
  }, [countdown, showCountdown]);

  const startEnvironmentCollection = useCallback(() => {
    setIsCollecting(true);
    setProgress(0);
    
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
      
      // Collect mock environment data
      const environmentData = {
        timestamp: Date.now(),
        lightingHistogram: generateMockHistogram(),
        shadowScore: 0.2 + Math.random() * 0.3, // Mock shadow stability
        faceCount: 1,
        objectCount: Math.floor(Math.random() * 2), // 0-1 objects
        luminance: 120 + Math.random() * 40,
        contrast: 0.6 + Math.random() * 0.3
      };
      
      setCollectedData(prev => [...prev, environmentData]);
      
      if (elapsed >= COLLECTION_DURATION) {
        completeEnvironmentCheck();
      }
    };
    
    const dataInterval = setInterval(collectData, interval);
    
    return () => clearInterval(dataInterval);
  }, []);

  const generateMockHistogram = (): number[] => {
    // Generate a mock lighting histogram (256 bins)
    const histogram = new Array(256).fill(0);
    
    // Simulate a normal distribution around mid-tones
    for (let i = 0; i < 256; i++) {
      const distance = Math.abs(i - 128);
      histogram[i] = Math.max(0, 100 - distance * 0.5 + Math.random() * 20);
    }
    
    return histogram;
  };

  const completeEnvironmentCheck = useCallback(() => {
    setIsCollecting(false);
    
    // Calculate environment baseline from collected data
    const baseline = calculateEnvironmentBaseline(collectedData);
    
    onComplete({
      type: 'environment-baseline',
      data: collectedData,
      baseline,
      quality: calculateEnvironmentQuality(baseline)
    });
  }, [collectedData, onComplete]);

  const calculateEnvironmentBaseline = (data: any[]) => {
    if (data.length === 0) return null;
    
    // Calculate average histogram
    const avgHistogram = new Array(256).fill(0);
    data.forEach(sample => {
      sample.lightingHistogram.forEach((value: number, index: number) => {
        avgHistogram[index] += value;
      });
    });
    avgHistogram.forEach((_, index) => {
      avgHistogram[index] /= data.length;
    });
    
    // Calculate other baseline metrics
    const avgLuminance = data.reduce((sum, d) => sum + d.luminance, 0) / data.length;
    const avgShadowScore = data.reduce((sum, d) => sum + d.shadowScore, 0) / data.length;
    const maxFaceCount = Math.max(...data.map(d => d.faceCount));
    const maxObjectCount = Math.max(...data.map(d => d.objectCount));
    
    return {
      lightingHistogram: avgHistogram,
      mean: avgLuminance,
      variance: calculateVariance(data.map(d => d.luminance)),
      shadowStability: 1 - avgShadowScore, // Higher stability = lower shadow score
      faceCount: maxFaceCount,
      objectCount: maxObjectCount,
      timestamp: Date.now()
    };
  };

  const calculateVariance = (values: number[]): number => {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  };

  const calculateEnvironmentQuality = (baseline: any): number => {
    if (!baseline) return 0;
    
    // Quality based on stability and optimal conditions
    let quality = 0.5; // Base quality
    
    // Good lighting conditions
    if (baseline.mean > 80 && baseline.mean < 180) quality += 0.2;
    
    // Low variance (stable lighting)
    if (baseline.variance < 100) quality += 0.2;
    
    // Good shadow stability
    if (baseline.shadowStability > 0.7) quality += 0.1;
    
    // Single face detected
    if (baseline.faceCount === 1) quality += 0.1;
    
    // No distracting objects
    if (baseline.objectCount === 0) quality += 0.1;
    
    return Math.min(quality, 1.0);
  };

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
        
        {/* Instructions */}
        <div className="text-gray-400 text-sm max-w-md">
          Please remain still and maintain good posture. 
          We&apos;re analyzing your environment to ensure optimal monitoring conditions.
        </div>
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