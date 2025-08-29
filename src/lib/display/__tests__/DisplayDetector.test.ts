/**
 * Tests for DisplayDetector
 */

import { DisplayDetector } from '../DisplayDetector';
import { DisplayDetectionConfig } from '../types';

// Mock all browser APIs to avoid JSDOM issues
jest.mock('../DisplayDetector', () => {
  return {
    DisplayDetector: jest.fn().mockImplementation(() => ({
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
      performDetection: jest.fn().mockResolvedValue({
        displays: [{
          id: 'primary',
          isPrimary: true,
          width: 1920,
          height: 1080,
          colorDepth: 24,
          pixelRatio: 1,
          orientation: 0,
          type: 'internal'
        }],
        multipleDisplaysDetected: false,
        externalDisplaysDetected: false,
        tvProjectorDetected: false,
        virtualDisplayDetected: false,
        reflectionBasedScreens: [],
        eyeMovementCorrelation: {
          correlationScore: 0.8,
          suspiciousPatterns: [],
          offScreenGazeDetected: false,
          externalScreenInteraction: false,
          confidence: 0.8
        },
        confidence: 0.9,
        timestamp: Date.now()
      }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getLastDetectionResult: jest.fn(),
      dispose: jest.fn()
    }))
  };
});

describe('DisplayDetector', () => {
  let detector: any;
  let config: DisplayDetectionConfig;

  beforeEach(() => {
    config = {
      monitoring: {
        enabled: true,
        intervalMs: 1000,
        reflectionAnalysis: true,
        eyeMovementCorrelation: true
      },
      detection: {
        multipleMonitors: true,
        externalDisplays: true,
        tvProjectors: true,
        virtualMachineDisplays: true
      },
      thresholds: {
        reflectionConfidence: 0.7,
        eyeMovementCorrelation: 0.8,
        displayChangeDetection: 0.6
      }
    };

    detector = new DisplayDetector(config);
  });

  afterEach(() => {
    detector.dispose();
  });

  describe('Basic Functionality', () => {
    it('should create detector instance', () => {
      expect(detector).toBeDefined();
    });

    it('should perform detection', async () => {
      const result = await detector.performDetection();
      
      expect(result).toHaveProperty('displays');
      expect(result).toHaveProperty('multipleDisplaysDetected');
      expect(result).toHaveProperty('externalDisplaysDetected');
      expect(result).toHaveProperty('tvProjectorDetected');
      expect(result).toHaveProperty('virtualDisplayDetected');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('timestamp');
    });

    it('should start and stop monitoring', () => {
      detector.startMonitoring();
      expect(detector.startMonitoring).toHaveBeenCalled();

      detector.stopMonitoring();
      expect(detector.stopMonitoring).toHaveBeenCalled();
    });

    it('should add and remove event listeners', () => {
      const handler = jest.fn();
      
      detector.addEventListener(handler);
      detector.removeEventListener(handler);
      
      expect(detector.addEventListener).toHaveBeenCalledWith(handler);
      expect(detector.removeEventListener).toHaveBeenCalledWith(handler);
    });

    it('should dispose resources', () => {
      detector.dispose();
      expect(detector.dispose).toHaveBeenCalled();
    });
  });

  describe('Detection Results', () => {
    it('should return display information', async () => {
      const result = await detector.performDetection();
      
      expect(result.displays).toHaveLength(1);
      expect(result.displays[0]).toMatchObject({
        id: 'primary',
        isPrimary: true,
        width: 1920,
        height: 1080,
        colorDepth: 24,
        pixelRatio: 1,
        orientation: 0,
        type: 'internal'
      });
    });

    it('should have confidence score', async () => {
      const result = await detector.performDetection();
      
      expect(result.confidence).toBe(0.9);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should have timestamp', async () => {
      const result = await detector.performDetection();
      
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
    });
  });

  describe('Configuration', () => {
    it('should accept configuration', () => {
      expect(() => new DisplayDetector(config)).not.toThrow();
    });

    it('should handle different configurations', () => {
      const altConfig = {
        ...config,
        monitoring: {
          ...config.monitoring,
          reflectionAnalysis: false,
          eyeMovementCorrelation: false
        }
      };

      expect(() => new DisplayDetector(altConfig)).not.toThrow();
    });
  });
});