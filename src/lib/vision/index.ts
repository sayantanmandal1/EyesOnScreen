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
  DeviceDetectionResult,
  SecondaryObjectDetection,
  SecondaryObjectDetectorConfig
} from './SecondaryObjectDetector';

export { AdvancedFaceDetector } from './AdvancedFaceDetector';
export type {
  FaceLandmarks,
  FaceDetectionResult as AdvancedFaceDetectionResult,
  IdentityProfile
} from './AdvancedFaceDetector';

export { FacialAnalysisEngine, facialAnalysisEngine } from './FacialAnalysisEngine';
export type {
  MicroExpression,
  LipMovementAnalysis,
  FacialOrientation,
  PupilAnalysis,
  FacialModel3D,
  FacialAnalysisResult
} from './FacialAnalysisEngine';

export { MilitaryGradeGazeTracker } from './MilitaryGradeGazeTracker';
export type {
  SubPixelIrisData,
  CornealReflection,
  IrisQuality,
  PrecisionGazeVector,
  ScreenIntersection,
  GazeDeviationAnalysis
} from './MilitaryGradeGazeTracker';

export { EyeBehaviorAnalyzer } from './EyeBehaviorAnalyzer';
export type {
  BlinkData,
  BlinkPattern,
  EyeMovementPattern,
  AttentionFocus,
  OffScreenGazeAlert,
  TemporalGazeConsistency
} from './EyeBehaviorAnalyzer';

export { MilitaryGradeGazeSystem } from './MilitaryGradeGazeSystem';
export type {
  MilitaryGradeGazeData,
  MilitaryGradeConfig
} from './MilitaryGradeGazeSystem';

export * from './types';