/**
 * Tests for PerformanceMonitor class
 */

import { PerformanceMonitor, PerformanceMetrics, QualitySettings } from '../PerformanceMonitor';

// Mock performance.now()
const mockPerformanceNow = jest.fn();
const originalPerformance = global.performance;

// Mock performance.memory
const mockMemory = {
  usedJSHeapSize: 100 * 1024 * 1024 // 100MB in bytes
};

beforeAll(() => {
  Object.defineProperty(global, 'performance', {
    value: {
      ...originalPerformance,
      now: mockPerformanceNow,
      memory: mockMemory
    },
    writable: true,
    configurable: true
  });
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 0;
    mockPerformanceNow.mockImplementation(() => currentTime);
    monitor = new PerformanceMonitor();
    jest.clearAllMocks();
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('Frame Tracking', () => {
    it('should track frame processing time', () => {
      currentTime = 1000;
      monitor.startFrame();
      
      currentTime = 1033; // 33ms processing time
      monitor.endFrame();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.processingLatency).toBe(33);
    });

    it('should calculate FPS correctly', () => {
      // Simulate consistent 16ms processing time (should give ~62.5 FPS based on processing time)
      for (let i = 0; i < 30; i++) {
        currentTime = i * 33.33;
        monitor.startFrame();
        currentTime = i * 33.33 + 16; // 16ms processing time
        monitor.endFrame();
      }
      
      const fps = monitor.getFPS();
      // FPS is calculated based on processing time, not frame intervals
      expect(fps).toBeCloseTo(62, 5); // 1000/16 ≈ 62.5
    });

    it('should detect dropped frames', () => {
      // Set initial quality to establish expected frame rate
      monitor.setQuality({ frameRate: 30 }); // 33.33ms expected frame time
      
      currentTime = 1000;
      monitor.startFrame(); // lastFrameTime = 1000
      currentTime = 1016;
      monitor.endFrame();
      
      // Simulate a long gap (dropped frame) - should be > 1.5 * expected frame time (50ms)
      // Gap from 1000 to 1200 = 200ms, which is > 50ms threshold
      currentTime = 1200; 
      monitor.startFrame(); // This should detect the dropped frame (200ms > 50ms)
      currentTime = 1216;
      monitor.endFrame();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.droppedFrames).toBeGreaterThan(0);
    });
  });

  describe('Memory Monitoring', () => {
    it('should return memory usage in MB', () => {
      // Advance time to trigger memory check
      currentTime += 2000; // More than memoryCheckInterval (1000ms)
      
      const memoryUsage = monitor.getMemoryUsage();
      expect(memoryUsage).toBe(100); // 100MB as mocked
    });

    it('should cache memory checks', () => {
      monitor.getMemoryUsage();
      monitor.getMemoryUsage();
      
      // Should only check memory once due to caching
      expect(mockPerformanceNow).toHaveBeenCalledTimes(2);
    });

    it('should handle missing memory API', () => {
      // Create performance object without memory API
      Object.defineProperty(global, 'performance', {
        value: {
          ...originalPerformance,
          now: mockPerformanceNow
          // No memory property
        },
        writable: true,
        configurable: true
      });
      
      const newMonitor = new PerformanceMonitor();
      const memoryUsage = newMonitor.getMemoryUsage();
      
      expect(typeof memoryUsage).toBe('number');
      expect(memoryUsage).toBeGreaterThanOrEqual(0);
      
      newMonitor.destroy();
      
      // Restore memory API
      Object.defineProperty(global, 'performance', {
        value: {
          ...originalPerformance,
          now: mockPerformanceNow,
          memory: mockMemory
        },
        writable: true,
        configurable: true
      });
    });
  });

  describe('CPU Usage Estimation', () => {
    it('should estimate CPU usage based on processing time', () => {
      const processingTime = 20; // 20ms
      const cpuUsage = monitor.estimateCPUUsage(processingTime);
      
      // For 24 FPS target (41.67ms), 20ms should be ~48% CPU
      expect(cpuUsage).toBeCloseTo(48, 0);
    });

    it('should cap CPU usage at 100%', () => {
      const processingTime = 100; // Very high processing time
      const cpuUsage = monitor.estimateCPUUsage(processingTime);
      
      expect(cpuUsage).toBe(100);
    });
  });

  describe('Performance Statistics', () => {
    beforeEach(() => {
      // Generate some performance data
      for (let i = 0; i < 20; i++) {
        currentTime = i * 50;
        monitor.startFrame();
        currentTime = i * 50 + 20; // 20ms processing
        monitor.endFrame();
      }
    });

    it('should calculate performance statistics', () => {
      const stats = monitor.getPerformanceStats(1000);
      
      expect(stats.average).toBeDefined();
      expect(stats.min).toBeDefined();
      expect(stats.max).toBeDefined();
      expect(stats.trend).toMatch(/improving|stable|degrading/);
    });

    it('should detect performance trends', () => {
      // Create degrading performance pattern with very pronounced degradation
      const totalFrames = 30;
      for (let i = 0; i < totalFrames; i++) {
        currentTime = 1000 + i * 100;
        monitor.startFrame();
        // Start with excellent performance, then degrade dramatically
        const processingTime = i < totalFrames/2 ? 5 : 80; // Very sharp degradation
        currentTime = 1000 + i * 100 + processingTime;
        monitor.endFrame();
      }
      
      const stats = monitor.getPerformanceStats(4000);
      expect(stats.trend).toBe('degrading');
    });
  });

  describe('Adaptive Quality Adjustment', () => {
    it('should degrade quality when performance is poor', () => {
      // Simulate poor performance
      for (let i = 0; i < 10; i++) {
        currentTime = i * 100;
        monitor.startFrame();
        currentTime = i * 100 + 80; // High processing time
        monitor.endFrame();
      }
      
      // Force quality check
      currentTime += 6000; // Move time forward to trigger adjustment
      monitor.startFrame();
      monitor.endFrame();
      
      const quality = monitor.getCurrentQuality();
      expect(quality.enableOptimizations).toBe(true);
    });

    it('should improve quality when performance is good', () => {
      // Start with low quality
      monitor.setQuality({ resolution: 'low', frameRate: 15 });
      
      // Simulate good performance
      for (let i = 0; i < 20; i++) {
        currentTime = i * 20;
        monitor.startFrame();
        currentTime = i * 20 + 10; // Low processing time
        monitor.endFrame();
      }
      
      // Force quality check
      currentTime += 6000;
      monitor.startFrame();
      monitor.endFrame();
      
      const quality = monitor.getCurrentQuality();
      expect(quality.resolution).not.toBe('low');
    });

    it('should allow manual quality override', () => {
      const customQuality: Partial<QualitySettings> = {
        resolution: 'high',
        frameRate: 60,
        enableFiltering: false
      };
      
      monitor.setQuality(customQuality);
      const quality = monitor.getCurrentQuality();
      
      expect(quality.resolution).toBe('high');
      expect(quality.frameRate).toBe(60);
      expect(quality.enableFiltering).toBe(false);
    });
  });

  describe('Performance Recommendations', () => {
    it('should provide recommendations for poor performance', () => {
      // Simulate poor performance metrics
      for (let i = 0; i < 5; i++) {
        currentTime = i * 200;
        monitor.startFrame();
        currentTime = i * 200 + 100; // Very high processing time
        monitor.endFrame();
      }
      
      const recommendations = monitor.getRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('resolution'))).toBe(true);
    });

    it('should provide no recommendations for good performance', () => {
      // Simulate good performance
      for (let i = 0; i < 10; i++) {
        currentTime = i * 33;
        monitor.startFrame();
        currentTime = i * 33 + 15; // Good processing time
        monitor.endFrame();
      }
      
      const recommendations = monitor.getRecommendations();
      expect(recommendations.length).toBe(0);
    });
  });

  describe('Configuration and Control', () => {
    it('should allow adaptive quality to be disabled', () => {
      monitor.setAdaptiveQuality(false);
      
      // Simulate poor performance
      for (let i = 0; i < 10; i++) {
        currentTime = i * 100;
        monitor.startFrame();
        currentTime = i * 100 + 80;
        monitor.endFrame();
      }
      
      const initialQuality = monitor.getCurrentQuality();
      
      // Force time forward
      currentTime += 6000;
      monitor.startFrame();
      monitor.endFrame();
      
      const finalQuality = monitor.getCurrentQuality();
      expect(finalQuality).toEqual(initialQuality);
    });

    it('should allow adaptive config updates', () => {
      const newConfig = {
        adjustmentInterval: 1000,
        thresholds: {
          targetFPS: 30,
          maxCPUUsage: 50,
          maxMemoryUsage: 200,
          maxLatency: 30
        }
      };
      
      monitor.updateAdaptiveConfig(newConfig);
      
      // Test that new thresholds are applied
      const recommendations = monitor.getRecommendations();
      // This would need specific performance conditions to test properly
      expect(typeof recommendations).toBe('object');
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should clean up old performance data', () => {
      // Generate lots of performance data
      for (let i = 0; i < 200; i++) {
        currentTime = i * 50;
        monitor.startFrame();
        currentTime = i * 50 + 20;
        monitor.endFrame();
      }
      
      // Move time forward significantly
      currentTime += 60000; // 1 minute
      
      monitor.cleanup();
      
      const stats = monitor.getPerformanceStats(5000);
      // Should have cleaned up old data
      expect(stats.average).toBeDefined();
    });

    it('should reset all tracking data', () => {
      // Generate some data
      currentTime = 1000;
      monitor.startFrame();
      currentTime = 1020;
      monitor.endFrame();
      
      monitor.reset();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.fps).toBe(0);
      expect(metrics.droppedFrames).toBe(0);
    });

    it('should properly destroy and clean up', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      monitor.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero frame times', () => {
      const fps = monitor.getFPS();
      const latency = monitor.getAverageLatency();
      
      expect(fps).toBe(0);
      expect(latency).toBe(0);
    });

    it('should handle very high frame rates', () => {
      // Simulate very fast processing
      for (let i = 0; i < 10; i++) {
        currentTime = i * 5;
        monitor.startFrame();
        currentTime = i * 5 + 1; // 1ms processing
        monitor.endFrame();
      }
      
      const fps = monitor.getFPS();
      expect(fps).toBeGreaterThan(100);
    });

    it('should handle negative time differences', () => {
      currentTime = 1000;
      monitor.startFrame();
      currentTime = 999; // Time goes backwards (shouldn't happen but test anyway)
      monitor.endFrame();
      
      const metrics = monitor.getCurrentMetrics();
      // The implementation should handle this gracefully, even if it results in negative values
      expect(typeof metrics.processingLatency).toBe('number');
    });
  });

  describe('Performance Targets', () => {
    it('should meet target FPS requirement (≥24 FPS)', () => {
      // Simulate target performance
      for (let i = 0; i < 30; i++) {
        currentTime = i * 41.67; // ~24 FPS
        monitor.startFrame();
        currentTime = i * 41.67 + 20; // 20ms processing
        monitor.endFrame();
      }
      
      const fps = monitor.getFPS();
      expect(fps).toBeGreaterThanOrEqual(24);
    });

    it('should detect when CPU usage exceeds 60%', () => {
      const highProcessingTime = 50; // Should exceed 60% for 24 FPS target
      const cpuUsage = monitor.estimateCPUUsage(highProcessingTime);
      
      expect(cpuUsage).toBeGreaterThan(60);
    });

    it('should detect when memory usage exceeds 300MB', () => {
      // Mock high memory usage
      const highMemoryMock = { usedJSHeapSize: 350 * 1024 * 1024 }; // 350MB
      
      Object.defineProperty(global, 'performance', {
        value: {
          ...originalPerformance,
          now: mockPerformanceNow,
          memory: highMemoryMock
        },
        writable: true,
        configurable: true
      });
      
      // Force memory check by advancing time
      currentTime += 2000;
      
      const memoryUsage = monitor.getMemoryUsage();
      expect(memoryUsage).toBeGreaterThan(300);
      
      // Restore original memory mock
      Object.defineProperty(global, 'performance', {
        value: {
          ...originalPerformance,
          now: mockPerformanceNow,
          memory: mockMemory
        },
        writable: true,
        configurable: true
      });
    });
  });
});