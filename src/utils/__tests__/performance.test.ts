import {
  measurePerformance,
  createPerformanceTimer,
  getMemoryUsage,
  getFPS,
  createFPSCounter,
  optimizeForPerformance,
  requestIdleCallback,
  cancelIdleCallback
} from '../performance';

// Mock performance API
const mockPerformance = {
  now: jest.fn(),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000
  }
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

// Mock requestAnimationFrame
let rafCallbacks: (() => void)[] = [];
global.requestAnimationFrame = jest.fn((callback) => {
  rafCallbacks.push(callback);
  return rafCallbacks.length;
});

global.cancelAnimationFrame = jest.fn((id) => {
  delete rafCallbacks[id - 1];
});

describe('Performance Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rafCallbacks = [];
    mockPerformance.now.mockReturnValue(1000);
  });

  describe('measurePerformance', () => {
    it('should measure function execution time', async () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100);

      const testFn = jest.fn().mockResolvedValue('result');
      const result = await measurePerformance('test-operation', testFn);

      expect(result.result).toBe('result');
      expect(result.duration).toBe(100);
      expect(result.operation).toBe('test-operation');
      expect(testFn).toHaveBeenCalled();
    });

    it('should handle synchronous functions', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1050);

      const testFn = jest.fn().mockReturnValue('sync-result');
      const result = measurePerformance('sync-operation', testFn);

      expect(result.result).toBe('sync-result');
      expect(result.duration).toBe(50);
    });

    it('should handle function errors', async () => {
      const error = new Error('Test error');
      const testFn = jest.fn().mockRejectedValue(error);

      await expect(measurePerformance('error-operation', testFn)).rejects.toThrow('Test error');
    });
  });

  describe('createPerformanceTimer', () => {
    it('should create a performance timer', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1200);

      const timer = createPerformanceTimer('timer-test');
      const elapsed = timer.stop();

      expect(elapsed).toBe(200);
      expect(mockPerformance.mark).toHaveBeenCalledWith('timer-test-start');
      expect(mockPerformance.mark).toHaveBeenCalledWith('timer-test-end');
      expect(mockPerformance.measure).toHaveBeenCalledWith('timer-test', 'timer-test-start', 'timer-test-end');
    });

    it('should get elapsed time without stopping', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1150);

      const timer = createPerformanceTimer('elapsed-test');
      const elapsed = timer.getElapsed();

      expect(elapsed).toBe(150);
    });

    it('should reset timer', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1500);

      const timer = createPerformanceTimer('reset-test');
      timer.reset();

      expect(mockPerformance.clearMarks).toHaveBeenCalledWith('reset-test-start');
      expect(mockPerformance.clearMarks).toHaveBeenCalledWith('reset-test-end');
      expect(mockPerformance.clearMeasures).toHaveBeenCalledWith('reset-test');
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage when available', () => {
      const usage = getMemoryUsage();

      expect(usage).toEqual({
        used: 1000000,
        total: 2000000,
        limit: 4000000,
        percentage: 50
      });
    });

    it('should return null when memory API is not available', () => {
      const originalMemory = mockPerformance.memory;
      delete (mockPerformance as any).memory;

      const usage = getMemoryUsage();

      expect(usage).toBeNull();

      mockPerformance.memory = originalMemory;
    });
  });

  describe('getFPS', () => {
    it('should calculate FPS from frame times', () => {
      const frameTimes = [16.67, 16.67, 16.67, 16.67, 16.67]; // 60 FPS
      const fps = getFPS(frameTimes);

      expect(fps).toBeCloseTo(60, 0);
    });

    it('should handle empty frame times', () => {
      const fps = getFPS([]);
      expect(fps).toBe(0);
    });

    it('should handle single frame time', () => {
      const fps = getFPS([16.67]);
      expect(fps).toBeCloseTo(60, 0);
    });
  });

  describe('createFPSCounter', () => {
    it('should create FPS counter', () => {
      const counter = createFPSCounter();

      // Simulate frame updates
      mockPerformance.now.mockReturnValue(1000);
      counter.update();
      
      mockPerformance.now.mockReturnValue(1016.67);
      counter.update();
      
      mockPerformance.now.mockReturnValue(1033.34);
      counter.update();

      const fps = counter.getFPS();
      expect(fps).toBeGreaterThan(0);
    });

    it('should reset FPS counter', () => {
      const counter = createFPSCounter();
      
      counter.update();
      counter.reset();
      
      const fps = counter.getFPS();
      expect(fps).toBe(0);
    });

    it('should get average FPS over window', () => {
      const counter = createFPSCounter(3); // Window size of 3

      mockPerformance.now.mockReturnValue(1000);
      counter.update();
      
      mockPerformance.now.mockReturnValue(1016.67);
      counter.update();
      
      mockPerformance.now.mockReturnValue(1033.34);
      counter.update();
      
      mockPerformance.now.mockReturnValue(1050.01);
      counter.update();

      const fps = counter.getFPS();
      expect(fps).toBeCloseTo(60, 0);
    });
  });

  describe('optimizeForPerformance', () => {
    it('should optimize function for performance', () => {
      const expensiveFn = jest.fn().mockReturnValue('result');
      const optimizedFn = optimizeForPerformance(expensiveFn, {
        throttle: 100,
        cache: true
      });

      // First call should execute
      const result1 = optimizedFn('arg1');
      expect(result1).toBe('result');
      expect(expensiveFn).toHaveBeenCalledTimes(1);

      // Cached call should not execute function again
      const result2 = optimizedFn('arg1');
      expect(result2).toBe('result');
      expect(expensiveFn).toHaveBeenCalledTimes(1);

      // Different argument should execute
      const result3 = optimizedFn('arg2');
      expect(result3).toBe('result');
      expect(expensiveFn).toHaveBeenCalledTimes(2);
    });

    it('should handle debouncing', (done) => {
      const debouncedFn = jest.fn();
      const optimizedFn = optimizeForPerformance(debouncedFn, {
        debounce: 50
      });

      optimizedFn();
      optimizedFn();
      optimizedFn();

      expect(debouncedFn).not.toHaveBeenCalled();

      setTimeout(() => {
        expect(debouncedFn).toHaveBeenCalledTimes(1);
        done();
      }, 60);
    });
  });

  describe('requestIdleCallback polyfill', () => {
    it('should use native requestIdleCallback when available', () => {
      const mockRequestIdleCallback = jest.fn().mockReturnValue(1);
      (global as any).requestIdleCallback = mockRequestIdleCallback;

      const callback = jest.fn();
      const id = requestIdleCallback(callback);

      expect(mockRequestIdleCallback).toHaveBeenCalledWith(callback, undefined);
      expect(id).toBe(1);

      delete (global as any).requestIdleCallback;
    });

    it('should fallback to setTimeout when not available', () => {
      const mockSetTimeout = jest.spyOn(global, 'setTimeout').mockReturnValue(123 as any);
      
      const callback = jest.fn();
      const id = requestIdleCallback(callback);

      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
      expect(id).toBe(123);

      mockSetTimeout.mockRestore();
    });

    it('should handle timeout option', () => {
      const mockRequestIdleCallback = jest.fn().mockReturnValue(1);
      (global as any).requestIdleCallback = mockRequestIdleCallback;

      const callback = jest.fn();
      requestIdleCallback(callback, { timeout: 1000 });

      expect(mockRequestIdleCallback).toHaveBeenCalledWith(callback, { timeout: 1000 });

      delete (global as any).requestIdleCallback;
    });
  });

  describe('cancelIdleCallback polyfill', () => {
    it('should use native cancelIdleCallback when available', () => {
      const mockCancelIdleCallback = jest.fn();
      (global as any).cancelIdleCallback = mockCancelIdleCallback;

      cancelIdleCallback(123);

      expect(mockCancelIdleCallback).toHaveBeenCalledWith(123);

      delete (global as any).cancelIdleCallback;
    });

    it('should fallback to clearTimeout when not available', () => {
      const mockClearTimeout = jest.spyOn(global, 'clearTimeout');
      
      cancelIdleCallback(123);

      expect(mockClearTimeout).toHaveBeenCalledWith(123);

      mockClearTimeout.mockRestore();
    });
  });
});