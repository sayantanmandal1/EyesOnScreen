/**
 * Proctoring module type definitions
 */

import { VisionSignals } from '../vision/types';

export interface ProctorConfig {
  thresholds: {
    gazeConfidence: number; // 0.7
    headYawMax: number; // 20 degrees
    headPitchMax: number; // 15 degrees
    shadowScoreMax: number; // 0.6
    eyesOffDurationMs: number; // 600ms
    shadowAnomalyDurationMs: number; // 800ms
  };
  debouncing: {
    softAlertFrames: number; // 8-12 frames
    hardAlertFrames: number; // 5 frames
    gracePeriodMs: number; // 500ms
  };
  riskScoring: {
    eyesOffPerSecond: number; // +3 points
    hardEventBonus: number; // +25 points
    decayPerSecond: number; // -1 point
    reviewThreshold: number; // 60 points
  };
}

export interface FlagEvent {
  id: string;
  timestamp: number;
  endTimestamp?: number;
  type: 'EYES_OFF' | 'HEAD_POSE' | 'TAB_BLUR' | 'SECOND_FACE' | 
        'DEVICE_OBJECT' | 'SHADOW_ANOMALY' | 'FACE_MISSING' | 'DOWN_GLANCE' |
        'INTEGRITY_VIOLATION' | 'FULLSCREEN_EXIT';
  severity: 'soft' | 'hard';
  confidence: number;
  details: Record<string, unknown>;
  questionId?: string;
}

export interface AlertConfig {
  type: 'soft' | 'hard';
  message: string;
  duration?: number;
  sound?: boolean;
  modal?: boolean;
}

export interface RiskScoreConfig {
  weights: {
    eyesOff: number;
    headPose: number;
    tabBlur: number;
    secondFace: number;
    deviceObject: number;
    shadowAnomaly: number;
    faceMissing: number;
    downGlance: number;
  };
  decayRate: number;
  maxScore: number;
  reviewThreshold: number;
}

export interface PerformanceMetrics {
  fps: number;
  processingLatency: number;
  memoryUsage: number;
  cpuUsage?: number;
  droppedFrames?: number;
  timestamp: number;
}

export interface PerformanceSnapshot {
  fps: number;
  processingLatency: number;
  memoryUsage: number;
  timestamp: number;
}

export interface MonitoringState {
  isActive: boolean;
  currentSignals: VisionSignals | null;
  activeFlags: FlagEvent[];
  riskScore: number;
  performanceMetrics: {
    fps: number;
    latency: number;
    memoryUsage: number;
  };
}