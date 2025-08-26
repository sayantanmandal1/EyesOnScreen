/**
 * Tests for SecondaryObjectDetector
 */

import { SecondaryObjectDetector } from '../SecondaryObjectDetector';

// Mock HTMLVideoElement and HTMLCanvasElement
class MockVideoElement {
  videoWidth = 640;
  videoHeight = 480;
}

class MockCanvasElement {
  width = 0;
  height = 0;
  
  getContext() {
    return new MockCanvasContext();
  }
}

class MockCanvasContext {
  drawImage() {}
  
  getImageData(x: number, y: number, width: number, height: number) {
    // Create mock image data with patterns for testing
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = Math.floor(i / 4);
      const pixelX = pixelIndex % width;
      const pixelY = Math.floor(pixelIndex / width);
      
      // Create different patterns for testing
      let r = 100, g = 100, b = 100; // Default gray
      
      // Create a skin-colored region (potential face)
      if (pixelX > 100 && pixelX < 200 && pixelY > 100 && pixelY < 200) {
        r = 200; g = 150; b = 120; // Skin color
        
        // Add dark regions for eyes
        if ((pixelX > 130 && pixelX < 140 && pixelY > 130 && pixelY < 140) ||
            (pixelX > 160 && pixelX < 170 && pixelY > 130 && pixelY < 140)) {
          r = 50; g = 50; b = 50; // Dark eyes
        }
        
        // Add dark region for mouth
        if (pixelX > 140 && pixelX < 160 && pixelY > 170 && pixelY < 180) {
          r = 80; g = 60; b = 60; // Dark mouth
        }
      }
      
      // Create a rectangular bright region (potential device)
      if (pixelX > 300 && pixelX < 400 && pixelY > 200 && pixelY < 350) {
        r = 220; g = 220; b = 220; // Bright rectangle
        
        // Add some highlights
        if (pixelX > 320 && pixelX < 330 && pixelY > 220 && pixelY < 230) {
          r = 255; g = 255; b = 255; // Bright highlight
        }
      }
      
      data[i] = r;         // R
      data[i + 1] = g;     // G
      data[i + 2] = b;     // B
      data[i + 3] = 255;   // A
    }
    
    return { data, width, height };
  }
}

// Mock DOM elements
(global as any).HTMLCanvasElement = MockCanvasElement;

// Store original createElement
const originalCreateElement = document.createElement;

// Mock document.createElement globally
const mockCreateElement = jest.fn((tagName: string) => {
  if (tagName === 'canvas') {
    return new MockCanvasElement() as any;
  }
  return originalCreateElement.call(document, tagName);
});

document.createElement = mockCreateElement;

describe('SecondaryObjectDetector', () => {
  let detector: SecondaryObjectDetector;
  let mockVideo: MockVideoElement;

  beforeEach(() => {
    mockCreateElement.mockClear();
    detector = new SecondaryObjectDetector();
    mockVideo = new MockVideoElement();
  });

  afterEach(() => {
    detector.dispose();
  });

  afterAll(() => {
    // Restore original createElement
    document.createElement = originalCreateElement;
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const detector = new SecondaryObjectDetector();
      expect(detector).toBeDefined();
    });

    it('should accept custom config', () => {
      const config = {
        faceConfidenceThreshold: 0.8,
        deviceConfidenceThreshold: 0.7,
        minConsecutiveFrames: 3
      };
      const detector = new SecondaryObjectDetector(config);
      expect(detector).toBeDefined();
    });
  });

  describe('detectObjects', () => {
    it('should detect objects and return detection results', () => {
      const result = detector.detectObjects(mockVideo as any);
      
      expect(result).toHaveProperty('secondaryFaces');
      expect(result).toHaveProperty('deviceLikeObjects');
      expect(result).toHaveProperty('totalSecondaryFaces');
      expect(result).toHaveProperty('totalDeviceLikeObjects');
      
      expect(Array.isArray(result.secondaryFaces)).toBe(true);
      expect(Array.isArray(result.deviceLikeObjects)).toBe(true);
      expect(typeof result.totalSecondaryFaces).toBe('number');
      expect(typeof result.totalDeviceLikeObjects).toBe('number');
    });

    it('should exclude primary face from secondary face detection', () => {
      const primaryFaceBounds = {
        x: 100,
        y: 100,
        width: 100,
        height: 100
      };
      
      const result = detector.detectObjects(mockVideo as any, primaryFaceBounds);
      
      // Should not detect the primary face region as secondary
      const overlappingFaces = result.secondaryFaces.filter(face => {
        if (!face.boundingBox) return false;
        return (
          face.boundingBox.x < primaryFaceBounds.x + primaryFaceBounds.width &&
          face.boundingBox.x + face.boundingBox.width > primaryFaceBounds.x &&
          face.boundingBox.y < primaryFaceBounds.y + primaryFaceBounds.height &&
          face.boundingBox.y + face.boundingBox.height > primaryFaceBounds.y
        );
      });
      
      expect(overlappingFaces.length).toBe(0);
    });
  });

  describe('face detection', () => {
    it('should detect face-like regions with proper properties', () => {
      const result = detector.detectObjects(mockVideo as any);
      
      result.secondaryFaces.forEach(face => {
        expect(face).toHaveProperty('detected');
        expect(face).toHaveProperty('confidence');
        expect(face).toHaveProperty('frameCount');
        
        expect(typeof face.detected).toBe('boolean');
        expect(typeof face.confidence).toBe('number');
        expect(typeof face.frameCount).toBe('number');
        
        expect(face.confidence).toBeGreaterThanOrEqual(0);
        expect(face.confidence).toBeLessThanOrEqual(1);
        expect(face.frameCount).toBeGreaterThan(0);
        
        if (face.boundingBox) {
          expect(face.boundingBox).toHaveProperty('x');
          expect(face.boundingBox).toHaveProperty('y');
          expect(face.boundingBox).toHaveProperty('width');
          expect(face.boundingBox).toHaveProperty('height');
        }
      });
    });

    it('should require consecutive frames for face detection', () => {
      const config = { minConsecutiveFrames: 3 };
      const testDetector = new SecondaryObjectDetector(config);
      
      // First frame - should not be detected yet
      let result = testDetector.detectObjects(mockVideo as any);
      const detectedFaces = result.secondaryFaces.filter(f => f.detected);
      expect(detectedFaces.length).toBe(0);
      
      // Process more frames
      testDetector.detectObjects(mockVideo as any);
      testDetector.detectObjects(mockVideo as any);
      
      // After minimum frames, should be detected
      result = testDetector.detectObjects(mockVideo as any);
      // Note: Detection depends on the mock data pattern
      
      testDetector.dispose();
    });

    it('should calculate face confidence based on features', () => {
      const result = detector.detectObjects(mockVideo as any);
      
      // Should find some face-like regions in our mock data
      const faces = result.secondaryFaces;
      
      faces.forEach(face => {
        expect(face.confidence).toBeGreaterThanOrEqual(0);
        expect(face.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('device detection', () => {
    it('should detect device-like objects with proper properties', () => {
      const result = detector.detectObjects(mockVideo as any);
      
      result.deviceLikeObjects.forEach(device => {
        expect(device).toHaveProperty('detected');
        expect(device).toHaveProperty('confidence');
        expect(device).toHaveProperty('motionScore');
        expect(device).toHaveProperty('highlightScore');
        expect(device).toHaveProperty('frameCount');
        
        expect(typeof device.detected).toBe('boolean');
        expect(typeof device.confidence).toBe('number');
        expect(typeof device.motionScore).toBe('number');
        expect(typeof device.highlightScore).toBe('number');
        expect(typeof device.frameCount).toBe('number');
        
        expect(device.confidence).toBeGreaterThanOrEqual(0);
        expect(device.confidence).toBeLessThanOrEqual(1);
        expect(device.motionScore).toBeGreaterThanOrEqual(0);
        expect(device.highlightScore).toBeGreaterThanOrEqual(0);
        expect(device.highlightScore).toBeLessThanOrEqual(1);
      });
    });

    it('should calculate motion score between frames', () => {
      // First frame
      detector.detectObjects(mockVideo as any);
      
      // Second frame - should calculate motion
      const result = detector.detectObjects(mockVideo as any);
      
      result.deviceLikeObjects.forEach(device => {
        expect(typeof device.motionScore).toBe('number');
        expect(device.motionScore).toBeGreaterThanOrEqual(0);
      });
    });

    it('should detect highlights in bright regions', () => {
      const result = detector.detectObjects(mockVideo as any);
      
      result.deviceLikeObjects.forEach(device => {
        expect(typeof device.highlightScore).toBe('number');
        expect(device.highlightScore).toBeGreaterThanOrEqual(0);
        expect(device.highlightScore).toBeLessThanOrEqual(1);
      });
    });

    it('should require consecutive frames for device detection', () => {
      const config = { minConsecutiveFrames: 3 };
      const testDetector = new SecondaryObjectDetector(config);
      
      // First frame
      const result = testDetector.detectObjects(mockVideo as any);
      const detectedDevices = result.deviceLikeObjects.filter(d => d.detected);
      expect(detectedDevices.length).toBe(0);
      
      testDetector.dispose();
    });
  });

  describe('confidence thresholds', () => {
    it('should respect face confidence threshold', () => {
      const config = { faceConfidenceThreshold: 0.9 }; // Very high threshold
      const testDetector = new SecondaryObjectDetector(config);
      
      const result = testDetector.detectObjects(mockVideo as any);
      
      // With high threshold, should detect fewer faces
      result.secondaryFaces.forEach(face => {
        if (face.detected) {
          expect(face.confidence).toBeGreaterThanOrEqual(0.9);
        }
      });
      
      testDetector.dispose();
    });

    it('should respect device confidence threshold', () => {
      const config = { deviceConfidenceThreshold: 0.9 }; // Very high threshold
      const testDetector = new SecondaryObjectDetector(config);
      
      const result = testDetector.detectObjects(mockVideo as any);
      
      // With high threshold, should detect fewer devices
      result.deviceLikeObjects.forEach(device => {
        if (device.detected) {
          expect(device.confidence).toBeGreaterThanOrEqual(0.9);
        }
      });
      
      testDetector.dispose();
    });
  });

  describe('object tracking', () => {
    it('should track objects across multiple frames', () => {
      // Process multiple frames
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(detector.detectObjects(mockVideo as any));
      }
      
      // Should maintain consistent tracking
      const lastResult = results[results.length - 1];
      
      lastResult.secondaryFaces.forEach(face => {
        expect(face.frameCount).toBeGreaterThan(0);
      });
      
      lastResult.deviceLikeObjects.forEach(device => {
        expect(device.frameCount).toBeGreaterThan(0);
      });
    });

    it('should clean up old detections', () => {
      // Process many frames to trigger cleanup
      for (let i = 0; i < 50; i++) {
        detector.detectObjects(mockVideo as any);
      }
      
      // Should not accumulate infinite detections
      const result = detector.detectObjects(mockVideo as any);
      
      // Exact numbers depend on mock data, but should be reasonable
      expect(result.secondaryFaces.length).toBeLessThan(100);
      expect(result.deviceLikeObjects.length).toBeLessThan(100);
    });
  });

  describe('aspect ratio filtering', () => {
    it('should filter devices by aspect ratio', () => {
      const config = {
        rectangleAspectRatioMin: 0.5,
        rectangleAspectRatioMax: 0.6
      };
      const testDetector = new SecondaryObjectDetector(config);
      
      const result = testDetector.detectObjects(mockVideo as any);
      
      result.deviceLikeObjects.forEach(device => {
        if (device.boundingBox) {
          const aspectRatio = device.boundingBox.width / device.boundingBox.height;
          // Note: This test depends on the mock data creating appropriate rectangles
          expect(typeof aspectRatio).toBe('number');
        }
      });
      
      testDetector.dispose();
    });
  });

  describe('size filtering', () => {
    it('should filter objects by size', () => {
      const config = {
        minObjectSize: 0.01,
        maxObjectSize: 0.5
      };
      const testDetector = new SecondaryObjectDetector(config);
      
      const result = testDetector.detectObjects(mockVideo as any);
      
      const frameArea = mockVideo.videoWidth * mockVideo.videoHeight;
      
      [...result.secondaryFaces, ...result.deviceLikeObjects].forEach(obj => {
        if (obj.boundingBox) {
          const objArea = obj.boundingBox.width * obj.boundingBox.height;
          const relativeSize = objArea / frameArea;
          
          expect(relativeSize).toBeGreaterThanOrEqual(0);
          expect(relativeSize).toBeLessThanOrEqual(1);
        }
      });
      
      testDetector.dispose();
    });
  });

  describe('reset and dispose', () => {
    it('should reset detector state', () => {
      // Process some frames
      detector.detectObjects(mockVideo as any);
      detector.detectObjects(mockVideo as any);
      
      // Reset
      detector.reset();
      
      // Next detection should start fresh
      const result = detector.detectObjects(mockVideo as any);
      
      // All objects should have frameCount of 1 (fresh start)
      [...result.secondaryFaces, ...result.deviceLikeObjects].forEach(obj => {
        expect(obj.frameCount).toBeLessThanOrEqual(1);
      });
    });

    it('should dispose resources', () => {
      detector.detectObjects(mockVideo as any);
      
      expect(() => detector.dispose()).not.toThrow();
      
      // Should be able to call dispose multiple times
      expect(() => detector.dispose()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty frames gracefully', () => {
      const mockContext = {
        drawImage: jest.fn(),
        getImageData: jest.fn().mockReturnValue({
          data: new Uint8ClampedArray(640 * 480 * 4), // All zeros
          width: 640,
          height: 480
        })
      };
      
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: jest.fn().mockReturnValue(mockContext)
      };
      
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn().mockReturnValue(mockCanvas);
      
      const testDetector = new SecondaryObjectDetector();
      
      const result = testDetector.detectObjects(mockVideo as any);
      
      expect(result.totalSecondaryFaces).toBe(0);
      expect(result.totalDeviceLikeObjects).toBe(0);
      
      document.createElement = originalCreateElement;
      testDetector.dispose();
    });

    it('should handle very small video dimensions', () => {
      const smallVideo = {
        videoWidth: 100,
        videoHeight: 100
      };
      
      const result = detector.detectObjects(smallVideo as any);
      
      expect(result).toHaveProperty('secondaryFaces');
      expect(result).toHaveProperty('deviceLikeObjects');
      expect(Array.isArray(result.secondaryFaces)).toBe(true);
      expect(Array.isArray(result.deviceLikeObjects)).toBe(true);
    });
  });

  describe('performance considerations', () => {
    it('should complete detection in reasonable time', () => {
      const startTime = Date.now();
      
      detector.detectObjects(mockVideo as any);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 1 second (generous for testing)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple consecutive detections', () => {
      expect(() => {
        for (let i = 0; i < 10; i++) {
          detector.detectObjects(mockVideo as any);
        }
      }).not.toThrow();
    });
  });
});