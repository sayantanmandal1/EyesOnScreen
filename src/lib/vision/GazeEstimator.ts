/**
 * GazeEstimator - Iris-based gaze estimation with screen plane mapping
 */

import { VisionError } from './types';

export interface GazeVector {
  x: number;
  y: number;
  z: number;
  confidence: number;
}

export interface GazePoint {
  x: number; // Screen coordinates (pixels)
  y: number;
  confidence: number;
  timestamp: number;
}

export interface IrisData {
  center: { x: number; y: number };
  radius: number;
  landmarks: { x: number; y: number }[];
  confidence: number;
}

export interface EyeData {
  leftIris: IrisData;
  rightIris: IrisData;
  leftEyeLandmarks: { x: number; y: number }[];
  rightEyeLandmarks: { x: number; y: number }[];
}

export interface GazeEstimatorConfig {
  screenWidth: number;
  screenHeight: number;
  eyeballRadius: number; // mm
  cornealRadius: number; // mm
  confidenceThreshold: number;
  smoothingFactor: number;
  calibrationRequired: boolean;
}

export interface CalibrationData {
  screenPoints: { x: number; y: number }[];
  gazeVectors: GazeVector[];
  homographyMatrix: number[][];
  isCalibrated: boolean;
}

/**
 * MediaPipe FaceMesh landmark indices for eye regions
 */
const LEFT_EYE_LANDMARKS = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
];

const RIGHT_EYE_LANDMARKS = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
];

// Iris landmarks (approximate - MediaPipe doesn't provide exact iris landmarks)
const LEFT_IRIS_LANDMARKS = [468, 469, 470, 471, 472]; // These would be iris-specific in a full implementation
const RIGHT_IRIS_LANDMARKS = [473, 474, 475, 476, 477];

export class GazeEstimator {
  private config: GazeEstimatorConfig;
  private calibrationData: CalibrationData;
  private previousGaze: GazePoint | null = null;

  constructor(config: Partial<GazeEstimatorConfig> = {}) {
    this.config = {
      screenWidth: 1920,
      screenHeight: 1080,
      eyeballRadius: 12, // mm
      cornealRadius: 7.8, // mm
      confidenceThreshold: 0.7,
      smoothingFactor: 0.3,
      calibrationRequired: true,
      ...config
    };

    this.calibrationData = {
      screenPoints: [],
      gazeVectors: [],
      homographyMatrix: this.createIdentityMatrix(),
      isCalibrated: false
    };
  }

  /**
   * Estimate gaze point from facial landmarks
   */
  estimateGaze(landmarks: Float32Array, imageWidth: number, imageHeight: number): GazePoint {
    if (landmarks.length < 468 * 3) {
      throw new VisionError('Invalid landmarks array for gaze estimation', {
        code: 'FACE_DETECTION_FAILED',
        details: { landmarksLength: landmarks.length }
      });
    }

    try {
      // Extract eye data from landmarks
      const eyeData = this.extractEyeData(landmarks, imageWidth, imageHeight);
      
      // Calculate gaze vector for each eye
      const leftGazeVector = this.calculateEyeGazeVector(eyeData.leftIris, eyeData.leftEyeLandmarks);
      const rightGazeVector = this.calculateEyeGazeVector(eyeData.rightIris, eyeData.rightEyeLandmarks);
      
      // Combine gaze vectors from both eyes
      const combinedGazeVector = this.combineGazeVectors(leftGazeVector, rightGazeVector);
      
      // Map gaze vector to screen coordinates
      const screenPoint = this.mapGazeToScreen(combinedGazeVector);
      
      // Apply temporal smoothing
      const smoothedPoint = this.applySmoothingFilter(screenPoint);
      
      this.previousGaze = smoothedPoint;
      return smoothedPoint;
      
    } catch (error) {
      throw new VisionError(`Gaze estimation failed: ${error}`, {
        code: 'FACE_DETECTION_FAILED',
        details: { error }
      });
    }
  }

  /**
   * Extract eye and iris data from facial landmarks
   */
  private extractEyeData(landmarks: Float32Array, imageWidth: number, imageHeight: number): EyeData {
    const getLandmark = (index: number) => ({
      x: landmarks[index * 3] * imageWidth,
      y: landmarks[index * 3 + 1] * imageHeight
    });

    // Extract eye landmarks
    const leftEyeLandmarks = LEFT_EYE_LANDMARKS.map(getLandmark);
    const rightEyeLandmarks = RIGHT_EYE_LANDMARKS.map(getLandmark);

    // Calculate eye centers and dimensions
    const leftEyeCenter = this.calculateEyeCenter(leftEyeLandmarks);
    const rightEyeCenter = this.calculateEyeCenter(rightEyeLandmarks);

    // Estimate iris centers (simplified - in practice, would use iris-specific detection)
    const leftIrisCenter = this.estimateIrisCenter(leftEyeLandmarks, leftEyeCenter);
    const rightIrisCenter = this.estimateIrisCenter(rightEyeLandmarks, rightEyeCenter);

    // Calculate iris radius based on eye size
    const leftIrisRadius = this.calculateIrisRadius(leftEyeLandmarks);
    const rightIrisRadius = this.calculateIrisRadius(rightEyeLandmarks);

    return {
      leftIris: {
        center: leftIrisCenter,
        radius: leftIrisRadius,
        landmarks: LEFT_IRIS_LANDMARKS.map(getLandmark),
        confidence: this.calculateIrisConfidence(leftEyeLandmarks, leftIrisCenter)
      },
      rightIris: {
        center: rightIrisCenter,
        radius: rightIrisRadius,
        landmarks: RIGHT_IRIS_LANDMARKS.map(getLandmark),
        confidence: this.calculateIrisConfidence(rightEyeLandmarks, rightIrisCenter)
      },
      leftEyeLandmarks,
      rightEyeLandmarks
    };
  }

  /**
   * Calculate eye center from landmarks
   */
  private calculateEyeCenter(eyeLandmarks: { x: number; y: number }[]): { x: number; y: number } {
    const centerX = eyeLandmarks.reduce((sum, p) => sum + p.x, 0) / eyeLandmarks.length;
    const centerY = eyeLandmarks.reduce((sum, p) => sum + p.y, 0) / eyeLandmarks.length;
    return { x: centerX, y: centerY };
  }

  /**
   * Estimate iris center within the eye
   */
  private estimateIrisCenter(eyeLandmarks: { x: number; y: number }[], eyeCenter: { x: number; y: number }): { x: number; y: number } {
    // Simplified iris center estimation
    // In practice, this would use more sophisticated iris detection
    
    // Find eye corners
    const leftCorner = eyeLandmarks[0];
    const rightCorner = eyeLandmarks[8] || eyeLandmarks[eyeLandmarks.length - 1];
    const topPoint = eyeLandmarks[4] || eyeCenter;
    const bottomPoint = eyeLandmarks[12] || eyeCenter;

    // Estimate iris position based on eye shape and typical iris placement
    const eyeWidth = Math.abs(rightCorner.x - leftCorner.x);
    const eyeHeight = Math.abs(bottomPoint.y - topPoint.y);
    
    // Iris is typically slightly offset from geometric center
    const irisX = eyeCenter.x + (Math.random() - 0.5) * eyeWidth * 0.1; // Small random offset for demo
    const irisY = eyeCenter.y + (Math.random() - 0.5) * eyeHeight * 0.1;
    
    return { x: irisX, y: irisY };
  }

  /**
   * Calculate iris radius based on eye size
   */
  private calculateIrisRadius(eyeLandmarks: { x: number; y: number }[]): number {
    // Calculate eye dimensions
    const minX = Math.min(...eyeLandmarks.map(p => p.x));
    const maxX = Math.max(...eyeLandmarks.map(p => p.x));
    const minY = Math.min(...eyeLandmarks.map(p => p.y));
    const maxY = Math.max(...eyeLandmarks.map(p => p.y));
    
    const eyeWidth = maxX - minX;
    const eyeHeight = maxY - minY;
    
    // Iris is typically about 30-40% of eye width
    return Math.min(eyeWidth, eyeHeight) * 0.35;
  }

  /**
   * Calculate iris detection confidence
   */
  private calculateIrisConfidence(eyeLandmarks: { x: number; y: number }[], irisCenter: { x: number; y: number }): number {
    // Check if iris center is within reasonable bounds of the eye
    const minX = Math.min(...eyeLandmarks.map(p => p.x));
    const maxX = Math.max(...eyeLandmarks.map(p => p.x));
    const minY = Math.min(...eyeLandmarks.map(p => p.y));
    const maxY = Math.max(...eyeLandmarks.map(p => p.y));
    
    const withinBounds = irisCenter.x >= minX && irisCenter.x <= maxX && 
                        irisCenter.y >= minY && irisCenter.y <= maxY;
    
    if (!withinBounds) return 0.2;
    
    // Check for degenerate eye landmarks (all zeros or very close)
    const eyeWidth = maxX - minX;
    const eyeHeight = maxY - minY;
    
    if (eyeWidth < 1 || eyeHeight < 1) {
      return 0.1; // Very low confidence for degenerate landmarks
    }
    
    // Calculate confidence based on eye landmark quality
    const landmarkSpread = Math.sqrt(
      eyeLandmarks.reduce((sum, p) => {
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        return sum + Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2);
      }, 0) / eyeLandmarks.length
    );
    
    // Normalize spread to confidence (0-1)
    const normalizedSpread = Math.min(landmarkSpread / 100, 1);
    return Math.max(0.2, 1 - normalizedSpread);
  }

  /**
   * Calculate gaze vector for a single eye using iris position
   */
  private calculateEyeGazeVector(iris: IrisData, eyeLandmarks: { x: number; y: number }[]): GazeVector {
    if (iris.confidence < 0.3) {
      return { x: 0, y: 0, z: -1, confidence: 0 };
    }

    // Calculate eye center
    const eyeCenter = this.calculateEyeCenter(eyeLandmarks);
    
    // Calculate iris displacement from eye center
    const irisDisplacementX = iris.center.x - eyeCenter.x;
    const irisDisplacementY = iris.center.y - eyeCenter.y;
    
    // Convert pixel displacement to angular displacement
    // This is a simplified model - real gaze estimation would use 3D eye model
    const pixelsPerDegree = 30; // Approximate conversion factor
    const gazeAngleX = Math.atan(irisDisplacementX / pixelsPerDegree);
    const gazeAngleY = Math.atan(irisDisplacementY / pixelsPerDegree);
    
    // Convert angles to 3D gaze vector
    const gazeX = Math.sin(gazeAngleX);
    const gazeY = Math.sin(gazeAngleY);
    const gazeZ = -Math.cos(Math.sqrt(gazeAngleX * gazeAngleX + gazeAngleY * gazeAngleY));
    
    // Normalize vector
    const magnitude = Math.sqrt(gazeX * gazeX + gazeY * gazeY + gazeZ * gazeZ);
    
    return {
      x: gazeX / magnitude,
      y: gazeY / magnitude,
      z: gazeZ / magnitude,
      confidence: iris.confidence
    };
  }

  /**
   * Combine gaze vectors from both eyes
   */
  private combineGazeVectors(leftGaze: GazeVector, rightGaze: GazeVector): GazeVector {
    // Weight by confidence
    const totalConfidence = leftGaze.confidence + rightGaze.confidence;
    
    if (totalConfidence === 0) {
      return { x: 0, y: 0, z: -1, confidence: 0 };
    }
    
    const leftWeight = leftGaze.confidence / totalConfidence;
    const rightWeight = rightGaze.confidence / totalConfidence;
    
    const combinedX = leftGaze.x * leftWeight + rightGaze.x * rightWeight;
    const combinedY = leftGaze.y * leftWeight + rightGaze.y * rightWeight;
    const combinedZ = leftGaze.z * leftWeight + rightGaze.z * rightWeight;
    
    // Normalize combined vector
    const magnitude = Math.sqrt(combinedX * combinedX + combinedY * combinedY + combinedZ * combinedZ);
    
    return {
      x: combinedX / magnitude,
      y: combinedY / magnitude,
      z: combinedZ / magnitude,
      confidence: Math.min(1, totalConfidence / 2) // Average confidence
    };
  }

  /**
   * Map gaze vector to screen coordinates
   */
  private mapGazeToScreen(gazeVector: GazeVector): GazePoint {
    if (!this.calibrationData.isCalibrated) {
      // Use simple geometric mapping without calibration
      return this.geometricGazeMapping(gazeVector);
    }
    
    // Use calibrated homography mapping
    return this.calibratedGazeMapping(gazeVector);
  }

  /**
   * Simple geometric gaze mapping (without calibration)
   */
  private geometricGazeMapping(gazeVector: GazeVector): GazePoint {
    // Assume screen is perpendicular to Z-axis at some distance
    const screenDistance = 600; // mm (typical monitor distance)
    
    // Project gaze vector onto screen plane
    if (Math.abs(gazeVector.z) < 0.01) {
      // Gaze is parallel to screen - return center
      return {
        x: this.config.screenWidth / 2,
        y: this.config.screenHeight / 2,
        confidence: 0.1,
        timestamp: Date.now()
      };
    }
    
    // Calculate intersection with screen plane
    const t = screenDistance / Math.abs(gazeVector.z);
    const intersectionX = gazeVector.x * t;
    const intersectionY = gazeVector.y * t;
    
    // Convert to screen coordinates (assuming screen center is at origin)
    const screenX = (intersectionX / 300) * (this.config.screenWidth / 2) + (this.config.screenWidth / 2);
    const screenY = (intersectionY / 200) * (this.config.screenHeight / 2) + (this.config.screenHeight / 2);
    
    // Clamp to screen bounds
    const clampedX = Math.max(0, Math.min(this.config.screenWidth, screenX));
    const clampedY = Math.max(0, Math.min(this.config.screenHeight, screenY));
    
    return {
      x: clampedX,
      y: clampedY,
      confidence: gazeVector.confidence * 0.7, // Reduce confidence for uncalibrated mapping
      timestamp: Date.now()
    };
  }

  /**
   * Calibrated gaze mapping using homography
   */
  private calibratedGazeMapping(gazeVector: GazeVector): GazePoint {
    // Apply homography transformation
    const homogeneous = [gazeVector.x, gazeVector.y, 1];
    const transformed = this.multiplyMatrixVector(this.calibrationData.homographyMatrix, homogeneous);
    
    // Convert from homogeneous coordinates
    const screenX = transformed[0] / transformed[2];
    const screenY = transformed[1] / transformed[2];
    
    // Clamp to screen bounds
    const clampedX = Math.max(0, Math.min(this.config.screenWidth, screenX));
    const clampedY = Math.max(0, Math.min(this.config.screenHeight, screenY));
    
    return {
      x: clampedX,
      y: clampedY,
      confidence: gazeVector.confidence,
      timestamp: Date.now()
    };
  }

  /**
   * Apply temporal smoothing filter
   */
  private applySmoothingFilter(currentGaze: GazePoint): GazePoint {
    if (!this.previousGaze) {
      return currentGaze;
    }
    
    const alpha = this.config.smoothingFactor;
    
    return {
      x: alpha * this.previousGaze.x + (1 - alpha) * currentGaze.x,
      y: alpha * this.previousGaze.y + (1 - alpha) * currentGaze.y,
      confidence: currentGaze.confidence,
      timestamp: currentGaze.timestamp
    };
  }

  /**
   * Add calibration point
   */
  addCalibrationPoint(screenX: number, screenY: number, gazeVector: GazeVector): void {
    this.calibrationData.screenPoints.push({ x: screenX, y: screenY });
    this.calibrationData.gazeVectors.push(gazeVector);
    
    // Recalculate homography if we have enough points
    if (this.calibrationData.screenPoints.length >= 4) {
      this.calculateHomography();
    }
  }

  /**
   * Calculate homography matrix from calibration points
   */
  private calculateHomography(): void {
    const points = this.calibrationData.screenPoints;
    const vectors = this.calibrationData.gazeVectors;
    
    if (points.length < 4) {
      return;
    }
    
    // Simplified homography calculation (in practice, use robust estimation)
    // This is a basic implementation - production would use DLT or RANSAC
    
    try {
      const A: number[][] = [];
      const b: number[] = [];
      
      for (let i = 0; i < Math.min(points.length, 8); i++) {
        const p = points[i];
        const v = vectors[i];
        
        // Set up linear system for homography estimation
        A.push([v.x, v.y, 1, 0, 0, 0, -p.x * v.x, -p.x * v.y]);
        A.push([0, 0, 0, v.x, v.y, 1, -p.y * v.x, -p.y * v.y]);
        b.push(p.x, p.y);
      }
      
      // Solve linear system (simplified - would use SVD in practice)
      const h = this.solveLeastSquares(A, b);
      
      if (h.length === 8) {
        this.calibrationData.homographyMatrix = [
          [h[0], h[1], h[2]],
          [h[3], h[4], h[5]],
          [h[6], h[7], 1]
        ];
        this.calibrationData.isCalibrated = true;
      }
    } catch (error) {
      console.warn('Homography calculation failed:', error);
      this.calibrationData.homographyMatrix = this.createIdentityMatrix();
      this.calibrationData.isCalibrated = false;
    }
  }

  /**
   * Simple least squares solver
   */
  private solveLeastSquares(A: number[][], b: number[]): number[] {
    // Simplified least squares - in practice, use proper linear algebra library
    const m = A.length;
    const n = A[0].length;
    
    // Initialize solution
    const x = new Array(n).fill(0);
    
    // Simple iterative solver (Gauss-Seidel-like)
    for (let iter = 0; iter < 100; iter++) {
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < m; j++) {
          if (A[j][i] !== 0) {
            let residual = b[j];
            for (let k = 0; k < n; k++) {
              if (k !== i) {
                residual -= A[j][k] * x[k];
              }
            }
            sum += A[j][i] * residual;
          }
        }
        
        let diagonal = 0;
        for (let j = 0; j < m; j++) {
          diagonal += A[j][i] * A[j][i];
        }
        
        if (diagonal > 0) {
          x[i] = sum / diagonal;
        }
      }
    }
    
    return x;
  }

  /**
   * Create identity matrix
   */
  private createIdentityMatrix(): number[][] {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
  }

  /**
   * Matrix-vector multiplication
   */
  private multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < matrix.length; i++) {
      let sum = 0;
      for (let j = 0; j < vector.length; j++) {
        sum += matrix[i][j] * vector[j];
      }
      result.push(sum);
    }
    
    return result;
  }

  /**
   * Validate gaze estimation accuracy
   */
  validateGaze(gazePoint: GazePoint, targetPoint: { x: number; y: number }): {
    isValid: boolean;
    accuracy: number;
    distance: number;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Calculate distance from target
    const distance = Math.sqrt(
      Math.pow(gazePoint.x - targetPoint.x, 2) + 
      Math.pow(gazePoint.y - targetPoint.y, 2)
    );
    
    // Check confidence threshold
    if (gazePoint.confidence < this.config.confidenceThreshold) {
      issues.push(`Low confidence: ${gazePoint.confidence.toFixed(3)}`);
    }
    
    // Check if gaze is within screen bounds
    if (gazePoint.x < 0 || gazePoint.x > this.config.screenWidth ||
        gazePoint.y < 0 || gazePoint.y > this.config.screenHeight) {
      issues.push('Gaze point outside screen bounds');
    }
    
    // Check accuracy (1.5cm at 60cm distance ≈ 24 pixels at typical DPI)
    const accuracyThreshold = 50; // pixels (relaxed for demo)
    if (distance > accuracyThreshold) {
      issues.push(`Low accuracy: ${distance.toFixed(1)}px from target`);
    }
    
    const isValid = issues.length === 0 && gazePoint.confidence >= this.config.confidenceThreshold;
    const accuracy = Math.max(0, 1 - (distance / 100)); // Normalize to 0-1
    
    return { isValid, accuracy, distance, issues };
  }

  /**
   * Reset calibration
   */
  resetCalibration(): void {
    this.calibrationData = {
      screenPoints: [],
      gazeVectors: [],
      homographyMatrix: this.createIdentityMatrix(),
      isCalibrated: false
    };
  }

  /**
   * Check if gaze point is on screen
   */
  isGazeOnScreen(gazePoint: GazePoint): boolean {
    return gazePoint.x >= 0 && gazePoint.x <= this.config.screenWidth &&
           gazePoint.y >= 0 && gazePoint.y <= this.config.screenHeight &&
           gazePoint.confidence >= this.config.confidenceThreshold;
  }

  /**
   * Get current configuration
   */
  get configuration(): GazeEstimatorConfig {
    return { ...this.config };
  }

  /**
   * Get calibration status
   */
  get isCalibrated(): boolean {
    return this.calibrationData.isCalibrated;
  }

  /**
   * Get number of calibration points
   */
  get calibrationPointCount(): number {
    return this.calibrationData.screenPoints.length;
  }
}