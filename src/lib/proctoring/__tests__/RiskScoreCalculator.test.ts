/**
 * RiskScoreCalculator tests
 */

import { RiskScoreCalculator, RiskScoreConfig } from '../RiskScoreCalculator';
import { FlagEvent } from '../types';

describe('RiskScoreCalculator', () => {
  let config: RiskScoreConfig;
  let calculator: RiskScoreCalculator;

  beforeEach(() => {
    config = {
      weights: {
        eyesOff: 3,
        headPose: 2,
        tabBlur: 5,
        secondFace: 10,
        deviceObject: 8,
        shadowAnomaly: 3,
        faceMissing: 4,
        downGlance: 2,
      },
      decayRate: 1, // 1 point per second
      maxScore: 100,
      reviewThreshold: 60,
      cleanBehaviorWindow: 5000, // 5 seconds
    };

    calculator = new RiskScoreCalculator(config);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(calculator.getConfig()).toEqual(config);
    });

    it('should initialize with zero score', () => {
      expect(calculator.getCurrentScore()).toBe(0);
      expect(calculator.isUnderReview()).toBe(false);
    });
  });

  describe('flag processing', () => {
    it('should add points for soft flags', () => {
      const flag: FlagEvent = {
        id: 'test-1',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.8,
        details: {},
      };

      const score = calculator.processFlag(flag);
      
      // Base points (3) * confidence multiplier (0.5 + 0.8 * 0.5 = 0.9) = 2.7
      expect(score).toBeCloseTo(2.7, 1);
    });

    it('should add more points for hard flags', () => {
      const flag: FlagEvent = {
        id: 'test-2',
        timestamp: Date.now(),
        type: 'SECOND_FACE',
        severity: 'hard',
        confidence: 0.9,
        details: {},
      };

      const score = calculator.processFlag(flag);
      
      // Base points (10) * severity multiplier (1.5) * confidence multiplier (0.95) = 14.25
      expect(score).toBeCloseTo(14.25, 1);
    });

    it('should handle duration-based flags', () => {
      const flag: FlagEvent = {
        id: 'test-3',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 1.0,
        details: { duration: 2000 }, // 2 seconds
      };

      const score = calculator.processFlag(flag);
      
      // Base points (3) * confidence multiplier (1.0) * duration multiplier (2) = 6
      expect(score).toBeCloseTo(6, 1);
    });

    it('should cap score at maximum', () => {
      const flag: FlagEvent = {
        id: 'test-4',
        timestamp: Date.now(),
        type: 'SECOND_FACE',
        severity: 'hard',
        confidence: 1.0,
        details: {},
      };

      // Process enough flags to exceed maximum
      for (let i = 0; i < 10; i++) {
        calculator.processFlag({ ...flag, id: `test-4-${i}` });
      }

      expect(calculator.getCurrentScore()).toBe(config.maxScore);
    });

    it('should track flag history', () => {
      const flags: FlagEvent[] = [
        {
          id: 'test-5a',
          timestamp: Date.now(),
          type: 'EYES_OFF',
          severity: 'soft',
          confidence: 0.8,
          details: {},
        },
        {
          id: 'test-5b',
          timestamp: Date.now() + 1000,
          type: 'HEAD_POSE',
          severity: 'soft',
          confidence: 0.7,
          details: {},
        },
      ];

      flags.forEach(flag => calculator.processFlag(flag));

      const history = calculator.getFlagHistory();
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('EYES_OFF');
      expect(history[1].type).toBe('HEAD_POSE');
    });
  });

  describe('score decay', () => {
    it('should apply decay after clean behavior window', () => {
      const flag: FlagEvent = {
        id: 'decay-test-1',
        timestamp: Date.now(),
        type: 'TAB_BLUR',
        severity: 'soft',
        confidence: 1.0,
        details: {},
      };

      // Add initial score
      calculator.processFlag(flag);
      const initialScore = calculator.getCurrentScore();
      expect(initialScore).toBeGreaterThan(0);

      // Simulate time passing beyond clean behavior window
      const futureTime = Date.now() + config.cleanBehaviorWindow + 2000; // 7 seconds later
      const decayedScore = calculator.updateScore(futureTime);

      // Score should be lower due to decay
      expect(decayedScore).toBeLessThan(initialScore);
    });

    it('should not apply decay within clean behavior window', () => {
      const flag: FlagEvent = {
        id: 'decay-test-2',
        timestamp: Date.now(),
        type: 'TAB_BLUR',
        severity: 'soft',
        confidence: 1.0,
        details: {},
      };

      calculator.processFlag(flag);
      const initialScore = calculator.getCurrentScore();

      // Simulate time passing within clean behavior window
      const nearFutureTime = Date.now() + config.cleanBehaviorWindow - 1000; // 4 seconds later
      const score = calculator.updateScore(nearFutureTime);

      // Score should remain the same
      expect(score).toBe(initialScore);
    });

    it('should decay score to zero over time', () => {
      const flag: FlagEvent = {
        id: 'decay-test-3',
        timestamp: Date.now(),
        type: 'HEAD_POSE',
        severity: 'soft',
        confidence: 1.0,
        details: {},
      };

      calculator.processFlag(flag);
      const initialScore = calculator.getCurrentScore();

      // Simulate a very long time passing
      const veryFutureTime = Date.now() + config.cleanBehaviorWindow + (initialScore * 1000); // Enough time to decay to 0
      const finalScore = calculator.updateScore(veryFutureTime);

      expect(finalScore).toBe(0);
    });
  });

  describe('under review marking', () => {
    it('should mark as under review when threshold is exceeded', () => {
      const flag: FlagEvent = {
        id: 'review-test-1',
        timestamp: Date.now(),
        type: 'SECOND_FACE',
        severity: 'hard',
        confidence: 1.0,
        details: {},
      };

      // Process enough flags to exceed review threshold
      for (let i = 0; i < 5; i++) {
        calculator.processFlag({ ...flag, id: `review-test-1-${i}` });
      }

      expect(calculator.isUnderReview()).toBe(true);
      expect(calculator.getCurrentScore()).toBeGreaterThanOrEqual(config.reviewThreshold);
    });

    it('should not mark as under review below threshold', () => {
      const flag: FlagEvent = {
        id: 'review-test-2',
        timestamp: Date.now(),
        type: 'DOWN_GLANCE',
        severity: 'soft',
        confidence: 0.5,
        details: {},
      };

      calculator.processFlag(flag);

      expect(calculator.isUnderReview()).toBe(false);
      expect(calculator.getCurrentScore()).toBeLessThan(config.reviewThreshold);
    });

    it('should allow manual under review marking', () => {
      expect(calculator.isUnderReview()).toBe(false);

      calculator.markUnderReview('Manual review requested');

      expect(calculator.isUnderReview()).toBe(true);
    });
  });

  describe('risk level assessment', () => {
    it('should return correct risk levels', () => {
      // Low risk
      expect(calculator.getRiskLevel()).toBe('low');

      // Medium risk (need to reach 30 points for 50% of 60 threshold)
      const mediumFlag: FlagEvent = {
        id: 'risk-medium',
        timestamp: Date.now(),
        type: 'DEVICE_OBJECT', // 8 base points
        severity: 'hard', // 1.5x multiplier
        confidence: 1.0, // 1.0x multiplier
        details: {},
      };
      
      // 8 * 1.5 * 1.0 = 12 points per flag, need 3 flags for ~36 points
      for (let i = 0; i < 3; i++) {
        calculator.processFlag({ ...mediumFlag, id: `risk-medium-${i}` });
      }
      expect(calculator.getRiskLevel()).toBe('medium');

      // High risk (need to reach 45 points for 75% of 60 threshold)
      const highFlag: FlagEvent = {
        id: 'risk-high',
        timestamp: Date.now(),
        type: 'SECOND_FACE', // 10 base points
        severity: 'soft', // 1.0x multiplier
        confidence: 1.0, // 1.0x multiplier
        details: {},
      };
      
      // Add one more flag: 10 * 1.0 * 1.0 = 10 points, total ~46 points
      calculator.processFlag(highFlag);
      expect(calculator.getRiskLevel()).toBe('high');

      // Critical risk (need to reach 60+ points)
      const criticalFlag: FlagEvent = {
        id: 'risk-critical',
        timestamp: Date.now(),
        type: 'SECOND_FACE',
        severity: 'hard', // 1.5x multiplier
        confidence: 1.0,
        details: {},
      };
      
      // 10 * 1.5 * 1.0 = 15 points, should push us over 60
      calculator.processFlag(criticalFlag);
      expect(calculator.getRiskLevel()).toBe('critical');
      expect(calculator.isUnderReview()).toBe(true);
    });
  });

  describe('risk assessment', () => {
    it('should provide detailed risk assessment', () => {
      const flags: FlagEvent[] = [
        {
          id: 'assessment-1',
          timestamp: Date.now(),
          type: 'EYES_OFF',
          severity: 'soft',
          confidence: 0.8,
          details: {},
        },
        {
          id: 'assessment-2',
          timestamp: Date.now() + 1000,
          type: 'EYES_OFF',
          severity: 'soft',
          confidence: 0.9,
          details: {},
        },
        {
          id: 'assessment-3',
          timestamp: Date.now() + 2000,
          type: 'TAB_BLUR',
          severity: 'hard',
          confidence: 1.0,
          details: {},
        },
      ];

      flags.forEach(flag => calculator.processFlag(flag));

      const assessment = calculator.getRiskAssessment();

      expect(assessment.score).toBeGreaterThan(0);
      expect(assessment.flagCount).toBe(3);
      expect(assessment.breakdown.EYES_OFF.count).toBe(2);
      expect(assessment.breakdown.TAB_BLUR.count).toBe(1);
      expect(assessment.lastFlagTime).toBeGreaterThan(0);
    });
  });

  describe('score timeline', () => {
    it('should generate score timeline', () => {
      const flag: FlagEvent = {
        id: 'timeline-test',
        timestamp: Date.now(),
        type: 'HEAD_POSE',
        severity: 'soft',
        confidence: 1.0,
        details: {},
      };

      calculator.processFlag(flag);

      const timeline = calculator.getScoreTimeline(1000);

      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline[0]).toHaveProperty('timestamp');
      expect(timeline[0]).toHaveProperty('score');
    });

    it('should return single point for no flags', () => {
      const timeline = calculator.getScoreTimeline();

      expect(timeline).toHaveLength(1);
      expect(timeline[0].score).toBe(0);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = {
        reviewThreshold: 80,
        decayRate: 2,
      };

      calculator.updateConfig(newConfig);

      const updatedConfig = calculator.getConfig();
      expect(updatedConfig.reviewThreshold).toBe(80);
      expect(updatedConfig.decayRate).toBe(2);
    });

    it('should re-evaluate under review status on threshold change', () => {
      // Set score to exceed threshold
      const flag: FlagEvent = {
        id: 'config-test',
        timestamp: Date.now(),
        type: 'SECOND_FACE', // 10 base points
        severity: 'hard', // 1.5x multiplier
        confidence: 1.0, // 1.0x multiplier
        details: {},
      };

      // 10 * 1.5 * 1.0 = 15 points per flag
      // Need 4 flags for 60 points to exceed threshold
      for (let i = 0; i < 4; i++) {
        calculator.processFlag({ ...flag, id: `config-test-${i}` });
      }

      expect(calculator.getCurrentScore()).toBeGreaterThanOrEqual(60);
      expect(calculator.isUnderReview()).toBe(true); // Should be under review with default threshold

      // Lower threshold
      calculator.updateConfig({ reviewThreshold: 30 });
      expect(calculator.isUnderReview()).toBe(true); // Should still be under review
    });
  });

  describe('projected score', () => {
    it('should project score with decay', () => {
      const flag: FlagEvent = {
        id: 'projection-test',
        timestamp: Date.now(),
        type: 'TAB_BLUR',
        severity: 'soft',
        confidence: 1.0,
        details: {},
      };

      calculator.processFlag(flag);
      const currentScore = calculator.getCurrentScore();

      // Project score 10 seconds into future (after clean behavior window)
      const projectedScore = calculator.getProjectedScore(config.cleanBehaviorWindow + 10000);

      expect(projectedScore).toBeLessThan(currentScore);
    });

    it('should project same score for recent flags', () => {
      const flag: FlagEvent = {
        id: 'projection-test-2',
        timestamp: Date.now(),
        type: 'HEAD_POSE',
        severity: 'soft',
        confidence: 1.0,
        details: {},
      };

      calculator.processFlag(flag);
      const currentScore = calculator.getCurrentScore();

      // Project score 2 seconds into future (within clean behavior window)
      const projectedScore = calculator.getProjectedScore(2000);

      expect(projectedScore).toBe(currentScore);
    });
  });

  describe('state management', () => {
    it('should reset state', () => {
      const flag: FlagEvent = {
        id: 'reset-test',
        timestamp: Date.now(),
        type: 'SECOND_FACE',
        severity: 'hard',
        confidence: 1.0,
        details: {},
      };

      calculator.processFlag(flag);
      expect(calculator.getCurrentScore()).toBeGreaterThan(0);

      calculator.reset();

      expect(calculator.getCurrentScore()).toBe(0);
      expect(calculator.isUnderReview()).toBe(false);
      expect(calculator.getFlagHistory()).toHaveLength(0);
    });

    it('should provide current state for debugging', () => {
      const state = calculator.getState();

      expect(state).toHaveProperty('currentScore');
      expect(state).toHaveProperty('lastFlagTime');
      expect(state).toHaveProperty('flagHistory');
      expect(state).toHaveProperty('isUnderReview');
    });
  });

  describe('edge cases', () => {
    it('should handle zero confidence flags', () => {
      const flag: FlagEvent = {
        id: 'zero-confidence',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0,
        details: {},
      };

      const score = calculator.processFlag(flag);

      // Should still add some points (base * severity * 0.5)
      expect(score).toBeGreaterThan(0);
    });

    it('should handle unknown flag types', () => {
      const flag: FlagEvent = {
        id: 'unknown-type',
        timestamp: Date.now(),
        type: 'UNKNOWN_TYPE' as any,
        severity: 'soft',
        confidence: 1.0,
        details: {},
      };

      expect(() => {
        calculator.processFlag(flag);
      }).not.toThrow();

      expect(calculator.getCurrentScore()).toBeGreaterThan(0);
    });

    it('should handle flags without details', () => {
      const flag: FlagEvent = {
        id: 'no-details',
        timestamp: Date.now(),
        type: 'HEAD_POSE',
        severity: 'soft',
        confidence: 1.0,
        details: {},
      };

      expect(() => {
        calculator.processFlag(flag);
      }).not.toThrow();
    });

    it('should handle rapid flag processing', () => {
      const flags = Array.from({ length: 100 }, (_, i) => ({
        id: `rapid-${i}`,
        timestamp: Date.now() + i,
        type: 'DOWN_GLANCE' as const,
        severity: 'soft' as const,
        confidence: 0.5,
        details: {},
      }));

      flags.forEach(flag => calculator.processFlag(flag));

      expect(calculator.getCurrentScore()).toBeLessThanOrEqual(config.maxScore);
      expect(calculator.getFlagHistory()).toHaveLength(100);
    });
  });
});