/**
 * EnvironmentCalibrator tests
 */

import { EnvironmentCalibrator } from '../EnvironmentCalibrator';
import { EnvironmentCalibrationData } from '../types';

// Mock ImageData for testing
const createMockImageData = (width: number, height: number, pattern: 'uniform' | 'gradient' | 'noisy' = 'uniform') => {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    
    let r, g, b;
    
    switch (pattern) {
      case 'gradient':
        r = g = b = Math.floor((x / width) * 255);
        break;
      case 'noisy':
        r = g = b = Math.floor(Math.random() * 255);
        break;
      default: // uniform
        r = g = b = 128;
    }
    
    data[i] = r;     // Red
    data[i + 1] = g; // Green
    data[i + 2] = b; // Blue
    data[i + 3] = 255; // Alpha
  }
  
  return { data, width, height } as ImageData;
};

describe('EnvironmentCalibrator', () => {
  let calibrator: EnvironmentCalibrator;

  beforeEach(() => {
    calibrator = new EnvironmentCalibrator();
  });

  describe('addCalibrationData', () => {
    it('should add calibration data points', () => {
      const data: EnvironmentCalibrationData = {
        lightingHistogram: new Array(256).fill(0),
        shadowScore: 0.3,
        timestamp: Date.now(),
        faceCount: 1,
        objectCount: 0
      };

      calibrator.addCalibrationData(data);
      expect(calibrator.getDataCount()).toBe(1);
    });
  });

  describe('clearCalibrationData', () => {
    it('should clear all calibration data', () => {
      const data: EnvironmentCalibrationData = {
        lightingHistogram: new Array(256).fill(0),
        shadowScore: 0.3,
        timestamp: Date.now(),
        faceCount: 1,
        objectCount: 0
      };

      calibrator.addCalibrationData(data);
      calibrator.clearCalibrationData();
      expect(calibrator.getDataCount()).toBe(0);
      expect(calibrator.getBaseline()).toBeNull();
    });
  });

  describe('analyzeLightingHistogram', () => {
    it('should analyze uniform lighting', () => {
      const imageData = createMockImageData(100, 100, 'uniform');
      const histogram = calibrator.analyzeLightingHistogram(imageData);
      
      expect(histogram).toHaveLength(256);
      expect(histogram[128]).toBeGreaterThan(0.9); // Most pixels should be at intensity 128
      expect(histogram.reduce((sum, val) => sum + val, 0)).toBeCloseTo(1, 5); // Should sum to 1
    });

    it('should analyze gradient lighting', () => {
      const imageData = createMockImageData(100, 100, 'gradient');
      const histogram = calibrator.analyzeLightingHistogram(imageData);
      
      expect(histogram).toHaveLength(256);
      expect(histogram.reduce((sum, val) => sum + val, 0)).toBeCloseTo(1, 5);
      
      // Gradient should have distribution across intensities
      const nonZeroCount = histogram.filter(val => val > 0).length;
      expect(nonZeroCount).toBeGreaterThan(50); // Should have many different intensities
    });
  });

  describe('measureShadowStability', () => {
    it('should return perfect stability for single frame', () => {
      const frame = createMockImageData(50, 50, 'uniform');
      const stability = calibrator.measureShadowStability([frame]);
      expect(stability).toBe(1.0);
    });

    it('should measure stability across multiple frames', () => {
      const frames = [
        createMockImageData(50, 50, 'uniform'),
        createMockImageData(50, 50, 'uniform'),
        createMockImageData(50, 50, 'uniform')
      ];
      
      const stability = calibrator.measureShadowStability(frames);
      expect(stability).toBeGreaterThan(0.8); // Uniform frames should be very stable
    });

    it('should detect instability in varying frames', () => {
      const frames = [
        createMockImageData(50, 50, 'uniform'),
        createMockImageData(50, 50, 'gradient'),
        createMockImageData(50, 50, 'noisy')
      ];
      
      const stability = calibrator.measureShadowStability(frames);
      expect(stability).toBeLessThan(1.0); // Varying frames should be less stable
    });
  });

  describe('calculateIPD', () => {
    it('should return default IPD for empty landmarks', () => {
      const ipd = calibrator.calculateIPD([], []);
      expect(ipd).toBe(65);
    });

    it('should calculate IPD from landmarks', () => {
      const leftEye = [[10, 20], [12, 18], [14, 20], [12, 22], [10, 20], [8, 20]];
      const rightEye = [[50, 20], [52, 18], [54, 20], [52, 22], [50, 20], [48, 20]];
      
      const ipd = calibrator.calculateIPD(leftEye, rightEye);
      expect(ipd).toBeGreaterThan(0);
      expect(ipd).toBeLessThan(200); // Reasonable range
    });
  });

  describe('calculateEAR', () => {
    it('should return default EAR for insufficient landmarks', () => {
      const ear = calibrator.calculateEAR([[0, 0]]);
      expect(ear).toBe(0.3);
    });

    it('should calculate EAR from eye landmarks', () => {
      const eyeLandmarks = [
        [0, 10],   // Left corner
        [5, 8],    // Top left
        [10, 6],   // Top right
        [20, 10],  // Right corner
        [10, 14],  // Bottom right
        [5, 12]    // Bottom left
      ];
      
      const ear = calibrator.calculateEAR(eyeLandmarks);
      expect(ear).toBeGreaterThan(0);
      expect(ear).toBeLessThan(1);
    });
  });

  describe('detectBaselineBlinkRate', () => {
    it('should return 0 for empty data', () => {
      const blinkRate = calibrator.detectBaselineBlinkRate([], 5000);
      expect(blinkRate).toBe(0);
    });

    it('should detect blinks from EAR values', () => {
      // Simulate EAR values with blinks (drops below 0.25)
      const earValues = [0.3, 0.3, 0.2, 0.15, 0.2, 0.3, 0.3, 0.2, 0.1, 0.2, 0.3];
      const timeSpan = 10000; // 10 seconds
      
      const blinkRate = calibrator.detectBaselineBlinkRate(earValues, timeSpan);
      expect(blinkRate).toBeGreaterThan(0);
      expect(blinkRate).toBeLessThan(60); // Reasonable blink rate per minute
    });
  });

  describe('createBaseline', () => {
    it('should return null with no data', () => {
      const baseline = calibrator.createBaseline();
      expect(baseline).toBeNull();
    });

    it('should create baseline from calibration data', () => {
      // Add sample calibration data
      const sampleData = [
        {
          lightingHistogram: new Array(256).fill(0).map((_, i) => i === 128 ? 0.8 : 0.001),
          shadowScore: 0.2,
          timestamp: Date.now(),
          faceCount: 1,
          objectCount: 0
        },
        {
          lightingHistogram: new Array(256).fill(0).map((_, i) => i === 130 ? 0.7 : 0.001),
          shadowScore: 0.25,
          timestamp: Date.now(),
          faceCount: 1,
          objectCount: 0
        }
      ];

      sampleData.forEach(data => calibrator.addCalibrationData(data));
      
      const baseline = calibrator.createBaseline();
      expect(baseline).not.toBeNull();
      expect(baseline?.lightingHistogram).toHaveLength(256);
      expect(baseline?.mean).toBeGreaterThan(0);
      expect(baseline?.variance).toBeGreaterThanOrEqual(0);
      expect(baseline?.shadowStability).toBeGreaterThan(0);
      expect(baseline?.quality).toBeGreaterThan(0);
    });
  });

  describe('validateEnvironment', () => {
    it('should return invalid without baseline', () => {
      const currentData: EnvironmentCalibrationData = {
        lightingHistogram: new Array(256).fill(0),
        shadowScore: 0.3,
        timestamp: Date.now(),
        faceCount: 1,
        objectCount: 0
      };

      const validation = calibrator.validateEnvironment(currentData);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('No baseline available');
      expect(validation.confidence).toBe(0);
    });

    it('should validate environment against baseline', () => {
      // Create baseline
      const baselineData: EnvironmentCalibrationData = {
        lightingHistogram: new Array(256).fill(0).map((_, i) => i === 128 ? 0.8 : 0.001),
        shadowScore: 0.2,
        timestamp: Date.now(),
        faceCount: 1,
        objectCount: 0
      };

      calibrator.addCalibrationData(baselineData);
      calibrator.createBaseline();

      // Test with similar conditions
      const currentData: EnvironmentCalibrationData = {
        lightingHistogram: new Array(256).fill(0).map((_, i) => i === 130 ? 0.8 : 0.001),
        shadowScore: 0.22,
        timestamp: Date.now(),
        faceCount: 1,
        objectCount: 0
      };

      const validation = calibrator.validateEnvironment(currentData);
      expect(validation.confidence).toBeGreaterThan(0);
      expect(validation.issues).toBeInstanceOf(Array);
    });

    it('should detect significant changes', () => {
      // Create baseline
      const baselineData: EnvironmentCalibrationData = {
        lightingHistogram: new Array(256).fill(0).map((_, i) => i === 128 ? 0.8 : 0.001),
        shadowScore: 0.2,
        timestamp: Date.now(),
        faceCount: 1,
        objectCount: 0
      };

      calibrator.addCalibrationData(baselineData);
      calibrator.createBaseline();

      // Test with very different conditions
      const currentData: EnvironmentCalibrationData = {
        lightingHistogram: new Array(256).fill(0).map((_, i) => i === 200 ? 0.8 : 0.001), // Much brighter
        shadowScore: 0.8, // Much more shadows
        timestamp: Date.now(),
        faceCount: 2, // Additional face
        objectCount: 1 // Additional object
      };

      const validation = calibrator.validateEnvironment(currentData);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.confidence).toBeLessThan(1);
    });
  });
});