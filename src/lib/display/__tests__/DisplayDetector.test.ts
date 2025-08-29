/**
 * Tests for DisplayDetector
 */

import { DisplayDetector } from '../DisplayDetector';
import { DisplayDetectionConfig } from '../types';

// Mock browser APIs
const mockGetUserMedia = jest.fn();
const mockGetDisplayMedia = jest.fn();

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    getDisplayMedia: mockGetDisplayMedia
  },
  writable: true
});

// Mock screen object
Object.defineProperty(window, 'screen', {
  value: {
    width: 1920,
    height: 1080,
    colorDepth: 24,
    orientation: { angle: 0 },
    availWidth: 1920,
    availHeight: 1040
  },
  writable: true
});

// Mock device pixel ratio
Object.defineProperty(window, 'devicePixelRatio', {
  value: 1.0,
  writable: true
});

describe('DisplayDetector', () => {
  let detector: DisplayDetector;
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
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    detector.dispose();
  });

  describe('Display Detection', () => {
    it('should detect primary display correctly', async () => {
      const result = await detector.performDetection();

      expect(result.displays).toHaveLength(1);
      expect(result.displays[0]).toMatchObject({
        id: 'primary',
        isPrimary: true,
        width: 1920,
        height: 1080,
        colorDepth: 24,
        pixelRatio: 1.0,
        orientation: 0
      });
    });

    it('should classify display type correctly', async () => {
      const result = await detector.performDetection();
      const primaryDisplay = result.displays[0];

      // 1920x1080 should be classified as external monitor
      expect(primaryDisplay.type).toBe('external');
    });

    it('should detect multiple displays when available', async () => {
      // Mock getDisplayMedia to simulate additional screen
      mockGetDisplayMedia.mockResolvedValue({
        getVideoTracks: () => [{
          getSettings: () => ({
            displaySurface: 'monitor',
            deviceId: 'screen-2',
            width: 2560,
            height: 1440
          }),
          stop: jest.fn()
        }],
        getTracks: () => [{
          stop: jest.fn()
        }]
      });

      const result = await detector.performDetection();

      expect(result.multipleDisplaysDetected).toBe(true);
      expect(result.displays.length).toBeGreaterThan(1);
    });

    it('should detect TV/projector based on resolution', async () => {
      // Mock a 4K TV resolution
      Object.defineProperty(window, 'screen', {
        value: {
          width: 3840,
          height: 2160,
          colorDepth: 24,
          orientation: { angle: 0 },
          availWidth: 3840,
          availHeight: 2160
        },
        writable: true
      });

      const result = await detector.performDetection();
      
      expect(result.tvProjectorDetected).toBe(true);
      expect(result.displays[0].type).toBe('tv');
    });

    it('should detect virtual machine displays', async () => {
      // Mock VM-like resolution
      Object.defineProperty(window, 'screen', {
        value: {
          width: 1024,
          height: 768,
          colorDepth: 16,
          orientation: { angle: 0 },
          availWidth: 1024,
          availHeight: 768
        },
        writable: true
      });

      const result = await detector.performDetection();
      
      expect(result.virtualDisplayDetected).toBe(true);
    });

    it('should handle getUserMedia errors gracefully', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Camera access denied'));

      const result = await detector.performDetection();

      // Should still return basic display info even if camera fails
      expect(result.displays).toHaveLength(1);
      expect(result.reflectionBasedScreens).toHaveLength(0);
    });
  });

  describe('Reflection Detection', () => {
    it('should perform reflection analysis when enabled', async () => {
      // Mock successful camera access
      const mockVideo = {
        srcObject: null,
        play: jest.fn().mockResolvedValue(undefined),
        onloadedmetadata: null,
        videoWidth: 640,
        videoHeight: 480,
        remove: jest.fn()
      };

      const mockStream = {
        getTracks: () => [{ stop: jest.fn() }]
      };

      mockGetUserMedia.mockResolvedValue(mockStream);

      // Mock canvas and context
      const mockCanvas = document.createElement('canvas');
      const mockCtx = {
        drawImage: jest.fn(),
        getImageData: jest.fn().mockReturnValue({
          data: new Uint8ClampedArray(640 * 480 * 4),
          width: 640,
          height: 480
        })
      };

      jest.spyOn(document, 'createElement').mockReturnValue(mockVideo as any);
      jest.spyOn(mockCanvas, 'getContext').mockReturnValue(mockCtx as any);

      const result = await detector.performDetection();

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      });
    });

    it('should handle reflection detection errors gracefully', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Camera not available'));

      const result = await detector.performDetection();

      expect(result.reflectionBasedScreens).toHaveLength(0);
    });
  });

  describe('Threat Detection', () => {
    it('should generate threats for multiple displays', async () => {
      const threatHandler = jest.fn();
      detector.addEventListener(threatHandler);

      // Mock multiple displays
      mockGetDisplayMedia.mockResolvedValue({
        getVideoTracks: () => [{
          getSettings: () => ({
            displaySurface: 'monitor',
            deviceId: 'screen-2',
            width: 1920,
            height: 1080
          }),
          stop: jest.fn()
        }],
        getTracks: () => [{ stop: jest.fn() }]
      });

      await detector.performDetection();

      expect(threatHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'threat_detected',
          data: expect.objectContaining({
            type: 'multiple_displays',
            severity: 'high'
          })
        })
      );
    });

    it('should generate threats for TV/projector detection', async () => {
      const threatHandler = jest.fn();
      detector.addEventListener(threatHandler);

      // Mock TV resolution
      Object.defineProperty(window, 'screen', {
        value: {
          width: 3840,
          height: 2160,
          colorDepth: 24,
          orientation: { angle: 0 },
          availWidth: 3840,
          availHeight: 2160
        },
        writable: true
      });

      await detector.performDetection();

      expect(threatHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'threat_detected',
          data: expect.objectContaining({
            type: 'tv_projector',
            severity: 'critical'
          })
        })
      );
    });
  });

  describe('Monitoring', () => {
    it('should start and stop monitoring correctly', () => {
      const spy = jest.spyOn(window, 'setInterval');
      const clearSpy = jest.spyOn(window, 'clearInterval');

      detector.startMonitoring();
      expect(spy).toHaveBeenCalledWith(expect.any(Function), config.monitoring.intervalMs);

      detector.stopMonitoring();
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should emit display change events during monitoring', (done) => {
      detector.addEventListener((event) => {
        if (event.type === 'display_change') {
          expect(event.data).toHaveProperty('displays');
          expect(event.data).toHaveProperty('timestamp');
          detector.stopMonitoring();
          done();
        }
      });

      detector.startMonitoring();
    });
  });

  describe('Configuration', () => {
    it('should respect disabled reflection analysis', async () => {
      const configWithoutReflection = {
        ...config,
        monitoring: {
          ...config.monitoring,
          reflectionAnalysis: false
        }
      };

      const detectorWithoutReflection = new DisplayDetector(configWithoutReflection);
      const result = await detectorWithoutReflection.performDetection();

      expect(result.reflectionBasedScreens).toHaveLength(0);
      expect(mockGetUserMedia).not.toHaveBeenCalled();

      detectorWithoutReflection.dispose();
    });

    it('should respect disabled eye movement correlation', async () => {
      const configWithoutEyeTracking = {
        ...config,
        monitoring: {
          ...config.monitoring,
          eyeMovementCorrelation: false
        }
      };

      const detectorWithoutEyeTracking = new DisplayDetector(configWithoutEyeTracking);
      const result = await detectorWithoutEyeTracking.performDetection();

      expect(result.eyeMovementCorrelation.correlationScore).toBe(0);
      expect(result.eyeMovementCorrelation.confidence).toBe(0);

      detectorWithoutEyeTracking.dispose();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing screen orientation', async () => {
      Object.defineProperty(window, 'screen', {
        value: {
          width: 1920,
          height: 1080,
          colorDepth: 24,
          orientation: undefined,
          availWidth: 1920,
          availHeight: 1080
        },
        writable: true
      });

      const result = await detector.performDetection();
      expect(result.displays[0].orientation).toBe(0);
    });

    it('should handle ultra-wide displays', async () => {
      Object.defineProperty(window, 'screen', {
        value: {
          width: 3440,
          height: 1440,
          colorDepth: 24,
          orientation: { angle: 0 },
          availWidth: 3440,
          availHeight: 1440
        },
        writable: true
      });

      const result = await detector.performDetection();
      
      // Ultra-wide should be detected as external
      expect(result.displays[0].type).toBe('external');
      expect(result.externalDisplaysDetected).toBe(true);
    });
  });
});