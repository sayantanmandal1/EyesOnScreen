/**
 * Display detection and monitoring type definitions
 */

export interface DisplayDetectionConfig {
  monitoring: {
    enabled: boolean;
    intervalMs: number;
    reflectionAnalysis: boolean;
    eyeMovementCorrelation: boolean;
  };
  detection: {
    multipleMonitors: boolean;
    externalDisplays: boolean;
    tvProjectors: boolean;
    virtualMachineDisplays: boolean;
  };
  thresholds: {
    reflectionConfidence: number;
    eyeMovementCorrelation: number;
    displayChangeDetection: number;
  };
}

export interface DisplayInfo {
  id: string;
  isPrimary: boolean;
  width: number;
  height: number;
  colorDepth: number;
  pixelRatio: number;
  orientation: number;
  refreshRate?: number;
  type: 'internal' | 'external' | 'tv' | 'projector' | 'virtual' | 'unknown';
  connectionType?: 'hdmi' | 'displayport' | 'vga' | 'usb-c' | 'wireless' | 'unknown';
}

export interface DisplayDetectionResult {
  displays: DisplayInfo[];
  multipleDisplaysDetected: boolean;
  externalDisplaysDetected: boolean;
  tvProjectorDetected: boolean;
  virtualDisplayDetected: boolean;
  reflectionBasedScreens: ReflectionDetection[];
  eyeMovementCorrelation: EyeMovementAnalysis;
  confidence: number;
  timestamp: number;
}

export interface ReflectionDetection {
  screenId: string;
  confidence: number;
  location: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  reflectionType: 'monitor' | 'tv' | 'mobile' | 'tablet' | 'unknown';
  brightness: number;
  colorProfile: number[];
}

export interface EyeMovementAnalysis {
  correlationScore: number;
  suspiciousPatterns: SuspiciousPattern[];
  offScreenGazeDetected: boolean;
  externalScreenInteraction: boolean;
  confidence: number;
}

export interface SuspiciousPattern {
  type: 'rapid_shifts' | 'consistent_off_screen' | 'dual_focus' | 'reading_pattern';
  confidence: number;
  duration: number;
  frequency: number;
  details: Record<string, unknown>;
}

export interface ScreenBehaviorMonitoring {
  cursorTracking: CursorAnalysis;
  windowFocus: WindowFocusAnalysis;
  screenSharing: ScreenSharingDetection;
  fullscreenEnforcement: FullscreenStatus;
  virtualMachineDisplay: VMDisplayDetection;
}

export interface CursorAnalysis {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  outsideViewport: boolean;
  suspiciousMovement: boolean;
  automatedBehavior: boolean;
  confidence: number;
}

export interface WindowFocusAnalysis {
  currentWindow: string;
  focusChanges: FocusChange[];
  applicationSwitching: boolean;
  suspiciousApplications: string[];
  backgroundActivity: boolean;
}

export interface FocusChange {
  timestamp: number;
  fromWindow: string;
  toWindow: string;
  duration: number;
  suspicious: boolean;
}

export interface ScreenSharingDetection {
  isScreenSharing: boolean;
  remoteDesktopDetected: boolean;
  screenCastingDetected: boolean;
  collaborationToolsDetected: string[];
  confidence: number;
}

export interface FullscreenStatus {
  isFullscreen: boolean;
  enforcementActive: boolean;
  bypassAttempts: number;
  lastBypassAttempt?: number;
  violations: FullscreenViolation[];
}

export interface FullscreenViolation {
  timestamp: number;
  type: 'exit_attempt' | 'key_combination' | 'alt_tab' | 'window_switch';
  blocked: boolean;
  method: string;
}

export interface VMDisplayDetection {
  isVirtualDisplay: boolean;
  vmSoftware: string[];
  displayDrivers: string[];
  resolutionAnomalies: boolean;
  refreshRateAnomalies: boolean;
  confidence: number;
}

export interface DisplayThreat {
  id: string;
  type: 'multiple_displays' | 'external_display' | 'tv_projector' | 
        'reflection_screen' | 'vm_display' | 'screen_sharing' | 
        'focus_violation' | 'fullscreen_bypass';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, unknown>;
  timestamp: number;
  resolved: boolean;
}

export interface DisplayEvent {
  type: 'display_change' | 'threat_detected' | 'threat_resolved' | 
        'fullscreen_violation' | 'focus_change';
  data: DisplayDetectionResult | DisplayThreat | FullscreenViolation | FocusChange;
  timestamp: number;
}

export type DisplayEventHandler = (event: DisplayEvent) => void;