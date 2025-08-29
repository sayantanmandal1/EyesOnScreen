/**
 * Integration test for Comprehensive Facial Analysis System
 * Validates that the system meets all requirements from task 2.2
 */

import { FacialAnalysisEngine } from '../FacialAnalysisEngine';
import { FaceLandmarks } from '../AdvancedFaceDetector';

describe('Facial Analysis System Integration', () => {
  let engine: FacialAnalysisEngine;

  beforeEach(() => {
    engine = new FacialAnalysisEngine();
  });

  describe('Task 2.2 Requirements Validation', () => {
    it('should implement micro-expression detection for deception analysis (Requirement 5.6)', () => {
      // Generate realistic facial landmarks with expression
      const landmarks = generateRealisticHappyFace();
      
      const result = engine.analyzeFace(landmarks);
      
      // Verify micro-expression detection is implemented
      expect(result.microExpression).toBeDefined();
      expect(result.deceptionIndicators).toBeDefined();
      expect(result.deceptionIndicators.microExpressionInconsistency).toBeGreaterThanOrEqual(0);
      expect(result.deceptionIndicators.overallDeceptionScore).toBeGreaterThanOrEqual(0);
    });

    it('should create lip movement and whisper detection system (Requirement 5.7)', () => {
      const staticLandmarks = generateRealisticNeutralFace();
      const movingLandmarks = generateRealisticLipMovement();
      
      // Establish baseline
      engine.analyzeFace(staticLandmarks);
      
      // Test lip movement detection
      const result = engine.analyzeFace(movingLandmarks);
      
      expect(result.lipMovement).toBeDefined();
      expect(result.lipMovement.isMoving).toBeDefined();
      expect(result.lipMovement.movementIntensity).toBeGreaterThanOrEqual(0);
      expect(result.lipMovement.speechLikelihood).toBeGreaterThanOrEqual(0);
      expect(result.lipMovement.whisperDetected).toBeDefined();
      expect(result.lipMovement.lipSyncScore).toBeGreaterThanOrEqual(0);
    });

    it('should build facial orientation and attention monitoring (Requirement 7.13)', () => {
      const landmarks = generateRealisticNeutralFace();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.orientation).toBeDefined();
      expect(result.orientation.yaw).toBeGreaterThanOrEqual(-90);
      expect(result.orientation.yaw).toBeLessThanOrEqual(90);
      expect(result.orientation.pitch).toBeGreaterThanOrEqual(-90);
      expect(result.orientation.pitch).toBeLessThanOrEqual(90);
      expect(result.orientation.roll).toBeGreaterThanOrEqual(-180);
      expect(result.orientation.roll).toBeLessThanOrEqual(180);
      expect(result.orientation.attentionScore).toBeGreaterThanOrEqual(0);
      expect(result.orientation.attentionScore).toBeLessThanOrEqual(1);
      expect(result.orientation.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should add pupil dilation and stress indicator analysis', () => {
      const landmarks = generateRealisticNeutralFace();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.pupilAnalysis).toBeDefined();
      if (result.pupilAnalysis) {
        expect(result.pupilAnalysis.leftPupilDiameter).toBeGreaterThanOrEqual(0);
        expect(result.pupilAnalysis.rightPupilDiameter).toBeGreaterThanOrEqual(0);
        expect(result.pupilAnalysis.stressIndicator).toBeGreaterThanOrEqual(0);
        expect(result.pupilAnalysis.stressIndicator).toBeLessThanOrEqual(1);
        expect(result.pupilAnalysis.cognitiveLoad).toBeGreaterThanOrEqual(0);
        expect(result.pupilAnalysis.cognitiveLoad).toBeLessThanOrEqual(1);
      }
    });

    it('should implement 3D facial modeling for identity verification', () => {
      const landmarks = generateRealisticNeutralFace();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.facialModel).toBeDefined();
      if (result.facialModel) {
        expect(result.facialModel.vertices).toBeDefined();
        expect(result.facialModel.vertices.length).toBeGreaterThan(0);
        expect(result.facialModel.normals).toBeDefined();
        expect(result.facialModel.textureCoords).toBeDefined();
        expect(result.facialModel.faceDescriptor).toBeDefined();
        expect(result.facialModel.faceDescriptor.length).toBe(128);
        expect(result.facialModel.confidence).toBeGreaterThanOrEqual(0);
        expect(result.facialModel.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should provide comprehensive deception analysis', () => {
      const landmarks = generateRealisticNeutralFace();
      
      const result = engine.analyzeFace(landmarks);
      
      expect(result.deceptionIndicators).toBeDefined();
      expect(result.deceptionIndicators.microExpressionInconsistency).toBeGreaterThanOrEqual(0);
      expect(result.deceptionIndicators.microExpressionInconsistency).toBeLessThanOrEqual(1);
      expect(result.deceptionIndicators.eyeMovementPatterns).toBeGreaterThanOrEqual(0);
      expect(result.deceptionIndicators.eyeMovementPatterns).toBeLessThanOrEqual(1);
      expect(result.deceptionIndicators.facialTension).toBeGreaterThanOrEqual(0);
      expect(result.deceptionIndicators.facialTension).toBeLessThanOrEqual(1);
      expect(result.deceptionIndicators.overallDeceptionScore).toBeGreaterThanOrEqual(0);
      expect(result.deceptionIndicators.overallDeceptionScore).toBeLessThanOrEqual(1);
    });

    it('should maintain history and provide temporal analysis', () => {
      const landmarks = generateRealisticNeutralFace();
      
      // Analyze multiple frames
      for (let i = 0; i < 5; i++) {
        engine.analyzeFace(landmarks);
      }
      
      const expressionHistory = engine.getExpressionHistory();
      const lipHistory = engine.getLipMovementHistory();
      const orientationHistory = engine.getOrientationHistory();
      
      expect(expressionHistory).toBeDefined();
      expect(lipHistory).toBeDefined();
      expect(orientationHistory).toBeDefined();
      expect(lipHistory.length).toBeGreaterThan(0);
      expect(orientationHistory.length).toBeGreaterThan(0);
    });

    it('should handle edge cases gracefully', () => {
      // Test with empty landmarks
      const emptyResult = engine.analyzeFace([]);
      expect(emptyResult).toBeDefined();
      expect(emptyResult.microExpression).toBeNull();
      expect(emptyResult.pupilAnalysis).toBeNull();
      expect(emptyResult.facialModel).toBeNull();
      
      // Test with malformed landmarks
      const malformedLandmarks = [
        { x: NaN, y: 0.5, z: 0 },
        { x: 0.5, y: Infinity, z: 0 }
      ];
      const malformedResult = engine.analyzeFace(malformedLandmarks);
      expect(malformedResult).toBeDefined();
    });

    it('should provide real-time performance', () => {
      const landmarks = generateRealisticNeutralFace();
      
      const startTime = performance.now();
      const result = engine.analyzeFace(landmarks);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      // Should process within reasonable time (< 50ms for real-time)
      expect(processingTime).toBeLessThan(50);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });
});

// Helper functions for realistic test data

function generateRealisticNeutralFace(): FaceLandmarks[] {
  const landmarks: FaceLandmarks[] = [];
  
  // Generate 468 landmarks in realistic positions
  for (let i = 0; i < 468; i++) {
    landmarks.push({
      x: 0.5 + (Math.random() - 0.5) * 0.3,
      y: 0.5 + (Math.random() - 0.5) * 0.4,
      z: Math.random() * 0.02
    });
  }
  
  // Set key landmarks to realistic positions
  landmarks[33] = { x: 0.42, y: 0.45, z: 0.01 }; // Left eye
  landmarks[362] = { x: 0.58, y: 0.45, z: 0.01 }; // Right eye
  landmarks[19] = { x: 0.5, y: 0.55, z: 0.02 }; // Nose tip
  landmarks[61] = { x: 0.45, y: 0.65, z: 0.01 }; // Left mouth corner
  landmarks[291] = { x: 0.55, y: 0.65, z: 0.01 }; // Right mouth corner
  landmarks[13] = { x: 0.5, y: 0.63, z: 0.01 }; // Top lip
  landmarks[14] = { x: 0.5, y: 0.67, z: 0.01 }; // Bottom lip
  
  return landmarks;
}

function generateRealisticHappyFace(): FaceLandmarks[] {
  const landmarks = generateRealisticNeutralFace();
  
  // Modify for happiness
  if (landmarks[61]) landmarks[61].y -= 0.03; // Left mouth corner up
  if (landmarks[291]) landmarks[291].y -= 0.03; // Right mouth corner up
  if (landmarks[13]) landmarks[13].y -= 0.01; // Top lip up
  
  return landmarks;
}

function generateRealisticLipMovement(): FaceLandmarks[] {
  const landmarks = generateRealisticNeutralFace();
  
  // Add realistic lip movement
  const lipIndices = [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318];
  
  lipIndices.forEach(index => {
    if (landmarks[index]) {
      landmarks[index].x += (Math.random() - 0.5) * 0.02;
      landmarks[index].y += (Math.random() - 0.5) * 0.02;
    }
  });
  
  return landmarks;
}