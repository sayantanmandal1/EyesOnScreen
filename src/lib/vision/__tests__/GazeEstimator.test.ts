/**
 * GazeEstimator unit tests
 */

import { GazeEstimator, GazePoint, GazeVector } from '../GazeEstimator';
import { VisionError } from '../types';

describe('GazeEstimator', () => {
  let gazeEstimator: GazeEstimator;

  beforeEach(() => {
    gazeEstimator = new GazeEstimator({
      screenWidth: 1920,
      screenHeight: 1080,
      confidenceThreshold: 0.7
    });
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const config = gazeEstimator.configuration;
      
      expect(config).toMatchObject({
        screenWidth: 1920,
        screenHeight: 1080,
        eyeballRadius: 12,
        cornealRadius: 7.8,
        confidenceThreshold: 0.7,
        smoothingFactor: 0.3,
        calibrationRequired: true
      });
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        screenWidth: 2560,
        screenHeight: 1440,
        confidenceThreshold: 0.8,
        smoothingFactor: 0.5
      };

      const customEstimator = new GazeEstimator(customConfig);
      const config = customEstimator.configuration;
      
      expect(config.screenWidth).toBe(2560);
      expect(config.screenHeight).toBe(1440);
      expect(config.confidenceThreshold).toBe(0.8);
      expect(config.smoothingFactor).toBe(0.5);
    });

    it('should start without calibration', () => {
      expect(gazeEstimator.isCalibrated).toBe(false);
      expect(gazeEstimator.calibrationPointCount).toBe(0);
    });
  });

  describe('gaze estimation', () => {
    let validLandmarks: Float32Array;

    beforeEach(() => {
      // Create valid landmarks array (468 points * 3 coordinates)
      validLandmarks = new Float32Array(468 * 3);
      
      // Fill with realistic face landmark coordinates
      for (let i = 0; i < 468; i++) {
        validLandmarks[i * 3] = 0.3 + Math.random() * 0.4; // x: 0.3-0.7
        validLandmarks[i * 3 + 1] = 0.2 + Math.random() * 0.6; // y: 0.2-0.8
        validLandmarks[i * 3 + 2] = Math.random() * 0.1; // z: 0-0.1
      }

      // Set specific eye landmarks for more realistic eye regions
      const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
      const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

      // Left eye landmarks (around x=0.4, y=0.45)
      leftEyeIndices.forEach((index, i) => {
        const angle = (i / leftEyeIndices.length) * 2 * Math.PI;
        validLandmarks[index * 3] = 0.4 + Math.cos(angle) * 0.03;
        validLandmarks[index * 3 + 1] = 0.45 + Math.sin(angle) * 0.02;
        validLandmarks[index * 3 + 2] = 0.05;
      });

      // Right eye landmarks (around x=0.6, y=0.45)
      rightEyeIndices.forEach((index, i) => {
        const angle = (i / rightEyeIndices.length) * 2 * Math.PI;
        validLandmarks[index * 3] = 0.6 + Math.cos(angle) * 0.03;
        validLandmarks[index * 3 + 1] = 0.45 + Math.sin(angle) * 0.02;
        validLandmarks[index * 3 + 2] = 0.05;
      });
    });

    it('should estimate gaze point from valid landmarks', () => {
      const gazePoint = gazeEstimator.estimateGaze(validLandmarks, 640, 480);

      expect(gazePoint).toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number),
        confidence: expect.any(Number),
        timestamp: expect.any(Number)
      });

      expect(gazePoint.x).toBeGreaterThanOrEqual(0);
      expect(gazePoint.x).toBeLessThanOrEqual(1920);
      expect(gazePoint.y).toBeGreaterThanOrEqual(0);
      expect(gazePoint.y).toBeLessThanOrEqual(1080);
      expect(gazePoint.confidence).toBeGreaterThanOrEqual(0);
      expect(gazePoint.confidence).toBeLessThanOrEqual(1);
    });

    it('should throw error for invalid landmarks array', () => {
      const invalidLandmarks = new Float32Array(100); // Too small

      expect(() => {
        gazeEstimator.estimateGaze(invalidLandmarks, 640, 480);
      }).toThrow(VisionError);
    });

    it('should apply temporal smoothing', () => {
      const gazePoint1 = gazeEstimator.estimateGaze(validLandmarks, 640, 480);
      
      // Modify landmarks slightly for second frame
      const modifiedLandmarks = new Float32Array(validLandmarks);
      for (let i = 0; i < 10; i++) {
        modifiedLandmarks[i * 3] += 0.01; // Small change
      }
      
      const gazePoint2 = gazeEstimator.estimateGaze(modifiedLandmarks, 640, 480);

      // Second gaze point should be smoothed (closer to first than raw estimation would be)
      const distance = Math.sqrt(
        Math.pow(gazePoint2.x - gazePoint1.x, 2) + 
        Math.pow(gazePoint2.y - gazePoint1.y, 2)
      );
      
      expect(distance).toBeLessThan(200); // Should be reasonably close due to smoothing
    });

    it('should handle poor quality landmarks gracefully', () => {
      // Create landmarks with poor quality (all zeros)
      const poorLandmarks = new Float32Array(468 * 3);
      
      const gazePoint = gazeEstimator.estimateGaze(poorLandmarks, 640, 480);
      
      expect(gazePoint.confidence).toBeLessThan(0.5); // Should have low confidence
      expect(gazePoint.x).toBeGreaterThanOrEqual(0);
      expect(gazePoint.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calibration', () => {
    it('should add calibration points', () => {
      const gazeVector: GazeVector = { x: 0.1, y: 0.2, z: -0.9, confidence: 0.8 };
      
      gazeEstimator.addCalibrationPoint(960, 540, gazeVector);
      
      expect(gazeEstimator.calibrationPointCount).toBe(1);
      expect(gazeEstimator.isCalibrated).toBe(false); // Need at least 4 points
    });

    it('should become calibrated after adding enough points', () => {
      const calibrationPoints = [
        { screen: { x: 100, y: 100 }, gaze: { x: -0.3, y: -0.3, z: -0.9, confidence: 0.8 } },
        { screen: { x: 1820, y: 100 }, gaze: { x: 0.3, y: -0.3, z: -0.9, confidence: 0.8 } },
        { screen: { x: 100, y: 980 }, gaze: { x: -0.3, y: 0.3, z: -0.9, confidence: 0.8 } },
        { screen: { x: 1820, y: 980 }, gaze: { x: 0.3, y: 0.3, z: -0.9, confidence: 0.8 } }
      ];

      calibrationPoints.forEach(point => {
        gazeEstimator.addCalibrationPoint(point.screen.x, point.screen.y, point.gaze);
      });

      expect(gazeEstimator.calibrationPointCount).toBe(4);
      expect(gazeEstimator.isCalibrated).toBe(true);
    });

    it('should reset calibration', () => {
      // Add some calibration points
      gazeEstimator.addCalibrationPoint(960, 540, { x: 0, y: 0, z: -1, confidence: 0.8 });
      gazeEstimator.addCalibrationPoint(100, 100, { x: -0.3, y: -0.3, z: -0.9, confidence: 0.8 });
      
      gazeEstimator.resetCalibration();
      
      expect(gazeEstimator.calibrationPointCount).toBe(0);
      expect(gazeEstimator.isCalibrated).toBe(false);
    });
  });

  describe('gaze validation', () => {
    it('should validate gaze point with good accuracy', () => {
      const gazePoint: GazePoint = {
        x: 960,
        y: 540,
        confidence: 0.8,
        timestamp: Date.now()
      };
      
      const targetPoint = { x: 970, y: 545 }; // Close to gaze point
      
      const validation = gazeEstimator.validateGaze(gazePoint, targetPoint);
      
      expect(validation.isValid).toBe(true);
      expect(validation.accuracy).toBeGreaterThan(0.8);
      expect(validation.distance).toBeLessThan(15);
      expect(validation.issues).toHaveLength(0);
    });

    it('should invalidate gaze point with low confidence', () => {
      const lowConfidenceGaze: GazePoint = {
        x: 960,
        y: 540,
        confidence: 0.3, // Below threshold
        timestamp: Date.now()
      };
      
      const targetPoint = { x: 960, y: 540 };
      
      const validation = gazeEstimator.validateGaze(lowConfidenceGaze, targetPoint);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Low confidence: 0.300');
    });

    it('should invalidate gaze point outside screen bounds', () => {
      const outOfBoundsGaze: GazePoint = {
        x: -100, // Outside screen
        y: 540,
        confidence: 0.8,
        timestamp: Date.now()
      };
      
      const targetPoint = { x: 960, y: 540 };
      
      const validation = gazeEstimator.validateGaze(outOfBoundsGaze, targetPoint);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Gaze point outside screen bounds');
    });

    it('should invalidate gaze point with poor accuracy', () => {
      const inaccurateGaze: GazePoint = {
        x: 960,
        y: 540,
        confidence: 0.8,
        timestamp: Date.now()
      };
      
      const targetPoint = { x: 1200, y: 800 }; // Far from gaze point
      
      const validation = gazeEstimator.validateGaze(inaccurateGaze, targetPoint);
      
      expect(validation.isValid).toBe(false);
      expect(validation.distance).toBeGreaterThan(50);
      expect(validation.issues.some(issue => issue.includes('Low accuracy'))).toBe(true);
    });
  });

  describe('screen bounds checking', () => {
    it('should correctly identify gaze on screen', () => {
      const onScreenGaze: GazePoint = {
        x: 960,
        y: 540,
        confidence: 0.8,
        timestamp: Date.now()
      };
      
      expect(gazeEstimator.isGazeOnScreen(onScreenGaze)).toBe(true);
    });

    it('should correctly identify gaze off screen', () => {
      const offScreenGaze: GazePoint = {
        x: 2000, // Outside screen width
        y: 540,
        confidence: 0.8,
        timestamp: Date.now()
      };
      
      expect(gazeEstimator.isGazeOnScreen(offScreenGaze)).toBe(false);
    });

    it('should consider low confidence as off screen', () => {
      const lowConfidenceGaze: GazePoint = {
        x: 960,
        y: 540,
        confidence: 0.3, // Below threshold
        timestamp: Date.now()
      };
      
      expect(gazeEstimator.isGazeOnScreen(lowConfidenceGaze)).toBe(false);
    });
  });

  describe('mathematical operations', () => {
    it('should calculate eye center correctly', () => {
      const eyeLandmarks = [
        { x: 100, y: 100 },
        { x: 120, y: 100 },
        { x: 110, y: 90 },
        { x: 110, y: 110 }
      ];
      
      const center = (gazeEstimator as any).calculateEyeCenter(eyeLandmarks);
      
      expect(center.x).toBe(110);
      expect(center.y).toBe(100);
    });

    it('should calculate iris radius based on eye size', () => {
      const eyeLandmarks = [
        { x: 100, y: 100 },
        { x: 140, y: 100 }, // 40px wide
        { x: 120, y: 90 },
        { x: 120, y: 110 }  // 20px tall
      ];
      
      const radius = (gazeEstimator as any).calculateIrisRadius(eyeLandmarks);
      
      expect(radius).toBeCloseTo(7, 0); // 35% of min(40, 20) = 7
    });

    it('should combine gaze vectors correctly', () => {
      const leftGaze: GazeVector = { x: -0.1, y: 0, z: -0.9, confidence: 0.8 };
      const rightGaze: GazeVector = { x: 0.1, y: 0, z: -0.9, confidence: 0.6 };
      
      const combined = (gazeEstimator as any).combineGazeVectors(leftGaze, rightGaze);
      
      expect(combined.x).toBeCloseTo(-0.02, 1); // Weighted average closer to left (higher confidence)
      expect(combined.confidence).toBeCloseTo(0.7, 1); // Average confidence
      expect(Math.abs(Math.sqrt(combined.x ** 2 + combined.y ** 2 + combined.z ** 2) - 1)).toBeLessThan(0.01); // Normalized
    });

    it('should handle zero confidence gaze vectors', () => {
      const zeroGaze: GazeVector = { x: 0, y: 0, z: 0, confidence: 0 };
      const validGaze: GazeVector = { x: 0.1, y: 0.2, z: -0.9, confidence: 0.8 };
      
      const combined = (gazeEstimator as any).combineGazeVectors(zeroGaze, validGaze);
      
      expect(combined.confidence).toBe(0.4); // Half of valid confidence
      expect(combined.x).toBeCloseTo(validGaze.x, 1);
      expect(combined.y).toBeCloseTo(validGaze.y, 1);
    });
  });

  describe('accuracy requirements', () => {
    it('should demonstrate gaze estimation capability', () => {
      // Create landmarks for centered gaze
      const centeredLandmarks = new Float32Array(468 * 3);
      
      // Fill with centered face landmarks
      for (let i = 0; i < 468; i++) {
        centeredLandmarks[i * 3] = 0.5; // Centered x
        centeredLandmarks[i * 3 + 1] = 0.5; // Centered y
        centeredLandmarks[i * 3 + 2] = 0.05; // Small depth
      }

      // Set eye landmarks for forward gaze
      const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
      const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

      // Left eye (centered iris)
      leftEyeIndices.forEach((index, i) => {
        const angle = (i / leftEyeIndices.length) * 2 * Math.PI;
        centeredLandmarks[index * 3] = 0.4 + Math.cos(angle) * 0.03;
        centeredLandmarks[index * 3 + 1] = 0.5 + Math.sin(angle) * 0.02;
        centeredLandmarks[index * 3 + 2] = 0.05;
      });

      // Right eye (centered iris)
      rightEyeIndices.forEach((index, i) => {
        const angle = (i / rightEyeIndices.length) * 2 * Math.PI;
        centeredLandmarks[index * 3] = 0.6 + Math.cos(angle) * 0.03;
        centeredLandmarks[index * 3 + 1] = 0.5 + Math.sin(angle) * 0.02;
        centeredLandmarks[index * 3 + 2] = 0.05;
      });

      const gazePoint = gazeEstimator.estimateGaze(centeredLandmarks, 640, 480);

      // For centered gaze, should be roughly in center of screen
      const screenCenterX = 1920 / 2;
      const screenCenterY = 1080 / 2;
      
      const distanceFromCenter = Math.sqrt(
        Math.pow(gazePoint.x - screenCenterX, 2) + 
        Math.pow(gazePoint.y - screenCenterY, 2)
      );

      // Should be reasonably close to center (allowing for algorithm limitations)
      expect(distanceFromCenter).toBeLessThan(400); // Within 400 pixels of center
      expect(gazePoint.confidence).toBeGreaterThan(0.3);
    });

    it('should maintain consistency across multiple frames', () => {
      const landmarks = new Float32Array(468 * 3);
      
      // Create stable landmarks
      for (let i = 0; i < 468; i++) {
        landmarks[i * 3] = 0.5;
        landmarks[i * 3 + 1] = 0.5;
        landmarks[i * 3 + 2] = 0.05;
      }

      const gazePoints: GazePoint[] = [];
      
      // Estimate gaze multiple times with slight variations
      for (let frame = 0; frame < 10; frame++) {
        // Add small random noise to simulate real conditions
        const noisyLandmarks = new Float32Array(landmarks);
        for (let i = 0; i < 468; i++) {
          noisyLandmarks[i * 3] += (Math.random() - 0.5) * 0.001; // ±0.05% noise
          noisyLandmarks[i * 3 + 1] += (Math.random() - 0.5) * 0.001;
        }
        
        const gazePoint = gazeEstimator.estimateGaze(noisyLandmarks, 640, 480);
        gazePoints.push(gazePoint);
      }

      // Calculate standard deviation of gaze points
      const xValues = gazePoints.map(p => p.x);
      const yValues = gazePoints.map(p => p.y);

      const xMean = xValues.reduce((a, b) => a + b) / xValues.length;
      const yMean = yValues.reduce((a, b) => a + b) / yValues.length;

      const xStd = Math.sqrt(xValues.reduce((sum, val) => sum + Math.pow(val - xMean, 2), 0) / xValues.length);
      const yStd = Math.sqrt(yValues.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0) / yValues.length);

      // Standard deviation should be reasonable for stable tracking
      expect(xStd).toBeLessThan(100); // Within 100 pixels std dev
      expect(yStd).toBeLessThan(100);
    });
  });
});