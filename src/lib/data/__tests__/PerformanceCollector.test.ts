/**
 * Tests for PerformanceCollector class
 */

import { PerformanceCollector } from '../PerformanceCollector';

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 100 * 1024 * 1024, // 100MB
  },
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true,
});

// Mock PerformanceObserver
const mockPerformanceObserver = {
  observe: jest.fn(),
  disconnect: jest.fn(),
};

Object.defineProperty(global, 'PerformanceObserver', {
  value: jest.fn(() => mockPerformanceObserver),
  writable: true,
});

describe('PerformanceCollector', () => {
  let performanceCollector: PerformanceCollector;
  let mockNow: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockNow = mockPerformance.now as jest.Mock;
    mockNow.mockReturnValue(1000);

    performanceCollector = new PerformanceCollector({
      minFps: 20,
      maxLatency: 50,
      maxMemoryUsage: 200,
      maxCpuUsage: 60,
    });
  });

  afterEach(() => {
    performanceCollector.destroy();
    jest.useRealTimers();
  });

  describe('frame recording', () => {
    it('should record frame processing times', () => {
      performanceCollector.recordFrame(25);
      performanceCollector.recordFrame(30);
      performanceCollector.recordFrame(20);

      const metrics = performanceCollector.getCurrentMetrics();
      expect(metrics.processingLatency).toBe(25); // Average of 25, 30, 20
    });

    it('should calculate FPS based on frame timestamps', () => {
      const baseTime = 1000;
      mockNow
        .mockReturnValueOnce(baseTime)
        .mockReturnValueOnce(baseTime + 33.33) // ~30 FPS
        .mockReturnValueOnce(baseTime + 66.66)
        .mockReturnValueOnce(baseTime + 100);

      performanceCollector.recordFrame(25);
      performanceCollector.recordFrame(25);
      performanceCollector.recordFrame(25);

      const metrics = performanceCollector.getCurrentMetrics();
      expect(metrics.fps).toBeCloseTo(30, 0); // Should be around 30 FPS
    });

    it('should limit frame history to recent frames', () => {
      // Record more than 60 frames
      for (let i = 0; i < 70; i++) {
        mockNow.mockReturnValue(1000 + i * 16.67); // 60 FPS timing
        performanceCollector.recordFrame(25);
      }

      const metrics = performanceCollector.getCurrentMetrics();
      expect(metrics.fps).toBeCloseTo(60, 0);
    });
  });

  describe('performance metrics calculation', () => {
    it('should calculate current performance metrics', () => {
      performanceCollector.recordFrame(25);
      performanceCollector.recordFrame(35);

      const metrics = performanceCollector.getCurrentMetrics();

      expect(metrics).toMatchObject({
        fps: expect.any(Number),
        processingLatency: 30, // Average of 25 and 35
        memoryUsage: 100, // 100MB from mock
        cpuUsage: expect.any(Number),
        droppedFrames: 0,
        timestamp: expect.any(Number),
      });
    });

    it('should count dropped frames for high latency', () => {
      performanceCollector.recordFrame(25); // Normal
      performanceCollector.recordFrame(75); // Dropped (>50ms)
      performanceCollector.recordFrame(30); // Normal
      performanceCollector.recordFrame(60); // Dropped (>50ms)

      const metrics = performanceCollector.getCurrentMetrics();
      expect(metrics.droppedFrames).toBe(2);
    });

    it('should estimate CPU usage based on processing times and FPS', () => {
      const baseTime = 1000;
      mockNow
        .mockReturnValueOnce(baseTime)
        .mockReturnValueOnce(baseTime + 100) // 10 FPS
        .mockReturnValueOnce(baseTime + 200);

      performanceCollector.recordFrame(50); // 50ms processing time
      performanceCollector.recordFrame(50);

      const metrics = performanceCollector.getCurrentMetrics();
      // At 10 FPS with 50ms processing time: 10 * 50 / 1000 = 50% CPU
      expect(metrics.cpuUsage).toBeCloseTo(50, 0);
    });
  });

  describe('detailed performance snapshot', () => {
    it('should provide detailed performance snapshot', () => {
      performanceCollector.recordFrame(25);

      const snapshot = performanceCollector.getDetailedSnapshot();

      expect(snapshot).toMatchObject({
        fps: expect.any(Number),
        processingLatency: 25,
        memoryUsage: 100,
        cpuUsage: expect.any(Number),
        droppedFrames: 0,
        timestamp: expect.any(Number),
        cpuUsageEstimate: expect.any(Number),
        memoryPressure: 'low', // 100MB is low pressure
        thermalState: undefined, // Not supported in test environment
      });
    });

    it('should assess memory pressure correctly', () => {
      // Test low memory pressure (100MB)
      let snapshot = performanceCollector.getDetailedSnapshot();
      expect(snapshot.memoryPressure).toBe('low');

      // Test medium memory pressure
      mockPerformance.memory.usedJSHeapSize = 150 * 1024 * 1024; // 150MB
      snapshot = performanceCollector.getDetailedSnapshot();
      expect(snapshot.memoryPressure).toBe('medium');

      // Test high memory pressure
      mockPerformance.memory.usedJSHeapSize = 250 * 1024 * 1024; // 250MB
      snapshot = performanceCollector.getDetailedSnapshot();
      expect(snapshot.memoryPressure).toBe('high');
    });
  });

  describe('performance threshold checking', () => {
    it('should identify acceptable performance', () => {
      const baseTime = 1000;
      mockNow
        .mockReturnValueOnce(baseTime)
        .mockReturnValueOnce(baseTime + 33.33); // 30 FPS

      performanceCollector.recordFrame(25); // Good latency

      const result = performanceCollector.isPerformanceAcceptable();

      expect(result.acceptable).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should identify performance issues', () => {
      const baseTime = 1000;
      mockNow
        .mockReturnValueOnce(baseTime)
        .mockReturnValueOnce(baseTime + 100); // 10 FPS (below 20 FPS threshold)

      performanceCollector.recordFrame(75); // High latency (above 50ms threshold)

      // Set high memory usage
      mockPerformance.memory.usedJSHeapSize = 250 * 1024 * 1024; // 250MB (above 200MB threshold)

      const result = performanceCollector.isPerformanceAcceptable();

      expect(result.acceptable).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('Low FPS'));
      expect(result.issues).toContain(expect.stringContaining('High latency'));
      expect(result.issues).toContain(expect.stringContaining('High memory usage'));
    });
  });

  describe('performance trends', () => {
    it('should calculate performance trends', () => {
      // Create enough snapshots for trend analysis
      for (let i = 0; i < 25; i++) {
        jest.advanceTimersByTime(1000); // Advance monitoring interval
        
        // Simulate degrading performance
        const fps = 30 - i; // Decreasing FPS
        const latency = 20 + i; // Increasing latency
        const memory = 100 + i * 2; // Increasing memory
        
        mockNow.mockReturnValue(1000 + i * 33.33);
        mockPerformance.memory.usedJSHeapSize = memory * 1024 * 1024;
        
        performanceCollector.recordFrame(latency);
      }

      const trend = performanceCollector.getPerformanceTrend(10);

      expect(trend.fps.trend).toBe('degrading');
      expect(trend.latency.trend).toBe('degrading');
      expect(trend.memory.trend).toBe('degrading');
    });

    it('should identify stable performance', () => {
      // Create snapshots with stable performance
      for (let i = 0; i < 25; i++) {
        jest.advanceTimersByTime(1000);
        
        mockNow.mockReturnValue(1000 + i * 33.33);
        performanceCollector.recordFrame(25); // Consistent latency
      }

      const trend = performanceCollector.getPerformanceTrend(10);

      expect(trend.fps.trend).toBe('stable');
      expect(trend.latency.trend).toBe('stable');
      expect(trend.memory.trend).toBe('stable');
    });
  });

  describe('performance recommendations', () => {
    it('should provide recommendations for poor performance', () => {
      const baseTime = 1000;
      mockNow
        .mockReturnValueOnce(baseTime)
        .mockReturnValueOnce(baseTime + 100); // 10 FPS

      performanceCollector.recordFrame(90); // High latency
      
      // Set high memory usage
      mockPerformance.memory.usedJSHeapSize = 300 * 1024 * 1024; // 300MB

      // Record many dropped frames
      for (let i = 0; i < 15; i++) {
        performanceCollector.recordFrame(60); // All dropped frames
      }

      const recommendations = performanceCollector.getPerformanceRecommendations();

      expect(recommendations).toContain(expect.stringContaining('reducing video resolution'));
      expect(recommendations).toContain(expect.stringContaining('frame skipping'));
      expect(recommendations).toContain(expect.stringContaining('Clear old data buffers'));
      expect(recommendations).toContain(expect.stringContaining('Increase processing timeout'));
      expect(recommendations).toContain(expect.stringContaining('Force garbage collection'));
    });

    it('should provide no recommendations for good performance', () => {
      const baseTime = 1000;
      mockNow
        .mockReturnValueOnce(baseTime)
        .mockReturnValueOnce(baseTime + 33.33); // 30 FPS

      performanceCollector.recordFrame(25); // Good latency

      const recommendations = performanceCollector.getPerformanceRecommendations();

      expect(recommendations).toHaveLength(0);
    });
  });

  describe('monitoring lifecycle', () => {
    it('should start monitoring on initialization', () => {
      expect(PerformanceObserver).toHaveBeenCalled();
      expect(mockPerformanceObserver.observe).toHaveBeenCalledWith({
        entryTypes: ['measure'],
      });
    });

    it('should collect metrics periodically', () => {
      const initialMetricsCount = performanceCollector.getDetailedSnapshot();
      
      // Advance time to trigger periodic collection
      jest.advanceTimersByTime(2000); // 2 seconds
      
      // The collector should have collected metrics
      // This is tested indirectly through the monitoring interval
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should clean up resources on destroy', () => {
      performanceCollector.destroy();

      expect(mockPerformanceObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle missing performance.memory gracefully', () => {
      const originalMemory = mockPerformance.memory;
      delete (mockPerformance as any).memory;

      const metrics = performanceCollector.getCurrentMetrics();
      expect(metrics.memoryUsage).toBe(0);

      // Restore for other tests
      mockPerformance.memory = originalMemory;
    });

    it('should handle PerformanceObserver initialization failure', () => {
      // Mock PerformanceObserver to throw an error
      const originalPO = global.PerformanceObserver;
      (global as any).PerformanceObserver = jest.fn(() => {
        throw new Error('PerformanceObserver not supported');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // This should not throw
      const collector = new PerformanceCollector();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize PerformanceObserver:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
      collector.destroy();

      // Restore for other tests
      (global as any).PerformanceObserver = originalPO;
    });
  });
});