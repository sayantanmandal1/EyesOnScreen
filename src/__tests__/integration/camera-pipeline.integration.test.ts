/**
 * Integration tests for the complete camera pipeline
 * Tests end-to-end video processing with synthetic data
 */

import { CameraPermissionManager } from '../../lib/camera/CameraPermissionManager';
import { CameraStreamManager } from '../../lib/camera/CameraStreamManager';
import { FaceDetector } from '../../lib/vision/FaceDetector';
import { GazeEstimator } from '../../lib/vision/GazeEstimator';
import { HeadPoseEstimator } from '../../lib/vision/HeadPoseEstimator';
import { ProctorEngine } from '../../lib/proctoring/ProctorEngine';

// Mock MediaPipe and WebGL
jest.mock('@mediapipe/face_mesh', () => ({
  FaceMesh: jest.fn().mockImplementation(() => ({
    setOptions: jest.fn(),
    onResults: jest.fn(),
    send: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock video element
const mockVideoElement = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  videoWidth: 640,
  videoHeight: 480,
  srcObject: null,
} as unknown as HTMLVideoElement;

// Mock canvas and WebGL context
const mockCanvas = {
  getContext: jest.fn().mockReturnValue({
    drawImage: jest.fn(),
    getImageData: jest.fn().mockReturnValue({
      data: new Uint8ClampedArray(640 * 480 * 4)
    }),
    putImageData: jest.fn(),
    clearRect: jest.fn()
  }),
  width: 640,
  height: 480
};

Object.defineProperty(global, 'HTMLCanvasElement', {
  value: jest.fn().mockImplementation(() => mockCanvas),
  writable: true
});

// Mock getUserMedia
const mockStream = {
  getTracks: jest.fn().mockReturnValue([{
    stop: jest.fn(),
    getSettings: jest.fn().mockReturnValue({
      width: 640,
      height: 480,
      frameRate: 30
    })
  }]),
  active: true
};

const mockGetUserMedia = jest.fn().mockResolvedValue(mockStream);
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  writable: true
});

// Mock video element
const mockVideo = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  srcObject: null,
  videoWidth: 640,
  videoHeight: 480,
  readyState: 4
};

Object.defineProperty(global, 'HTMLVideoElement', {
  value: jest.fn().mockImplementation(() => mockVideo),
  writable: true
});

describe('Camera Pipeline Integration', () => {
  let permissionManager: CameraPermissionManager;
  let streamManager: CameraStreamManager;
  let faceDetector: FaceDetector;
  let gazeEstimator: GazeEstimator;
  let headPoseEstimator: HeadPoseEstimator;
  let proctorEngine: ProctorEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    
    permissionManager = new CameraPermissionManager({
      constraints: {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: false
      },
      maxRetries: 3,
      retryDelay: 1000,
      reconnectDelay: 2000,
      maxReconnectAttempts: 5
    });
    streamManager = new CameraStreamManager({
      constraints: {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: false
      },
      maxRetries: 3,
      retryDelay: 1000,
      reconnectDelay: 2000,
      maxReconnectAttempts: 5
    }, permissionManager);
    faceDetector = new FaceDetector();
    gazeEstimator = new GazeEstimator();
    headPoseEstimator = new HeadPoseEstimator();
    proctorEngine = new ProctorEngine();
  });

  afterEach(() => {
    streamManager.destroy();
    proctorEngine.stop();
  });

  describe('End-to-End Camera Setup', () => {
    it('should complete full camera initialization flow', async () => {
      // Step 1: Request camera permission
      const permissionResult = await permissionManager.requestPermissionWithResult();
      expect(permissionResult.granted).toBe(true);

      // Step 2: Initialize camera stream
      const streamResult = await streamManager.initializeWithResult();
      expect(streamResult.success).toBe(true);
      expect(streamResult.stream).toBe(mockStream);

      // Step 3: Verify stream is active
      expect(streamManager.isActive).toBe(true);
      expect(streamManager.getStream()).toBe(mockStream);
    });

    it('should handle camera permission denial gracefully', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValueOnce(error);

      const permissionResult = await permissionManager.requestPermission();
      expect(permissionResult.granted).toBe(false);
      expect(permissionResult.error).toBe('Permission denied by user');

      // Stream initialization should fail
      const streamResult = await streamManager.initialize();
      expect(streamResult.success).toBe(false);
    });

    it('should recover from temporary camera errors', async () => {
      // First attempt fails
      const error = new Error('Device busy');
      error.name = 'NotReadableError';
      mockGetUserMedia
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockStream);

      // Should retry and succeed
      const permissionResult = await permissionManager.requestPermission({ 
        maxRetries: 2, 
        retryDelay: 10 
      });
      expect(permissionResult.granted).toBe(true);
    });
  });

  describe('Vision Processing Pipeline', () => {
    beforeEach(async () => {
      await streamManager.initialize();
    });

    it('should process synthetic video frames through complete pipeline', async () => {
      // Initialize vision components
      await faceDetector.initialize();
      await gazeEstimator.initialize();
      await headPoseEstimator.initialize();

      // Create synthetic frame data
      const syntheticLandmarks = new Float32Array(468 * 3);
      // Populate with realistic face landmark positions
      for (let i = 0; i < 468; i++) {
        syntheticLandmarks[i * 3] = 320 + Math.random() * 100; // x
        syntheticLandmarks[i * 3 + 1] = 240 + Math.random() * 100; // y
        syntheticLandmarks[i * 3 + 2] = Math.random() * 10; // z
      }

      // Mock face detection results
      const mockResults = {
        multiFaceLandmarks: [{
          map: () => Array.from({ length: 468 }, (_, i) => ({
            x: syntheticLandmarks[i * 3] / 640,
            y: syntheticLandmarks[i * 3 + 1] / 480,
            z: syntheticLandmarks[i * 3 + 2]
          }))
        }]
      };

      // Process through face detector
      const faceResults = await faceDetector.processFrame(mockCanvas as any);
      expect(faceResults.faceDetected).toBeDefined();

      // Process through head pose estimator
      if (faceResults.faceDetected) {
        const headPose = await headPoseEstimator.estimateHeadPose(faceResults.landmarks);
        expect(headPose.yaw).toBeDefined();
        expect(headPose.pitch).toBeDefined();
        expect(headPose.roll).toBeDefined();
        expect(headPose.confidence).toBeGreaterThan(0);
      }

      // Process through gaze estimator
      if (faceResults.faceDetected) {
        const gazeVector = await gazeEstimator.estimateGaze(faceResults.landmarks);
        expect(gazeVector.x).toBeDefined();
        expect(gazeVector.y).toBeDefined();
        expect(gazeVector.z).toBeDefined();
        expect(gazeVector.confidence).toBeGreaterThan(0);
      }
    });

    it('should handle missing face landmarks gracefully', async () => {
      await faceDetector.initialize();

      // Process frame with no face
      const emptyResults = await faceDetector.processFrame(mockCanvas as any);
      expect(emptyResults.faceDetected).toBe(false);

      // Downstream processors should handle gracefully
      const headPose = await headPoseEstimator.estimateHeadPose(null);
      expect(headPose.confidence).toBe(0);

      const gazeVector = await gazeEstimator.estimateGaze(null);
      expect(gazeVector.confidence).toBe(0);
    });

    it('should maintain processing performance under load', async () => {
      await faceDetector.initialize();
      
      const frameCount = 30;
      const startTime = performance.now();

      // Process multiple frames rapidly
      const promises = Array.from({ length: frameCount }, () =>
        faceDetector.processFrame(mockCanvas as any)
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgFrameTime = totalTime / frameCount;

      // Should maintain reasonable frame processing time
      expect(avgFrameTime).toBeLessThan(50); // < 50ms per frame for 20+ FPS
      expect(results).toHaveLength(frameCount);
    });
  });

  describe('Proctor Engine Integration', () => {
    beforeEach(async () => {
      await streamManager.initialize();
      await faceDetector.initialize();
      await gazeEstimator.initialize();
      await headPoseEstimator.initialize();
    });

    it('should integrate all components in monitoring loop', async () => {
      const mockSignals = {
        timestamp: Date.now(),
        faceDetected: true,
        landmarks: new Float32Array(468 * 3),
        headPose: { yaw: 5, pitch: -2, roll: 1, confidence: 0.9 },
        gazeVector: { x: 0.1, y: -0.05, z: -1, confidence: 0.85 },
        eyesOnScreen: true,
        environmentScore: {
          lighting: 0.8,
          shadowStability: 0.9,
          secondaryFaces: 0,
          deviceLikeObjects: 0
        }
      };

      // Start proctor engine
      proctorEngine.start();
      expect(proctorEngine.isRunning()).toBe(true);

      // Process signals through engine
      const flags = proctorEngine.processSignals(mockSignals);
      expect(Array.isArray(flags)).toBe(true);

      // Should not flag normal behavior
      expect(flags).toHaveLength(0);
    });

    it('should detect and flag suspicious behavior', async () => {
      const suspiciousSignals = {
        timestamp: Date.now(),
        faceDetected: true,
        landmarks: new Float32Array(468 * 3),
        headPose: { yaw: 45, pitch: -30, roll: 5, confidence: 0.9 }, // Extreme head turn
        gazeVector: { x: 0.8, y: 0.6, z: -1, confidence: 0.85 }, // Looking away
        eyesOnScreen: false,
        environmentScore: {
          lighting: 0.3, // Poor lighting
          shadowStability: 0.4, // Unstable shadows
          secondaryFaces: 1, // Additional face detected
          deviceLikeObjects: 1 // Phone-like object
        }
      };

      proctorEngine.start();

      // Process suspicious signals
      const flags = proctorEngine.processSignals(suspiciousSignals);
      
      // Should generate multiple flags
      expect(flags.length).toBeGreaterThan(0);
      
      // Check for specific flag types
      const flagTypes = flags.map(flag => flag.type);
      expect(flagTypes).toContain('EYES_OFF');
      expect(flagTypes).toContain('HEAD_POSE');
    });

    it('should handle rapid signal processing', async () => {
      proctorEngine.start();

      const signalCount = 100;
      const signals = Array.from({ length: signalCount }, (_, i) => ({
        timestamp: Date.now() + i * 33, // 30 FPS
        faceDetected: true,
        landmarks: new Float32Array(468 * 3),
        headPose: { yaw: Math.random() * 10 - 5, pitch: Math.random() * 10 - 5, roll: 0, confidence: 0.9 },
        gazeVector: { x: Math.random() * 0.2 - 0.1, y: Math.random() * 0.2 - 0.1, z: -1, confidence: 0.85 },
        eyesOnScreen: true,
        environmentScore: {
          lighting: 0.8,
          shadowStability: 0.9,
          secondaryFaces: 0,
          deviceLikeObjects: 0
        }
      }));

      const startTime = performance.now();
      
      // Process all signals
      const allFlags = signals.map(signal => proctorEngine.processSignals(signal));
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgProcessingTime = totalTime / signalCount;

      // Should maintain real-time processing speed
      expect(avgProcessingTime).toBeLessThan(10); // < 10ms per signal
      expect(allFlags).toHaveLength(signalCount);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from camera disconnection', async () => {
      await streamManager.initialize();
      expect(streamManager.isActive()).toBe(true);

      // Simulate camera disconnection
      mockStream.active = false;
      mockStream.getTracks()[0].readyState = 'ended';

      // Should detect inactive stream
      const health = streamManager.getStreamHealth();
      expect(health.active).toBe(false);

      // Should be able to restart
      mockStream.active = true;
      mockGetUserMedia.mockResolvedValueOnce(mockStream);
      
      const restartResult = await streamManager.restart();
      expect(restartResult.success).toBe(true);
    });

    it('should handle vision processing failures gracefully', async () => {
      await faceDetector.initialize();

      // Mock processing error
      const originalProcess = faceDetector.processFrame;
      faceDetector.processFrame = jest.fn().mockRejectedValue(new Error('Processing failed'));

      // Should handle error without crashing
      const result = await faceDetector.processFrame(mockCanvas as any).catch(err => ({
        faceDetected: false,
        landmarks: null,
        error: err.message
      }));

      expect(result.faceDetected).toBe(false);
      expect(result.error).toBe('Processing failed');

      // Restore original function
      faceDetector.processFrame = originalProcess;
    });

    it('should maintain state consistency during errors', async () => {
      proctorEngine.start();
      
      // Process normal signal
      const normalSignal = {
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

      proctorEngine.processSignals(normalSignal);
      const initialState = proctorEngine.getCurrentState();

      // Process malformed signal
      const malformedSignal = {
        timestamp: Date.now(),
        // Missing required fields
      };

      // Should handle gracefully without corrupting state
      const flags = proctorEngine.processSignals(malformedSignal as any);
      const finalState = proctorEngine.getCurrentState();

      expect(flags).toEqual([]);
      expect(finalState.isRunning).toBe(initialState.isRunning);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should properly cleanup resources on shutdown', async () => {
      await streamManager.initialize();
      await faceDetector.initialize();
      proctorEngine.start();

      // Verify resources are active
      expect(streamManager.isActive()).toBe(true);
      expect(proctorEngine.isRunning()).toBe(true);

      // Cleanup all resources
      streamManager.destroy();
      proctorEngine.stop();
      faceDetector.destroy();

      // Verify cleanup
      expect(streamManager.isActive()).toBe(false);
      expect(proctorEngine.isRunning()).toBe(false);
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
    });

    it('should not leak memory during extended operation', async () => {
      await streamManager.initialize();
      await faceDetector.initialize();
      proctorEngine.start();

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Simulate extended operation
      for (let i = 0; i < 1000; i++) {
        const signal = {
          timestamp: Date.now() + i,
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
        
        // Periodic cleanup simulation
        if (i % 100 === 0) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory growth should be reasonable (less than 50MB increase)
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });
});