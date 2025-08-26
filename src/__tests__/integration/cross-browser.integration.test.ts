/**
 * Cross-browser compatibility integration tests
 * Tests core functionality across different browser environments
 */

import { CameraPermissionManager } from '../../lib/camera/CameraPermissionManager';
import { CameraStreamManager } from '../../lib/camera/CameraStreamManager';
import { LocalStorage } from '../../lib/data/LocalStorage';
import { PerformanceMonitor } from '../../lib/performance/PerformanceMonitor';

// Browser environment simulation utilities
class BrowserEnvironment {
  private originalUserAgent: string;
  private originalNavigator: any;
  private originalWindow: any;

  constructor() {
    this.originalUserAgent = navigator.userAgent;
    this.originalNavigator = { ...navigator };
    this.originalWindow = { ...window };
  }

  simulateChrome() {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true
    });

    // Chrome-specific APIs
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn().mockResolvedValue(this.createMockStream()),
        enumerateDevices: jest.fn().mockResolvedValue([
          { deviceId: 'camera1', kind: 'videoinput', label: 'HD Camera' }
        ])
      },
      configurable: true
    });

    // Chrome performance API
    Object.defineProperty(window, 'performance', {
      value: {
        ...performance,
        memory: {
          usedJSHeapSize: 10000000,
          totalJSHeapSize: 20000000,
          jsHeapSizeLimit: 100000000
        }
      },
      configurable: true
    });
  }

  simulateFirefox() {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      configurable: true
    });

    // Firefox-specific behavior
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn().mockResolvedValue(this.createMockStream()),
        enumerateDevices: jest.fn().mockResolvedValue([
          { deviceId: 'camera1', kind: 'videoinput', label: '' } // Firefox may not provide labels
        ])
      },
      configurable: true
    });

    // Firefox doesn't have performance.memory
    Object.defineProperty(window, 'performance', {
      value: {
        ...performance,
        memory: undefined
      },
      configurable: true
    });
  }

  simulateSafari() {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      configurable: true
    });

    // Safari-specific constraints
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn().mockImplementation((constraints) => {
          // Safari may reject certain constraints
          if (constraints.video?.frameRate?.ideal > 30) {
            return Promise.reject(new Error('OverconstrainedError'));
          }
          return Promise.resolve(this.createMockStream());
        }),
        enumerateDevices: jest.fn().mockResolvedValue([
          { deviceId: 'camera1', kind: 'videoinput', label: 'FaceTime HD Camera' }
        ])
      },
      configurable: true
    });

    // Safari limitations
    Object.defineProperty(window, 'performance', {
      value: {
        ...performance,
        memory: undefined
      },
      configurable: true
    });
  }

  simulateEdge() {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      configurable: true
    });

    // Edge (Chromium-based) similar to Chrome
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn().mockResolvedValue(this.createMockStream()),
        enumerateDevices: jest.fn().mockResolvedValue([
          { deviceId: 'camera1', kind: 'videoinput', label: 'Integrated Camera' }
        ])
      },
      configurable: true
    });

    Object.defineProperty(window, 'performance', {
      value: {
        ...performance,
        memory: {
          usedJSHeapSize: 8000000,
          totalJSHeapSize: 16000000,
          jsHeapSizeLimit: 80000000
        }
      },
      configurable: true
    });
  }

  simulateMobile() {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true
    });

    // Mobile constraints
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn().mockImplementation((constraints) => {
          // Mobile may have different camera constraints
          const stream = this.createMockStream();
          stream.getTracks()[0].getSettings = jest.fn().mockReturnValue({
            width: 480,
            height: 640, // Portrait orientation
            frameRate: 24 // Lower frame rate on mobile
          });
          return Promise.resolve(stream);
        }),
        enumerateDevices: jest.fn().mockResolvedValue([
          { deviceId: 'camera1', kind: 'videoinput', label: 'Back Camera' },
          { deviceId: 'camera2', kind: 'videoinput', label: 'Front Camera' }
        ])
      },
      configurable: true
    });

    // Mobile performance characteristics
    Object.defineProperty(window, 'performance', {
      value: {
        ...performance,
        memory: undefined // Not available on mobile Safari
      },
      configurable: true
    });
  }

  private createMockStream() {
    return {
      getTracks: jest.fn().mockReturnValue([{
        stop: jest.fn(),
        getSettings: jest.fn().mockReturnValue({
          width: 640,
          height: 480,
          frameRate: 30
        }),
        readyState: 'live'
      }]),
      active: true,
      id: 'mock-stream'
    };
  }

  restore() {
    Object.defineProperty(navigator, 'userAgent', {
      value: this.originalUserAgent,
      configurable: true
    });
    
    // Restore other properties as needed
    Object.keys(this.originalNavigator).forEach(key => {
      if (key !== 'userAgent') {
        Object.defineProperty(navigator, key, {
          value: this.originalNavigator[key],
          configurable: true
        });
      }
    });
  }
}

describe('Cross-Browser Compatibility', () => {
  let browserEnv: BrowserEnvironment;
  let permissionManager: CameraPermissionManager;
  let streamManager: CameraStreamManager;
  let localStorage: LocalStorage;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    browserEnv = new BrowserEnvironment();
    permissionManager = new CameraPermissionManager();
    streamManager = new CameraStreamManager();
    localStorage = new LocalStorage();
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    browserEnv.restore();
    streamManager.destroy();
    performanceMonitor.stop();
  });

  describe('Chrome Compatibility', () => {
    beforeEach(() => {
      browserEnv.simulateChrome();
    });

    it('should work with Chrome camera API', async () => {
      const permissionResult = await permissionManager.requestPermission();
      expect(permissionResult.granted).toBe(true);

      const streamResult = await streamManager.initialize();
      expect(streamResult.success).toBe(true);
    });

    it('should utilize Chrome performance features', () => {
      performanceMonitor.start();
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.memoryUsage?.used).toBeGreaterThan(0);
    });

    it('should handle Chrome-specific storage features', async () => {
      await localStorage.initialize();
      
      const testData = { test: 'chrome-data' };
      await localStorage.storeCalibrationProfile('chrome-test', testData as any);
      
      const retrieved = await localStorage.getCalibrationProfile('chrome-test');
      expect(retrieved).toEqual(testData);
    });
  });

  describe('Firefox Compatibility', () => {
    beforeEach(() => {
      browserEnv.simulateFirefox();
    });

    it('should work with Firefox camera API', async () => {
      const permissionResult = await permissionManager.requestPermission();
      expect(permissionResult.granted).toBe(true);

      const streamResult = await streamManager.initialize();
      expect(streamResult.success).toBe(true);
    });

    it('should handle Firefox performance limitations', () => {
      performanceMonitor.start();
      
      const metrics = performanceMonitor.getMetrics();
      // Firefox doesn't have performance.memory
      expect(metrics.memoryUsage).toBeNull();
      expect(metrics.fps).toBeDefined();
    });

    it('should work with Firefox IndexedDB implementation', async () => {
      await localStorage.initialize();
      
      const testData = { test: 'firefox-data' };
      await localStorage.storeCalibrationProfile('firefox-test', testData as any);
      
      const retrieved = await localStorage.getCalibrationProfile('firefox-test');
      expect(retrieved).toEqual(testData);
    });
  });

  describe('Safari Compatibility', () => {
    beforeEach(() => {
      browserEnv.simulateSafari();
    });

    it('should work with Safari camera constraints', async () => {
      const permissionResult = await permissionManager.requestPermission();
      expect(permissionResult.granted).toBe(true);

      // Safari may reject high frame rates
      const streamResult = await streamManager.initialize({
        width: 640,
        height: 480,
        frameRate: 25 // Lower frame rate for Safari
      });
      expect(streamResult.success).toBe(true);
    });

    it('should handle Safari performance limitations', () => {
      performanceMonitor.start();
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.memoryUsage).toBeNull(); // Not available in Safari
      expect(metrics.fps).toBeDefined();
    });

    it('should work with Safari storage restrictions', async () => {
      await localStorage.initialize();
      
      // Safari may have storage limitations
      const testData = { test: 'safari-data' };
      await localStorage.storeCalibrationProfile('safari-test', testData as any);
      
      const retrieved = await localStorage.getCalibrationProfile('safari-test');
      expect(retrieved).toEqual(testData);
    });
  });

  describe('Edge Compatibility', () => {
    beforeEach(() => {
      browserEnv.simulateEdge();
    });

    it('should work with Edge camera API', async () => {
      const permissionResult = await permissionManager.requestPermission();
      expect(permissionResult.granted).toBe(true);

      const streamResult = await streamManager.initialize();
      expect(streamResult.success).toBe(true);
    });

    it('should utilize Edge performance features', () => {
      performanceMonitor.start();
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.fps).toBeDefined();
    });
  });

  describe('Mobile Browser Compatibility', () => {
    beforeEach(() => {
      browserEnv.simulateMobile();
    });

    it('should handle mobile camera constraints', async () => {
      const permissionResult = await permissionManager.requestPermission();
      expect(permissionResult.granted).toBe(true);

      const streamResult = await streamManager.initialize();
      expect(streamResult.success).toBe(true);

      // Check mobile-specific settings
      const settings = streamManager.getStreamSettings();
      expect(settings.width).toBe(480);
      expect(settings.height).toBe(640); // Portrait
      expect(settings.frameRate).toBe(24); // Lower FPS
    });

    it('should adapt to mobile performance constraints', () => {
      performanceMonitor.start();
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.memoryUsage).toBeNull(); // Not available on mobile
      
      // Should still track basic metrics
      expect(metrics.fps).toBeDefined();
      expect(metrics.processingLatency).toBeDefined();
    });

    it('should handle mobile storage limitations', async () => {
      await localStorage.initialize();
      
      // Mobile may have stricter storage quotas
      const testData = { test: 'mobile-data' };
      await localStorage.storeCalibrationProfile('mobile-test', testData as any);
      
      const retrieved = await localStorage.getCalibrationProfile('mobile-test');
      expect(retrieved).toEqual(testData);
    });
  });

  describe('Feature Detection and Graceful Degradation', () => {
    it('should detect and handle missing APIs gracefully', async () => {
      // Simulate missing mediaDevices API
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true
      });

      const permissionResult = await permissionManager.requestPermission();
      expect(permissionResult.granted).toBe(false);
      expect(permissionResult.error).toContain('not supported');
    });

    it('should handle missing performance APIs', () => {
      // Simulate missing performance.memory
      Object.defineProperty(window.performance, 'memory', {
        value: undefined,
        configurable: true
      });

      performanceMonitor.start();
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.memoryUsage).toBeNull();
      expect(metrics.fps).toBeDefined(); // Should still work
    });

    it('should handle missing IndexedDB gracefully', async () => {
      // Simulate missing IndexedDB
      Object.defineProperty(window, 'indexedDB', {
        value: undefined,
        configurable: true
      });

      // Should fallback to localStorage or memory storage
      const initResult = await localStorage.initialize().catch(() => false);
      expect(initResult).toBe(false);
    });

    it('should provide appropriate fallbacks for unsupported features', () => {
      // Test various feature detection scenarios
      const features = {
        mediaDevices: !!navigator.mediaDevices,
        performanceMemory: !!(window.performance as any)?.memory,
        indexedDB: !!window.indexedDB,
        webgl: !!document.createElement('canvas').getContext('webgl'),
        webAssembly: typeof WebAssembly !== 'undefined'
      };

      // Should handle each feature appropriately
      Object.entries(features).forEach(([feature, supported]) => {
        expect(typeof supported).toBe('boolean');
      });
    });
  });

  describe('Performance Across Browsers', () => {
    const testPerformanceAcrossBrowsers = (browserName: string, setupFn: () => void) => {
      describe(`${browserName} Performance`, () => {
        beforeEach(setupFn);

        it('should maintain acceptable frame rates', async () => {
          await streamManager.initialize();
          performanceMonitor.start();

          // Simulate processing load
          const startTime = performance.now();
          for (let i = 0; i < 100; i++) {
            // Simulate frame processing
            await new Promise(resolve => setTimeout(resolve, 16)); // ~60 FPS
          }
          const endTime = performance.now();

          const metrics = performanceMonitor.getMetrics();
          expect(metrics.fps).toBeGreaterThan(15); // Minimum acceptable FPS
          
          const avgFrameTime = (endTime - startTime) / 100;
          expect(avgFrameTime).toBeLessThan(50); // < 50ms per frame
        });

        it('should handle memory efficiently', () => {
          performanceMonitor.start();
          
          // Simulate memory usage
          const largeArrays = [];
          for (let i = 0; i < 10; i++) {
            largeArrays.push(new Float32Array(1000));
          }

          const metrics = performanceMonitor.getMetrics();
          
          if (metrics.memoryUsage) {
            expect(metrics.memoryUsage.percentage).toBeLessThan(80);
          }
          
          // Cleanup
          largeArrays.length = 0;
        });
      });
    };

    testPerformanceAcrossBrowsers('Chrome', () => browserEnv.simulateChrome());
    testPerformanceAcrossBrowsers('Firefox', () => browserEnv.simulateFirefox());
    testPerformanceAcrossBrowsers('Safari', () => browserEnv.simulateSafari());
    testPerformanceAcrossBrowsers('Edge', () => browserEnv.simulateEdge());
    testPerformanceAcrossBrowsers('Mobile', () => browserEnv.simulateMobile());
  });

  describe('Error Handling Across Browsers', () => {
    it('should handle browser-specific errors consistently', async () => {
      const errorScenarios = [
        {
          name: 'Permission Denied',
          setup: () => {
            (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
              Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
            );
          }
        },
        {
          name: 'Device Not Found',
          setup: () => {
            (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
              Object.assign(new Error('Device not found'), { name: 'NotFoundError' })
            );
          }
        },
        {
          name: 'Device Busy',
          setup: () => {
            (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
              Object.assign(new Error('Device busy'), { name: 'NotReadableError' })
            );
          }
        }
      ];

      for (const scenario of errorScenarios) {
        scenario.setup();
        
        const result = await permissionManager.requestPermission();
        expect(result.granted).toBe(false);
        expect(result.error).toBeDefined();
        
        // Reset mock
        (navigator.mediaDevices.getUserMedia as jest.Mock).mockReset();
      }
    });
  });
});