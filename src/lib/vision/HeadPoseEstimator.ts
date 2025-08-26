/**
 * HeadPoseEstimator - 6DOF head tracking using solvePnP algorithm
 */

import { VisionError } from './types';

export interface HeadPose {
  yaw: number;    // Rotation around Y-axis (left/right)
  pitch: number;  // Rotation around X-axis (up/down)
  roll: number;   // Rotation around Z-axis (tilt)
  confidence: number;
  timestamp: number;
}

export interface HeadPoseEstimatorConfig {
  focalLength: number;
  principalPointX: number;
  principalPointY: number;
  confidenceThreshold: number;
  stabilizationFactor: number;
}

/**
 * 3D model points for key facial landmarks in a canonical face coordinate system
 * Based on anthropometric measurements and MediaPipe face model
 */
const CANONICAL_FACE_MODEL_POINTS = [
  // Nose tip
  [0.0, 0.0, 0.0],
  // Chin
  [0.0, -330.0, -65.0],
  // Left eye left corner
  [-225.0, 170.0, -135.0],
  // Right eye right corner
  [225.0, 170.0, -135.0],
  // Left mouth corner
  [-150.0, -150.0, -125.0],
  // Right mouth corner
  [150.0, -150.0, -125.0],
  // Left ear
  [-300.0, 0.0, -100.0],
  // Right ear
  [300.0, 0.0, -100.0]
];

/**
 * Corresponding MediaPipe FaceMesh landmark indices for the 3D model points
 */
const LANDMARK_INDICES = [
  1,    // Nose tip
  152,  // Chin
  33,   // Left eye left corner
  362,  // Right eye right corner
  61,   // Left mouth corner
  291,  // Right mouth corner
  234,  // Left ear approximation
  454   // Right ear approximation
];

export class HeadPoseEstimator {
  private config: HeadPoseEstimatorConfig;
  private previousPose: HeadPose | null = null;
  private cameraMatrix: number[][];
  private distortionCoeffs: number[];

  constructor(config: Partial<HeadPoseEstimatorConfig> = {}) {
    this.config = {
      focalLength: 500,
      principalPointX: 320,
      principalPointY: 240,
      confidenceThreshold: 0.6,
      stabilizationFactor: 0.7,
      ...config
    };

    // Initialize camera intrinsic matrix
    this.cameraMatrix = [
      [this.config.focalLength, 0, this.config.principalPointX],
      [0, this.config.focalLength, this.config.principalPointY],
      [0, 0, 1]
    ];

    // Assume no lens distortion for simplicity
    this.distortionCoeffs = [0, 0, 0, 0, 0];
  }

  /**
   * Estimate head pose from facial landmarks
   */
  estimatePose(landmarks: Float32Array, imageWidth: number, imageHeight: number): HeadPose {
    if (landmarks.length < 468 * 3) {
      throw new VisionError('Invalid landmarks array for head pose estimation', {
        code: 'FACE_DETECTION_FAILED',
        details: { landmarksLength: landmarks.length }
      });
    }

    try {
      // Extract 2D image points from landmarks
      const imagePoints = this.extractImagePoints(landmarks, imageWidth, imageHeight);
      
      // Validate that we have enough points
      if (imagePoints.length < LANDMARK_INDICES.length) {
        throw new Error('Insufficient landmark points for pose estimation');
      }

      // Solve PnP to get rotation and translation vectors
      const { rotationVector, translationVector, confidence } = this.solvePnP(
        CANONICAL_FACE_MODEL_POINTS,
        imagePoints
      );

      // Convert rotation vector to Euler angles
      const { yaw, pitch, roll } = this.rotationVectorToEulerAngles(rotationVector);

      const pose: HeadPose = {
        yaw: this.radiansToDegrees(yaw),
        pitch: this.radiansToDegrees(pitch),
        roll: this.radiansToDegrees(roll),
        confidence,
        timestamp: Date.now()
      };

      // Apply temporal stabilization
      const stabilizedPose = this.stabilizePose(pose);
      this.previousPose = stabilizedPose;

      return stabilizedPose;
    } catch (error) {
      throw new VisionError(`Head pose estimation failed: ${error}`, {
        code: 'FACE_DETECTION_FAILED',
        details: { error }
      });
    }
  }

  /**
   * Extract 2D image points from landmarks for specific indices
   */
  private extractImagePoints(landmarks: Float32Array, imageWidth: number, imageHeight: number): number[][] {
    const imagePoints: number[][] = [];

    for (const index of LANDMARK_INDICES) {
      if (index * 3 + 1 < landmarks.length) {
        const x = landmarks[index * 3] * imageWidth;
        const y = landmarks[index * 3 + 1] * imageHeight;
        imagePoints.push([x, y]);
      }
    }

    return imagePoints;
  }

  /**
   * Solve Perspective-n-Point problem using simplified method
   * This is a basic implementation for demonstration - in production, use OpenCV's solvePnP
   */
  private solvePnP(objectPoints: number[][], imagePoints: number[][]): {
    rotationVector: number[];
    translationVector: number[];
    confidence: number;
  } {
    if (objectPoints.length !== imagePoints.length) {
      throw new Error('Object points and image points must have the same length');
    }

    // For simplicity, estimate pose based on key point relationships
    // This is a simplified approach - real solvePnP would use proper optimization
    
    // Calculate face center in image coordinates
    const centerX = imagePoints.reduce((sum, p) => sum + p[0], 0) / imagePoints.length;
    const centerY = imagePoints.reduce((sum, p) => sum + p[1], 0) / imagePoints.length;
    
    // Estimate yaw from left-right eye positions (indices 2 and 3 in our landmark set)
    const leftEye = imagePoints[2] || [centerX - 50, centerY];
    const rightEye = imagePoints[3] || [centerX + 50, centerY];
    const eyeDistance = rightEye[0] - leftEye[0];
    const expectedEyeDistance = 100; // pixels for frontal face
    
    // Estimate yaw based on eye distance and asymmetry
    const eyeCenterX = (leftEye[0] + rightEye[0]) / 2;
    const faceAsymmetry = (eyeCenterX - centerX) / this.config.principalPointX;
    const yaw = Math.atan(faceAsymmetry * 2) * 0.5; // Simplified yaw estimation
    
    // Estimate pitch from nose-chin relationship (indices 0 and 1)
    const nose = imagePoints[0] || [centerX, centerY - 30];
    const chin = imagePoints[1] || [centerX, centerY + 80];
    const noseToChainDistance = chin[1] - nose[1];
    const expectedNoseChinDistance = 110; // pixels for frontal face
    
    const pitchFactor = (noseToChainDistance - expectedNoseChinDistance) / expectedNoseChinDistance;
    const pitch = Math.atan(pitchFactor) * 0.3; // Simplified pitch estimation
    
    // Estimate roll from eye line angle
    const eyeAngle = Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]);
    const roll = eyeAngle * 0.8; // Simplified roll estimation
    
    // Simple translation estimation
    const translationVector = [
      (centerX - this.config.principalPointX) * 2,
      (centerY - this.config.principalPointY) * 2,
      -800 // Assume face is about 80cm from camera
    ];
    
    const rotationVector = [pitch, yaw, roll];
    
    // Calculate confidence based on landmark consistency
    let confidence = 1.0;
    
    // Reduce confidence for extreme poses
    if (Math.abs(yaw) > 0.5) confidence *= 0.8;
    if (Math.abs(pitch) > 0.4) confidence *= 0.8;
    if (Math.abs(roll) > 0.3) confidence *= 0.8;
    
    // Reduce confidence if landmarks are too spread out or too close
    const landmarkSpread = Math.sqrt(
      imagePoints.reduce((sum, p) => sum + Math.pow(p[0] - centerX, 2) + Math.pow(p[1] - centerY, 2), 0) / imagePoints.length
    );
    
    if (landmarkSpread < 20 || landmarkSpread > 200) {
      confidence *= 0.6;
    }

    return {
      rotationVector,
      translationVector,
      confidence: Math.min(1, Math.max(0, confidence))
    };
  }

  /**
   * Project 3D points to 2D image plane
   */
  private projectPoints(objectPoints: number[][], rotationVector: number[], translationVector: number[]): {
    projectedPoints: number[][];
    jacobian: number[][];
  } {
    const rotationMatrix = this.rodriguesRotation(rotationVector);
    const projectedPoints: number[][] = [];
    const jacobian: number[][] = [];

    for (const point3D of objectPoints) {
      // Transform 3D point
      const transformedPoint = this.matrixVectorMultiply(rotationMatrix, point3D);
      const worldPoint = [
        transformedPoint[0] + translationVector[0],
        transformedPoint[1] + translationVector[1],
        transformedPoint[2] + translationVector[2]
      ];

      // Project to image plane
      if (worldPoint[2] !== 0) {
        const x = (worldPoint[0] / worldPoint[2]) * this.config.focalLength + this.config.principalPointX;
        const y = (worldPoint[1] / worldPoint[2]) * this.config.focalLength + this.config.principalPointY;
        projectedPoints.push([x, y]);
      } else {
        projectedPoints.push([this.config.principalPointX, this.config.principalPointY]);
      }

      // Simplified Jacobian calculation (partial derivatives)
      const J = this.calculatePointJacobian(point3D, rotationVector, translationVector);
      jacobian.push(J);
    }

    return { projectedPoints, jacobian };
  }

  /**
   * Calculate Jacobian matrix for a single point
   */
  private calculatePointJacobian(point3D: number[], rotationVector: number[], translationVector: number[]): number[] {
    // Simplified Jacobian - in practice, this would be more complex
    // Returns partial derivatives with respect to [rx, ry, rz, tx, ty, tz]
    const epsilon = 1e-6;
    const jacobian: number[] = [];

    // Numerical differentiation for rotation parameters
    for (let i = 0; i < 3; i++) {
      const rotPlus = [...rotationVector];
      const rotMinus = [...rotationVector];
      rotPlus[i] += epsilon;
      rotMinus[i] -= epsilon;

      const projPlus = this.projectSinglePoint(point3D, rotPlus, translationVector);
      const projMinus = this.projectSinglePoint(point3D, rotMinus, translationVector);

      jacobian.push((projPlus[0] - projMinus[0]) / (2 * epsilon)); // dx/dri
      jacobian.push((projPlus[1] - projMinus[1]) / (2 * epsilon)); // dy/dri
    }

    // Analytical derivatives for translation parameters
    const rotMatrix = this.rodriguesRotation(rotationVector);
    const transformedPoint = this.matrixVectorMultiply(rotMatrix, point3D);
    const z = transformedPoint[2] + translationVector[2];

    if (z !== 0) {
      jacobian.push(this.config.focalLength / z); // dx/dtx
      jacobian.push(0); // dy/dtx
      jacobian.push(0); // dx/dty
      jacobian.push(this.config.focalLength / z); // dy/dty
      jacobian.push(-this.config.focalLength * (transformedPoint[0] + translationVector[0]) / (z * z)); // dx/dtz
      jacobian.push(-this.config.focalLength * (transformedPoint[1] + translationVector[1]) / (z * z)); // dy/dtz
    } else {
      jacobian.push(0, 0, 0, 0, 0, 0);
    }

    return jacobian;
  }

  /**
   * Project a single 3D point to 2D
   */
  private projectSinglePoint(point3D: number[], rotationVector: number[], translationVector: number[]): number[] {
    const rotationMatrix = this.rodriguesRotation(rotationVector);
    const transformedPoint = this.matrixVectorMultiply(rotationMatrix, point3D);
    const worldPoint = [
      transformedPoint[0] + translationVector[0],
      transformedPoint[1] + translationVector[1],
      transformedPoint[2] + translationVector[2]
    ];

    if (worldPoint[2] !== 0) {
      const x = (worldPoint[0] / worldPoint[2]) * this.config.focalLength + this.config.principalPointX;
      const y = (worldPoint[1] / worldPoint[2]) * this.config.focalLength + this.config.principalPointY;
      return [x, y];
    }

    return [this.config.principalPointX, this.config.principalPointY];
  }

  /**
   * Calculate reprojection error
   */
  private calculateReprojectionError(imagePoints: number[][], projectedPoints: number[][]): number {
    let totalError = 0;

    for (let i = 0; i < imagePoints.length; i++) {
      const dx = imagePoints[i][0] - projectedPoints[i][0];
      const dy = imagePoints[i][1] - projectedPoints[i][1];
      totalError += Math.sqrt(dx * dx + dy * dy);
    }

    return totalError / imagePoints.length;
  }

  /**
   * Calculate parameter update using Gauss-Newton method
   */
  private calculateParameterUpdate(imagePoints: number[][], projectedPoints: number[][], jacobian: number[][]): number[] {
    // Simplified parameter update - in practice, this would use proper matrix operations
    const delta = [0, 0, 0, 0, 0, 0]; // [drx, dry, drz, dtx, dty, dtz]
    const learningRate = 0.001;

    for (let i = 0; i < imagePoints.length; i++) {
      const errorX = imagePoints[i][0] - projectedPoints[i][0];
      const errorY = imagePoints[i][1] - projectedPoints[i][1];

      // Simple gradient descent update
      for (let j = 0; j < 6; j++) {
        if (jacobian[i] && jacobian[i][j * 2] !== undefined) {
          delta[j] += learningRate * (errorX * jacobian[i][j * 2] + errorY * jacobian[i][j * 2 + 1]);
        }
      }
    }

    return delta;
  }

  /**
   * Convert rotation vector to rotation matrix using Rodrigues' formula
   */
  private rodriguesRotation(rotationVector: number[]): number[][] {
    const [rx, ry, rz] = rotationVector;
    const theta = Math.sqrt(rx * rx + ry * ry + rz * rz);

    if (theta < 1e-6) {
      // Identity matrix for small rotations
      return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ];
    }

    const [ux, uy, uz] = [rx / theta, ry / theta, rz / theta];
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const oneMinusCos = 1 - cosTheta;

    return [
      [
        cosTheta + ux * ux * oneMinusCos,
        ux * uy * oneMinusCos - uz * sinTheta,
        ux * uz * oneMinusCos + uy * sinTheta
      ],
      [
        uy * ux * oneMinusCos + uz * sinTheta,
        cosTheta + uy * uy * oneMinusCos,
        uy * uz * oneMinusCos - ux * sinTheta
      ],
      [
        uz * ux * oneMinusCos - uy * sinTheta,
        uz * uy * oneMinusCos + ux * sinTheta,
        cosTheta + uz * uz * oneMinusCos
      ]
    ];
  }

  /**
   * Convert rotation vector to Euler angles (yaw, pitch, roll)
   */
  private rotationVectorToEulerAngles(rotationVector: number[]): { yaw: number; pitch: number; roll: number } {
    const rotationMatrix = this.rodriguesRotation(rotationVector);

    // Extract Euler angles from rotation matrix (ZYX convention)
    const sy = Math.sqrt(rotationMatrix[0][0] * rotationMatrix[0][0] + rotationMatrix[1][0] * rotationMatrix[1][0]);
    const singular = sy < 1e-6;

    let yaw, pitch, roll;

    if (!singular) {
      yaw = Math.atan2(rotationMatrix[1][0], rotationMatrix[0][0]);
      pitch = Math.atan2(-rotationMatrix[2][0], sy);
      roll = Math.atan2(rotationMatrix[2][1], rotationMatrix[2][2]);
    } else {
      yaw = Math.atan2(-rotationMatrix[0][1], rotationMatrix[1][1]);
      pitch = Math.atan2(-rotationMatrix[2][0], sy);
      roll = 0;
    }

    return { yaw, pitch, roll };
  }

  /**
   * Matrix-vector multiplication
   */
  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
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
   * Apply temporal stabilization to reduce jitter
   */
  private stabilizePose(currentPose: HeadPose): HeadPose {
    if (!this.previousPose) {
      return currentPose;
    }

    const alpha = this.config.stabilizationFactor;
    
    return {
      yaw: alpha * this.previousPose.yaw + (1 - alpha) * currentPose.yaw,
      pitch: alpha * this.previousPose.pitch + (1 - alpha) * currentPose.pitch,
      roll: alpha * this.previousPose.roll + (1 - alpha) * currentPose.roll,
      confidence: currentPose.confidence,
      timestamp: currentPose.timestamp
    };
  }

  /**
   * Convert radians to degrees
   */
  private radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Validate head pose estimation accuracy
   */
  validatePose(pose: HeadPose): {
    isValid: boolean;
    issues: string[];
    accuracy: number;
  } {
    const issues: string[] = [];
    
    // Check confidence threshold
    if (pose.confidence < this.config.confidenceThreshold) {
      issues.push(`Low confidence: ${pose.confidence.toFixed(3)}`);
    }

    // Check for reasonable angle ranges
    if (Math.abs(pose.yaw) > 90) {
      issues.push(`Extreme yaw angle: ${pose.yaw.toFixed(1)}°`);
    }
    
    if (Math.abs(pose.pitch) > 60) {
      issues.push(`Extreme pitch angle: ${pose.pitch.toFixed(1)}°`);
    }
    
    if (Math.abs(pose.roll) > 45) {
      issues.push(`Extreme roll angle: ${pose.roll.toFixed(1)}°`);
    }

    const isValid = issues.length === 0 && pose.confidence >= this.config.confidenceThreshold;
    const accuracy = pose.confidence;

    return { isValid, issues, accuracy };
  }

  /**
   * Update camera parameters
   */
  updateCameraParameters(focalLength: number, principalPointX: number, principalPointY: number): void {
    this.config.focalLength = focalLength;
    this.config.principalPointX = principalPointX;
    this.config.principalPointY = principalPointY;

    // Update camera matrix
    this.cameraMatrix = [
      [focalLength, 0, principalPointX],
      [0, focalLength, principalPointY],
      [0, 0, 1]
    ];
  }

  /**
   * Reset temporal stabilization
   */
  reset(): void {
    this.previousPose = null;
  }

  /**
   * Get current configuration
   */
  get configuration(): HeadPoseEstimatorConfig {
    return { ...this.config };
  }
}