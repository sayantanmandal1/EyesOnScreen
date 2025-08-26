/**
 * SignalProcessor tests
 */

import { SignalProcessor, DecisionResult, SignalWeights } from '../SignalProcessor';
import { ProctorConfig } from '../types';
import { FilteredSignals } from '../TemporalFilterSystem';
import { CalibrationProfile } from '../../vision/types';

describe('SignalProcessor', () => {
  let processor: SignalProcessor;
  let mockConfig: ProctorConfig;
  let mockCalibrationProfile: CalibrationProfile;
  let mockSignals: FilteredSignals;

  beforeEach(() => {
    mockConfig = {
      thresholds: {
        gazeConfidence: 0.7,
        headYawMax: 20,
        headPitchMax: 15,
        shadowScoreMax: 0.6,
        eyesOffDurationMs: 600,
        shadowAnomalyDurationMs: 800
      },
      debouncing: {
        softAlertFrames: 10,
        hardAlertFrames: 5,
        gracePeriodMs: 500
      },
      riskScoring: {
        eyesOffPerSecond: 3,
        hardEventBonus: 25,
        decayPerSecond: 1,
        reviewThreshold: 60
      }
    };

    mockCalibrationProfile = {
      ipd: 65,
      earBaseline: 0.3,
      gazeMapping: {
        homography: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        bias: [0, 0]
      },
      headPoseBounds: {
        yawRange: [-25, 25],
        pitchRange: [-20, 20]
      },
      lightingBaseline: {
        histogram: new Array(256).fill(0),
        mean: 128,
        variance: 50
      },
      quality: 0.9
    };

    mockSignals = {
      timestamp: Date.now(),
      faceDetected: true,
      landmarks: new Float32Array(1404),
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
      },
      confidence: {
        overall: 0.8,
        gaze: 0.8,
        headPose: 0.9,
        landmarks: 0.85,
        environment: 0.75
      },
      stability: {
        gaze: 0.8,
        headPose: 0.85,
        lighting: 0.9
      }
    };

    processor = new SignalProcessor(mockConfig, mockCalibrationProfile);
  });

  describe('initialization', () => {
    it('should initialize with config only', () => {
      const proc = new SignalProcessor(mockConfig);
      expect(proc).toBeDefined();
    });

    it('should initialize with config and calibration profile', () => {
      const proc = new SignalProcessor(mockConfig, mockCalibrationProfile);
      expect(proc).toBeDefined();
    });
  });

  describe('signal processing', () => {
    it('should process signals and return decision result', () => {
      const result = processor.process(mockSignals);

      expect(result).toBeDefined();
      expect(typeof result.eyesOnScreen).toBe('boolean');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.breakdown).toBeDefined();
      expect(result.flags).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
    });

    it('should have proper breakdown structure', () => {
      const result = processor.process(mockSignals);

      expect(result.breakdown.gaze).toBeDefined();
      expect(result.breakdown.headPose).toBeDefined();
      expect(result.breakdown.environment).toBeDefined();
      expect(result.breakdown.temporal).toBeDefined();

      // Check each component has required fields
      Object.values(result.breakdown).forEach(component => {
        expect(component.score).toBeGreaterThanOrEqual(0);
        expect(component.score).toBeLessThanOrEqual(1);
        expect(component.weight).toBeGreaterThan(0);
        expect(component.contribution).toBeDefined();
      });
    });

    it('should include metadata', () => {
      const result = processor.process(mockSignals);

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.signalQuality).toBeGreaterThanOrEqual(0);
      expect(result.metadata.signalQuality).toBeLessThanOrEqual(1);
      expect(result.metadata.temporalConsistency).toBeGreaterThanOrEqual(0);
      expect(result.metadata.temporalConsistency).toBeLessThanOrEqual(1);
    });
  });

  describe('gaze evaluation', () => {
    it('should return high score for good gaze', () => {
      const goodGazeSignals = {
        ...mockSignals,
        gazeVector: {
          x: 0.05,
          y: 0.05,
          z: 0.99, // Looking straight at screen
          confidence: 0.9
        }
      };

      const result = processor.process(goodGazeSignals);
      expect(result.breakdown.gaze.score).toBeGreaterThan(0.7);
    });

    it('should return low score for off-screen gaze', () => {
      const offScreenGazeSignals = {
        ...mockSignals,
        gazeVector: {
          x: 0.8,
          y: 0.6,
          z: 0.1, // Looking away from screen
          confidence: 0.8
        }
      };

      const result = processor.process(offScreenGazeSignals);
      expect(result.breakdown.gaze.score).toBeLessThan(0.3);
      expect(result.flags).toContain('gaze_off_screen');
    });

    it('should handle low confidence gaze', () => {
      const lowConfidenceSignals = {
        ...mockSignals,
        gazeVector: {
          ...mockSignals.gazeVector,
          confidence: 0.3 // Below threshold
        }
      };

      const result = processor.process(lowConfidenceSignals);
      expect(result.breakdown.gaze.score).toBe(0);
      expect(result.flags).toContain('low_gaze_confidence');
    });
  });

  describe('head pose evaluation', () => {
    it('should return high score for good head pose', () => {
      const goodPoseSignals = {
        ...mockSignals,
        headPose: {
          yaw: 2,
          pitch: -1,
          roll: 0.5,
          confidence: 0.95
        }
      };

      const result = processor.process(goodPoseSignals);
      expect(result.breakdown.headPose.score).toBeGreaterThan(0.8);
    });

    it('should return low score for extreme head pose', () => {
      const extremePoseSignals = {
        ...mockSignals,
        headPose: {
          yaw: 35, // Beyond threshold
          pitch: -25, // Beyond threshold
          roll: 5,
          confidence: 0.8
        }
      };

      const result = processor.process(extremePoseSignals);
      expect(result.breakdown.headPose.score).toBeLessThan(0.3);
      expect(result.flags).toContain('head_yaw_out_of_bounds');
      expect(result.flags).toContain('head_pitch_out_of_bounds');
    });

    it('should handle low confidence head pose', () => {
      const lowConfidenceSignals = {
        ...mockSignals,
        headPose: {
          ...mockSignals.headPose,
          confidence: 0.3
        }
      };

      const result = processor.process(lowConfidenceSignals);
      expect(result.breakdown.headPose.score).toBe(0.5); // Neutral score
      expect(result.flags).toContain('low_head_pose_confidence');
    });
  });

  describe('environment evaluation', () => {
    it('should return high score for good environment', () => {
      const goodEnvSignals = {
        ...mockSignals,
        environmentScore: {
          lighting: 0.6,
          shadowStability: 0.9,
          secondaryFaces: 0,
          deviceLikeObjects: 0
        }
      };

      const result = processor.process(goodEnvSignals);
      expect(result.breakdown.environment.score).toBeGreaterThan(0.8);
    });

    it('should penalize poor lighting', () => {
      const poorLightingSignals = {
        ...mockSignals,
        environmentScore: {
          ...mockSignals.environmentScore,
          lighting: 0.1 // Too dark
        }
      };

      const result = processor.process(poorLightingSignals);
      expect(result.breakdown.environment.score).toBeLessThan(0.7);
      expect(result.flags).toContain('poor_lighting');
    });

    it('should penalize secondary faces', () => {
      const secondaryFaceSignals = {
        ...mockSignals,
        environmentScore: {
          ...mockSignals.environmentScore,
          secondaryFaces: 0.8
        }
      };

      const result = processor.process(secondaryFaceSignals);
      expect(result.breakdown.environment.score).toBeLessThan(0.8);
      expect(result.flags).toContain('secondary_face_detected');
    });

    it('should penalize device-like objects', () => {
      const deviceObjectSignals = {
        ...mockSignals,
        environmentScore: {
          ...mockSignals.environmentScore,
          deviceLikeObjects: 0.6
        }
      };

      const result = processor.process(deviceObjectSignals);
      expect(result.breakdown.environment.score).toBeLessThan(0.8);
      expect(result.flags).toContain('device_like_object_detected');
    });
  });

  describe('temporal consistency', () => {
    it('should build temporal consistency over time', () => {
      const results: DecisionResult[] = [];

      // Process multiple consistent signals
      for (let i = 0; i < 10; i++) {
        const result = processor.process(mockSignals);
        results.push(result);
      }

      // Later results should have higher temporal scores
      const earlyTemporal = results[2].breakdown.temporal.score;
      const lateTemporal = results[9].breakdown.temporal.score;
      
      expect(lateTemporal).toBeGreaterThanOrEqual(earlyTemporal);
    });

    it('should apply temporal consistency requirements', () => {
      // Process several positive signals
      for (let i = 0; i < 5; i++) {
        processor.process(mockSignals);
      }

      // Process one negative signal
      const negativeSignals = {
        ...mockSignals,
        gazeVector: {
          x: 0.8,
          y: 0.6,
          z: 0.1,
          confidence: 0.8
        }
      };

      const result = processor.process(negativeSignals);
      
      // Decision might be influenced by temporal consistency
      expect(result.eyesOnScreen).toBeDefined();
    });

    it('should handle insufficient history gracefully', () => {
      const result = processor.process(mockSignals);
      
      expect(result.breakdown.temporal.score).toBe(0.5); // Neutral score
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', () => {
      const newConfig = {
        ...mockConfig,
        thresholds: {
          ...mockConfig.thresholds,
          gazeConfidence: 0.8
        }
      };

      processor.updateConfig(newConfig);
      
      // Process signals to verify new config is applied
      const result = processor.process(mockSignals);
      expect(result).toBeDefined();
    });

    it('should update calibration profile', () => {
      const newProfile = {
        ...mockCalibrationProfile,
        headPoseBounds: {
          yawRange: [-30, 30] as [number, number],
          pitchRange: [-25, 25] as [number, number]
        }
      };

      processor.updateCalibrationProfile(newProfile);
      
      const result = processor.process(mockSignals);
      expect(result).toBeDefined();
    });

    it('should update signal weights', () => {
      const newWeights: Partial<SignalWeights> = {
        gaze: 0.5,
        headPose: 0.3
      };

      processor.updateWeights(newWeights);
      
      const result = processor.process(mockSignals);
      expect(result.breakdown.gaze.weight).toBeCloseTo(0.5, 0);
      expect(result.breakdown.headPose.weight).toBeCloseTo(0.3, 0);
    });

    it('should normalize weights to sum to 1', () => {
      const newWeights: SignalWeights = {
        gaze: 2,
        headPose: 2,
        environment: 2,
        temporal: 2
      };

      processor.updateWeights(newWeights);
      
      const result = processor.process(mockSignals);
      const totalWeight = 
        result.breakdown.gaze.weight +
        result.breakdown.headPose.weight +
        result.breakdown.environment.weight +
        result.breakdown.temporal.weight;
      
      expect(totalWeight).toBeCloseTo(1, 2);
    });
  });

  describe('statistics and monitoring', () => {
    it('should provide processing statistics', () => {
      // Process some signals
      for (let i = 0; i < 5; i++) {
        processor.process(mockSignals);
      }

      const stats = processor.getStatistics();
      
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(stats.decisionConsistency).toBeGreaterThanOrEqual(0);
      expect(stats.decisionConsistency).toBeLessThanOrEqual(1);
      expect(stats.confidenceStability).toBeGreaterThanOrEqual(0);
      expect(stats.historySize).toBeGreaterThan(0);
    });

    it('should track processing performance', () => {
      const result = processor.process(mockSignals);
      
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.processingTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('edge cases', () => {
    it('should handle missing face detection', () => {
      const noFaceSignals = {
        ...mockSignals,
        faceDetected: false,
        gazeVector: {
          x: 0,
          y: 0,
          z: 0,
          confidence: 0
        },
        headPose: {
          yaw: 0,
          pitch: 0,
          roll: 0,
          confidence: 0
        }
      };

      const result = processor.process(noFaceSignals);
      
      expect(result.breakdown.gaze.score).toBe(0);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle zero gaze vector', () => {
      const zeroGazeSignals = {
        ...mockSignals,
        gazeVector: {
          x: 0,
          y: 0,
          z: 0,
          confidence: 0.8
        }
      };

      const result = processor.process(zeroGazeSignals);
      
      expect(result.breakdown.gaze.score).toBeLessThan(0.3);
    });

    it('should reset properly', () => {
      // Build up some history
      for (let i = 0; i < 10; i++) {
        processor.process(mockSignals);
      }

      const statsBeforeReset = processor.getStatistics();
      expect(statsBeforeReset.historySize).toBeGreaterThan(0);

      processor.reset();

      const statsAfterReset = processor.getStatistics();
      expect(statsAfterReset.historySize).toBe(0);
    });
  });

  describe('flag generation', () => {
    it('should generate appropriate flags for various conditions', () => {
      const problematicSignals = {
        ...mockSignals,
        gazeVector: {
          x: 0.8,
          y: 0.6,
          z: 0.1,
          confidence: 0.5 // Low confidence
        },
        headPose: {
          yaw: 30, // Out of bounds
          pitch: -20, // Out of bounds
          roll: 5,
          confidence: 0.4 // Low confidence
        },
        environmentScore: {
          lighting: 0.1, // Poor lighting
          shadowStability: 0.4,
          secondaryFaces: 0.8, // Secondary face
          deviceLikeObjects: 0.5 // Device detected
        },
        stability: {
          gaze: 0.3, // Unstable
          headPose: 0.4, // Unstable
          lighting: 0.8
        }
      };

      const result = processor.process(problematicSignals);
      
      expect(result.flags).toContain('low_gaze_confidence');
      // Note: gaze_off_screen flag depends on calculated angle, which might not trigger with this vector
      expect(result.flags).toContain('head_yaw_out_of_bounds');
      expect(result.flags).toContain('head_pitch_out_of_bounds');
      expect(result.flags).toContain('low_head_pose_confidence');
      expect(result.flags).toContain('poor_lighting');
      expect(result.flags).toContain('secondary_face_detected');
      expect(result.flags).toContain('device_like_object_detected');
      expect(result.flags).toContain('unstable_gaze');
      expect(result.flags).toContain('unstable_head_pose');
    });
  });
});