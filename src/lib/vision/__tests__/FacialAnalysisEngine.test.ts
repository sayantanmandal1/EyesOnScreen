/**
 * Tests for Comprehensive Facial Analysis System
 * Validates micro-expression detection, lip movement analysis, facial orientation monitoring,
 * pupil dilation analysis, and 3D facial modeling
 */

import {
  FacialAnalysisEngine,
  MicroExpression,
  LipMovementAnalysis,
  FacialOrientation,
  PupilAnalysis,
  FacialModel3D,
  FacialAnalysisResult
} from '../FacialAnalysisEngine';
import { FaceLandmarks } from '../AdvancedFaceDetector';

describe('FacialAnalysisEngine', () => {
  let engine: FacialAnalysisEngine;

  beforeEach(() => {
    engine = new FacialAnalysisEngine();
  });

  describe('Micro-Expression Detection', () => {
    it('should detect happiness micro-expression', () => {
      const landmarks = generateHappyFaceLandmarks();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.microExpression).toBeTruthy();
      expect(result.microExpression!.type).toBe('happiness');
      expect(result.microExpression!.confidence).toBeGreaterThan(0.6);
      expect(result.microExpression!.intensity).toBeGreaterThan(0);
    });

    it('should detect surprise micro-expression', () => {
      const landmarks = generateSurprisedFaceLandmarks();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.microExpression).toBeTruthy();
      expect(result.microExpression!.type).toBe('surprise');
      expect(result.microExpression!.confidence).toBeGreaterThan(0.6);
    });

    it('should not detect expression with low confidence', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      const result = engine.analyzeFace(landmarks);
      
      // Neutral face should have low expression confidence
      expect(result.microExpression).toBeNull();
    });

    it('should track expression duration', () => {
      const landmarks = generateHappyFaceLandmarks();
      
      // Analyze same expression multiple times
      for (let i = 0; i < 5; i++) {
        engine.analyzeFace(landmarks);
      }
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.microExpression).toBeTruthy();
      expect(result.microExpression!.duration).toBeGreaterThan(0);
    });

    it('should maintain expression history', () => {
      const happyLandmarks = generateHappyFaceLandmarks();
      const surprisedLandmarks = generateSurprisedFaceLandmarks();
      
      engine.analyzeFace(happyLandmarks);
      engine.analyzeFace(surprisedLandmarks);
      
      const history = engine.getExpressionHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history.some(exp => exp.type === 'happiness')).toBe(true);
    });
  });

  describe('Lip Movement Analysis', () => {
    it('should detect lip movement', () => {
      const staticLandmarks = generateNeutralFaceLandmarks();
      const movingLandmarks = generateMovingLipsLandmarks();
      
      // First frame - static
      engine.analyzeFace(staticLandmarks);
      
      // Second frame - moving lips
      const result = engine.analyzeFace(movingLandmarks);
      
      expect(result.lipMovement.isMoving).toBe(true);
      expect(result.lipMovement.movementIntensity).toBeGreaterThan(0);
    });

    it('should detect speech likelihood', () => {
      const staticLandmarks = generateNeutralFaceLandmarks();
      const speechLandmarks = generateSpeechLandmarks();
      
      engine.analyzeFace(staticLandmarks);
      const result = engine.analyzeFace(speechLandmarks);
      
      expect(result.lipMovement.speechLikelihood).toBeGreaterThan(0.3);
    });

    it('should detect whisper patterns', () => {
      const staticLandmarks = generateNeutralFaceLandmarks();
      const whisperLandmarks = generateWhisperLandmarks();
      
      engine.analyzeFace(staticLandmarks);
      const result = engine.analyzeFace(whisperLandmarks);
      
      expect(result.lipMovement.whisperDetected).toBe(true);
    });

    it('should calculate lip sync score', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      // Analyze multiple frames to build history
      for (let i = 0; i < 10; i++) {
        engine.analyzeFace(landmarks);
      }
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.lipMovement.lipSyncScore).toBeGreaterThanOrEqual(0);
      expect(result.lipMovement.lipSyncScore).toBeLessThanOrEqual(1);
    });

    it('should maintain lip movement history', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      engine.analyzeFace(landmarks);
      engine.analyzeFace(landmarks);
      
      const history = engine.getLipMovementHistory();
      expect(history.length).toBe(2);
      expect(history[0].timestamp).toBeLessThan(history[1].timestamp);
    });
  });

  describe('Facial Orientation Monitoring', () => {
    it('should calculate head pose angles', () => {
      const landmarks = generateTiltedFaceLandmarks();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.orientation.yaw).toBeGreaterThanOrEqual(-90);
      expect(result.orientation.yaw).toBeLessThanOrEqual(90);
      expect(result.orientation.pitch).toBeGreaterThanOrEqual(-90);
      expect(result.orientation.pitch).toBeLessThanOrEqual(90);
      expect(result.orientation.roll).toBeGreaterThanOrEqual(-180);
      expect(result.orientation.roll).toBeLessThanOrEqual(180);
    });

    it('should calculate attention score', () => {
      const frontFacingLandmarks = generateNeutralFaceLandmarks();
      
      const result = engine.analyzeFace(frontFacingLandmarks);
      
      expect(result.orientation.attentionScore).toBeGreaterThan(0.7);
    });

    it('should detect looking away', () => {
      const lookingAwayLandmarks = generateLookingAwayLandmarks();
      
      const result = engine.analyzeFace(lookingAwayLandmarks);
      
      expect(result.orientation.attentionScore).toBeLessThan(0.5);
      expect(Math.abs(result.orientation.yaw)).toBeGreaterThan(15);
    });

    it('should calculate orientation confidence', () => {
      const highQualityLandmarks = generateNeutralFaceLandmarks();
      
      const result = engine.analyzeFace(highQualityLandmarks);
      
      expect(result.orientation.confidence).toBeGreaterThan(0.8);
    });

    it('should maintain orientation history', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      engine.analyzeFace(landmarks);
      engine.analyzeFace(landmarks);
      
      const history = engine.getOrientationHistory();
      expect(history.length).toBe(2);
    });
  });

  describe('Pupil Dilation Analysis', () => {
    it('should analyze pupil size', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.pupilAnalysis).toBeTruthy();
      expect(result.pupilAnalysis!.leftPupilDiameter).toBeGreaterThan(0);
      expect(result.pupilAnalysis!.rightPupilDiameter).toBeGreaterThan(0);
    });

    it('should detect pupil dilation', () => {
      const normalLandmarks = generateNeutralFaceLandmarks();
      const dilatedLandmarks = generateDilatedPupilLandmarks();
      
      // Establish baseline
      engine.analyzeFace(normalLandmarks);
      
      // Analyze dilated pupils
      const result = engine.analyzeFace(dilatedLandmarks);
      
      expect(result.pupilAnalysis).toBeTruthy();
      expect(result.pupilAnalysis!.pupilDilation).toBeGreaterThan(0);
    });

    it('should calculate stress indicators', () => {
      const stressedLandmarks = generateStressedFaceLandmarks();
      
      const result = engine.analyzeFace(stressedLandmarks);
      
      expect(result.pupilAnalysis).toBeTruthy();
      expect(result.pupilAnalysis!.stressIndicator).toBeGreaterThanOrEqual(0);
      expect(result.pupilAnalysis!.stressIndicator).toBeLessThanOrEqual(1);
    });

    it('should calculate cognitive load', () => {
      const focusedLandmarks = generateFocusedFaceLandmarks();
      
      const result = engine.analyzeFace(focusedLandmarks);
      
      expect(result.pupilAnalysis).toBeTruthy();
      expect(result.pupilAnalysis!.cognitiveLoad).toBeGreaterThanOrEqual(0);
      expect(result.pupilAnalysis!.cognitiveLoad).toBeLessThanOrEqual(1);
    });

    it('should handle missing eye landmarks', () => {
      const incompleteLandmarks = generateIncompleteLandmarks();
      
      const result = engine.analyzeFace(incompleteLandmarks);
      
      expect(result.pupilAnalysis).toBeNull();
    });
  });

  describe('3D Facial Modeling', () => {
    it('should generate 3D facial model', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.facialModel).toBeTruthy();
      expect(result.facialModel!.vertices.length).toBeGreaterThan(0);
      expect(result.facialModel!.normals.length).toBeGreaterThan(0);
      expect(result.facialModel!.textureCoords.length).toBeGreaterThan(0);
    });

    it('should generate face descriptor for identity verification', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.facialModel).toBeTruthy();
      expect(result.facialModel!.faceDescriptor.length).toBe(128);
    });

    it('should calculate model confidence', () => {
      const highQualityLandmarks = generateNeutralFaceLandmarks();
      
      const result = engine.analyzeFace(highQualityLandmarks);
      
      expect(result.facialModel).toBeTruthy();
      expect(result.facialModel!.confidence).toBeGreaterThan(0.5);
    });

    it('should handle insufficient landmarks', () => {
      const fewLandmarks = generateFewLandmarks();
      
      const result = engine.analyzeFace(fewLandmarks);
      
      expect(result.facialModel).toBeNull();
    });
  });

  describe('Deception Detection', () => {
    it('should calculate micro-expression inconsistency', () => {
      const happyLandmarks = generateHappyFaceLandmarks();
      const sadLandmarks = generateSadFaceLandmarks();
      
      // Create inconsistent expression pattern
      engine.analyzeFace(happyLandmarks);
      engine.analyzeFace(sadLandmarks);
      engine.analyzeFace(happyLandmarks);
      engine.analyzeFace(sadLandmarks);
      
      const result = engine.analyzeFace(happyLandmarks);
      
      expect(result.deceptionIndicators.microExpressionInconsistency).toBeGreaterThan(0);
    });

    it('should detect suspicious eye movements', () => {
      const rapidMovementLandmarks = generateRapidEyeMovementLandmarks();
      
      const result = engine.analyzeFace(rapidMovementLandmarks);
      
      expect(result.deceptionIndicators.eyeMovementPatterns).toBeGreaterThan(0);
    });

    it('should calculate facial tension', () => {
      const tenseLandmarks = generateTenseFaceLandmarks();
      const relaxedLandmarks = generateNeutralFaceLandmarks();
      
      engine.analyzeFace(relaxedLandmarks);
      const result = engine.analyzeFace(tenseLandmarks);
      
      expect(result.deceptionIndicators.facialTension).toBeGreaterThan(0);
    });

    it('should calculate overall deception score', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.deceptionIndicators.overallDeceptionScore).toBeGreaterThanOrEqual(0);
      expect(result.deceptionIndicators.overallDeceptionScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Baseline Management', () => {
    it('should reset baseline', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      engine.analyzeFace(landmarks);
      engine.resetBaseline();
      
      const history = engine.getExpressionHistory();
      expect(history.length).toBe(0);
    });

    it('should set baseline pupil size', () => {
      const baselineSize = 0.05;
      
      engine.setBaselinePupilSize(baselineSize);
      
      const landmarks = generateNeutralFaceLandmarks();
      const result = engine.analyzeFace(landmarks);
      
      expect(result.pupilAnalysis).toBeTruthy();
      // Pupil dilation should be calculated relative to baseline
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty landmarks array', () => {
      const result = engine.analyzeFace([]);
      
      expect(result.microExpression).toBeNull();
      expect(result.lipMovement.isMoving).toBe(false);
      expect(result.orientation.confidence).toBe(0);
      expect(result.pupilAnalysis).toBeNull();
      expect(result.facialModel).toBeNull();
    });

    it('should handle malformed landmarks', () => {
      const malformedLandmarks = [
        { x: NaN, y: 0.5, z: 0 },
        { x: 0.5, y: Infinity, z: 0 },
        { x: -1, y: 2, z: 0 }
      ];
      
      const result = engine.analyzeFace(malformedLandmarks);
      
      // Should not crash and return valid result structure
      expect(result).toBeTruthy();
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should maintain consistent timestamps', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      const result1 = engine.analyzeFace(landmarks);
      
      // Small delay
      setTimeout(() => {
        const result2 = engine.analyzeFace(landmarks);
        expect(result2.timestamp).toBeGreaterThan(result1.timestamp);
      }, 10);
    });

    it('should limit history size to prevent memory leaks', () => {
      const landmarks = generateNeutralFaceLandmarks();
      
      // Generate more entries than history limit
      for (let i = 0; i < 100; i++) {
        engine.analyzeFace(landmarks);
      }
      
      const expressionHistory = engine.getExpressionHistory();
      const lipHistory = engine.getLipMovementHistory();
      const orientationHistory = engine.getOrientationHistory();
      
      expect(expressionHistory.length).toBeLessThanOrEqual(50);
      expect(lipHistory.length).toBeLessThanOrEqual(30);
      expect(orientationHistory.length).toBeLessThanOrEqual(30);
    });
  });
});

// Helper functions to generate test landmarks

function generateNeutralFaceLandmarks(): FaceLandmarks[] {
  const landmarks: FaceLandmarks[] = [];
  
  // Generate 468 landmarks for MediaPipe face mesh
  for (let i = 0; i < 468; i++) {
    const angle = (i / 468) * 2 * Math.PI;
    const radius = 0.15;
    
    landmarks.push({
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
      z: Math.random() * 0.02
    });
  }
  
  return landmarks;
}

function generateHappyFaceLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Modify mouth corners to simulate smile
  if (landmarks[61]) landmarks[61].y -= 0.02; // Left mouth corner up
  if (landmarks[291]) landmarks[291].y -= 0.02; // Right mouth corner up
  
  // Modify eye regions for smile
  if (landmarks[33]) landmarks[33].y += 0.01; // Left eye squint
  if (landmarks[362]) landmarks[362].y += 0.01; // Right eye squint
  
  return landmarks;
}

function generateSurprisedFaceLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Modify eyebrows for surprise
  if (landmarks[70]) landmarks[70].y -= 0.03; // Left eyebrow up
  if (landmarks[296]) landmarks[296].y -= 0.03; // Right eyebrow up
  
  // Modify mouth for surprise
  if (landmarks[13]) landmarks[13].y += 0.02; // Mouth open
  if (landmarks[14]) landmarks[14].y -= 0.02;
  
  return landmarks;
}

function generateSadFaceLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Modify mouth corners for sadness
  if (landmarks[61]) landmarks[61].y += 0.02; // Left mouth corner down
  if (landmarks[291]) landmarks[291].y += 0.02; // Right mouth corner down
  
  // Modify eyebrows for sadness
  if (landmarks[70]) landmarks[70].y += 0.01; // Left eyebrow down
  if (landmarks[296]) landmarks[296].y += 0.01; // Right eyebrow down
  
  return landmarks;
}

function generateMovingLipsLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Modify lip landmarks to simulate movement
  const lipIndices = [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318];
  
  lipIndices.forEach(index => {
    if (landmarks[index]) {
      landmarks[index].x += (Math.random() - 0.5) * 0.02;
      landmarks[index].y += (Math.random() - 0.5) * 0.02;
    }
  });
  
  return landmarks;
}

function generateSpeechLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Modify lips for speech pattern
  if (landmarks[13]) landmarks[13].y += 0.015; // Top lip
  if (landmarks[14]) landmarks[14].y -= 0.015; // Bottom lip
  if (landmarks[61]) landmarks[61].x -= 0.01; // Left corner
  if (landmarks[291]) landmarks[291].x += 0.01; // Right corner
  
  return landmarks;
}

function generateWhisperLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Subtle lip movements for whisper
  if (landmarks[13]) landmarks[13].y += 0.005; // Slight mouth opening
  if (landmarks[14]) landmarks[14].y -= 0.005;
  
  return landmarks;
}

function generateTiltedFaceLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Apply rotation to simulate head tilt
  const angle = 0.2; // 0.2 radians tilt
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  
  landmarks.forEach(landmark => {
    const x = landmark.x - 0.5;
    const y = landmark.y - 0.5;
    
    landmark.x = x * cos - y * sin + 0.5;
    landmark.y = x * sin + y * cos + 0.5;
  });
  
  return landmarks;
}

function generateLookingAwayLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Shift face to simulate looking away
  landmarks.forEach(landmark => {
    landmark.x += 0.1; // Shift right
  });
  
  return landmarks;
}

function generateDilatedPupilLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Simulate dilated pupils by modifying eye landmarks
  const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
  
  // Slightly expand eye regions to simulate dilation
  leftEyeIndices.forEach(index => {
    if (landmarks[index]) {
      const centerX = 0.4; // Approximate left eye center
      const centerY = 0.45;
      const dx = landmarks[index].x - centerX;
      const dy = landmarks[index].y - centerY;
      landmarks[index].x = centerX + dx * 1.1;
      landmarks[index].y = centerY + dy * 1.1;
    }
  });
  
  rightEyeIndices.forEach(index => {
    if (landmarks[index]) {
      const centerX = 0.6; // Approximate right eye center
      const centerY = 0.45;
      const dx = landmarks[index].x - centerX;
      const dy = landmarks[index].y - centerY;
      landmarks[index].x = centerX + dx * 1.1;
      landmarks[index].y = centerY + dy * 1.1;
    }
  });
  
  return landmarks;
}

function generateStressedFaceLandmarks(): FaceLandmarks[] {
  const landmarks = generateDilatedPupilLandmarks();
  
  // Add tension indicators
  if (landmarks[70]) landmarks[70].y -= 0.01; // Tense eyebrows
  if (landmarks[296]) landmarks[296].y -= 0.01;
  
  return landmarks;
}

function generateFocusedFaceLandmarks(): FaceLandmarks[] {
  const landmarks = generateDilatedPupilLandmarks();
  
  // Focused expression with slightly dilated pupils
  return landmarks;
}

function generateIncompleteLandmarks(): FaceLandmarks[] {
  // Return only a few landmarks, missing eye regions
  return [
    { x: 0.5, y: 0.3, z: 0 }, // Nose
    { x: 0.4, y: 0.7, z: 0 }, // Left mouth
    { x: 0.6, y: 0.7, z: 0 }  // Right mouth
  ];
}

function generateFewLandmarks(): FaceLandmarks[] {
  // Return insufficient landmarks for 3D modeling
  return Array.from({ length: 50 }, (_, i) => ({
    x: 0.5 + (Math.random() - 0.5) * 0.3,
    y: 0.5 + (Math.random() - 0.5) * 0.3,
    z: Math.random() * 0.02
  }));
}

function generateRapidEyeMovementLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Simulate rapid eye movements by shifting eye landmarks
  const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
  
  leftEyeIndices.forEach(index => {
    if (landmarks[index]) {
      landmarks[index].x += (Math.random() - 0.5) * 0.05;
      landmarks[index].y += (Math.random() - 0.5) * 0.05;
    }
  });
  
  rightEyeIndices.forEach(index => {
    if (landmarks[index]) {
      landmarks[index].x += (Math.random() - 0.5) * 0.05;
      landmarks[index].y += (Math.random() - 0.5) * 0.05;
    }
  });
  
  return landmarks;
}

function generateTenseFaceLandmarks(): FaceLandmarks[] {
  const landmarks = generateNeutralFaceLandmarks();
  
  // Add random small movements to simulate tension
  landmarks.forEach(landmark => {
    landmark.x += (Math.random() - 0.5) * 0.01;
    landmark.y += (Math.random() - 0.5) * 0.01;
  });
  
  return landmarks;
}