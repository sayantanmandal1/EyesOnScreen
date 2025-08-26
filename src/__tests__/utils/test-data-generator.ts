/**
 * Test data generation utilities for consistent testing
 */

import { VisionSignals, FlagEvent, CalibrationProfile } from '../../store/types';
import { Question } from '../../lib/quiz/types';

export class TestDataGenerator {
  private static instance: TestDataGenerator;
  private seedValue: number = 12345;

  static getInstance(): TestDataGenerator {
    if (!TestDataGenerator.instance) {
      TestDataGenerator.instance = new TestDataGenerator();
    }
    return TestDataGenerator.instance;
  }

  // Seeded random number generator for consistent test data
  private seededRandom(): number {
    this.seedValue = (this.seedValue * 9301 + 49297) % 233280;
    return this.seedValue / 233280;
  }

  setSeed(seed: number): void {
    this.seedValue = seed;
  }

  // Generate realistic face landmarks
  generateFaceLandmarks(options: {
    facePresent?: boolean;
    headPose?: { yaw: number; pitch: number; roll: number };
    eyesClosed?: boolean;
  } = {}): Float32Array {
    const landmarks = new Float32Array(468 * 3);
    
    if (!options.facePresent) {
      return landmarks; // Return zeros for no face
    }

    const centerX = 320;
    const centerY = 240;
    const faceWidth = 150;
    const faceHeight = 200;

    // Apply head pose transformations
    const yaw = (options.headPose?.yaw || 0) * Math.PI / 180;
    const pitch = (options.headPose?.pitch || 0) * Math.PI / 180;
    const roll = (options.headPose?.roll || 0) * Math.PI / 180;

    for (let i = 0; i < 468; i++) {
      // Generate base landmark positions (simplified face model)
      let x, y, z;

      if (i < 17) {
        // Face outline
        const angle = (i / 16) * Math.PI;
        x = centerX + Math.cos(angle) * faceWidth * 0.8;
        y = centerY + Math.sin(angle) * faceHeight * 0.6;
        z = this.seededRandom() * 5;
      } else if (i < 68) {
        // Eye region landmarks
        const isLeftEye = i < 42;
        const eyeCenterX = centerX + (isLeftEye ? -40 : 40);
        const eyeCenterY = centerY - 20;
        
        if (options.eyesClosed) {
          y = eyeCenterY; // Closed eyes
        } else {
          y = eyeCenterY + (this.seededRandom() - 0.5) * 10;
        }
        
        x = eyeCenterX + (this.seededRandom() - 0.5) * 30;
        z = this.seededRandom() * 3;
      } else {
        // Other facial features
        x = centerX + (this.seededRandom() - 0.5) * faceWidth;
        y = centerY + (this.seededRandom() - 0.5) * faceHeight;
        z = this.seededRandom() * 8;
      }

      // Apply head pose transformations
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      const rotatedX = (x - centerX) * cosYaw - z * sinYaw + centerX;
      const rotatedY = (y - centerY) * cosPitch - z * sinPitch + centerY;
      const rotatedZ = (x - centerX) * sinYaw + z * cosYaw;

      landmarks[i * 3] = rotatedX;
      landmarks[i * 3 + 1] = rotatedY;
      landmarks[i * 3 + 2] = rotatedZ;
    }

    return landmarks;
  }

  // Generate vision signals
  generateVisionSignals(options: {
    faceDetected?: boolean;
    eyesOnScreen?: boolean;
    headPose?: { yaw: number; pitch: number; roll: number };
    gazeDirection?: { x: number; y: number };
    environmentIssues?: boolean;
    timestamp?: number;
  } = {}): VisionSignals {
    const headPose = options.headPose || { yaw: 0, pitch: 0, roll: 0 };
    const gazeDirection = options.gazeDirection || { x: 0, y: 0 };

    return {
      timestamp: options.timestamp || Date.now(),
      faceDetected: options.faceDetected !== false,
      landmarks: this.generateFaceLandmarks({
        facePresent: options.faceDetected !== false,
        headPose
      }),
      headPose: {
        ...headPose,
        confidence: options.faceDetected !== false ? 0.8 + this.seededRandom() * 0.2 : 0
      },
      gazeVector: {
        x: gazeDirection.x,
        y: gazeDirection.y,
        z: -1,
        confidence: options.eyesOnScreen !== false ? 0.7 + this.seededRandom() * 0.3 : 0.3
      },
      eyesOnScreen: options.eyesOnScreen !== false,
      environmentScore: {
        lighting: options.environmentIssues ? 0.3 + this.seededRandom() * 0.3 : 0.7 + this.seededRandom() * 0.3,
        shadowStability: options.environmentIssues ? 0.2 + this.seededRandom() * 0.4 : 0.8 + this.seededRandom() * 0.2,
        secondaryFaces: options.environmentIssues && this.seededRandom() > 0.7 ? 1 : 0,
        deviceLikeObjects: options.environmentIssues && this.seededRandom() > 0.8 ? 1 : 0
      }
    };
  }

  // Generate flag events
  generateFlagEvent(options: {
    type?: FlagEvent['type'];
    severity?: FlagEvent['severity'];
    timestamp?: number;
    questionId?: string;
  } = {}): FlagEvent {
    const types: FlagEvent['type'][] = [
      'EYES_OFF', 'HEAD_POSE', 'TAB_BLUR', 'SECOND_FACE', 
      'DEVICE_OBJECT', 'SHADOW_ANOMALY', 'FACE_MISSING', 'DOWN_GLANCE'
    ];

    return {
      id: `flag-${Date.now()}-${Math.floor(this.seededRandom() * 1000)}`,
      timestamp: options.timestamp || Date.now(),
      type: options.type || types[Math.floor(this.seededRandom() * types.length)],
      severity: options.severity || (this.seededRandom() > 0.5 ? 'soft' : 'hard'),
      confidence: 0.5 + this.seededRandom() * 0.5,
      details: {
        duration: Math.floor(this.seededRandom() * 5000),
        threshold: this.seededRandom()
      },
      questionId: options.questionId
    };
  }

  // Generate calibration profile
  generateCalibrationProfile(options: {
    quality?: number;
    timestamp?: number;
  } = {}): CalibrationProfile {
    return {
      ipd: 60 + this.seededRandom() * 10, // 60-70mm
      earBaseline: 0.25 + this.seededRandom() * 0.1, // 0.25-0.35
      gazeMapping: {
        homography: [
          [1 + (this.seededRandom() - 0.5) * 0.1, (this.seededRandom() - 0.5) * 0.05, this.seededRandom() * 10],
          [(this.seededRandom() - 0.5) * 0.05, 1 + (this.seededRandom() - 0.5) * 0.1, this.seededRandom() * 10],
          [0, 0, 1]
        ],
        bias: [(this.seededRandom() - 0.5) * 5, (this.seededRandom() - 0.5) * 5]
      },
      headPoseBounds: {
        yawRange: [-15 - this.seededRandom() * 10, 15 + this.seededRandom() * 10],
        pitchRange: [-10 - this.seededRandom() * 5, 10 + this.seededRandom() * 5]
      },
      lightingBaseline: {
        histogram: Array.from({ length: 256 }, (_, i) => {
          // Generate realistic histogram with peak around 128
          const distance = Math.abs(i - 128);
          return Math.max(0, 100 - distance * 2 + (this.seededRandom() - 0.5) * 20);
        }),
        mean: 120 + this.seededRandom() * 16,
        variance: 8 + this.seededRandom() * 8
      },
      quality: options.quality || (0.7 + this.seededRandom() * 0.3),
      timestamp: options.timestamp || Date.now()
    };
  }

  // Generate quiz questions
  generateQuestions(count: number = 10): Question[] {
    const questions: Question[] = [];
    
    for (let i = 0; i < count; i++) {
      const isMultipleChoice = i < count * 0.7; // 70% multiple choice
      
      if (isMultipleChoice) {
        questions.push({
          id: `q${i + 1}`,
          type: 'multiple-choice',
          text: `Question ${i + 1}: What is ${2 + i} + ${3 + i}?`,
          options: [
            `${4 + i}`,
            `${5 + i}`,
            `${6 + i}`,
            `${7 + i}`
          ],
          correctAnswer: `${5 + i}`,
          timeLimitSeconds: 20 + Math.floor(this.seededRandom() * 20),
          points: 1
        });
      } else {
        questions.push({
          id: `q${i + 1}`,
          type: 'short-answer',
          text: `Question ${i + 1}: Explain the concept of ${['recursion', 'polymorphism', 'encapsulation'][i % 3]}.`,
          correctAnswer: 'Sample answer',
          timeLimitSeconds: 60 + Math.floor(this.seededRandom() * 60),
          points: 2
        });
      }
    }
    
    return questions;
  }

  // Generate log entries for testing
  generateLogEntries(count: number = 1000, options: {
    timeSpan?: number; // milliseconds
    questionCount?: number;
    flagProbability?: number;
  } = {}): any[] {
    const timeSpan = options.timeSpan || 600000; // 10 minutes default
    const questionCount = options.questionCount || 10;
    const flagProbability = options.flagProbability || 0.1;
    
    const logs = [];
    const startTime = Date.now() - timeSpan;
    
    for (let i = 0; i < count; i++) {
      const timestamp = startTime + (i / count) * timeSpan;
      const questionIndex = Math.floor((i / count) * questionCount);
      
      logs.push({
        timestamp,
        questionId: questionIndex < questionCount ? `q${questionIndex + 1}` : null,
        eyesOn: this.seededRandom() > 0.15, // 85% eyes on screen
        gazeConfidence: 0.5 + this.seededRandom() * 0.5,
        headPose: {
          yaw: (this.seededRandom() - 0.5) * 30,
          pitch: (this.seededRandom() - 0.5) * 20,
          roll: (this.seededRandom() - 0.5) * 10
        },
        shadowScore: this.seededRandom(),
        secondaryFace: this.seededRandom() > 0.95,
        deviceLike: this.seededRandom() > 0.98,
        tabHidden: this.seededRandom() > 0.99,
        facePresent: this.seededRandom() > 0.05,
        flagType: this.seededRandom() < flagProbability ? 'EYES_OFF' : null,
        riskScore: Math.min(100, Math.max(0, 20 + (this.seededRandom() - 0.5) * 40))
      });
    }
    
    return logs;
  }

  // Generate performance test data
  generatePerformanceTestData(complexity: 'light' | 'medium' | 'heavy' = 'medium') {
    const sizes = {
      light: { signals: 100, landmarks: 100 },
      medium: { signals: 1000, landmarks: 468 },
      heavy: { signals: 10000, landmarks: 468 }
    };
    
    const config = sizes[complexity];
    const signals = [];
    
    for (let i = 0; i < config.signals; i++) {
      signals.push(this.generateVisionSignals({
        timestamp: Date.now() + i * 33, // 30 FPS
        faceDetected: this.seededRandom() > 0.05,
        eyesOnScreen: this.seededRandom() > 0.1,
        headPose: {
          yaw: (this.seededRandom() - 0.5) * 20,
          pitch: (this.seededRandom() - 0.5) * 15,
          roll: (this.seededRandom() - 0.5) * 5
        }
      }));
    }
    
    return signals;
  }

  // Generate synthetic video frame data
  generateVideoFrameData(width: number = 640, height: number = 480): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < data.length; i += 4) {
      // Generate realistic face-like patterns
      const x = (i / 4) % width;
      const y = Math.floor((i / 4) / width);
      
      // Create a simple face-like pattern
      const centerX = width / 2;
      const centerY = height / 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      let intensity = 128;
      if (distance < 100) {
        // Face region - skin tone
        intensity = 180 + (this.seededRandom() - 0.5) * 40;
      } else if (distance < 150) {
        // Hair region
        intensity = 60 + (this.seededRandom() - 0.5) * 40;
      } else {
        // Background
        intensity = 200 + (this.seededRandom() - 0.5) * 20;
      }
      
      data[i] = intensity;     // R
      data[i + 1] = intensity; // G
      data[i + 2] = intensity; // B
      data[i + 3] = 255;       // A
    }
    
    return new ImageData(data, width, height);
  }

  // Reset to initial state
  reset(): void {
    this.seedValue = 12345;
  }
}

// Export singleton instance
export const testDataGenerator = TestDataGenerator.getInstance();