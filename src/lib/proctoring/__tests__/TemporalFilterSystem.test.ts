/**
 * TemporalFilterSystem tests
 */

import { TemporalFilterSystem, FilterConfig } from '../TemporalFilterSystem';
import { VisionSignals } from '../../vision/types';

describe('TemporalFilterSystem', () => {
  let filterSystem: TemporalFilterSystem;
  let mockSignals: VisionSignals;

  beforeEach(() => {
    filterSystem = new TemporalFilterSystem();
    
    mockSignals = {
      timestamp: Date.now(),
      faceDetected: true,
      landmarks: new Float32Array(Array.from({ length: 1404 }, (_, i) => i * 0.001)),
      headPose: {
        yaw: 5,
        pitch: -2,
        roll: 1,
        confidence: 0.9
      },
      gazeVector: {
        x: 0.1,
        y: 0.2,
        z: 0.97,
        confidence: 0.8
      },
      eyesOnScreen: true,
      environmentScore: {
        lighting: 0.7,
        shadowStability: 0.8,
        secondaryFaces: 0,
        deviceLikeObjects: 0
      }
    };
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const system = new TemporalFilterSystem();
      expect(system).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const customConfig: Partial<FilterConfig> = {
        kalman: {
          processNoise: 0.02,
          measurementNoise: 0.15
        },
        ema: {
          alpha: 0.5
        }
      };

      const system = new TemporalFilterSystem(customConfig);
      expect(system).toBeDefined();
    });
  });

  describe('signal processing', () => {
    it('should process vision signals and return filtered results', () => {
      const filtered = filterSystem.process(mockSignals);

      expect(filtered).toBeDefined();
      expect(filtered.timestamp).toBe(mockSignals.timestamp);
      expect(filtered.faceDetected).toBe(mockSignals.faceDetected);
      expect(filtered.confidence).toBeDefined();
      expect(filtered.stability).toBeDefined();
    });

    it('should maintain signal structure', () => {
      const filtered = filterSystem.process(mockSignals);

      expect(filtered.headPose).toBeDefined();
      expect(filtered.gazeVector).toBeDefined();
      expect(filtered.environmentScore).toBeDefined();
      expect(filtered.landmarks).toBeDefined();
    });

    it('should calculate confidence scores', () => {
      const filtered = filterSystem.process(mockSignals);

      expect(filtered.confidence.overall).toBeGreaterThanOrEqual(0);
      expect(filtered.confidence.overall).toBeLessThanOrEqual(1);
      expect(filtered.confidence.gaze).toBeGreaterThanOrEqual(0);
      expect(filtered.confidence.headPose).toBeGreaterThanOrEqual(0);
      expect(filtered.confidence.landmarks).toBeGreaterThanOrEqual(0);
      expect(filtered.confidence.environment).toBeGreaterThanOrEqual(0);
    });

    it('should calculate stability scores', () => {
      // Process multiple signals to build stability history
      for (let i = 0; i < 10; i++) {
        const signals = {
          ...mockSignals,
          timestamp: Date.now() + i * 100,
          headPose: {
            ...mockSignals.headPose,
            yaw: 5 + Math.random() * 2 - 1, // Small variations
            pitch: -2 + Math.random() * 2 - 1
          },
          gazeVector: {
            ...mockSignals.gazeVector,
            x: 0.1 + Math.random() * 0.02 - 0.01,
            y: 0.2 + Math.random() * 0.02 - 0.01
          }
        };
        filterSystem.process(signals);
      }

      const filtered = filterSystem.process(mockSignals);

      expect(filtered.stability.gaze).toBeGreaterThanOrEqual(0);
      expect(filtered.stability.gaze).toBeLessThanOrEqual(1);
      expect(filtered.stability.headPose).toBeGreaterThanOrEqual(0);
      expect(filtered.stability.headPose).toBeLessThanOrEqual(1);
      expect(filtered.stability.lighting).toBeGreaterThanOrEqual(0);
      expect(filtered.stability.lighting).toBeLessThanOrEqual(1);
    });
  });

  describe('filtering behavior', () => {
    it('should smooth noisy gaze data', () => {
      const noisySignals = Array.from({ length: 10 }, (_, i) => ({
        ...mockSignals,
        timestamp: Date.now() + i * 100,
        gazeVector: {
          x: 0.1 + (Math.random() - 0.5) * 0.4, // High noise
          y: 0.2 + (Math.random() - 0.5) * 0.4,
          z: 0.97 + (Math.random() - 0.5) * 0.1,
          confidence: 0.8
        }
      }));

      const filteredResults = noisySignals.map(signals => filterSystem.process(signals));

      // Check that later results are more stable
      const earlyVariance = calculateGazeVariance(filteredResults.slice(0, 3));
      const lateVariance = calculateGazeVariance(filteredResults.slice(-3));

      expect(lateVariance).toBeLessThanOrEqual(earlyVariance);
    });

    it('should handle missing face detection', () => {
      const noFaceSignals = {
        ...mockSignals,
        faceDetected: false,
        landmarks: new Float32Array(),
        headPose: {
          yaw: 0,
          pitch: 0,
          roll: 0,
          confidence: 0
        },
        gazeVector: {
          x: 0,
          y: 0,
          z: 0,
          confidence: 0
        }
      };

      const filtered = filterSystem.process(noFaceSignals);

      expect(filtered.confidence.landmarks).toBe(0);
      expect(filtered.confidence.overall).toBeLessThan(0.5);
    });

    it('should detect and handle outliers', () => {
      // Process normal signals first
      for (let i = 0; i < 5; i++) {
        filterSystem.process(mockSignals);
      }

      // Introduce outlier
      const outlierSignals = {
        ...mockSignals,
        gazeVector: {
          x: 10, // Extreme outlier
          y: 10,
          z: 10,
          confidence: 0.8
        }
      };

      const filtered = filterSystem.process(outlierSignals);

      // Filtered gaze should be less extreme than input
      expect(Math.abs(filtered.gazeVector.x)).toBeLessThan(Math.abs(outlierSignals.gazeVector.x));
      expect(Math.abs(filtered.gazeVector.y)).toBeLessThan(Math.abs(outlierSignals.gazeVector.y));
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig: Partial<FilterConfig> = {
        ema: {
          alpha: 0.7
        },
        buffer: {
          size: 50
        }
      };

      filterSystem.updateConfig(newConfig);

      // Process signals to verify new config is applied
      const filtered = filterSystem.process(mockSignals);
      expect(filtered).toBeDefined();
    });
  });

  describe('statistics', () => {
    it('should provide filter statistics', () => {
      // Process some signals first
      for (let i = 0; i < 5; i++) {
        filterSystem.process(mockSignals);
      }

      const stats = filterSystem.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.gazeStability).toBeGreaterThanOrEqual(0);
      expect(stats.headPoseStability).toBeGreaterThanOrEqual(0);
      expect(stats.lightingStability).toBeGreaterThanOrEqual(0);
      expect(stats.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.bufferSizes).toBeDefined();
    });

    it('should track buffer sizes correctly', () => {
      for (let i = 0; i < 15; i++) {
        filterSystem.process(mockSignals);
      }

      const stats = filterSystem.getStatistics();

      expect(stats.bufferSizes.gaze).toBeGreaterThan(0);
      expect(stats.bufferSizes.headPose).toBeGreaterThan(0);
      expect(stats.bufferSizes.lighting).toBeGreaterThan(0);
      expect(stats.bufferSizes.confidence).toBeGreaterThan(0);
    });
  });

  describe('reset functionality', () => {
    it('should reset all filters', () => {
      // Process some signals
      for (let i = 0; i < 10; i++) {
        filterSystem.process(mockSignals);
      }

      const statsBeforeReset = filterSystem.getStatistics();
      expect(statsBeforeReset.bufferSizes.gaze).toBeGreaterThan(0);

      filterSystem.reset();

      const statsAfterReset = filterSystem.getStatistics();
      expect(statsAfterReset.bufferSizes.gaze).toBe(0);
      expect(statsAfterReset.bufferSizes.headPose).toBe(0);
      expect(statsAfterReset.bufferSizes.lighting).toBe(0);
      expect(statsAfterReset.bufferSizes.confidence).toBe(0);
    });
  });

});

// Helper function for calculating gaze variance
function calculateGazeVariance(results: any[]): number {
  if (results.length < 2) return 0;

  const gazeX = results.map(r => r.gazeVector.x);
  const meanX = gazeX.reduce((a, b) => a + b, 0) / gazeX.length;
  const varianceX = gazeX.reduce((acc, val) => acc + Math.pow(val - meanX, 2), 0) / gazeX.length;

  return varianceX;
}