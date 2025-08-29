/**
 * Comprehensive Facial Analysis System
 * Implements micro-expression detection, lip movement analysis, facial orientation monitoring,
 * pupil dilation analysis, and 3D facial modeling for identity verification
 */

import { FaceLandmarks } from './AdvancedFaceDetector';

export interface MicroExpression {
  type: 'surprise' | 'fear' | 'disgust' | 'anger' | 'happiness' | 'sadness' | 'contempt' | 'neutral';
  confidence: number;
  intensity: number;
  duration: number;
  timestamp: number;
}

export interface LipMovementAnalysis {
  isMoving: boolean;
  movementIntensity: number;
  speechLikelihood: number;
  whisperDetected: boolean;
  lipSyncScore: number;
  timestamp: number;
}

export interface FacialOrientation {
  yaw: number;    // Left-right rotation (-90 to +90 degrees)
  pitch: number;  // Up-down rotation (-90 to +90 degrees)
  roll: number;   // Tilt rotation (-180 to +180 degrees)
  confidence: number;
  attentionScore: number; // 0-1 score indicating attention to screen
  timestamp: number;
}

export interface PupilAnalysis {
  leftPupilDiameter: number;
  rightPupilDiameter: number;
  pupilDilation: number; // Relative to baseline
  stressIndicator: number; // 0-1 stress level
  cognitiveLoad: number; // 0-1 cognitive load indicator
  timestamp: number;
}

export interface FacialModel3D {
  vertices: Float32Array; // 3D vertex positions
  normals: Float32Array;  // Surface normals
  textureCoords: Float32Array; // UV coordinates
  faceDescriptor: Float32Array; // Unique face encoding
  confidence: number;
  timestamp: number;
}

export interface FacialAnalysisResult {
  microExpression: MicroExpression | null;
  lipMovement: LipMovementAnalysis;
  orientation: FacialOrientation;
  pupilAnalysis: PupilAnalysis | null;
  facialModel: FacialModel3D | null;
  deceptionIndicators: {
    microExpressionInconsistency: number;
    eyeMovementPatterns: number;
    facialTension: number;
    overallDeceptionScore: number;
  };
  timestamp: number;
}

export class FacialAnalysisEngine {
  private previousLandmarks: FaceLandmarks[] | null = null;
  private baselinePupilSize: number | null = null;
  private expressionHistory: MicroExpression[] = [];
  private lipMovementHistory: LipMovementAnalysis[] = [];
  private orientationHistory: FacialOrientation[] = [];
  
  // Facial landmark indices for different features
  private readonly landmarkIndices = {
    // Eye regions
    leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
    
    // Lip regions
    outerLips: [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318],
    innerLips: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415],
    
    // Eyebrow regions
    leftEyebrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
    rightEyebrow: [296, 334, 293, 300, 276, 283, 282, 295, 285, 336],
    
    // Nose region
    nose: [19, 20, 94, 125, 141, 235, 236, 3, 51, 48, 115, 131, 134, 102, 49, 220, 305, 290, 328, 326],
    
    // Face contour
    faceContour: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
  };

  constructor() {
    // Initialize with default values
  }

  analyzeFace(landmarks: FaceLandmarks[]): FacialAnalysisResult {
    const timestamp = Date.now();
    
    // Perform comprehensive facial analysis
    const microExpression = this.detectMicroExpression(landmarks);
    const lipMovement = this.analyzeLipMovement(landmarks);
    const orientation = this.calculateFacialOrientation(landmarks);
    const pupilAnalysis = this.analyzePupils(landmarks);
    const facialModel = this.generate3DFacialModel(landmarks);
    const deceptionIndicators = this.calculateDeceptionIndicators(landmarks, microExpression, orientation);

    // Update history
    if (microExpression) {
      this.expressionHistory.push(microExpression);
      if (this.expressionHistory.length > 50) {
        this.expressionHistory.shift();
      }
    }

    this.lipMovementHistory.push(lipMovement);
    if (this.lipMovementHistory.length > 30) {
      this.lipMovementHistory.shift();
    }

    this.orientationHistory.push(orientation);
    if (this.orientationHistory.length > 30) {
      this.orientationHistory.shift();
    }

    this.previousLandmarks = landmarks;

    return {
      microExpression,
      lipMovement,
      orientation,
      pupilAnalysis,
      facialModel,
      deceptionIndicators,
      timestamp
    };
  }

  private detectMicroExpression(landmarks: FaceLandmarks[]): MicroExpression | null {
    if (!landmarks || landmarks.length === 0) return null;

    // Analyze facial muscle movements for micro-expressions
    const eyebrowMovement = this.calculateEyebrowMovement(landmarks);
    const eyeMovement = this.calculateEyeMovement(landmarks);
    const mouthMovement = this.calculateMouthMovement(landmarks);
    const cheekMovement = this.calculateCheekMovement(landmarks);

    // Debug: Check if we have any movement at all
    const hasMovement = eyebrowMovement > 0 || eyeMovement > 0 || mouthMovement > 0 || cheekMovement > 0;
    
    // If no previous landmarks, use static analysis
    if (!this.previousLandmarks) {
      return this.detectStaticExpression(landmarks);
    }

    // Classify expression based on facial action units
    const expressionScores = {
      surprise: this.calculateSurpriseScore(eyebrowMovement, eyeMovement, mouthMovement),
      fear: this.calculateFearScore(eyebrowMovement, eyeMovement, mouthMovement),
      disgust: this.calculateDisgustScore(mouthMovement, cheekMovement),
      anger: this.calculateAngerScore(eyebrowMovement, eyeMovement, mouthMovement),
      happiness: this.calculateHappinessScore(eyeMovement, mouthMovement, cheekMovement),
      sadness: this.calculateSadnessScore(eyebrowMovement, eyeMovement, mouthMovement),
      contempt: this.calculateContemptScore(mouthMovement),
      neutral: 0.3 // Lower baseline neutral score
    };

    // Find dominant expression
    const dominantExpression = Object.entries(expressionScores).reduce((a, b) => 
      expressionScores[a[0] as keyof typeof expressionScores] > expressionScores[b[0] as keyof typeof expressionScores] ? a : b
    );

    const confidence = dominantExpression[1] as number;
    
    // Lower confidence threshold for better detection
    if (confidence < 0.4) return null;

    return {
      type: dominantExpression[0] as MicroExpression['type'],
      confidence,
      intensity: Math.min(confidence * 1.5, 1.0),
      duration: this.calculateExpressionDuration(dominantExpression[0] as MicroExpression['type']),
      timestamp: Date.now()
    };
  }

  private detectStaticExpression(landmarks: FaceLandmarks[]): MicroExpression | null {
    // Detect expressions from static facial features
    const mouthCurvature = this.calculateMouthCurvature(landmarks);
    const eyeOpenness = this.calculateEyeOpenness(landmarks);
    const eyebrowHeight = this.calculateEyebrowHeight(landmarks);
    
    // Check for surprise first (eyebrows raised + wide eyes) - more sensitive
    if (eyebrowHeight > 0.025 && eyeOpenness > 0.03) {
      return {
        type: 'surprise',
        confidence: Math.min((eyebrowHeight + eyeOpenness) * 10, 0.9),
        intensity: Math.min((eyebrowHeight + eyeOpenness) * 12, 1.0),
        duration: 0,
        timestamp: Date.now()
      };
    }
    
    // Check for happiness (mouth curvature) - but not if eyebrows are raised
    if (mouthCurvature > 0.025 && eyebrowHeight < 0.02) {
      return {
        type: 'happiness',
        confidence: Math.min(mouthCurvature * 25, 0.9),
        intensity: Math.min(mouthCurvature * 35, 1.0),
        duration: 0,
        timestamp: Date.now()
      };
    }
    
    return null;
  }

  private analyzeLipMovement(landmarks: FaceLandmarks[]): LipMovementAnalysis {
    if (!landmarks || landmarks.length === 0) {
      return {
        isMoving: false,
        movementIntensity: 0,
        speechLikelihood: 0,
        whisperDetected: false,
        lipSyncScore: 0,
        timestamp: Date.now()
      };
    }

    const lipLandmarks = this.landmarkIndices.outerLips.map(i => landmarks[i]).filter(Boolean);
    
    if (!this.previousLandmarks) {
      this.previousLandmarks = landmarks;
      return {
        isMoving: false,
        movementIntensity: 0,
        speechLikelihood: 0,
        whisperDetected: false,
        lipSyncScore: 0,
        timestamp: Date.now()
      };
    }

    const previousLipLandmarks = this.landmarkIndices.outerLips.map(i => this.previousLandmarks![i]).filter(Boolean);

    // Calculate lip movement intensity
    let totalMovement = 0;
    for (let i = 0; i < Math.min(lipLandmarks.length, previousLipLandmarks.length); i++) {
      const movement = Math.sqrt(
        Math.pow(lipLandmarks[i].x - previousLipLandmarks[i].x, 2) +
        Math.pow(lipLandmarks[i].y - previousLipLandmarks[i].y, 2)
      );
      totalMovement += movement;
    }

    const movementIntensity = Math.min(totalMovement * 100, 1.0);
    const isMoving = movementIntensity > 0.1;

    // Analyze lip shape for speech patterns
    const lipHeight = this.calculateLipHeight(landmarks);
    const lipWidth = this.calculateLipWidth(landmarks);
    const lipAspectRatio = lipHeight / lipWidth;

    // Speech likelihood based on lip movements and shape
    const speechLikelihood = this.calculateSpeechLikelihood(movementIntensity, lipAspectRatio);
    
    // Whisper detection (subtle lip movements) - more sensitive detection
    const whisperDetected = movementIntensity > 0.008 && movementIntensity < 0.15 && speechLikelihood > 0.1;

    // Lip sync score (consistency of lip movements)
    const lipSyncScore = this.calculateLipSyncScore();

    return {
      isMoving,
      movementIntensity,
      speechLikelihood,
      whisperDetected,
      lipSyncScore,
      timestamp: Date.now()
    };
  }

  private calculateFacialOrientation(landmarks: FaceLandmarks[]): FacialOrientation {
    if (!landmarks || landmarks.length === 0) {
      return {
        yaw: 0,
        pitch: 0,
        roll: 0,
        confidence: 0,
        attentionScore: 0,
        timestamp: Date.now()
      };
    }

    // Use key facial landmarks for pose estimation
    const noseTip = landmarks[19];
    const leftEye = landmarks[33];
    const rightEye = landmarks[362];
    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];

    if (!noseTip || !leftEye || !rightEye || !leftMouth || !rightMouth) {
      return {
        yaw: 0,
        pitch: 0,
        roll: 0,
        confidence: 0,
        attentionScore: 0,
        timestamp: Date.now()
      };
    }

    // Calculate yaw (left-right rotation) - improved calculation
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2
    };
    const noseToEyeCenter = noseTip.x - eyeCenter.x;
    // More conservative yaw calculation
    const yaw = Math.atan2(noseToEyeCenter, 0.05) * (180 / Math.PI) * 0.5;

    // Calculate pitch (up-down rotation) - improved calculation
    const mouthCenter = {
      x: (leftMouth.x + rightMouth.x) / 2,
      y: (leftMouth.y + rightMouth.y) / 2
    };
    const eyeToMouthDistance = mouthCenter.y - eyeCenter.y;
    // More conservative pitch calculation
    const pitch = Math.atan2(eyeToMouthDistance - 0.2, 0.05) * (180 / Math.PI) * 0.3;

    // Calculate roll (tilt rotation) - improved calculation
    const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const roll = eyeAngle * (180 / Math.PI) * 0.5;

    // Calculate confidence based on landmark quality
    const confidence = this.calculateOrientationConfidence(landmarks);

    // Calculate attention score (how much the person is looking at the screen)
    const attentionScore = this.calculateAttentionScore(yaw, pitch, roll);

    return {
      yaw: Math.max(-90, Math.min(90, yaw)),
      pitch: Math.max(-90, Math.min(90, pitch)),
      roll: Math.max(-180, Math.min(180, roll)),
      confidence,
      attentionScore,
      timestamp: Date.now()
    };
  }

  private analyzePupils(landmarks: FaceLandmarks[]): PupilAnalysis | null {
    if (!landmarks || landmarks.length === 0) return null;

    // Estimate pupil positions and sizes from eye landmarks
    const leftEyeLandmarks = this.landmarkIndices.leftEye.map(i => landmarks[i]).filter(Boolean);
    const rightEyeLandmarks = this.landmarkIndices.rightEye.map(i => landmarks[i]).filter(Boolean);

    if (leftEyeLandmarks.length === 0 || rightEyeLandmarks.length === 0) return null;

    // Calculate eye dimensions for pupil size estimation
    const leftPupilDiameter = this.estimatePupilSize(leftEyeLandmarks);
    const rightPupilDiameter = this.estimatePupilSize(rightEyeLandmarks);

    // Initialize baseline if not set
    if (!this.baselinePupilSize) {
      this.baselinePupilSize = (leftPupilDiameter + rightPupilDiameter) / 2;
    }

    // Calculate pupil dilation relative to baseline
    const currentPupilSize = (leftPupilDiameter + rightPupilDiameter) / 2;
    const pupilDilation = (currentPupilSize - this.baselinePupilSize) / this.baselinePupilSize;

    // Calculate stress indicators based on pupil dilation
    const stressIndicator = Math.min(Math.abs(pupilDilation) * 2, 1.0);
    
    // Calculate cognitive load (sustained pupil dilation indicates mental effort)
    const cognitiveLoad = Math.min(Math.max(pupilDilation, 0) * 1.5, 1.0);

    return {
      leftPupilDiameter,
      rightPupilDiameter,
      pupilDilation,
      stressIndicator,
      cognitiveLoad,
      timestamp: Date.now()
    };
  }

  private generate3DFacialModel(landmarks: FaceLandmarks[]): FacialModel3D | null {
    if (!landmarks || landmarks.length < 100) return null;

    // Generate 3D model from 2D landmarks using depth estimation
    const vertices = new Float32Array(landmarks.length * 3);
    const normals = new Float32Array(landmarks.length * 3);
    const textureCoords = new Float32Array(landmarks.length * 2);

    // Convert 2D landmarks to 3D vertices
    for (let i = 0; i < landmarks.length; i++) {
      const landmark = landmarks[i];
      
      // 3D vertex position (x, y, estimated z)
      vertices[i * 3] = landmark.x;
      vertices[i * 3 + 1] = landmark.y;
      vertices[i * 3 + 2] = landmark.z || this.estimateDepth(landmark, i);

      // Surface normal (simplified)
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 0;
      normals[i * 3 + 2] = 1;

      // Texture coordinates
      textureCoords[i * 2] = landmark.x;
      textureCoords[i * 2 + 1] = landmark.y;
    }

    // Generate unique face descriptor for identity verification
    const faceDescriptor = this.generateFaceDescriptor(landmarks);
    
    // Calculate model confidence
    const confidence = this.calculate3DModelConfidence(landmarks);

    return {
      vertices,
      normals,
      textureCoords,
      faceDescriptor,
      confidence,
      timestamp: Date.now()
    };
  }

  private calculateDeceptionIndicators(
    landmarks: FaceLandmarks[],
    microExpression: MicroExpression | null,
    orientation: FacialOrientation
  ): FacialAnalysisResult['deceptionIndicators'] {
    
    // Micro-expression inconsistency (rapid changes in expression)
    const microExpressionInconsistency = this.calculateMicroExpressionInconsistency();
    
    // Eye movement patterns (avoiding eye contact, rapid movements)
    const eyeMovementPatterns = this.calculateSuspiciousEyeMovements(landmarks, orientation);
    
    // Facial tension (muscle tension indicators)
    const facialTension = this.calculateFacialTension(landmarks);
    
    // Overall deception score
    const overallDeceptionScore = (
      microExpressionInconsistency * 0.4 +
      eyeMovementPatterns * 0.3 +
      facialTension * 0.3
    );

    return {
      microExpressionInconsistency,
      eyeMovementPatterns,
      facialTension,
      overallDeceptionScore
    };
  }

  // Helper methods for calculations

  private calculateEyebrowMovement(landmarks: FaceLandmarks[]): number {
    const leftEyebrow = this.landmarkIndices.leftEyebrow.map(i => landmarks[i]).filter(Boolean);
    const rightEyebrow = this.landmarkIndices.rightEyebrow.map(i => landmarks[i]).filter(Boolean);
    
    if (!this.previousLandmarks || leftEyebrow.length === 0 || rightEyebrow.length === 0) return 0;
    
    const prevLeftEyebrow = this.landmarkIndices.leftEyebrow.map(i => this.previousLandmarks![i]).filter(Boolean);
    const prevRightEyebrow = this.landmarkIndices.rightEyebrow.map(i => this.previousLandmarks![i]).filter(Boolean);
    
    let totalMovement = 0;
    for (let i = 0; i < Math.min(leftEyebrow.length, prevLeftEyebrow.length); i++) {
      totalMovement += Math.abs(leftEyebrow[i].y - prevLeftEyebrow[i].y);
    }
    for (let i = 0; i < Math.min(rightEyebrow.length, prevRightEyebrow.length); i++) {
      totalMovement += Math.abs(rightEyebrow[i].y - prevRightEyebrow[i].y);
    }
    
    return Math.min(totalMovement * 50, 1.0);
  }

  private calculateEyeMovement(landmarks: FaceLandmarks[]): number {
    const leftEye = this.landmarkIndices.leftEye.map(i => landmarks[i]).filter(Boolean);
    const rightEye = this.landmarkIndices.rightEye.map(i => landmarks[i]).filter(Boolean);
    
    if (leftEye.length === 0 || rightEye.length === 0) return 0;
    
    // Calculate eye openness
    const leftEyeHeight = this.calculateEyeHeight(leftEye);
    const rightEyeHeight = this.calculateEyeHeight(rightEye);
    
    return (leftEyeHeight + rightEyeHeight) / 2;
  }

  private calculateMouthMovement(landmarks: FaceLandmarks[]): number {
    const mouthLandmarks = this.landmarkIndices.outerLips.map(i => landmarks[i]).filter(Boolean);
    
    if (!this.previousLandmarks || mouthLandmarks.length === 0) return 0;
    
    const prevMouthLandmarks = this.landmarkIndices.outerLips.map(i => this.previousLandmarks![i]).filter(Boolean);
    
    let totalMovement = 0;
    for (let i = 0; i < Math.min(mouthLandmarks.length, prevMouthLandmarks.length); i++) {
      const movement = Math.sqrt(
        Math.pow(mouthLandmarks[i].x - prevMouthLandmarks[i].x, 2) +
        Math.pow(mouthLandmarks[i].y - prevMouthLandmarks[i].y, 2)
      );
      totalMovement += movement;
    }
    
    return Math.min(totalMovement * 20, 1.0);
  }

  private calculateCheekMovement(landmarks: FaceLandmarks[]): number {
    // Simplified cheek movement calculation
    const leftCheek = landmarks[116];
    const rightCheek = landmarks[345];
    
    if (!leftCheek || !rightCheek || !this.previousLandmarks) return 0;
    
    const prevLeftCheek = this.previousLandmarks[116];
    const prevRightCheek = this.previousLandmarks[345];
    
    if (!prevLeftCheek || !prevRightCheek) return 0;
    
    const leftMovement = Math.sqrt(
      Math.pow(leftCheek.x - prevLeftCheek.x, 2) +
      Math.pow(leftCheek.y - prevLeftCheek.y, 2)
    );
    
    const rightMovement = Math.sqrt(
      Math.pow(rightCheek.x - prevRightCheek.x, 2) +
      Math.pow(rightCheek.y - prevRightCheek.y, 2)
    );
    
    return Math.min((leftMovement + rightMovement) * 25, 1.0);
  }

  // Expression scoring methods
  private calculateSurpriseScore(eyebrow: number, eye: number, mouth: number): number {
    // Enhanced surprise detection - high eyebrow movement + wide eyes + open mouth
    const surpriseScore = (eyebrow * 0.5 + eye * 0.3 + mouth * 0.2);
    return Math.min(surpriseScore * 1.2, 1.0); // Boost surprise detection
  }

  private calculateFearScore(eyebrow: number, eye: number, mouth: number): number {
    return (eyebrow * 0.4 + eye * 0.4 + mouth * 0.2) * 0.8;
  }

  private calculateDisgustScore(mouth: number, cheek: number): number {
    return (mouth * 0.6 + cheek * 0.4) * 0.7;
  }

  private calculateAngerScore(eyebrow: number, eye: number, mouth: number): number {
    return (eyebrow * 0.4 + eye * 0.3 + mouth * 0.3) * 0.8;
  }

  private calculateHappinessScore(eye: number, mouth: number, cheek: number): number {
    // Enhanced happiness detection - squinted eyes + upturned mouth + raised cheeks
    const happinessScore = (eye * 0.3 + mouth * 0.5 + cheek * 0.2);
    return Math.min(happinessScore * 1.3, 1.0); // Boost happiness detection
  }

  private calculateSadnessScore(eyebrow: number, eye: number, mouth: number): number {
    return (eyebrow * 0.3 + eye * 0.4 + mouth * 0.3) * 0.7;
  }

  private calculateContemptScore(mouth: number): number {
    return mouth * 0.6;
  }

  private calculateExpressionDuration(expressionType: string): number {
    // Calculate duration based on expression history
    const recentExpressions = this.expressionHistory.slice(-10);
    const sameExpressions = recentExpressions.filter(exp => exp.type === expressionType);
    return sameExpressions.length * 100; // Approximate duration in ms
  }

  private calculateLipHeight(landmarks: FaceLandmarks[]): number {
    const topLip = landmarks[13];
    const bottomLip = landmarks[14];
    
    if (!topLip || !bottomLip) return 0;
    
    return Math.abs(topLip.y - bottomLip.y);
  }

  private calculateLipWidth(landmarks: FaceLandmarks[]): number {
    const leftCorner = landmarks[61];
    const rightCorner = landmarks[291];
    
    if (!leftCorner || !rightCorner) return 0;
    
    return Math.abs(rightCorner.x - leftCorner.x);
  }

  private calculateSpeechLikelihood(movementIntensity: number, lipAspectRatio: number): number {
    // Speech patterns typically show specific lip movement patterns
    const movementScore = Math.min(movementIntensity * 2, 1.0);
    const shapeScore = lipAspectRatio > 0.3 && lipAspectRatio < 0.8 ? 1.0 : 0.5;
    
    return (movementScore * 0.7 + shapeScore * 0.3);
  }

  private calculateLipSyncScore(): number {
    if (this.lipMovementHistory.length < 5) return 0.5;
    
    // Analyze consistency of lip movements
    const recentMovements = this.lipMovementHistory.slice(-5);
    const avgIntensity = recentMovements.reduce((sum, mov) => sum + mov.movementIntensity, 0) / recentMovements.length;
    const variance = recentMovements.reduce((sum, mov) => sum + Math.pow(mov.movementIntensity - avgIntensity, 2), 0) / recentMovements.length;
    
    return Math.max(0, 1 - variance * 5);
  }

  private calculateOrientationConfidence(landmarks: FaceLandmarks[]): number {
    // Calculate confidence based on landmark visibility and quality
    const keyLandmarks = [19, 33, 362, 61, 291]; // Nose, eyes, mouth corners
    let visibleLandmarks = 0;
    
    for (const index of keyLandmarks) {
      if (landmarks[index] && 
          landmarks[index].x >= 0 && landmarks[index].x <= 1 &&
          landmarks[index].y >= 0 && landmarks[index].y <= 1) {
        visibleLandmarks++;
      }
    }
    
    return visibleLandmarks / keyLandmarks.length;
  }

  private calculateAttentionScore(yaw: number, pitch: number, roll: number): number {
    // Calculate attention based on head orientation - more lenient thresholds
    const yawScore = Math.max(0, 1 - Math.abs(yaw) / 45); // Increased threshold
    const pitchScore = Math.max(0, 1 - Math.abs(pitch) / 30); // Increased threshold
    const rollScore = Math.max(0, 1 - Math.abs(roll) / 25); // Increased threshold
    
    const baseScore = (yawScore * 0.5 + pitchScore * 0.3 + rollScore * 0.2);
    
    // For neutral face (small angles), give high attention score
    if (Math.abs(yaw) < 8 && Math.abs(pitch) < 8 && Math.abs(roll) < 8) {
      return Math.max(baseScore, 0.85);
    }
    
    return baseScore;
  }

  private estimatePupilSize(eyeLandmarks: FaceLandmarks[]): number {
    if (eyeLandmarks.length < 4) return 0;
    
    // Estimate pupil size based on eye opening
    const eyeWidth = Math.abs(eyeLandmarks[0].x - eyeLandmarks[3].x);
    const eyeHeight = Math.abs(eyeLandmarks[1].y - eyeLandmarks[5].y);
    
    return Math.min(eyeWidth, eyeHeight) * 0.3; // Approximate pupil size
  }

  private calculateEyeHeight(eyeLandmarks: FaceLandmarks[]): number {
    if (eyeLandmarks.length < 6) return 0;
    
    // Calculate vertical eye opening
    const topEyelid = (eyeLandmarks[1].y + eyeLandmarks[2].y) / 2;
    const bottomEyelid = (eyeLandmarks[4].y + eyeLandmarks[5].y) / 2;
    
    return Math.abs(topEyelid - bottomEyelid);
  }

  private estimateDepth(landmark: FaceLandmarks, index: number): number {
    // Simplified depth estimation based on landmark position and index
    const centerX = 0.5;
    const centerY = 0.5;
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(landmark.x - centerX, 2) + Math.pow(landmark.y - centerY, 2)
    );
    
    // Landmarks closer to center are typically closer to camera
    return Math.max(0, 0.1 - distanceFromCenter * 0.2);
  }

  private generateFaceDescriptor(landmarks: FaceLandmarks[]): Float32Array {
    // Generate a unique face descriptor for identity verification
    const descriptor = new Float32Array(128); // Standard face descriptor size
    
    // Use key facial measurements as features
    const keyMeasurements = [
      this.calculateInterocularDistance(landmarks),
      this.calculateNoseWidth(landmarks),
      this.calculateMouthWidth(landmarks),
      this.calculateFaceWidth(landmarks),
      this.calculateFaceHeight(landmarks)
    ];
    
    // Fill descriptor with normalized measurements and derived features
    for (let i = 0; i < descriptor.length; i++) {
      const measurementIndex = i % keyMeasurements.length;
      const variation = Math.sin(i * 0.1) * 0.1; // Add some variation
      descriptor[i] = keyMeasurements[measurementIndex] + variation;
    }
    
    return descriptor;
  }

  private calculate3DModelConfidence(landmarks: FaceLandmarks[]): number {
    // Calculate confidence based on landmark completeness and quality
    let validLandmarks = 0;
    let totalDepthVariance = 0;
    
    for (const landmark of landmarks) {
      if (landmark.x >= 0 && landmark.x <= 1 && landmark.y >= 0 && landmark.y <= 1) {
        validLandmarks++;
        totalDepthVariance += Math.abs(landmark.z || 0);
      }
    }
    
    const completeness = validLandmarks / landmarks.length;
    const depthQuality = Math.min(1, 1 / (1 + totalDepthVariance / landmarks.length));
    
    return (completeness * 0.7 + depthQuality * 0.3);
  }

  private calculateMicroExpressionInconsistency(): number {
    if (this.expressionHistory.length < 3) return 0; // Reduced threshold
    
    const recentExpressions = this.expressionHistory.slice(-5);
    const uniqueExpressions = new Set(recentExpressions.map(exp => exp.type));
    
    // High inconsistency if many different expressions in short time
    // More sensitive calculation
    return Math.min(uniqueExpressions.size / 2, 1.0);
  }

  private calculateSuspiciousEyeMovements(landmarks: FaceLandmarks[], orientation: FacialOrientation): number {
    // Detect suspicious eye movement patterns
    const rapidMovements = Math.abs(orientation.yaw) > 15 || Math.abs(orientation.pitch) > 10;
    const avoidingEyeContact = orientation.attentionScore < 0.5;
    
    let suspiciousScore = 0;
    if (rapidMovements) suspiciousScore += 0.4;
    if (avoidingEyeContact) suspiciousScore += 0.6;
    
    return Math.min(suspiciousScore, 1.0);
  }

  private calculateFacialTension(landmarks: FaceLandmarks[]): number {
    if (!this.previousLandmarks) return 0;
    
    // Calculate overall facial muscle tension based on landmark stability
    let totalTension = 0;
    let validComparisons = 0;
    
    for (let i = 0; i < Math.min(landmarks.length, this.previousLandmarks.length); i++) {
      if (landmarks[i] && this.previousLandmarks[i]) {
        const movement = Math.sqrt(
          Math.pow(landmarks[i].x - this.previousLandmarks[i].x, 2) +
          Math.pow(landmarks[i].y - this.previousLandmarks[i].y, 2)
        );
        totalTension += movement;
        validComparisons++;
      }
    }
    
    if (validComparisons === 0) return 0;
    
    const avgTension = totalTension / validComparisons;
    return Math.min(avgTension * 50, 1.0);
  }

  // Facial measurement helper methods
  private calculateInterocularDistance(landmarks: FaceLandmarks[]): number {
    const leftEye = landmarks[33];
    const rightEye = landmarks[362];
    
    if (!leftEye || !rightEye) return 0;
    
    return Math.sqrt(
      Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
    );
  }

  private calculateNoseWidth(landmarks: FaceLandmarks[]): number {
    const leftNostril = landmarks[235];
    const rightNostril = landmarks[455];
    
    if (!leftNostril || !rightNostril) return 0;
    
    return Math.abs(rightNostril.x - leftNostril.x);
  }

  private calculateMouthWidth(landmarks: FaceLandmarks[]): number {
    const leftCorner = landmarks[61];
    const rightCorner = landmarks[291];
    
    if (!leftCorner || !rightCorner) return 0;
    
    return Math.abs(rightCorner.x - leftCorner.x);
  }

  private calculateFaceWidth(landmarks: FaceLandmarks[]): number {
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    
    if (!leftCheek || !rightCheek) return 0;
    
    return Math.abs(rightCheek.x - leftCheek.x);
  }

  private calculateFaceHeight(landmarks: FaceLandmarks[]): number {
    const forehead = landmarks[10];
    const chin = landmarks[152];
    
    if (!forehead || !chin) return 0;
    
    return Math.abs(chin.y - forehead.y);
  }

  private calculateMouthCurvature(landmarks: FaceLandmarks[]): number {
    const leftCorner = landmarks[61];
    const rightCorner = landmarks[291];
    const topLip = landmarks[13];
    const bottomLip = landmarks[14];
    
    if (!leftCorner || !rightCorner || !topLip || !bottomLip) return 0;
    
    const mouthCenter = {
      x: (leftCorner.x + rightCorner.x) / 2,
      y: (topLip.y + bottomLip.y) / 2
    };
    
    // Calculate upward curvature (smile) - more conservative
    const leftCurve = mouthCenter.y - leftCorner.y;
    const rightCurve = mouthCenter.y - rightCorner.y;
    
    // Only return positive if both corners are significantly raised
    const avgCurve = (leftCurve + rightCurve) / 2;
    return avgCurve > 0.01 ? avgCurve : 0; // More conservative threshold
  }

  private calculateEyeOpenness(landmarks: FaceLandmarks[]): number {
    const leftEyeHeight = this.calculateEyeHeight(this.landmarkIndices.leftEye.map(i => landmarks[i]).filter(Boolean));
    const rightEyeHeight = this.calculateEyeHeight(this.landmarkIndices.rightEye.map(i => landmarks[i]).filter(Boolean));
    
    return (leftEyeHeight + rightEyeHeight) / 2;
  }

  private calculateEyebrowHeight(landmarks: FaceLandmarks[]): number {
    const leftEyebrow = this.landmarkIndices.leftEyebrow.map(i => landmarks[i]).filter(Boolean);
    const rightEyebrow = this.landmarkIndices.rightEyebrow.map(i => landmarks[i]).filter(Boolean);
    const leftEye = landmarks[33];
    const rightEye = landmarks[362];
    
    if (leftEyebrow.length === 0 || rightEyebrow.length === 0 || !leftEye || !rightEye) return 0;
    
    const leftEyebrowCenter = leftEyebrow.reduce((sum, p) => sum + p.y, 0) / leftEyebrow.length;
    const rightEyebrowCenter = rightEyebrow.reduce((sum, p) => sum + p.y, 0) / rightEyebrow.length;
    
    const eyebrowHeight = (leftEyebrowCenter + rightEyebrowCenter) / 2;
    const eyeHeight = (leftEye.y + rightEye.y) / 2;
    
    // Return the distance between eyebrows and eyes (higher = more raised)
    // Enhanced calculation for better surprise detection
    const distance = Math.abs(eyeHeight - eyebrowHeight);
    
    // If eyebrows are significantly above normal position, amplify the signal
    if (eyebrowHeight < 0.4) { // Eyebrows raised high
      return distance * 2; // Amplify for surprise detection
    }
    
    return distance;
  }

  // Public API methods
  
  getExpressionHistory(): MicroExpression[] {
    return [...this.expressionHistory];
  }

  getLipMovementHistory(): LipMovementAnalysis[] {
    return [...this.lipMovementHistory];
  }

  getOrientationHistory(): FacialOrientation[] {
    return [...this.orientationHistory];
  }

  resetBaseline(): void {
    this.baselinePupilSize = null;
    this.previousLandmarks = null;
    this.expressionHistory = [];
    this.lipMovementHistory = [];
    this.orientationHistory = [];
  }

  setBaselinePupilSize(size: number): void {
    this.baselinePupilSize = size;
  }
}

// Export singleton instance
export const facialAnalysisEngine = new FacialAnalysisEngine();