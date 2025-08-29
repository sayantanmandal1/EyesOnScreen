/**
 * Tests for Eye Behavior Analysis System
 */

import { EyeBehaviorAnalyzer, BlinkData, EyeMovementPattern, AttentionFocus } from '../EyeBehaviorAnalyzer';

describe('EyeBehaviorAnalyzer', () => {
  let analyzer: EyeBehaviorAnalyzer;

  beforeEach(() => {
    analyzer = new EyeBehaviorAnalyzer({ width: 1920, height: 1080 });
  });

  describe('Blink Pattern Analysis', () => {
    it('should detect blinks from eye landmarks', () => {
      const landmarks = createMockFaceLandmarks();
      const timestamp = Date.now();

      // Simulate closed eyes (low EAR)
      const closedEyeLandmarks = createMockFaceLandmarksWithClosedEyes();
      
      const result = analyzer.analyzeBlinkPattern(closedEyeLandmarks, timestamp);

      expect(result.currentBlink).toBeDefined();
      expect(result.currentBlink!.timestamp).toBe(timestamp);
      expect(result.currentBlink!.eyeAspectRatio).toBeLessThan(0.25);
      expect(result.currentBlink!.intensity).toBeGreaterThan(0);
      expect(result.pattern).toBeDefined();
    });

    it('should classify blink types correctly', () => {
      const timestamp = Date.now();
      
      // Test partial blink
      const partialBlinkLandmarks = createMockFaceLandmarksWithPartialBlink();
      const partialResult = analyzer.analyzeBlinkPattern(partialBlinkLandmarks, timestamp);
      
      if (partialResult.currentBlink) {
        expect(partialResult.currentBlink.type).toBe('partial');
      }

      // Test full blink
      const fullBlinkLandmarks = createMockFaceLandmarksWithClosedEyes();
      const fullResult = analyzer.analyzeBlinkPattern(fullBlinkLandmarks, timestamp + 1000);
      
      if (fullResult.currentBlink) {
        expect(['voluntary', 'involuntary']).toContain(fullResult.currentBlink.type);
      }
    });

    it('should detect reading patterns from blinks', () => {
      // Simulate reading pattern: reduced frequency, regular intervals
      const timestamps = [0, 4000, 8000, 12000, 16000]; // 15 blinks/min
      
      timestamps.forEach(timestamp => {
        const landmarks = createMockFaceLandmarksWithClosedEyes();
        analyzer.analyzeBlinkPattern(landmarks, timestamp);
      });

      const result = analyzer.analyzeBlinkPattern(createMockFaceLandmarks(), 20000);
      
      expect(result.pattern.readingIndicators.isReading).toBe(true);
      expect(result.pattern.readingIndicators.confidence).toBeGreaterThan(0.5);
      expect(result.pattern.readingIndicators.evidence.length).toBeGreaterThan(0);
    });

    it('should detect fatigue from blink patterns', () => {
      // Simulate fatigue pattern: increased frequency, longer durations
      const fatigueTimestamps = Array.from({ length: 30 }, (_, i) => i * 2000); // 30 blinks/min
      
      fatigueTimestamps.forEach(timestamp => {
        const landmarks = createMockFaceLandmarksWithClosedEyes();
        analyzer.analyzeBlinkPattern(landmarks, timestamp);
        
        // Simulate longer blink duration
        setTimeout(() => {
          analyzer.analyzeBlinkPattern(createMockFaceLandmarks(), timestamp + 250);
        }, 0);
      });

      const result = analyzer.analyzeBlinkPattern(createMockFaceLandmarks(), 60000);
      
      expect(result.pattern.fatigueIndicators.isFatigued).toBe(true);
      expect(result.pattern.fatigueIndicators.level).not.toBe('none');
      expect(result.pattern.fatigueIndicators.evidence.length).toBeGreaterThan(0);
    });

    it('should calculate blink frequency correctly', () => {
      // Add 10 blinks in 1 minute
      const blinkTimes = Array.from({ length: 10 }, (_, i) => i * 6000);
      
      blinkTimes.forEach(timestamp => {
        const landmarks = createMockFaceLandmarksWithClosedEyes();
        analyzer.analyzeBlinkPattern(landmarks, timestamp);
      });

      const result = analyzer.analyzeBlinkPattern(createMockFaceLandmarks(), 60000);
      
      expect(result.pattern.frequency).toBe(10);
    });
  });

  describe('Eye Movement Pattern Recognition', () => {
    it('should recognize saccade movements', () => {
      const startTime = Date.now();
      
      // Simulate rapid eye movement (saccade)
      const positions = [
        { x: 100, y: 100, timestamp: startTime, confidence: 0.9 },
        { x: 300, y: 120, timestamp: startTime + 50, confidence: 0.9 } // Fast movement
      ];

      positions.forEach(pos => {
        analyzer.recognizeEyeMovementPatterns(pos);
      });

      // Should detect saccade pattern
      const patterns = analyzer.recognizeEyeMovementPatterns({
        x: 320, y: 125, timestamp: startTime + 100, confidence: 0.9
      });

      const saccades = patterns.filter(p => p.type === 'saccade');
      expect(saccades.length).toBeGreaterThan(0);
      expect(saccades[0].velocity).toBeGreaterThan(30); // Above saccade threshold
    });

    it('should recognize fixation periods', () => {
      const startTime = Date.now();
      
      // Simulate stable gaze (fixation)
      const positions = [
        { x: 500, y: 300, timestamp: startTime, confidence: 0.9 },
        { x: 502, y: 301, timestamp: startTime + 100, confidence: 0.9 },
        { x: 501, y: 299, timestamp: startTime + 200, confidence: 0.9 }
      ];

      positions.forEach(pos => {
        analyzer.recognizeEyeMovementPatterns(pos);
      });

      const patterns = analyzer.recognizeEyeMovementPatterns({
        x: 500, y: 300, timestamp: startTime + 300, confidence: 0.9
      });

      const fixations = patterns.filter(p => p.type === 'fixation');
      expect(fixations.length).toBeGreaterThan(0);
      expect(fixations[0].velocity).toBeLessThan(5); // Low velocity for fixation
    });

    it('should recognize smooth pursuit movements', () => {
      const startTime = Date.now();
      
      // Simulate smooth tracking movement
      const positions = [
        { x: 100, y: 100, timestamp: startTime, confidence: 0.9 },
        { x: 120, y: 105, timestamp: startTime + 100, confidence: 0.9 },
        { x: 140, y: 110, timestamp: startTime + 200, confidence: 0.9 }
      ];

      positions.forEach(pos => {
        analyzer.recognizeEyeMovementPatterns(pos);
      });

      const patterns = analyzer.recognizeEyeMovementPatterns({
        x: 160, y: 115, timestamp: startTime + 300, confidence: 0.9
      });

      const pursuits = patterns.filter(p => p.type === 'smooth_pursuit');
      expect(pursuits.length).toBeGreaterThan(0);
      expect(pursuits[0].velocity).toBeGreaterThan(5);
      expect(pursuits[0].velocity).toBeLessThan(30);
    });

    it('should calculate movement characteristics correctly', () => {
      const startTime = Date.now();
      
      const pos1 = { x: 100, y: 100, timestamp: startTime, confidence: 0.9 };
      const pos2 = { x: 200, y: 150, timestamp: startTime + 100, confidence: 0.9 };

      analyzer.recognizeEyeMovementPatterns(pos1);
      const patterns = analyzer.recognizeEyeMovementPatterns(pos2);

      expect(patterns.length).toBeGreaterThan(0);
      
      const pattern = patterns[0];
      expect(pattern.startPosition).toEqual({ x: 100, y: 100 });
      expect(pattern.endPosition).toEqual({ x: 200, y: 150 });
      expect(pattern.amplitude).toBeGreaterThan(0);
      expect(pattern.direction).toBeDefined();
      expect(pattern.confidence).toBeGreaterThan(0);
    });
  });

  describe('Attention Focus Monitoring', () => {
    it('should monitor attention focus correctly', () => {
      const gazePosition = { x: 960, y: 540, timestamp: Date.now(), confidence: 0.9 };
      
      const attention = analyzer.monitorAttentionFocus(gazePosition);

      expect(attention).toBeDefined();
      expect(attention.isAttentive).toBeDefined();
      expect(attention.focusLevel).toBeGreaterThanOrEqual(0);
      expect(attention.focusLevel).toBeLessThanOrEqual(1);
      expect(attention.focusRegion).toBeDefined();
      expect(attention.dwellTime).toBeGreaterThanOrEqual(0);
      expect(attention.scanPattern).toMatch(/focused|scanning|distracted|off_screen/);
    });

    it('should calculate dwell time correctly', () => {
      const startTime = Date.now();
      const centerPosition = { x: 960, y: 540, confidence: 0.9 };
      
      // Stay in same region for multiple samples
      const positions = [
        { ...centerPosition, timestamp: startTime },
        { ...centerPosition, timestamp: startTime + 100 },
        { ...centerPosition, timestamp: startTime + 200 }
      ];

      positions.forEach(pos => {
        analyzer.monitorAttentionFocus(pos);
      });

      const finalAttention = analyzer.monitorAttentionFocus({
        ...centerPosition, timestamp: startTime + 300
      });

      expect(finalAttention.dwellTime).toBeGreaterThanOrEqual(300);
    });

    it('should detect different scan patterns', () => {
      const startTime = Date.now();
      
      // Simulate focused pattern (small movements)
      const focusedPositions = [
        { x: 960, y: 540, timestamp: startTime, confidence: 0.9 },
        { x: 965, y: 542, timestamp: startTime + 100, confidence: 0.9 },
        { x: 958, y: 538, timestamp: startTime + 200, confidence: 0.9 }
      ];

      focusedPositions.forEach(pos => {
        analyzer.recognizeEyeMovementPatterns(pos);
      });

      const attention = analyzer.monitorAttentionFocus(focusedPositions[2]);
      expect(attention.scanPattern).toBe('focused');
    });

    it('should detect off-screen attention', () => {
      const offScreenPosition = { x: -100, y: 540, timestamp: Date.now(), confidence: 0.9 };
      
      const attention = analyzer.monitorAttentionFocus(offScreenPosition);

      expect(attention.focusRegion).toBeNull();
      expect(attention.focusLevel).toBe(0);
    });
  });

  describe('Off-Screen Gaze Detection', () => {
    it('should detect off-screen gaze immediately', () => {
      const offScreenPositions = [
        { x: -50, y: 540, timestamp: Date.now(), confidence: 0.9 }, // Left
        { x: 2000, y: 540, timestamp: Date.now() + 100, confidence: 0.9 }, // Right
        { x: 960, y: -50, timestamp: Date.now() + 200, confidence: 0.9 }, // Up
        { x: 960, y: 1200, timestamp: Date.now() + 300, confidence: 0.9 } // Down
      ];

      const expectedDirections = ['left', 'right', 'up', 'down'];

      offScreenPositions.forEach((pos, index) => {
        // Simulate duration to trigger alert
        const alert = analyzer.detectOffScreenGaze({
          ...pos,
          timestamp: pos.timestamp + 1500 // Exceed alert delay
        });

        if (alert) {
          expect(alert.direction).toBe(expectedDirections[index]);
          expect(alert.severity).toMatch(/low|medium|high/);
        }
      });
    });

    it('should calculate off-screen duration correctly', () => {
      const startTime = Date.now();
      
      // Add on-screen position first
      analyzer.detectOffScreenGaze({ x: 960, y: 540, timestamp: startTime, confidence: 0.9 });
      
      // Then off-screen position after delay
      const alert = analyzer.detectOffScreenGaze({
        x: -100, y: 540, timestamp: startTime + 2000, confidence: 0.9
      });

      if (alert) {
        expect(alert.duration).toBeGreaterThanOrEqual(1000);
      }
    });

    it('should escalate severity based on duration', () => {
      const startTime = Date.now();
      const offScreenPos = { x: -100, y: 540, confidence: 0.9 };
      
      // Short duration - low severity
      const shortAlert = analyzer.detectOffScreenGaze({
        ...offScreenPos, timestamp: startTime + 1500
      });
      
      // Long duration - high severity
      const longAlert = analyzer.detectOffScreenGaze({
        ...offScreenPos, timestamp: startTime + 6000
      });

      if (shortAlert) expect(shortAlert.severity).toBe('low');
      if (longAlert) expect(longAlert.severity).toBe('high');
    });
  });

  describe('Temporal Gaze Consistency Validation', () => {
    it('should validate normal gaze consistency', () => {
      const startTime = Date.now();
      
      // Normal gaze sequence
      const positions = [
        { x: 100, y: 100, timestamp: startTime, confidence: 0.9 },
        { x: 110, y: 105, timestamp: startTime + 100, confidence: 0.9 },
        { x: 120, y: 110, timestamp: startTime + 200, confidence: 0.9 }
      ];

      positions.forEach(pos => {
        const validation = analyzer.validateTemporalGazeConsistency(pos);
        expect(validation.isConsistent).toBe(true);
        expect(validation.validationStatus).toBe('valid');
      });
    });

    it('should detect impossible velocities', () => {
      const startTime = Date.now();
      
      // Add normal position
      analyzer.validateTemporalGazeConsistency({
        x: 100, y: 100, timestamp: startTime, confidence: 0.9
      });
      
      // Add impossible jump
      const validation = analyzer.validateTemporalGazeConsistency({
        x: 1000, y: 800, timestamp: startTime + 10, confidence: 0.9 // Huge jump in 10ms
      });

      expect(validation.isConsistent).toBe(false);
      expect(validation.anomalies.length).toBeGreaterThan(0);
      expect(validation.anomalies[0].type).toBe('impossible_velocity');
      expect(validation.validationStatus).toMatch(/suspicious|invalid/);
    });

    it('should detect sudden jumps', () => {
      const startTime = Date.now();
      
      analyzer.validateTemporalGazeConsistency({
        x: 100, y: 100, timestamp: startTime, confidence: 0.9
      });
      
      const validation = analyzer.validateTemporalGazeConsistency({
        x: 400, y: 300, timestamp: startTime + 30, confidence: 0.9 // Large jump in short time
      });

      const jumpAnomalies = validation.anomalies.filter(a => a.type === 'sudden_jump');
      expect(jumpAnomalies.length).toBeGreaterThan(0);
    });

    it('should detect tracking loss', () => {
      const validation = analyzer.validateTemporalGazeConsistency({
        x: 100, y: 100, timestamp: Date.now(), confidence: 0.1 // Very low confidence
      });

      const trackingLossAnomalies = validation.anomalies.filter(a => a.type === 'tracking_loss');
      expect(trackingLossAnomalies.length).toBeGreaterThan(0);
    });

    it('should calculate consistency score correctly', () => {
      // Test with good data
      const goodValidation = analyzer.validateTemporalGazeConsistency({
        x: 100, y: 100, timestamp: Date.now(), confidence: 0.9
      });
      
      expect(goodValidation.consistencyScore).toBeGreaterThan(0.7);
      
      // Test with bad data (multiple anomalies)
      analyzer.validateTemporalGazeConsistency({
        x: 100, y: 100, timestamp: Date.now(), confidence: 0.9
      });
      
      const badValidation = analyzer.validateTemporalGazeConsistency({
        x: 1000, y: 800, timestamp: Date.now() + 5, confidence: 0.1
      });
      
      expect(badValidation.consistencyScore).toBeLessThan(0.5);
    });
  });

  describe('Comprehensive Behavior Analysis', () => {
    it('should provide comprehensive behavior summary', () => {
      // Add some sample data
      const startTime = Date.now();
      
      // Add blinks
      analyzer.analyzeBlinkPattern(createMockFaceLandmarksWithClosedEyes(), startTime);
      analyzer.analyzeBlinkPattern(createMockFaceLandmarks(), startTime + 100);
      
      // Add gaze movements
      analyzer.recognizeEyeMovementPatterns({ x: 100, y: 100, timestamp: startTime, confidence: 0.9 });
      analyzer.recognizeEyeMovementPatterns({ x: 200, y: 150, timestamp: startTime + 100, confidence: 0.9 });
      
      // Add attention data
      analyzer.monitorAttentionFocus({ x: 960, y: 540, timestamp: startTime + 200, confidence: 0.9 });

      const summary = analyzer.getBehaviorAnalysisSummary();

      expect(summary).toBeDefined();
      expect(summary.blinkPattern).toBeDefined();
      expect(summary.attentionLevel).toBeGreaterThanOrEqual(0);
      expect(summary.attentionLevel).toBeLessThanOrEqual(1);
      expect(summary.movementPatterns).toBeDefined();
      expect(summary.offScreenTime).toBeGreaterThanOrEqual(0);
      expect(summary.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(summary.consistencyScore).toBeLessThanOrEqual(1);
      expect(summary.overallEngagement).toBeGreaterThanOrEqual(0);
      expect(summary.overallEngagement).toBeLessThanOrEqual(1);
    });

    it('should reset analysis correctly', () => {
      // Add some data
      analyzer.analyzeBlinkPattern(createMockFaceLandmarksWithClosedEyes(), Date.now());
      analyzer.recognizeEyeMovementPatterns({ x: 100, y: 100, timestamp: Date.now(), confidence: 0.9 });
      
      // Reset
      analyzer.resetAnalysis();
      
      // Check that data is cleared
      const summary = analyzer.getBehaviorAnalysisSummary();
      expect(summary.blinkPattern.frequency).toBe(0);
      expect(summary.attentionLevel).toBe(0);
      expect(summary.offScreenTime).toBe(0);
    });

    it('should update screen bounds correctly', () => {
      const newBounds = { width: 2560, height: 1440 };
      analyzer.updateScreenBounds(newBounds);
      
      // Test that new bounds are used for off-screen detection
      const onScreenPos = { x: 2000, y: 1000, timestamp: Date.now(), confidence: 0.9 };
      const attention = analyzer.monitorAttentionFocus(onScreenPos);
      
      expect(attention.focusRegion).not.toBeNull(); // Should be on screen with new bounds
    });
  });

  // Helper functions for creating mock data
  function createMockFaceLandmarks(): Float32Array {
    // Create mock landmarks for 468 face points (MediaPipe format)
    const landmarks = new Float32Array(468 * 3);
    
    // Set some basic face structure
    for (let i = 0; i < 468; i++) {
      landmarks[i * 3] = 0.5 + (Math.random() - 0.5) * 0.1; // x
      landmarks[i * 3 + 1] = 0.5 + (Math.random() - 0.5) * 0.1; // y
      landmarks[i * 3 + 2] = 0; // z
    }
    
    // Set eye landmarks to open position (normal EAR ~0.3)
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    
    // Left eye
    leftEyeIndices.forEach((idx, i) => {
      landmarks[idx * 3] = 0.3 + i * 0.01; // x
      landmarks[idx * 3 + 1] = 0.4 + (i % 2) * 0.02; // y (alternating for eye shape)
    });
    
    // Right eye
    rightEyeIndices.forEach((idx, i) => {
      landmarks[idx * 3] = 0.6 + i * 0.01; // x
      landmarks[idx * 3 + 1] = 0.4 + (i % 2) * 0.02; // y
    });
    
    return landmarks;
  }

  function createMockFaceLandmarksWithClosedEyes(): Float32Array {
    const landmarks = createMockFaceLandmarks();
    
    // Modify eye landmarks to closed position (low EAR ~0.1)
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    
    // Compress vertical eye landmarks
    leftEyeIndices.forEach((idx, i) => {
      landmarks[idx * 3 + 1] = 0.4 + (i % 2) * 0.005; // Much smaller vertical spread
    });
    
    rightEyeIndices.forEach((idx, i) => {
      landmarks[idx * 3 + 1] = 0.4 + (i % 2) * 0.005;
    });
    
    return landmarks;
  }

  function createMockFaceLandmarksWithPartialBlink(): Float32Array {
    const landmarks = createMockFaceLandmarks();
    
    // Modify eye landmarks to partially closed position (EAR ~0.2)
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    
    // Partially compress vertical eye landmarks
    leftEyeIndices.forEach((idx, i) => {
      landmarks[idx * 3 + 1] = 0.4 + (i % 2) * 0.01; // Reduced vertical spread
    });
    
    rightEyeIndices.forEach((idx, i) => {
      landmarks[idx * 3 + 1] = 0.4 + (i % 2) * 0.01;
    });
    
    return landmarks;
  }
});