/**
 * Vision module exports
 */

export { FaceDetector } from './FaceDetector';
export type { FaceDetectionResult, FaceDetectorConfig } from './FaceDetector';

export { HeadPoseEstimator } from './HeadPoseEstimator';
export type { HeadPose, HeadPoseEstimatorConfig } from './HeadPoseEstimator';

export { GazeEstimator } from './GazeEstimator';
export type { 
  GazeVector, 
  GazePoint, 
  IrisData, 
  EyeData, 
  GazeEstimatorConfig, 
  CalibrationData 
} from './GazeEstimator';

export { EnvironmentAnalyzer } from './EnvironmentAnalyzer';
export type {
  LightingAnalysis,
  ShadowAnalysis,
  EnvironmentAnalysis,
  EnvironmentAnalyzerConfig
} from './EnvironmentAnalyzer';

export { SecondaryObjectDetector } from './SecondaryObjectDetector';
export type {
  FaceDetectionResult,
  DeviceDetectionResult,
  SecondaryObjectDetection,
  SecondaryObjectDetectorConfig
} from './SecondaryObjectDetector';

export * from './types';