/**
 * Camera module configuration
 */

import { CameraConfig } from './types';

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  constraints: {
    video: {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 30, max: 60 },
      facingMode: 'user',
    },
    audio: false,
  },
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  reconnectDelay: 2000, // 2 seconds
  maxReconnectAttempts: 5,
};

export const PERFORMANCE_CAMERA_CONFIG: CameraConfig = {
  constraints: {
    video: {
      width: { ideal: 480, max: 640 },
      height: { ideal: 360, max: 480 },
      frameRate: { ideal: 24, max: 30 },
      facingMode: 'user',
    },
    audio: false,
  },
  maxRetries: 3,
  retryDelay: 1000,
  reconnectDelay: 2000,
  maxReconnectAttempts: 5,
};