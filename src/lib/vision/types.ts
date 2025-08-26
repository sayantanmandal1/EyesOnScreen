/**
 * Vision module type definitions
 */

export interface VisionSignals {
  timestamp: number;
  faceDetected: boolean;
  landmarks: Float32Array; // 468 x 3 coordinates
  headPose: {
    yaw: number;
    pitch: number; 
    roll: number;
    confidence: number;
  };
  gazeVector: {
    x: number;
    y: number;
    z: number;
    confidence: number;
  };
  eyesOnScreen: boolean;
  environmentScore: {
    lighting: number;
    shadowStability: number;
    secondaryFaces: number;
    deviceLikeObjects: number;
  };
}

export interface CalibrationProfile {
  ipd: number; // Interpupillary distance
  earBaseline: number; // Eye aspect ratio baseline
  gazeMapping: {
    homography: number[][]; // 3x3 transformation matrix
    bias: number[]; // Offset correction
  };
  headPoseBounds: {
    yawRange: [number, number];
    pitchRange: [number, number];
  };
  lightingBaseline: {
    histogram: number[];
    mean: number;
    variance: number;
  };
  quality: number; // 0-1 calibration quality score
}

export interface SignalBuffer<T> {
  data: T[];
  maxSize: number;
  push(item: T): void;
  getFiltered(): T;
  getVariance(): number;
}

export interface DecisionMatrix {
  signals: {
    gaze: { weight: number; threshold: number };
    headPose: { weight: number; threshold: number };
    environment: { weight: number; threshold: number };
    temporal: { weight: number; threshold: number };
  };
  evaluate(inputs: VisionSignals): {
    decision: boolean;
    confidence: number;
    breakdown: Record<string, number>;
  };
}

export interface PerformanceMetrics {
  fps: number;
  processingLatency: number;
  memoryUsage: number;
  cpuUsage: number;
  droppedFrames: number;
}

export class VisionError extends Error {
  public code: 'MODEL_LOAD_FAILED' | 'FACE_DETECTION_FAILED' | 'CALIBRATION_FAILED';
  public details?: Record<string, unknown>;

  constructor(message: string, options: { code: VisionError['code']; details?: Record<string, unknown> }) {
    super(message);
    this.name = 'VisionError';
    this.code = options.code;
    this.details = options.details;
  }
}

export interface MediaStreamError extends Error {
  name: 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | 'OverconstrainedError';
}