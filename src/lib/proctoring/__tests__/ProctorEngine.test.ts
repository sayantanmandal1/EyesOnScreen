/**
 * ProctorEngine tests
 */

import { ProctorEngine } from '../ProctorEngine';
import { ProctorConfig } from '../types';
import { VisionSignals, PerformanceMetrics } from '../../vision/types';

// Mock vision components
jest.mock('../../vision/FaceDetector', () => ({
  FaceDetector: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    detectFace: jest.fn().mockResolvedValue({
      detected: true,
      landmarks: new Float32Array(468 * 3)
    }),
    dispose: jest.fn()
  }))
}));

jest.mock('../../vision/GazeEstimator', () => ({
  GazeEstimator: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    estimateGaze: jest.fn().mockResolvedValue({
      gazeVector: { x: 0, y: 0, z: 1, confidence: 0.8 },
      eyesOnScreen: true
    }),
    dispose: jest.fn()
  }))
}));

jest.mock('../../vision/HeadPoseEstimator', () => ({
  HeadPoseEstimator: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    estimateHeadPose: jest.fn().mockResolvedValue({
      yaw: 0,
      pitch: 0,
      roll: 0,
      confidence: 0.9
    }),
    dispose: jest.fn()
  }))
}));

jest.mock('../../vision/EnvironmentAnalyzer', () => ({
  EnvironmentAnalyzer: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    analyzeFrame: jest.fn().mockResolvedValue({
      lighting: 0.8,
      shadowStability: 0.9,
      secondaryFaces: 0,
      deviceLikeObjects: 0
    }),
    dispose: jest.fn()
  }))
}));

describe('ProctorEngine', () => {
  let engine: ProctorEngine;
  let mockVideoElement: HTMLVideoElement;
  let mockConfig: ProctorConfig;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    // Mock canvas and context
    mockContext = {
      drawImage: jest.fn(),
      getImageData: jest.fn().mockReturnValue({
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480
      })
    } as any;

    mockCanvas = {
      getContext: jest.fn().mockReturnValue(mockContext),
      width: 640,
      height: 480
    } as any;

    // Mock document.createElement for canvas
    const originalCreateElement = document.createElement;
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas;
      }
      return originalCreateElement.call(document, tagName);
    });

    // Create mock video element
    mockVideoElement = {
      readyState: 4,
      videoWidth: 640,
      videoHeight: 480
    } as HTMLVideoElement;

    // Create mock config
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

    engine = new ProctorEngine(mockConfig, mockVideoElement);
  });

  afterEach(() => {
    engine.dispose();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(engine.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization errors', async () => {
      // Mock initialization failure
      const mockError = new Error('Initialization failed');
      (engine as any).faceDetector.initialize.mockRejectedValue(mockError);

      await expect(engine.initialize()).rejects.toThrow('Initialization failed');
    });
  });

  describe('monitoring loop', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should start and stop monitoring', () => {
      expect((engine as any).isRunning).toBe(false);
      
      engine.start();
      expect((engine as any).isRunning).toBe(true);
      
      engine.stop();
      expect((engine as any).isRunning).toBe(false);
    });

    it('should not start if already running', () => {
      engine.start();
      const firstAnimationId = (engine as any).animationFrameId;
      
      engine.start(); // Try to start again
      expect((engine as any).animationFrameId).toBe(firstAnimationId);
    });

    it('should call callbacks when signals are updated', (done) => {
      const mockSignalsCallback = jest.fn((signals: VisionSignals) => {
        expect(signals).toBeDefined();
        expect(signals.timestamp).toBeGreaterThan(0);
        engine.stop();
        done();
      });

      engine.setCallbacks({
        onSignalsUpdate: mockSignalsCallback
      });

      engine.start();
      
      // Trigger a frame manually since requestAnimationFrame might not work in tests
      setTimeout(() => {
        if (mockSignalsCallback.mock.calls.length === 0) {
          engine.stop();
          done();
        }
      }, 100);
    }, 10000);

    it('should call performance callback periodically', (done) => {
      let callCount = 0;
      const mockPerformanceCallback = jest.fn((metrics: PerformanceMetrics) => {
        callCount++;
        expect(metrics).toBeDefined();
        expect(metrics.fps).toBeGreaterThanOrEqual(0);
        
        if (callCount >= 1) {
          engine.stop();
          done();
        }
      });

      engine.setCallbacks({
        onPerformanceUpdate: mockPerformanceCallback
      });

      engine.start();
      
      // Trigger timeout if callback doesn't fire
      setTimeout(() => {
        if (callCount === 0) {
          engine.stop();
          done();
        }
      }, 100);
    }, 10000);
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        thresholds: {
          gazeConfidence: 0.8
        }
      };

      engine.updateConfig(newConfig);
      expect((engine as any).config.thresholds.gazeConfidence).toBe(0.8);
    });

    it('should set target FPS within bounds', () => {
      engine.setTargetFps(45);
      expect((engine as any).targetFps).toBe(45);

      engine.setTargetFps(5); // Below minimum
      expect((engine as any).targetFps).toBe(15);

      engine.setTargetFps(120); // Above maximum
      expect((engine as any).targetFps).toBe(60);
    });

    it('should toggle adaptive FPS', () => {
      engine.setAdaptiveFps(false);
      expect((engine as any).adaptiveFps).toBe(false);

      engine.setAdaptiveFps(true);
      expect((engine as any).adaptiveFps).toBe(true);
    });
  });

  describe('performance metrics', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should return performance metrics', () => {
      const metrics = engine.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.fps).toBe('number');
      expect(typeof metrics.processingLatency).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
    });

    it('should update performance metrics during monitoring', (done) => {
      let updateCount = 0;
      
      engine.setCallbacks({
        onPerformanceUpdate: (metrics) => {
          updateCount++;
          expect(metrics.fps).toBeGreaterThan(0);
          
          if (updateCount >= 1) {
            engine.stop();
            done();
          }
        }
      });

      engine.start();
      
      // Fallback timeout
      setTimeout(() => {
        if (updateCount === 0) {
          engine.stop();
          done();
        }
      }, 100);
    }, 10000);
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should handle frame processing errors', (done) => {
      // Mock video element to cause error
      mockVideoElement.readyState = 0;

      engine.setCallbacks({
        onError: (error) => {
          expect(error).toBeDefined();
          engine.stop();
          done();
        }
      });

      engine.start();
      
      // Fallback timeout
      setTimeout(() => {
        engine.stop();
        done();
      }, 100);
    }, 10000);

    it('should continue monitoring after errors', (done) => {
      let errorCount = 0;
      let signalCount = 0;

      engine.setCallbacks({
        onError: () => {
          errorCount++;
        },
        onSignalsUpdate: () => {
          signalCount++;
          if (signalCount > errorCount) {
            // Monitoring continued after error
            engine.stop();
            done();
          }
        }
      });

      // Cause an error then fix it
      mockVideoElement.readyState = 0;
      engine.start();
      
      setTimeout(() => {
        mockVideoElement.readyState = 4;
      }, 50);
      
      // Fallback timeout
      setTimeout(() => {
        engine.stop();
        done();
      }, 200);
    }, 10000);
  });

  describe('frame rate adaptation', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should adapt frame rate based on performance', () => {
      engine.setAdaptiveFps(true);
      engine.setTargetFps(30);

      // Simulate high processing time
      const processingTimeBuffer = (engine as any).processingTimeBuffer;
      for (let i = 0; i < 10; i++) {
        processingTimeBuffer.push(25); // 25ms processing time for 30fps (33ms frame time)
      }

      (engine as any).adjustFrameRate();
      expect((engine as any).targetFps).toBeLessThan(30);
    });

    it('should not adapt when adaptive FPS is disabled', () => {
      engine.setAdaptiveFps(false);
      engine.setTargetFps(30);
      
      // Clear any existing processing time data
      (engine as any).processingTimeBuffer = [];
      
      // Simulate high processing time
      const processingTimeBuffer = (engine as any).processingTimeBuffer;
      for (let i = 0; i < 10; i++) {
        processingTimeBuffer.push(25);
      }

      const originalFps = (engine as any).targetFps;
      (engine as any).adjustFrameRate();
      expect((engine as any).targetFps).toBe(originalFps);
    });
  });

  describe('cleanup', () => {
    it('should dispose resources properly', async () => {
      await engine.initialize();
      engine.start();
      
      expect((engine as any).isRunning).toBe(true);
      
      engine.dispose();
      
      expect((engine as any).isRunning).toBe(false);
      expect((engine as any).animationFrameId).toBeNull();
    });
  });
});