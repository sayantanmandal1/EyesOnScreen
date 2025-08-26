/**
 * FaceDetector unit tests
 */

import { FaceDetector, FaceDetectionResult } from '../FaceDetector';
import { VisionError } from '../types';
import { FaceMesh } from '@mediapipe/face_mesh';

// Mock MediaPipe modules
jest.mock('@mediapipe/face_mesh', () => ({
  FaceMesh: jest.fn().mockImplementation(() => ({
    setOptions: jest.fn(),
    onResults: jest.fn(),
    send: jest.fn(),
    close: jest.fn()
  }))
}));

jest.mock('@mediapipe/camera_utils', () => ({
  Camera: jest.fn().mockImplementation(() => ({
    stop: jest.fn()
  }))
}));

describe('FaceDetector', () => {
  let faceDetector: FaceDetector;
  let mockFaceMesh: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock FaceMesh instance
    mockFaceMesh = {
      setOptions: jest.fn(),
      onResults: jest.fn(),
      send: jest.fn().mockResolvedValue(undefined),
      close: jest.fn()
    };

    // Mock FaceMesh constructor
    (FaceMesh as jest.Mock).mockImplementation(() => mockFaceMesh);

    faceDetector = new FaceDetector();
  });

  afterEach(() => {
    faceDetector.dispose();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      await faceDetector.initialize();

      expect(mockFaceMesh.setOptions).toHaveBeenCalledWith({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
      });

      expect(mockFaceMesh.onResults).toHaveBeenCalled();
      expect(faceDetector.initialized).toBe(true);
    });

    it('should initialize with custom configuration', async () => {
      const customConfig = {
        maxNumFaces: 2,
        refineLandmarks: false,
        minDetectionConfidence: 0.8,
        minTrackingConfidence: 0.6
      };

      faceDetector = new FaceDetector(customConfig);
      await faceDetector.initialize();

      expect(mockFaceMesh.setOptions).toHaveBeenCalledWith(customConfig);
    });

    it('should throw VisionError on initialization failure', async () => {
      (FaceMesh as jest.Mock).mockImplementation(() => {
        throw new Error('Model load failed');
      });

      await expect(faceDetector.initialize()).rejects.toThrow(VisionError);
      await expect(faceDetector.initialize()).rejects.toThrow('Failed to initialize MediaPipe FaceMesh');
    });
  });

  describe('frame processing', () => {
    beforeEach(async () => {
      await faceDetector.initialize();
    });

    it('should process video frame successfully', async () => {
      const mockVideo = document.createElement('video');
      
      const result = await faceDetector.processFrame(mockVideo);

      expect(mockFaceMesh.send).toHaveBeenCalledWith({ image: mockVideo });
      expect(result).toMatchObject({
        landmarks: expect.any(Float32Array),
        faceDetected: expect.any(Boolean),
        confidence: expect.any(Number),
        timestamp: expect.any(Number)
      });
    });

    it('should throw error when not initialized', async () => {
      const uninitializedDetector = new FaceDetector();
      const mockVideo = document.createElement('video');

      await expect(uninitializedDetector.processFrame(mockVideo)).rejects.toThrow(VisionError);
      await expect(uninitializedDetector.processFrame(mockVideo)).rejects.toThrow('FaceDetector not initialized');
    });

    it('should handle MediaPipe processing errors', async () => {
      mockFaceMesh.send.mockRejectedValue(new Error('Processing failed'));
      const mockVideo = document.createElement('video');

      await expect(faceDetector.processFrame(mockVideo)).rejects.toThrow(VisionError);
      await expect(faceDetector.processFrame(mockVideo)).rejects.toThrow('Face detection failed');
    });
  });

  describe('landmark processing', () => {
    beforeEach(async () => {
      await faceDetector.initialize();
    });

    it('should calculate landmark confidence correctly', () => {
      // Create valid landmarks array (468 points * 3 coordinates)
      const landmarks = new Float32Array(468 * 3);
      
      // Fill with valid coordinates (0-1 range)
      for (let i = 0; i < 468; i++) {
        landmarks[i * 3] = Math.random(); // x
        landmarks[i * 3 + 1] = Math.random(); // y
        landmarks[i * 3 + 2] = Math.random() * 0.1; // z (depth)
      }

      // Access private method through type assertion for testing
      const confidence = (faceDetector as any).calculateLandmarkConfidence(landmarks);
      
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should extract key landmarks correctly', () => {
      const landmarks = new Float32Array(468 * 3);
      
      // Fill with test data
      for (let i = 0; i < 468 * 3; i++) {
        landmarks[i] = i / (468 * 3); // Normalized test values
      }

      const keyLandmarks = faceDetector.getKeyLandmarks(landmarks);

      expect(keyLandmarks).toHaveProperty('leftEye');
      expect(keyLandmarks).toHaveProperty('rightEye');
      expect(keyLandmarks).toHaveProperty('nose');
      expect(keyLandmarks).toHaveProperty('mouth');
      expect(keyLandmarks).toHaveProperty('faceContour');

      expect(Array.isArray(keyLandmarks.leftEye)).toBe(true);
      expect(Array.isArray(keyLandmarks.rightEye)).toBe(true);
      expect(Array.isArray(keyLandmarks.mouth)).toBe(true);
      expect(Array.isArray(keyLandmarks.faceContour)).toBe(true);
      
      expect(keyLandmarks.nose).toHaveProperty('x');
      expect(keyLandmarks.nose).toHaveProperty('y');
      expect(keyLandmarks.nose).toHaveProperty('z');
    });

    it('should validate landmarks correctly', () => {
      // Valid landmarks
      const validLandmarks = new Float32Array(468 * 3);
      for (let i = 0; i < 468; i++) {
        validLandmarks[i * 3] = Math.random();
        validLandmarks[i * 3 + 1] = Math.random();
        validLandmarks[i * 3 + 2] = Math.random() * 0.1;
      }

      const validResult = faceDetector.validateLandmarks(validLandmarks);
      expect(validResult.isValid).toBe(true);
      expect(validResult.issues).toHaveLength(0);
      expect(validResult.quality).toBeGreaterThan(0);

      // Invalid landmarks (wrong size)
      const invalidLandmarks = new Float32Array(100);
      const invalidResult = faceDetector.validateLandmarks(invalidLandmarks);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.issues).toContain('Invalid landmark array size');
      expect(invalidResult.quality).toBe(0);
    });
  });

  describe('results callback', () => {
    beforeEach(async () => {
      await faceDetector.initialize();
    });

    it('should handle results callback with face detected', () => {
      const mockCallback = jest.fn();
      faceDetector.setOnResults(mockCallback);

      // Simulate MediaPipe results
      const mockResults = {
        multiFaceLandmarks: [
          Array.from({ length: 468 }, (_, i) => ({
            x: Math.random(),
            y: Math.random(),
            z: Math.random() * 0.1
          }))
        ]
      };

      // Get the callback function that was passed to onResults
      const resultsCallback = mockFaceMesh.onResults.mock.calls[0][0];
      resultsCallback(mockResults);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          landmarks: expect.any(Float32Array),
          faceDetected: true,
          confidence: expect.any(Number),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle results callback with no face detected', () => {
      const mockCallback = jest.fn();
      faceDetector.setOnResults(mockCallback);

      // Simulate MediaPipe results with no face
      const mockResults = {
        multiFaceLandmarks: []
      };

      const resultsCallback = mockFaceMesh.onResults.mock.calls[0][0];
      resultsCallback(mockResults);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          landmarks: expect.any(Float32Array),
          faceDetected: false,
          confidence: 0,
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('resource management', () => {
    it('should dispose resources properly', async () => {
      await faceDetector.initialize();
      
      faceDetector.dispose();

      expect(mockFaceMesh.close).toHaveBeenCalled();
      expect(faceDetector.initialized).toBe(false);
    });

    it('should handle disposal when not initialized', () => {
      expect(() => faceDetector.dispose()).not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should return current configuration', () => {
      const config = faceDetector.configuration;
      
      expect(config).toEqual({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
      });
    });

    it('should not allow external modification of configuration', () => {
      const config = faceDetector.configuration;
      config.maxNumFaces = 5;
      
      const newConfig = faceDetector.configuration;
      expect(newConfig.maxNumFaces).toBe(1);
    });
  });
});