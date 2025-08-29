/**
 * Environment Scanning and Verification Types
 * Implements comprehensive environmental analysis for anti-cheat detection
 * 
 * Requirements Implementation:
 * - 3.1: 360-degree room scanning using advanced computer vision
 * - 3.8: Surface analysis for notes and books detection
 * - 7.15: Environmental scanning for unauthorized materials
 */

export interface EnvironmentScanResult {
  timestamp: number;
  scanId: string;
  scanDuration: number;
  
  // Room analysis
  roomMapping: RoomLayout;
  objectsDetected: DetectedObject[];
  surfaceAnalysis: SurfaceAnalysis;
  
  // Security analysis
  unauthorizedMaterials: UnauthorizedMaterial[];
  mirrorReflections: MirrorReflection[];
  hiddenScreens: HiddenScreen[];
  
  // Quality metrics
  scanQuality: number;
  confidence: number;
  completeness: number;
  
  // Violations
  violations: EnvironmentViolation[];
  riskScore: number;
}

export interface RoomLayout {
  dimensions: {
    estimatedWidth: number;
    estimatedHeight: number;
    estimatedDepth: number;
  };
  walls: Wall[];
  corners: Corner[];
  surfaces: Surface[];
  lightingSources: LightSource[];
  acousticProperties: AcousticProperties;
}

export interface DetectedObject {
  id: string;
  type: ObjectType;
  confidence: number;
  boundingBox: BoundingBox;
  position3D: Position3D;
  classification: ObjectClassification;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface SurfaceAnalysis {
  surfaces: AnalyzedSurface[];
  textDetection: TextDetection[];
  writingMaterials: WritingMaterial[];
  books: BookDetection[];
  notes: NoteDetection[];
  whiteboards: WhiteboardDetection[];
}

export interface UnauthorizedMaterial {
  id: string;
  type: 'notes' | 'books' | 'papers' | 'cheat-sheet' | 'reference-material' | 'electronic-device';
  confidence: number;
  location: Position3D;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  evidence: string; // Base64 encoded image
}

export interface MirrorReflection {
  id: string;
  mirrorLocation: Position3D;
  reflectedContent: ReflectedContent[];
  confidence: number;
  riskAssessment: string;
}

export interface HiddenScreen {
  id: string;
  detectionMethod: 'reflection' | 'glow' | 'eye-tracking' | 'electromagnetic';
  estimatedLocation: Position3D;
  confidence: number;
  screenType: 'monitor' | 'tv' | 'tablet' | 'phone' | 'projector' | 'unknown';
  evidence: string;
}

export interface EnvironmentViolation {
  id: string;
  type: EnvironmentViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  location?: Position3D;
  evidence: string[];
  timestamp: number;
  autoBlock: boolean;
}

export type ObjectType = 
  | 'person' | 'face' | 'phone' | 'tablet' | 'laptop' | 'monitor' | 'tv'
  | 'book' | 'paper' | 'notebook' | 'pen' | 'pencil' | 'calculator'
  | 'mirror' | 'window' | 'door' | 'furniture' | 'wall' | 'ceiling'
  | 'light' | 'camera' | 'microphone' | 'speaker' | 'headphones'
  | 'smartwatch' | 'glasses' | 'unknown';

export type EnvironmentViolationType =
  | 'multiple-persons' | 'unauthorized-materials' | 'hidden-screens'
  | 'mirror-reflections' | 'electronic-devices' | 'reference-materials'
  | 'suspicious-objects' | 'environmental-tampering' | 'lighting-manipulation';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
  confidence: number;
}

export interface Wall {
  id: string;
  points: Position3D[];
  normal: Vector3D;
  area: number;
  materials: string[];
}

export interface Corner {
  id: string;
  position: Position3D;
  angle: number;
  type: 'convex' | 'concave';
}

export interface Surface {
  id: string;
  type: 'wall' | 'floor' | 'ceiling' | 'table' | 'desk' | 'shelf';
  area: number;
  orientation: Vector3D;
  material: string;
  reflectivity: number;
}

export interface LightSource {
  id: string;
  type: 'natural' | 'artificial' | 'screen' | 'unknown';
  position: Position3D;
  intensity: number;
  color: RGB;
  direction?: Vector3D;
}

export interface AcousticProperties {
  reverberation: number;
  roomSize: 'small' | 'medium' | 'large' | 'very-large';
  echoDelay: number;
  backgroundNoise: number;
}

export interface AnalyzedSurface {
  id: string;
  type: string;
  area: number;
  textPresent: boolean;
  writingDetected: boolean;
  reflectivity: number;
  suspiciousContent: boolean;
}

export interface TextDetection {
  id: string;
  text: string;
  confidence: number;
  location: BoundingBox;
  language: string;
  isHandwritten: boolean;
  riskLevel: number;
}

export interface WritingMaterial {
  id: string;
  type: 'pen' | 'pencil' | 'marker' | 'chalk' | 'stylus';
  location: Position3D;
  confidence: number;
  inUse: boolean;
}

export interface BookDetection {
  id: string;
  title?: string;
  type: 'textbook' | 'reference' | 'notebook' | 'manual' | 'unknown';
  isOpen: boolean;
  pageContent?: string;
  riskLevel: number;
  confidence: number;
}

export interface NoteDetection {
  id: string;
  type: 'handwritten' | 'printed' | 'sticky-note' | 'digital';
  content?: string;
  location: Position3D;
  riskLevel: number;
  confidence: number;
}

export interface WhiteboardDetection {
  id: string;
  hasContent: boolean;
  content?: string;
  location: Position3D;
  size: { width: number; height: number };
  riskLevel: number;
}

export interface ReflectedContent {
  type: 'screen' | 'person' | 'text' | 'object';
  description: string;
  confidence: number;
  riskLevel: number;
}

export interface ObjectClassification {
  category: string;
  subcategory: string;
  isAuthorized: boolean;
  riskLevel: number;
  description: string;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface EnvironmentScanConfig {
  scanDuration: number; // 30 seconds minimum
  frameRate: number; // 30 FPS
  objectDetectionThreshold: number;
  textDetectionEnabled: boolean;
  mirrorDetectionEnabled: boolean;
  hiddenScreenDetection: boolean;
  acousticAnalysis: boolean;
  
  // Detection sensitivities
  personDetectionSensitivity: number;
  deviceDetectionSensitivity: number;
  materialDetectionSensitivity: number;
  
  // Risk thresholds
  autoBlockThreshold: number;
  reviewThreshold: number;
  warningThreshold: number;
}

export interface EnvironmentMonitorCallbacks {
  onScanProgress?: (progress: number) => void;
  onObjectDetected?: (object: DetectedObject) => void;
  onViolationDetected?: (violation: EnvironmentViolation) => void;
  onScanComplete?: (result: EnvironmentScanResult) => void;
  onError?: (error: Error) => void;
}