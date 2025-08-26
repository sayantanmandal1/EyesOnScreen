/**
 * Camera Stream Manager
 * Handles video stream initialization, cleanup, and reconnection logic
 */

import { CameraStreamState, CameraStreamManagerEvents, CameraConfig } from './types';
import { CameraPermissionManager } from './CameraPermissionManager';

export class CameraStreamManager {
  private state: CameraStreamState = {
    stream: null,
    isActive: false,
    error: null,
    reconnectAttempts: 0,
  };

  private config: CameraConfig;
  private permissionManager: CameraPermissionManager;
  private eventListeners: Partial<CameraStreamManagerEvents> = {};
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: CameraConfig, permissionManager: CameraPermissionManager) {
    this.config = config;
    this.permissionManager = permissionManager;
  }

  /**
   * Initialize video stream
   */
  async initializeStream(): Promise<MediaStream> {
    try {
      // Clean up any existing stream
      this.cleanup();

      // Request camera permission and get stream
      const stream = await this.permissionManager.requestPermission();
      
      this.state.stream = stream;
      this.state.isActive = true;
      this.state.error = null;
      this.state.reconnectAttempts = 0;

      // Set up stream event listeners
      this.setupStreamEventListeners(stream);

      this.eventListeners.streamStarted?.(stream);
      return stream;

    } catch (error) {
      this.state.error = error as Error;
      this.state.isActive = false;
      this.eventListeners.streamError?.(error as Error);
      throw error;
    }
  }

  /**
   * Stop and cleanup video stream
   */
  cleanup(): void {
    if (this.state.stream) {
      // Stop all tracks
      this.state.stream.getTracks().forEach(track => {
        track.stop();
      });

      this.state.stream = null;
    }

    this.state.isActive = false;
    this.clearReconnectTimer();
    this.eventListeners.streamStopped?.();
  }

  /**
   * Attempt to reconnect stream after error
   */
  async reconnect(): Promise<MediaStream> {
    if (this.state.reconnectAttempts >= this.config.maxReconnectAttempts) {
      const error = new Error(`Maximum reconnect attempts (${this.config.maxReconnectAttempts}) exceeded`);
      this.eventListeners.reconnectFailed?.(error);
      throw error;
    }

    this.state.reconnectAttempts++;
    this.eventListeners.reconnectAttempt?.(this.state.reconnectAttempts);

    try {
      // Wait before reconnecting
      await this.sleep(this.config.reconnectDelay);

      // Reset permission manager state for fresh attempt
      this.permissionManager.resetState();

      // Try to initialize stream again
      const stream = await this.initializeStream();
      
      this.eventListeners.reconnectSuccess?.(stream);
      return stream;

    } catch (error) {
      this.state.lastReconnectAttempt = Date.now();
      
      // Schedule another reconnect attempt if we haven't exceeded max attempts
      if (this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else {
        this.eventListeners.reconnectFailed?.(error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Get current stream state
   */
  getState(): CameraStreamState {
    return { ...this.state };
  }

  /**
   * Get current stream if active
   */
  getCurrentStream(): MediaStream | null {
    return this.state.isActive ? this.state.stream : null;
  }

  /**
   * Check if stream is active and healthy
   */
  isStreamHealthy(): boolean {
    if (!this.state.stream || !this.state.isActive) {
      return false;
    }

    // Check if all tracks are still active
    const tracks = this.state.stream.getTracks();
    return tracks.length > 0 && tracks.every(track => track.readyState === 'live');
  }

  /**
   * Add event listener
   */
  on<K extends keyof CameraStreamManagerEvents>(
    event: K,
    listener: CameraStreamManagerEvents[K]
  ): void {
    this.eventListeners[event] = listener;
  }

  /**
   * Remove event listener
   */
  off<K extends keyof CameraStreamManagerEvents>(event: K): void {
    delete this.eventListeners[event];
  }

  /**
   * Reset reconnect attempts counter
   */
  resetReconnectAttempts(): void {
    this.state.reconnectAttempts = 0;
  }

  private setupStreamEventListeners(stream: MediaStream): void {
    const tracks = stream.getTracks();
    
    tracks.forEach(track => {
      track.addEventListener('ended', () => {
        this.handleStreamEnded();
      });

      track.addEventListener('mute', () => {
        this.handleStreamMuted();
      });
    });
  }

  private handleStreamEnded(): void {
    this.state.isActive = false;
    this.state.error = new Error('Camera stream ended unexpectedly');
    this.eventListeners.streamError?.(this.state.error);
    
    // Attempt automatic reconnection
    this.scheduleReconnect();
  }

  private handleStreamMuted(): void {
    // Stream was muted (possibly by system or user)
    // This might be temporary, so we'll monitor and potentially reconnect
    setTimeout(() => {
      if (!this.isStreamHealthy()) {
        this.handleStreamEnded();
      }
    }, 1000);
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnect().catch(() => {
        // Error already handled in reconnect method
      });
    }, this.config.reconnectDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}