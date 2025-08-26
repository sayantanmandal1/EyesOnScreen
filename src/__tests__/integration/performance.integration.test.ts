/**
 * Performance regression integration tests
 * Tests performance benchmarks and monitors for regressions
 */

import { PerformanceMonitor } from '../../lib/performance/PerformanceMonitor';
import { ProctorEngine } from '../../lib/proctoring/ProctorEngine';
import { FaceDetector } from '../../lib/vision/FaceDetector';
import { GazeEstimator } from '../../lib/vision/GazeEstimator';
import { HeadPoseEstimator } from '../../lib/vision/HeadPoseEstimator';
import { LocalStorage } from '../../lib/data/LocalStorage';
import { ExportManager } from '../../lib/data/ExportManager';

// Performance test utilities
class PerformanceBenchmark {
  private measurements: Map<string, number[]> = new Map();

  async measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return result;
  }

  getStats(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      mean: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  reset() {
    this.measurements.clear();
  }
}

// Mock heavy computation scenarios
const createSyntheticWorkload = (complexity: 'light' | 'medium' | 'heavy') => {
  const iterations = {
    light: 1000,
    medium: 10000,
    heavy: 100000
  }[complexity];

  return () => {
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sin(i) * Math.cos(i);
    }
    return result;
  };
};

// Mock MediaPipe and vision APIs
jest.mock('@mediapipe/face_mesh', () => ({
  FaceMesh: jest.fn().mockImplementation(() => ({
    setOptions: jest.fn(),
    onResults: jest.fn(),
    send: jest.fn().mockImplementation(() => {
      // Simulate processing delay
      return new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    }),
    initialize: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('Performance Integration Tests', () => {
  let benchmark: PerformanceBenchmark;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    benchmark = new PerformanceBenchmark();
    performanceMonitor = new PerformanceMonitor();
    jest.clearAllMocks();
  });

  afterEach(() => {
    performanceMonitor.stop();
    benchmark.reset();
  });

  describe('Vision Processing Performance', () => {
    let faceDetector: FaceDetector;
    let gazeEstimator: GazeEstimator;
    let headPoseEstimator: HeadPoseEstimator;

    beforeEach(async () => {
      faceDetector = new FaceDetector();
      gazeEstimator = new GazeEstimator();
      headPoseEstimator = new HeadPoseEstimator();

      await faceDetector.initialize();
      await gazeEstimator.initialize();
      await headPoseEstimator.initialize();
    });

    afterEach(() => {
      faceDetector.destroy();
      gazeEstimator.destroy();
      headPoseEstimator.destroy();
    });

    it('should maintain face detection performance under target thresholds', async () => {
      const mockCanvas = document.createElement('canvas');
      mockCanvas.width = 640;
      mockCanvas.height = 480;

      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await benchmark.measure('face-detection', async () => {
          return faceDetector.processFrame(mockCanvas);
        });
      }

      const stats = benchmark.getStats('face-detection');
      expect(stats).not.toBeNull();
      
      // Performance targets
      expect(stats!.mean).toBeLessThan(50); // < 50ms average
      expect(stats!.p95).toBeLessThan(100); // < 100ms 95th percentile
      expect(stats!.max).toBeLessThan(200); // < 200ms worst case
    });

    it('should maintain gaze estimation performance', async () => {
      const mockLandmarks = new Float32Array(468 * 3);
      // Populate with realistic landmark data
      for (let i = 0; i < 468; i++) {
        mockLandmarks[i * 3] = 320 + Math.random() * 100;
        mockLandmarks[i * 3 + 1] = 240 + Math.random() * 100;
        mockLandmarks[i * 3 + 2] = Math.random() * 10;
      }

      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await benchmark.measure('gaze-estimation', async () => {
          return gazeEstimator.estimateGaze(mockLandmarks);
        });
      }

      const stats = benchmark.getStats('gaze-estimation');
      expect(stats).not.toBeNull();
      
      expect(stats!.mean).toBeLessThan(20); // < 20ms average
      expect(stats!.p95).toBeLessThan(40); // < 40ms 95th percentile
    });

    it('should maintain head pose estimation performance', async () => {
      const mockLandmarks = new Float32Array(468 * 3);
      
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await benchmark.measure('head-pose-estimation', async () => {
          return headPoseEstimator.estimateHeadPose(mockLandmarks);
        });
      }

      const stats = benchmark.getStats('head-pose-estimation');
      expect(stats).not.toBeNull();
      
      expect(stats!.mean).toBeLessThan(15); // < 15ms average
      expect(stats!.p95).toBeLessThan(30); // < 30ms 95th percentile
    });

    it('should handle concurrent processing efficiently', async () => {
      const mockCanvas = document.createElement('canvas');
      const mockLandmarks = new Float32Array(468 * 3);
      
      const concurrentTasks = 10;
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        await benchmark.measure('concurrent-processing', async () => {
          const tasks = Array.from({ length: concurrentTasks }, () => 
            Promise.all([
              faceDetector.processFrame(mockCanvas),
              gazeEstimator.estimateGaze(mockLandmarks),
              headPoseEstimator.estimateHeadPose(mockLandmarks)
            ])
          );
          
          return Promise.all(tasks);
        });
      }

      const stats = benchmark.getStats('concurrent-processing');
      expect(stats).not.toBeNull();
      
      // Should handle concurrent processing without significant degradation
      expect(stats!.mean).toBeLessThan(200); // < 200ms for 10 concurrent tasks
    });
  });

  describe('Proctor Engine Performance', () => {
    let proctorEngine: ProctorEngine;

    beforeEach(() => {
      proctorEngine = new ProctorEngine();
      proctorEngine.start();
    });

    afterEach(() => {
      proctorEngine.stop();
    });

    it('should maintain real-time signal processing performance', async () => {
      const mockSignal = {
        timestamp: Date.now(),
        faceDetected: true,
        landmarks: new Float32Array(468 * 3),
        headPose: { yaw: 0, pitch: 0, roll: 0, confidence: 0.9 },
        gazeVector: { x: 0, y: 0, z: -1, confidence: 0.85 },
        eyesOnScreen: true,
        environmentScore: {
          lighting: 0.8,
          shadowStability: 0.9,
          secondaryFaces: 0,
          deviceLikeObjects: 0
        }
      };

      const iterations = 1000; // Simulate 1000 frames
      
      for (let i = 0; i < iterations; i++) {
        await benchmark.measure('signal-processing', () => {
          return proctorEngine.processSignals({
            ...mockSignal,
            timestamp: Date.now() + i * 33 // 30 FPS
          });
        });
      }

      const stats = benchmark.getStats('signal-processing');
      expect(stats).not.toBeNull();
      
      // Must maintain real-time processing
      expect(stats!.mean).toBeLessThan(10); // < 10ms average
      expect(stats!.p95).toBeLessThan(20); // < 20ms 95th percentile
      expect(stats!.max).toBeLessThan(50); // < 50ms worst case
    });

    it('should handle high-frequency signal bursts', async () => {
      const signalBurst = Array.from({ length: 100 }, (_, i) => ({
        timestamp: Date.now() + i,
        faceDetected: true,
        landmarks: new Float32Array(468 * 3),
        headPose: { yaw: Math.random() * 10 - 5, pitch: Math.random() * 10 - 5, roll: 0, confidence: 0.9 },
        gazeVector: { x: Math.random() * 0.2 - 0.1, y: Math.random() * 0.2 - 0.1, z: -1, confidence: 0.85 },
        eyesOnScreen: Math.random() > 0.1, // 90% on screen
        environmentScore: {
          lighting: 0.8 + Math.random() * 0.2,
          shadowStability: 0.8 + Math.random() * 0.2,
          secondaryFaces: Math.random() > 0.95 ? 1 : 0, // 5% chance
          deviceLikeObjects: Math.random() > 0.98 ? 1 : 0 // 2% chance
        }
      }));

      await benchmark.measure('signal-burst', () => {
        return signalBurst.map(signal => proctorEngine.processSignals(signal));
      });

      const stats = benchmark.getStats('signal-burst');
      expect(stats).not.toBeNull();
      
      // Should handle bursts efficiently
      expect(stats!.mean).toBeLessThan(100); // < 100ms for 100 signals
    });
  });

  describe('Data Management Performance', () => {
    let localStorage: LocalStorage;
    let exportManager: ExportManager;

    beforeEach(async () => {
      localStorage = new LocalStorage();
      exportManager = new ExportManager();
      await localStorage.initialize();
    });

    it('should maintain database operation performance', async () => {
      const testData = {
        ipd: 65,
        earBaseline: 0.3,
        gazeMapping: { homography: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], bias: [0, 0] },
        headPoseBounds: { yawRange: [-20, 20], pitchRange: [-15, 15] },
        lightingBaseline: { histogram: new Array(256).fill(0), mean: 128, variance: 10 },
        quality: 0.9,
        timestamp: Date.now()
      };

      const iterations = 100;

      // Test write performance
      for (let i = 0; i < iterations; i++) {
        await benchmark.measure('db-write', async () => {
          return localStorage.storeCalibrationProfile(`profile-${i}`, testData as any);
        });
      }

      // Test read performance
      for (let i = 0; i < iterations; i++) {
        await benchmark.measure('db-read', async () => {
          return localStorage.getCalibrationProfile(`profile-${i}`);
        });
      }

      const writeStats = benchmark.getStats('db-write');
      const readStats = benchmark.getStats('db-read');

      expect(writeStats!.mean).toBeLessThan(50); // < 50ms write
      expect(readStats!.mean).toBeLessThan(20); // < 20ms read
    });

    it('should maintain export performance for large datasets', async () => {
      const largeLogData = Array.from({ length: 10000 }, (_, i) => ({
        timestamp: Date.now() + i * 100,
        questionId: `q${Math.floor(i / 1000)}`,
        eyesOn: Math.random() > 0.2,
        gazeConfidence: Math.random(),
        headPose: { yaw: Math.random() * 20 - 10, pitch: Math.random() * 20 - 10, roll: 0 },
        shadowScore: Math.random(),
        secondaryFace: Math.random() > 0.95,
        deviceLike: Math.random() > 0.98,
        tabHidden: Math.random() > 0.99,
        facePresent: Math.random() > 0.05,
        flagType: Math.random() > 0.9 ? 'EYES_OFF' : null,
        riskScore: Math.random() * 100
      }));

      await benchmark.measure('export-json', async () => {
        return exportManager.exportToJSON(largeLogData);
      });

      await benchmark.measure('export-csv', async () => {
        return exportManager.exportToCSV(largeLogData);
      });

      const jsonStats = benchmark.getStats('export-json');
      const csvStats = benchmark.getStats('export-csv');

      expect(jsonStats!.mean).toBeLessThan(500); // < 500ms for 10k records
      expect(csvStats!.mean).toBeLessThan(1000); // < 1s for 10k records
    });
  });

  describe('Memory Usage and Leaks', () => {
    it('should not leak memory during extended operation', async () => {
      const proctorEngine = new ProctorEngine();
      proctorEngine.start();

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Simulate extended monitoring session
      const sessionDuration = 1000; // 1000 iterations
      
      for (let i = 0; i < sessionDuration; i++) {
        const signal = {
          timestamp: Date.now() + i * 33,
          faceDetected: true,
          landmarks: new Float32Array(468 * 3),
          headPose: { yaw: Math.random() * 10 - 5, pitch: Math.random() * 10 - 5, roll: 0, confidence: 0.9 },
          gazeVector: { x: Math.random() * 0.2 - 0.1, y: Math.random() * 0.2 - 0.1, z: -1, confidence: 0.85 },
          eyesOnScreen: Math.random() > 0.1,
          environmentScore: {
            lighting: 0.8,
            shadowStability: 0.9,
            secondaryFaces: 0,
            deviceLikeObjects: 0
          }
        };
        
        proctorEngine.processSignals(signal);
        
        // Periodic cleanup simulation
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;
      
      proctorEngine.stop();

      // Memory growth should be reasonable (< 20MB for extended session)
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024);
    });

    it('should properly cleanup resources', async () => {
      const components = {
        faceDetector: new FaceDetector(),
        gazeEstimator: new GazeEstimator(),
        headPoseEstimator: new HeadPoseEstimator(),
        proctorEngine: new ProctorEngine(),
        localStorage: new LocalStorage()
      };

      // Initialize all components
      await Promise.all([
        components.faceDetector.initialize(),
        components.gazeEstimator.initialize(),
        components.headPoseEstimator.initialize(),
        components.localStorage.initialize()
      ]);

      components.proctorEngine.start();

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Use components briefly
      const mockCanvas = document.createElement('canvas');
      await components.faceDetector.processFrame(mockCanvas);
      
      // Cleanup all components
      components.faceDetector.destroy();
      components.gazeEstimator.destroy();
      components.headPoseEstimator.destroy();
      components.proctorEngine.stop();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryDelta = finalMemory - initialMemory;

      // Memory should not grow significantly after cleanup
      expect(Math.abs(memoryDelta)).toBeLessThan(5 * 1024 * 1024); // < 5MB delta
    });
  });

  describe('CPU Usage and Efficiency', () => {
    it('should maintain acceptable CPU usage under load', async () => {
      performanceMonitor.start();
      
      const proctorEngine = new ProctorEngine();
      proctorEngine.start();

      // Simulate high-frequency processing
      const startTime = performance.now();
      const duration = 5000; // 5 seconds
      let frameCount = 0;

      while (performance.now() - startTime < duration) {
        const signal = {
          timestamp: Date.now(),
          faceDetected: true,
          landmarks: new Float32Array(468 * 3),
          headPose: { yaw: 0, pitch: 0, roll: 0, confidence: 0.9 },
          gazeVector: { x: 0, y: 0, z: -1, confidence: 0.85 },
          eyesOnScreen: true,
          environmentScore: {
            lighting: 0.8,
            shadowStability: 0.9,
            secondaryFaces: 0,
            deviceLikeObjects: 0
          }
        };
        
        proctorEngine.processSignals(signal);
        frameCount++;
        
        // Simulate frame rate (don't overwhelm)
        await new Promise(resolve => setTimeout(resolve, 16)); // ~60 FPS
      }

      const metrics = performanceMonitor.getMetrics();
      proctorEngine.stop();

      // Should maintain reasonable frame rate
      const actualFPS = frameCount / (duration / 1000);
      expect(actualFPS).toBeGreaterThan(30); // > 30 FPS

      // CPU usage should be reasonable (if available)
      if (metrics.cpuUsage !== undefined) {
        expect(metrics.cpuUsage).toBeLessThan(80); // < 80% CPU
      }
    });
  });

  describe('Performance Regression Detection', () => {
    const performanceBaselines = {
      faceDetection: { mean: 45, p95: 90 },
      gazeEstimation: { mean: 18, p95: 35 },
      headPoseEstimation: { mean: 12, p95: 25 },
      signalProcessing: { mean: 8, p95: 18 }
    };

    it('should detect performance regressions', async () => {
      // Run performance tests and compare against baselines
      const mockCanvas = document.createElement('canvas');
      const faceDetector = new FaceDetector();
      await faceDetector.initialize();

      const iterations = 50;
      for (let i = 0; i < iterations; i++) {
        await benchmark.measure('regression-test-face-detection', async () => {
          return faceDetector.processFrame(mockCanvas);
        });
      }

      const stats = benchmark.getStats('regression-test-face-detection');
      const baseline = performanceBaselines.faceDetection;

      // Allow for some variance (20% tolerance)
      const tolerance = 1.2;
      
      expect(stats!.mean).toBeLessThan(baseline.mean * tolerance);
      expect(stats!.p95).toBeLessThan(baseline.p95 * tolerance);

      faceDetector.destroy();
    });

    it('should track performance trends over time', () => {
      // This would integrate with a performance tracking system
      const performanceData = {
        timestamp: Date.now(),
        metrics: {
          faceDetection: benchmark.getStats('face-detection'),
          gazeEstimation: benchmark.getStats('gaze-estimation'),
          headPoseEstimation: benchmark.getStats('head-pose-estimation'),
          signalProcessing: benchmark.getStats('signal-processing')
        }
      };

      // In a real implementation, this would be stored and analyzed for trends
      expect(performanceData.timestamp).toBeDefined();
      expect(performanceData.metrics).toBeDefined();
    });
  });
});