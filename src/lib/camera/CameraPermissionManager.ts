/**
 * Camera Permission Manager
 * Handles camera permission requests, state tracking, and error handling
 */

import { CameraPermissionState, CameraPermissionManagerEvents, CameraConfig, MediaStreamError } from './types';

export class CameraPermissionManager {
  private state: CameraPermissionState = {
    status: 'pending',
    error: null,
    retryCount: 0,
  };

  private config: CameraConfig;
  private eventListeners: Partial<CameraPermissionManagerEvents> = {};

  constructor(config: CameraConfig) {
    this.config = config;
  }

  /**
   * Request camera permission and return stream if granted
   */
  async requestPermission(): Promise<MediaStream> {
    this.state.lastAttempt = Date.now();
    
    try {
      // Check if permission is already granted
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permission.state === 'denied') {
          this.handlePermissionDenied(new Error('Camera permission denied by user') as MediaStreamError);
          throw new Error('Camera permission denied');
        }
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia(this.config.constraints);
      
      this.handlePermissionGranted(stream);
      return stream;
      
    } catch (error) {
      this.handlePermissionError(error as MediaStreamError);
      throw error;
    }
  }

  /**
   * Retry permission request with exponential backoff
   */
  async retryPermission(): Promise<MediaStream> {
    if (this.state.retryCount >= this.config.maxRetries) {
      throw new Error(`Maximum retry attempts (${this.config.maxRetries}) exceeded`);
    }

    this.state.retryCount++;
    this.eventListeners.retryAttempt?.(this.state.retryCount);

    // Exponential backoff delay
    const delay = this.config.retryDelay * Math.pow(2, this.state.retryCount - 1);
    await this.sleep(delay);

    return this.requestPermission();
  }

  /**
   * Check current permission state without requesting
   */
  async checkPermissionState(): Promise<PermissionState> {
    if (!navigator.permissions) {
      return 'prompt';
    }

    try {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return permission.state;
    } catch {
      return 'prompt';
    }
  }

  /**
   * Reset permission state for new attempt
   */
  resetState(): void {
    this.state = {
      status: 'pending',
      error: null,
      retryCount: 0,
    };
  }

  /**
   * Get current permission state
   */
  getState(): CameraPermissionState {
    return { ...this.state };
  }

  /**
   * Add event listener
   */
  on<K extends keyof CameraPermissionManagerEvents>(
    event: K,
    listener: CameraPermissionManagerEvents[K]
  ): void {
    this.eventListeners[event] = listener;
  }

  /**
   * Remove event listener
   */
  off<K extends keyof CameraPermissionManagerEvents>(event: K): void {
    delete this.eventListeners[event];
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error?: Error): string {
    if (!error) return 'Unknown camera error';

    switch ((error as MediaStreamError).name) {
      case 'NotAllowedError':
        return 'Camera access was denied. Please allow camera access and try again.';
      case 'NotFoundError':
        return 'No camera found. Please connect a camera and try again.';
      case 'NotReadableError':
        return 'Camera is already in use by another application. Please close other applications and try again.';
      case 'OverconstrainedError':
        return 'Camera does not support the required settings. Please try with a different camera.';
      case 'SecurityError':
        return 'Camera access blocked due to security restrictions. Please ensure you are using HTTPS.';
      case 'AbortError':
        return 'Camera access was aborted. Please try again.';
      default:
        return `Camera error: ${error.message}`;
    }
  }

  /**
   * Check if error is recoverable
   */
  isRecoverableError(error: Error): boolean {
    return ['NotReadableError', 'AbortError'].includes((error as MediaStreamError).name);
  }

  private handlePermissionGranted(stream: MediaStream): void {
    this.state.status = 'granted';
    this.state.error = null;
    this.eventListeners.permissionGranted?.(stream);
  }

  private handlePermissionDenied(error: MediaStreamError): void {
    this.state.status = 'denied';
    this.state.error = error;
    this.eventListeners.permissionDenied?.(error);
  }

  private handlePermissionError(error: MediaStreamError): void {
    this.state.error = error;
    
    if ((error as MediaStreamError).name === 'NotAllowedError') {
      this.state.status = 'denied';
      this.eventListeners.permissionDenied?.(error);
    } else {
      this.eventListeners.permissionError?.(error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Request permission with result object (for test compatibility)
   */
  async requestPermissionWithResult(): Promise<{ granted: boolean; stream?: MediaStream; error?: Error }> {
    try {
      const stream = await this.requestPermission();
      return { granted: true, stream };
    } catch (error) {
      return { granted: false, error: error as Error };
    }
  }
}