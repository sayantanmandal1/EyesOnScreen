/**
 * Tests for RobustErrorHandler class
 */

import {
  RobustErrorHandler,
  createErrorContext,
  createCameraError,
  createVisionError,
  createNetworkError,
  createPerformanceError,
  CameraError,
  VisionError,
  NetworkError,
  PerformanceError,
  ErrorContext
} from '../RobustErrorHandler';

describe('RobustErrorHandler', () => {
  let handler: RobustErrorHandler;
  let mockNotificationCallback: jest.Mock;
  let context: ErrorContext;

  beforeEach(() => {
    mockNotificationCallback = jest.fn();
    handler = new RobustErrorHandler(3, mockNotificationCallback);
    context = createErrorContext('test-component', 'test-operation');
    jest.clearAllMocks();
  });

  afterEach(() => {
    handler.clearErrorHistory();
  });

  describe('Camera Error Handling', () => {
    it('should handle NotAllowedError with notification strategy', async () => {
      const error = createCameraError('NotAllowedError', 'Permission denied');
      
      const strategy = await handler.handleCameraError(error, context);
      
      expect(strategy.type).toBe('notify');
      expect(strategy.userMessage).toContain('Camera permission is required');
    });

    it('should handle NotFoundError with notification strategy', async () => {
      const error = createCameraError('NotFoundError', 'No camera found');
      
      const strategy = await handler.handleCameraError(error, context);
      
      expect(strategy.type).toBe('notify');
      expect(strategy.userMessage).toContain('No camera found');
    });

    it('should handle NotReadableError with retry strategy', async () => {
      const error = createCameraError('NotReadableError', 'Camera in use');
      
      const strategy = await handler.handleCameraError(error, context);
      
      expect(strategy.type).toBe('retry');
      expect(strategy.maxAttempts).toBe(3);
      expect(strategy.delay).toBe(2000);
    });

    it('should fallback after max retries for NotReadableError', async () => {
      const error = createCameraError('NotReadableError', 'Camera in use');
      
      // Exhaust retry attempts
      await handler.handleCameraError(error, context);
      await handler.handleCameraError(error, context);
      await handler.handleCameraError(error, context);
      
      const strategy = await handler.handleCameraError(error, context);
      
      expect(strategy.type).toBe('fallback');
      expect(strategy.userMessage).toContain('manual verification');
    });

    it('should handle OverconstrainedError with degrade strategy', async () => {
      const error = createCameraError('OverconstrainedError', 'Constraint not satisfied', 'width');
      
      const strategy = await handler.handleCameraError(error, context);
      
      expect(strategy.type).toBe('degrade');
      expect(strategy.userMessage).toContain('Adjusting camera settings');
    });

    it('should handle AbortError with retry strategy', async () => {
      const error = createCameraError('AbortError', 'Operation aborted');
      
      const strategy = await handler.handleCameraError(error, context);
      
      expect(strategy.type).toBe('retry');
      expect(strategy.delay).toBe(1000);
    });
  });

  describe('Vision Error Handling', () => {
    it('should handle ModelLoadError with retry strategy', async () => {
      const error = createVisionError('ModelLoadError', 'Failed to load model', 'high');
      
      const strategy = await handler.handleVisionError(error, context);
      
      expect(strategy.type).toBe('retry');
      expect(strategy.maxAttempts).toBe(3);
    });

    it('should fallback after max retries for ModelLoadError', async () => {
      const error = createVisionError('ModelLoadError', 'Failed to load model', 'high');
      
      // Exhaust retry attempts
      await handler.handleVisionError(error, context);
      await handler.handleVisionError(error, context);
      await handler.handleVisionError(error, context);
      
      const strategy = await handler.handleVisionError(error, context);
      
      expect(strategy.type).toBe('fallback');
      expect(strategy.userMessage).toContain('alternative vision processing');
    });

    it('should handle critical ProcessingError with fallback', async () => {
      const error = createVisionError('ProcessingError', 'Critical processing failure', 'critical');
      
      const strategy = await handler.handleVisionError(error, context);
      
      expect(strategy.type).toBe('fallback');
      expect(strategy.userMessage).toContain('backup system');
    });

    it('should handle recoverable ProcessingError with retry', async () => {
      const error = createVisionError('ProcessingError', 'Temporary processing issue', 'medium', true);
      
      const strategy = await handler.handleVisionError(error, context);
      
      expect(strategy.type).toBe('retry');
      expect(strategy.maxAttempts).toBe(3);
    });

    it('should handle non-recoverable ProcessingError with degrade', async () => {
      const error = createVisionError('ProcessingError', 'Non-recoverable issue', 'medium', false);
      
      const strategy = await handler.handleVisionError(error, context);
      
      expect(strategy.type).toBe('degrade');
      expect(strategy.userMessage).toContain('Reducing processing complexity');
    });

    it('should handle CalibrationError with retry', async () => {
      const error = createVisionError('CalibrationError', 'Calibration failed', 'medium');
      
      const strategy = await handler.handleVisionError(error, context);
      
      expect(strategy.type).toBe('retry');
      expect(strategy.maxAttempts).toBe(1);
      expect(strategy.userMessage).toContain('try calibrating again');
    });

    it('should handle high severity DetectionError with fallback', async () => {
      const error = createVisionError('DetectionError', 'Detection system failure', 'high');
      
      const strategy = await handler.handleVisionError(error, context);
      
      expect(strategy.type).toBe('fallback');
      expect(strategy.userMessage).toContain('backup detection methods');
    });

    it('should handle low severity DetectionError with degrade', async () => {
      const error = createVisionError('DetectionError', 'Minor detection issue', 'low');
      
      const strategy = await handler.handleVisionError(error, context);
      
      expect(strategy.type).toBe('degrade');
      expect(strategy.userMessage).toContain('detection sensitivity');
    });
  });

  describe('Network Error Handling', () => {
    it('should handle NetworkError with retry strategy', async () => {
      const error = createNetworkError('NetworkError', 'Network unavailable');
      
      const strategy = await handler.handleNetworkError(error, context);
      
      expect(strategy.type).toBe('retry');
      expect(strategy.maxAttempts).toBe(3);
      expect(strategy.delay).toBe(5000);
    });

    it('should fallback to offline mode after max retries', async () => {
      const error = createNetworkError('NetworkError', 'Network unavailable');
      
      // Exhaust retry attempts
      await handler.handleNetworkError(error, context);
      await handler.handleNetworkError(error, context);
      await handler.handleNetworkError(error, context);
      
      const strategy = await handler.handleNetworkError(error, context);
      
      expect(strategy.type).toBe('fallback');
      expect(strategy.userMessage).toContain('offline mode');
    });

    it('should handle TimeoutError with retry strategy', async () => {
      const error = createNetworkError('TimeoutError', 'Request timeout');
      
      const strategy = await handler.handleNetworkError(error, context);
      
      expect(strategy.type).toBe('retry');
      expect(strategy.userMessage).toContain('Retrying');
    });

    it('should handle AuthError with notification', async () => {
      const error = createNetworkError('AuthError', 'Authentication failed', 401);
      
      const strategy = await handler.handleNetworkError(error, context);
      
      expect(strategy.type).toBe('notify');
      expect(strategy.userMessage).toContain('Authentication failed');
    });

    it('should handle server errors (5xx) with fallback', async () => {
      const error = createNetworkError('ServerError', 'Internal server error', 500);
      
      const strategy = await handler.handleNetworkError(error, context);
      
      expect(strategy.type).toBe('fallback');
      expect(strategy.userMessage).toContain('offline mode');
    });

    it('should handle client errors (4xx) with notification', async () => {
      const error = createNetworkError('ServerError', 'Bad request', 400);
      
      const strategy = await handler.handleNetworkError(error, context);
      
      expect(strategy.type).toBe('notify');
      expect(strategy.userMessage).toContain('Server error');
    });
  });

  describe('Performance Error Handling', () => {
    it('should handle critical performance issues with degrade strategy', async () => {
      const error = createPerformanceError('fps', 5, 24); // Very low FPS
      
      const strategy = await handler.handlePerformanceError(error, context);
      
      expect(strategy.type).toBe('degrade');
      expect(strategy.userMessage).toContain('critical');
    });

    it('should handle high performance issues with degrade strategy', async () => {
      const error = createPerformanceError('memory', 480, 300); // High memory usage (1.6 ratio)
      
      const strategy = await handler.handlePerformanceError(error, context);
      
      expect(strategy.type).toBe('degrade');
      expect(strategy.userMessage).toContain('High memory usage');
    });

    it('should handle medium performance issues with degrade strategy', async () => {
      const error = createPerformanceError('cpu', 75, 60); // Medium CPU usage (1.25 ratio)
      
      const strategy = await handler.handlePerformanceError(error, context);
      
      expect(strategy.type).toBe('degrade');
      expect(strategy.userMessage).toContain('Adjusting settings');
    });

    it('should handle low performance issues with notification', async () => {
      const error = createPerformanceError('latency', 55, 50); // Slightly high latency
      
      const strategy = await handler.handlePerformanceError(error, context);
      
      expect(strategy.type).toBe('notify');
      expect(strategy.userMessage).toContain('Performance warning');
    });
  });

  describe('Generic Error Handling', () => {
    it('should handle generic errors with retry strategy', async () => {
      const error = new Error('Generic error');
      
      const strategy = await handler.handleGenericError(error, context);
      
      expect(strategy.type).toBe('retry');
      expect(strategy.maxAttempts).toBe(3);
      expect(strategy.delay).toBe(2000);
    });

    it('should notify after max retries for generic errors', async () => {
      const error = new Error('Generic error');
      
      // Exhaust retry attempts
      await handler.handleGenericError(error, context);
      await handler.handleGenericError(error, context);
      await handler.handleGenericError(error, context);
      
      const strategy = await handler.handleGenericError(error, context);
      
      expect(strategy.type).toBe('notify');
      expect(strategy.userMessage).toContain('unexpected error');
    });
  });

  describe('Recovery Execution', () => {
    it('should execute retry strategy with delay', async () => {
      const mockCallback = jest.fn().mockResolvedValue(undefined);
      handler.registerRecoveryCallback('test-component', mockCallback);
      
      const strategy = {
        type: 'retry' as const,
        delay: 100
      };
      
      const startTime = Date.now();
      const result = await handler.executeRecovery(strategy, context);
      const endTime = Date.now();
      
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should execute fallback strategy', async () => {
      const mockFallback = jest.fn().mockResolvedValue(undefined);
      const strategy = {
        type: 'fallback' as const,
        fallbackAction: mockFallback
      };
      
      const result = await handler.executeRecovery(strategy, context);
      
      expect(result).toBe(true);
      expect(mockFallback).toHaveBeenCalled();
    });

    it('should execute notify strategy', async () => {
      const strategy = {
        type: 'notify' as const,
        userMessage: 'Test notification'
      };
      
      const result = await handler.executeRecovery(strategy, context);
      
      expect(result).toBe(false);
      expect(mockNotificationCallback).toHaveBeenCalledWith('Test notification', 'error');
    });

    it('should handle recovery failures gracefully', async () => {
      const mockFallback = jest.fn().mockRejectedValue(new Error('Recovery failed'));
      const strategy = {
        type: 'fallback' as const,
        fallbackAction: mockFallback
      };
      
      const result = await handler.executeRecovery(strategy, context);
      
      expect(result).toBe(false);
    });
  });

  describe('Error Statistics and Logging', () => {
    it('should track error statistics', async () => {
      const error1 = createCameraError('NotAllowedError', 'Permission denied');
      const error2 = createVisionError('ModelLoadError', 'Model failed');
      const error3 = createCameraError('NotAllowedError', 'Permission denied again');
      
      await handler.handleCameraError(error1, context);
      await handler.handleVisionError(error2, context);
      await handler.handleCameraError(error3, { ...context, component: 'other-component' });
      
      const stats = handler.getErrorStats();
      
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByType['NotAllowedError']).toBe(2);
      expect(stats.errorsByType['ModelLoadError']).toBe(1);
      expect(stats.errorsByComponent['test-component']).toBe(2);
      expect(stats.errorsByComponent['other-component']).toBe(1);
      expect(stats.recentErrors).toHaveLength(3);
    });

    it('should limit error log size', async () => {
      // Create more than 100 errors
      for (let i = 0; i < 150; i++) {
        const error = new Error(`Error ${i}`);
        await handler.handleGenericError(error, context);
      }
      
      const stats = handler.getErrorStats();
      expect(stats.totalErrors).toBe(100); // Should be capped at 100
    });

    it('should clear error history', async () => {
      const error = createCameraError('NotAllowedError', 'Permission denied');
      await handler.handleCameraError(error, context);
      
      let stats = handler.getErrorStats();
      expect(stats.totalErrors).toBe(1);
      
      handler.clearErrorHistory();
      
      stats = handler.getErrorStats();
      expect(stats.totalErrors).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    it('should create error context with required fields', () => {
      const context = createErrorContext('test-component', 'test-operation', { extra: 'data' });
      
      expect(context.component).toBe('test-component');
      expect(context.operation).toBe('test-operation');
      expect(context.timestamp).toBeGreaterThan(0);
      expect(context.additionalData).toEqual({ extra: 'data' });
    });

    it('should create camera error with correct properties', () => {
      const error = createCameraError('NotAllowedError', 'Permission denied', 'video');
      
      expect(error.name).toBe('NotAllowedError');
      expect(error.message).toBe('Permission denied');
      expect(error.constraint).toBe('video');
    });

    it('should create vision error with correct properties', () => {
      const error = createVisionError('ProcessingError', 'Processing failed', 'high', false);
      
      expect(error.name).toBe('ProcessingError');
      expect(error.message).toBe('Processing failed');
      expect(error.severity).toBe('high');
      expect(error.recoverable).toBe(false);
    });

    it('should create network error with correct properties', () => {
      const error = createNetworkError('ServerError', 'Server error', 500, '/api/data');
      
      expect(error.name).toBe('ServerError');
      expect(error.message).toBe('Server error');
      expect(error.status).toBe(500);
      expect(error.endpoint).toBe('/api/data');
    });

    it('should create performance error with correct properties', () => {
      const error = createPerformanceError('fps', 15, 24, 'Low FPS detected');
      
      expect(error.name).toBe('PerformanceError');
      expect(error.message).toBe('Low FPS detected');
      expect(error.metric).toBe('fps');
      expect(error.currentValue).toBe(15);
      expect(error.threshold).toBe(24);
    });

    it('should create performance error with default message', () => {
      const error = createPerformanceError('memory', 400, 300);
      
      expect(error.message).toContain('Performance threshold exceeded');
      expect(error.message).toContain('memory = 400 > 300');
    });
  });

  describe('Exponential Backoff', () => {
    it('should increase delay with each retry attempt', async () => {
      const error = createCameraError('NotReadableError', 'Camera in use');
      
      const strategy1 = await handler.handleCameraError(error, context);
      expect(strategy1.delay).toBe(2000);
      
      const strategy2 = await handler.handleCameraError(error, context);
      expect(strategy2.delay).toBe(4000);
      
      const strategy3 = await handler.handleCameraError(error, context);
      expect(strategy3.delay).toBe(8000);
    });
  });

  describe('Recovery Callbacks', () => {
    it('should register and execute recovery callbacks', async () => {
      const mockCallback = jest.fn().mockResolvedValue(undefined);
      handler.registerRecoveryCallback('test-component', mockCallback);
      
      const strategy = { type: 'retry' as const };
      await handler.executeRecovery(strategy, context);
      
      expect(mockCallback).toHaveBeenCalled();
    });

    it('should handle missing recovery callbacks gracefully', async () => {
      const strategy = { type: 'retry' as const };
      const result = await handler.executeRecovery(strategy, context);
      
      expect(result).toBe(true); // Should still succeed even without callback
    });
  });
});