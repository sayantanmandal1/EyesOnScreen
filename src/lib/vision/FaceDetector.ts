/**
 * FaceDetector - MediaPipe FaceMesh integration for face landmark detection
 */

import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { VisionError } from './types';

export interface FaceDetectionResult {
  landmarks: Float32Array; // 468 x 3 coordinates
  faceDetected: boolean;
  confidence: number;
  timestamp: number;
}

export interface FaceDetectorConfig {
  maxNumFaces: number;
  refineLandmarks: boolean;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}

export class FaceDetector {
  private faceMesh: FaceMesh | null = null;
  private camera: Camera | null = null;
  private isInitialized = false;
  private config: FaceDetectorConfig;
  private lastResult: FaceDetectionResult | null = null;
  private onResultsCallback: ((result: FaceDetectionResult) => void) | null = null;

  constructor(config: Partial<FaceDetectorConfig> = {}) {
    this.config = {
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
      ...config
    };
  }

  /**
   * Initialize MediaPipe FaceMesh model
   */
  async initialize(): Promise<void> {
    try {
      this.faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      this.faceMesh.setOptions({
        maxNumFaces: this.config.maxNumFaces,
        refineLandmarks: this.config.refineLandmarks,
        minDetectionConfidence: this.config.minDetectionConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence,
      });

      this.faceMesh.onResults(this.onResults.bind(this));
      this.isInitialized = true;
    } catch (error) {
      throw new VisionError(`Failed to initialize MediaPipe FaceMesh: ${error}`, {
        code: 'MODEL_LOAD_FAILED',
        details: { error }
      });
    }
  }

  /**
   * Process video frame for face detection
   */
  async processFrame(videoElement: HTMLVideoElement): Promise<FaceDetectionResult> {
    if (!this.isInitialized || !this.faceMesh) {
      throw new VisionError('FaceDetector not initialized', {
        code: 'FACE_DETECTION_FAILED'
      });
    }

    try {
      await this.faceMesh.send({ image: videoElement });
      
      // Return the last result (updated by onResults callback)
      return this.lastResult || {
        landmarks: new Float32Array(468 * 3),
        faceDetected: false,
        confidence: 0,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new VisionError(`Face detection failed: ${error}`, {
        code: 'FACE_DETECTION_FAILED',
        details: { error }
      });
    }
  }

  /**
   * Set callback for real-time results
   */
  setOnResults(callback: (result: FaceDetectionResult) => void): void {
    this.onResultsCallback = callback;
  }

  /**
   * MediaPipe results callback
   */
  private onResults(results: Results): void {
    const timestamp = Date.now();
    let landmarks = new Float32Array(468 * 3);
    let faceDetected = false;
    let confidence = 0;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const faceLandmarks = results.multiFaceLandmarks[0];
      faceDetected = true;
      
      // Convert landmarks to Float32Array format
      for (let i = 0; i < faceLandmarks.length && i < 468; i++) {
        const landmark = faceLandmarks[i];
        landmarks[i * 3] = landmark.x;
        landmarks[i * 3 + 1] = landmark.y;
        landmarks[i * 3 + 2] = landmark.z || 0;
      }

      // Calculate confidence based on landmark visibility and consistency
      confidence = this.calculateLandmarkConfidence(landmarks);
    }

    const result: FaceDetectionResult = {
      landmarks,
      faceDetected,
      confidence,
      timestamp
    };

    this.lastResult = result;
    
    if (this.onResultsCallback) {
      this.onResultsCallback(result);
    }
  }

  /**
   * Calculate confidence score based on landmark quality
   */
  private calculateLandmarkConfidence(landmarks: Float32Array): number {
    if (landmarks.length < 468 * 3) return 0;

    let validLandmarks = 0;
    let totalVariance = 0;

    // Check landmark validity and calculate spatial consistency
    for (let i = 0; i < 468; i++) {
      const x = landmarks[i * 3];
      const y = landmarks[i * 3 + 1];
      const z = landmarks[i * 3 + 2];

      // Check if landmark is within valid range
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        validLandmarks++;
        
        // Calculate local variance for stability assessment
        if (i > 0) {
          const prevX = landmarks[(i - 1) * 3];
          const prevY = landmarks[(i - 1) * 3 + 1];
          const distance = Math.sqrt((x - prevX) ** 2 + (y - prevY) ** 2);
          totalVariance += distance;
        }
      }
    }

    const validityScore = validLandmarks / 468;
    const stabilityScore = Math.max(0, 1 - (totalVariance / 468));
    
    return (validityScore * 0.7 + stabilityScore * 0.3);
  }

  /**
   * Get specific landmark points for key facial features
   */
  getKeyLandmarks(landmarks: Float32Array): {
    leftEye: { x: number; y: number; z: number }[];
    rightEye: { x: number; y: number; z: number }[];
    nose: { x: number; y: number; z: number };
    mouth: { x: number; y: number; z: number }[];
    faceContour: { x: number; y: number; z: number }[];
  } {
    if (landmarks.length < 468 * 3) {
      throw new Error('Invalid landmarks array');
    }

    const getLandmark = (index: number) => ({
      x: landmarks[index * 3],
      y: landmarks[index * 3 + 1],
      z: landmarks[index * 3 + 2]
    });

    // MediaPipe FaceMesh landmark indices for key features
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    const noseIndex = 1;
    const mouthIndices = [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318];
    const faceContourIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

    return {
      leftEye: leftEyeIndices.map(getLandmark),
      rightEye: rightEyeIndices.map(getLandmark),
      nose: getLandmark(noseIndex),
      mouth: mouthIndices.map(getLandmark),
      faceContour: faceContourIndices.map(getLandmark)
    };
  }

  /**
   * Validate landmark detection quality
   */
  validateLandmarks(landmarks: Float32Array): {
    isValid: boolean;
    issues: string[];
    quality: number;
  } {
    const issues: string[] = [];
    
    if (landmarks.length !== 468 * 3) {
      issues.push('Invalid landmark array size');
      return { isValid: false, issues, quality: 0 };
    }

    let validCount = 0;
    let outOfBounds = 0;

    for (let i = 0; i < 468; i++) {
      const x = landmarks[i * 3];
      const y = landmarks[i * 3 + 1];
      
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        validCount++;
      } else {
        outOfBounds++;
      }
    }

    const validRatio = validCount / 468;
    
    if (validRatio < 0.8) {
      issues.push(`Low landmark validity: ${(validRatio * 100).toFixed(1)}%`);
    }
    
    if (outOfBounds > 50) {
      issues.push(`Too many out-of-bounds landmarks: ${outOfBounds}`);
    }

    const quality = this.calculateLandmarkConfidence(landmarks);
    const isValid = issues.length === 0 && quality > 0.6;

    return { isValid, issues, quality };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.faceMesh) {
      this.faceMesh.close();
      this.faceMesh = null;
    }
    
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    
    this.isInitialized = false;
    this.lastResult = null;
    this.onResultsCallback = null;
  }

  /**
   * Get initialization status
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current configuration
   */
  get configuration(): FaceDetectorConfig {
    return { ...this.config };
  }
}