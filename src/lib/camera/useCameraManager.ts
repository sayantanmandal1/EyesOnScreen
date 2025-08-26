/**
 * Camera Manager Hook
 * Combines permission and stream management with React integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CameraPermissionManager } from './CameraPermissionManager';
import { CameraStreamManager } from './CameraStreamManager';
import { CameraConfig, CameraPermissionState, CameraStreamState } from './types';
import { DEFAULT_CAMERA_CONFIG } from './config';
import { useAppStore } from '../../store';

interface UseCameraManagerOptions {
  config?: CameraConfig;
  autoStart?: boolean;
  onPermissionGranted?: (stream: MediaStream) => void;
  onPermissionDenied?: () => void;
  onStreamError?: (error: Error) => void;
  onStreamReconnected?: (stream: MediaStream) => void;
}

interface UseCameraManagerReturn {
  // State
  permissionState: CameraPermissionState;
  streamState: CameraStreamState;
  currentStream: MediaStream | null;
  isInitializing: boolean;
  
  // Actions
  requestPermission: () => Promise<MediaStream>;
  retryPermission: () => Promise<MediaStream>;
  initializeStream: () => Promise<MediaStream>;
  reconnectStream: () => Promise<MediaStream>;
  cleanup: () => void;
  
  // Utilities
  isStreamHealthy: () => boolean;
  getPermissionErrorMessage: (error?: Error) => string;
  resetPermissionState: () => void;
}

export const useCameraManager = (options: UseCameraManagerOptions = {}): UseCameraManagerReturn => {
  const {
    config = DEFAULT_CAMERA_CONFIG,
    autoStart = false,
    onPermissionGranted,
    onPermissionDenied,
    onStreamError,
    onStreamReconnected,
  } = options;

  const { setCameraPermission, showAlert } = useAppStore();
  
  const [permissionState, setPermissionState] = useState<CameraPermissionState>({
    status: 'pending',
    error: null,
    retryCount: 0,
  });
  
  const [streamState, setStreamState] = useState<CameraStreamState>({
    stream: null,
    isActive: false,
    error: null,
    reconnectAttempts: 0,
  });
  
  const [isInitializing, setIsInitializing] = useState(false);
  
  const permissionManagerRef = useRef<CameraPermissionManager | null>(null);
  const streamManagerRef = useRef<CameraStreamManager | null>(null);

  // Initialize managers
  useEffect(() => {
    const permissionManager = new CameraPermissionManager(config);
    const streamManager = new CameraStreamManager(config, permissionManager);
    
    permissionManagerRef.current = permissionManager;
    streamManagerRef.current = streamManager;

    // Set up permission manager event listeners
    permissionManager.on('permissionGranted', (stream) => {
      setPermissionState(permissionManager.getState());
      setCameraPermission('granted');
      onPermissionGranted?.(stream);
    });

    permissionManager.on('permissionDenied', () => {
      setPermissionState(permissionManager.getState());
      setCameraPermission('denied');
      onPermissionDenied?.();
    });

    permissionManager.on('permissionError', (error) => {
      setPermissionState(permissionManager.getState());
      showAlert('soft', permissionManager.getErrorMessage(error));
    });

    permissionManager.on('retryAttempt', (attempt) => {
      setPermissionState(permissionManager.getState());
      showAlert('soft', `Retry attempt ${attempt}...`);
    });

    // Set up stream manager event listeners
    streamManager.on('streamStarted', () => {
      setStreamState(streamManager.getState());
    });

    streamManager.on('streamStopped', () => {
      setStreamState(streamManager.getState());
    });

    streamManager.on('streamError', (error) => {
      setStreamState(streamManager.getState());
      onStreamError?.(error);
      showAlert('soft', 'Camera stream error. Attempting to reconnect...');
    });

    streamManager.on('reconnectAttempt', (attempt) => {
      setStreamState(streamManager.getState());
      showAlert('soft', `Reconnecting camera... (${attempt})`);
    });

    streamManager.on('reconnectSuccess', (stream) => {
      setStreamState(streamManager.getState());
      onStreamReconnected?.(stream);
      showAlert('soft', 'Camera reconnected successfully');
    });

    streamManager.on('reconnectFailed', () => {
      setStreamState(streamManager.getState());
      showAlert('hard', 'Failed to reconnect camera. Please refresh the page.');
    });

    return () => {
      streamManager.cleanup();
    };
  }, [config, setCameraPermission, showAlert, onPermissionGranted, onPermissionDenied, onStreamError, onStreamReconnected]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && permissionManagerRef.current && streamManagerRef.current) {
      streamManagerRef.current.initializeStream().catch(console.error);
    }
  }, [autoStart]);

  const requestPermission = useCallback(async (): Promise<MediaStream> => {
    if (!permissionManagerRef.current) {
      throw new Error('Permission manager not initialized');
    }

    setIsInitializing(true);
    try {
      const stream = await permissionManagerRef.current.requestPermission();
      return stream;
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const retryPermission = useCallback(async (): Promise<MediaStream> => {
    if (!permissionManagerRef.current) {
      throw new Error('Permission manager not initialized');
    }

    setIsInitializing(true);
    try {
      const stream = await permissionManagerRef.current.retryPermission();
      return stream;
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const initializeStream = useCallback(async (): Promise<MediaStream> => {
    if (!streamManagerRef.current) {
      throw new Error('Stream manager not initialized');
    }

    setIsInitializing(true);
    try {
      const stream = await streamManagerRef.current.initializeStream();
      return stream;
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const reconnectStream = useCallback(async (): Promise<MediaStream> => {
    if (!streamManagerRef.current) {
      throw new Error('Stream manager not initialized');
    }

    const stream = await streamManagerRef.current.reconnect();
    return stream;
  }, []);

  const cleanup = useCallback(() => {
    streamManagerRef.current?.cleanup();
  }, []);

  const isStreamHealthy = useCallback((): boolean => {
    return streamManagerRef.current?.isStreamHealthy() ?? false;
  }, []);

  const getPermissionErrorMessage = useCallback((error?: Error): string => {
    return permissionManagerRef.current?.getErrorMessage(error) ?? 'Unknown error';
  }, []);

  const resetPermissionState = useCallback(() => {
    permissionManagerRef.current?.resetState();
    setPermissionState({
      status: 'pending',
      error: null,
      retryCount: 0,
    });
  }, []);

  return {
    // State
    permissionState,
    streamState,
    currentStream: streamState.stream,
    isInitializing,
    
    // Actions
    requestPermission,
    retryPermission,
    initializeStream,
    reconnectStream,
    cleanup,
    
    // Utilities
    isStreamHealthy,
    getPermissionErrorMessage,
    resetPermissionState,
  };
};