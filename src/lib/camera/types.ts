/**
 * Camera module type definitions
 */

export interface CameraConstraints {
  video: {
    width: { ideal: number; max: number };
    height: { ideal: number; max: number };
    frameRate: { ideal: number; max: number };
    facingMode: 'user';
  };
  audio: false;
}

export interface CameraPermissionState {
  status: 'pending' | 'granted' | 'denied' | 'prompt';
  error?: MediaStreamError | null;
  retryCount: number;
  lastAttempt?: number;
}

export interface CameraStreamState {
  stream: MediaStream | null;
  isActive: boolean;
  error?: Error | null;
  reconnectAttempts: number;
  lastReconnectAttempt?: number;
}

export interface CameraConfig {
  constraints: CameraConstraints;
  maxRetries: number;
  retryDelay: number;
  reconnectDelay: number;
  maxReconnectAttempts: number;
}

export interface CameraPermissionManagerEvents {
  permissionGranted: (stream: MediaStream) => void;
  permissionDenied: (error: MediaStreamError) => void;
  permissionError: (error: Error) => void;
  retryAttempt: (attempt: number) => void;
}

export interface CameraStreamManagerEvents {
  streamStarted: (stream: MediaStream) => void;
  streamStopped: () => void;
  streamError: (error: Error) => void;
  reconnectAttempt: (attempt: number) => void;
  reconnectSuccess: (stream: MediaStream) => void;
  reconnectFailed: (error: Error) => void;
}

export interface MediaStreamError extends Error {
  name: 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | 'OverconstrainedError' | 'SecurityError' | 'TypeError' | 'AbortError';
  constraint?: string;
}