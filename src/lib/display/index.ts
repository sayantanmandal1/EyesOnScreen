/**
 * Multi-Monitor and External Display Detection System
 * 
 * This module provides comprehensive display detection and screen behavior monitoring
 * capabilities for the proctored quiz system. It detects multiple monitors, external
 * displays, TVs, projectors, virtual machine displays, and monitors screen behavior
 * including cursor tracking, window focus, screen sharing, and fullscreen enforcement.
 */

export { DisplayDetector } from './DisplayDetector';
export { ScreenBehaviorMonitor } from './ScreenBehaviorMonitor';
export { DisplayMonitoringSystem } from './DisplayMonitoringSystem';

export type {
  DisplayDetectionConfig,
  DisplayInfo,
  DisplayDetectionResult,
  ReflectionDetection,
  EyeMovementAnalysis,
  SuspiciousPattern,
  ScreenBehaviorMonitoring,
  CursorAnalysis,
  WindowFocusAnalysis,
  FocusChange,
  ScreenSharingDetection,
  FullscreenStatus,
  FullscreenViolation,
  VMDisplayDetection,
  DisplayThreat,
  DisplayEvent,
  DisplayEventHandler
} from './types';

export type { 
  DisplayMonitoringConfig,
  DisplayMonitoringResult 
} from './DisplayMonitoringSystem';