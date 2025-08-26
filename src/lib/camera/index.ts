/**
 * Camera module exports
 */

export { CameraPermissionManager } from './CameraPermissionManager';
export { CameraStreamManager } from './CameraStreamManager';
export { useCameraManager } from './useCameraManager';
export { DEFAULT_CAMERA_CONFIG, PERFORMANCE_CAMERA_CONFIG } from './config';
export type {
  CameraConstraints,
  CameraPermissionState,
  CameraStreamState,
  CameraConfig,
  CameraPermissionManagerEvents,
  CameraStreamManagerEvents,
  MediaStreamError,
} from './types';