/**
 * Environment Scanning and Verification System
 * Main entry point for comprehensive environmental analysis
 * 
 * Requirements Implementation:
 * - 3.1: 360-degree room scanning using advanced computer vision
 * - 3.8: Surface analysis for notes and books detection
 * - 7.15: Environmental scanning for unauthorized materials
 */

export * from './types';
export * from './RoomScanner';
export * from './ObjectDetector';
export * from './SurfaceAnalyzer';
export * from './MirrorDetector';
export * from './LightingAnalyzer';

// Re-export main classes for easy access
export { RoomScanner } from './RoomScanner';
export { ObjectDetector } from './ObjectDetector';
export { SurfaceAnalyzer } from './SurfaceAnalyzer';
export { MirrorDetector } from './MirrorDetector';
export { LightingAnalyzer } from './LightingAnalyzer';

// Export type definitions
export type {
  EnvironmentScanResult,
  EnvironmentScanConfig,
  EnvironmentMonitorCallbacks,
  DetectedObject,
  RoomLayout,
  SurfaceAnalysis,
  UnauthorizedMaterial,
  MirrorReflection,
  HiddenScreen,
  EnvironmentViolation,
  ObjectType,
  EnvironmentViolationType
} from './types';