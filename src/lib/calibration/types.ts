/**
 * Calibration module type definitions
 */

export interface CalibrationPoint {
  x: number;
  y: number;
  id: string;
  completed: boolean;
  quality?: number;
}

export interface CalibrationStep {
  id: string;
  name: string;
  description: string;
  duration: number;
  points?: CalibrationPoint[];
  instructions: string[];
  completed: boolean;
}

export interface CalibrationSession {
  id: string;
  startTime: number;
  endTime?: number;
  steps: CalibrationStep[];
  currentStepIndex: number;
  overallQuality: number;
  profile?: import('../vision/types').CalibrationProfile;
  status: 'not-started' | 'in-progress' | 'completed' | 'failed';
}

export interface GazeCalibrationData {
  screenPoint: { x: number; y: number };
  gazePoint: { x: number; y: number };
  timestamp: number;
  confidence: number;
  headPose: { yaw: number; pitch: number; roll: number };
}

export interface HeadPoseCalibrationData {
  direction: 'left' | 'right' | 'up' | 'down' | 'center';
  yaw: number;
  pitch: number;
  roll: number;
  timestamp: number;
  confidence: number;
}

export interface EnvironmentCalibrationData {
  lightingHistogram: number[];
  shadowScore: number;
  timestamp: number;
  faceCount: number;
  objectCount: number;
}

export interface CalibrationQuality {
  gazeAccuracy: number; // 0-1
  headPoseRange: number; // 0-1
  environmentStability: number; // 0-1
  overall: number; // 0-1
  recommendations: string[];
}