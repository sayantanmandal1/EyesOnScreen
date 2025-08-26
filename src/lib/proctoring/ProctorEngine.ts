/**
 * ProctorEngine - Main monitoring orchestrator
 * 
 * Manages the real-time monitoring loop, frame processing pipeline,
 * and coordinates all proctoring subsystems.
 */

import { VisionSignals, PerformanceMetrics } from '../vision/types';
import { ProctorConfig, FlagEvent, MonitoringState } from './types';
import { FaceDetector } from '../vision/FaceDetector';
import { GazeEstimator } from '../vision/GazeEstimator';
import { HeadPoseEstimator } from '../vision/HeadPoseEstimator';
import { EnvironmentAnalyzer } from '../vision/EnvironmentAnalyzer';

export class ProctorEngine {
  private isRunning = false;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private targetFps = 30;
  private adaptiveFps = true;
  
  // Vision components
  private faceDetector: FaceDetector;
  private gazeEstimator: GazeEstimator;
  private headPoseEstimator: HeadPoseEstimator;
  private environmentAnalyzer: EnvironmentAnalyzer;
  
  // Performance monitoring
  private performanceMetrics: PerformanceMetrics = {
    fps: 0,
    processingLatency: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    droppedFrames: 0
  };
  
  private frameTimeBuffer: number[] = [];
  private processingTimeBuffer: number[] = [];
  private readonly bufferSize = 30; // Track last 30 frames for metrics
  
  // Callbacks
  private onSignalsUpdate?: (signals: VisionSignals) => void;
  private onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
  private onError?: (error: Error) => void;

  constructor(
    private config: ProctorConfig,
    private videoElement: HTMLVideoElement
  ) {
    this.faceDetector = new FaceDetector();
    this.gazeEstimator = new GazeEstimator();
    this.headPoseEstimator = new HeadPoseEstimator();
    this.environmentAnalyzer = new EnvironmentAnalyzer();
  }

  /**
   * Initialize the proctoring engine
   */
  async initialize(): Promise<void> {
    try {
      // Initialize all vision components
      await Promise.all([
        this.faceDetector.initialize(),
        this.gazeEstimator.initialize(),
        this.headPoseEstimator.initialize(),
        this.environmentAnalyzer.initialize()
      ]);
    } catch (error) {
      this.handleError(new Error(`Failed to initialize ProctorEngine: ${error}`));
      throw error;
    }
  }

  /**
   * Start the monitoring loop
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.resetPerformanceBuffers();
    
    this.monitoringLoop();
  }

  /**
   * Stop the monitoring loop
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Set callbacks for engine events
   */
  setCallbacks(callbacks: {
    onSignalsUpdate?: (signals: VisionSignals) => void;
    onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
    onError?: (error: Error) => void;
  }): void {
    this.onSignalsUpdate = callbacks.onSignalsUpdate;
    this.onPerformanceUpdate = callbacks.onPerformanceUpdate;
    this.onError = callbacks.onError;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProctorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set target FPS
   */
  setTargetFps(fps: number): void {
    this.targetFps = Math.max(15, Math.min(60, fps));
  }

  /**
   * Enable/disable adaptive FPS
   */
  setAdaptiveFps(enabled: boolean): void {
    this.adaptiveFps = enabled;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Main monitoring loop
   */
  private monitoringLoop = (): void => {
    if (!this.isRunning) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    const targetFrameTime = 1000 / this.targetFps;

    // Frame rate control
    if (deltaTime < targetFrameTime) {
      this.animationFrameId = requestAnimationFrame(this.monitoringLoop);
      return;
    }

    this.processFrame(currentTime)
      .then(() => {
        this.updatePerformanceMetrics(currentTime, deltaTime);
        this.lastFrameTime = currentTime;
        this.frameCount++;
        
        // Schedule next frame
        this.animationFrameId = requestAnimationFrame(this.monitoringLoop);
      })
      .catch((error) => {
        this.handleError(error);
        // Continue monitoring even after errors
        this.animationFrameId = requestAnimationFrame(this.monitoringLoop);
      });
  };

  /**
   * Process a single frame
   */
  private async processFrame(timestamp: number): Promise<void> {
    const processingStartTime = performance.now();

    try {
      // Check if video is ready
      if (this.videoElement.readyState < 2) {
        return;
      }

      // Create canvas for frame processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      canvas.width = this.videoElement.videoWidth;
      canvas.height = this.videoElement.videoHeight;
      ctx.drawImage(this.videoElement, 0, 0);

      // Process frame through vision pipeline
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Face detection
      const faceResults = await this.faceDetector.detectFace(imageData);
      
      let signals: VisionSignals = {
        timestamp,
        faceDetected: faceResults.detected,
        landmarks: faceResults.landmarks || new Float32Array(),
        headPose: {
          yaw: 0,
          pitch: 0,
          roll: 0,
          confidence: 0
        },
        gazeVector: {
          x: 0,
          y: 0,
          z: 0,
          confidence: 0
        },
        eyesOnScreen: false,
        environmentScore: {
          lighting: 0,
          shadowStability: 0,
          secondaryFaces: 0,
          deviceLikeObjects: 0
        }
      };

      // Only proceed with other analyses if face is detected
      if (faceResults.detected && faceResults.landmarks) {
        // Head pose estimation
        const headPose = await this.headPoseEstimator.estimateHeadPose(faceResults.landmarks);
        signals.headPose = headPose;

        // Gaze estimation
        const gazeResult = await this.gazeEstimator.estimateGaze(faceResults.landmarks, headPose);
        signals.gazeVector = gazeResult.gazeVector;
        signals.eyesOnScreen = gazeResult.eyesOnScreen;

        // Environment analysis
        const envScore = await this.environmentAnalyzer.analyzeFrame(imageData);
        signals.environmentScore = envScore;
      }

      // Record processing time
      const processingTime = performance.now() - processingStartTime;
      this.processingTimeBuffer.push(processingTime);
      if (this.processingTimeBuffer.length > this.bufferSize) {
        this.processingTimeBuffer.shift();
      }

      // Emit signals
      if (this.onSignalsUpdate) {
        this.onSignalsUpdate(signals);
      }

    } catch (error) {
      throw new Error(`Frame processing failed: ${error}`);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(currentTime: number, deltaTime: number): void {
    // Update frame time buffer
    this.frameTimeBuffer.push(deltaTime);
    if (this.frameTimeBuffer.length > this.bufferSize) {
      this.frameTimeBuffer.shift();
    }

    // Calculate FPS
    const avgFrameTime = this.frameTimeBuffer.reduce((a, b) => a + b, 0) / this.frameTimeBuffer.length;
    this.performanceMetrics.fps = 1000 / avgFrameTime;

    // Calculate processing latency
    if (this.processingTimeBuffer.length > 0) {
      this.performanceMetrics.processingLatency = 
        this.processingTimeBuffer.reduce((a, b) => a + b, 0) / this.processingTimeBuffer.length;
    }

    // Estimate memory usage (rough approximation)
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.performanceMetrics.memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024); // MB
    }

    // Adaptive FPS adjustment
    if (this.adaptiveFps) {
      this.adjustFrameRate();
    }

    // Emit performance update every 30 frames
    if (this.frameCount % 30 === 0 && this.onPerformanceUpdate) {
      this.onPerformanceUpdate({ ...this.performanceMetrics });
    }
  }

  /**
   * Adjust frame rate based on performance
   */
  private adjustFrameRate(): void {
    if (!this.adaptiveFps) {
      return;
    }

    const avgProcessingTime = this.processingTimeBuffer.length > 0 
      ? this.processingTimeBuffer.reduce((a, b) => a + b, 0) / this.processingTimeBuffer.length
      : 0;

    const targetFrameTime = 1000 / this.targetFps;
    const processingRatio = avgProcessingTime / targetFrameTime;

    // If processing takes more than 60% of frame time, reduce FPS
    if (processingRatio > 0.6 && this.targetFps > 15) {
      this.targetFps = Math.max(15, this.targetFps - 2);
    }
    // If processing is efficient, try to increase FPS
    else if (processingRatio < 0.3 && this.targetFps < 60) {
      this.targetFps = Math.min(60, this.targetFps + 1);
    }
  }

  /**
   * Reset performance tracking buffers
   */
  private resetPerformanceBuffers(): void {
    this.frameTimeBuffer = [];
    this.processingTimeBuffer = [];
    this.performanceMetrics = {
      fps: 0,
      processingLatency: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      droppedFrames: 0
    };
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('ProctorEngine error:', error);
    
    if (this.onError) {
      this.onError(error);
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    
    // Dispose vision components
    this.faceDetector.dispose?.();
    this.gazeEstimator.dispose?.();
    this.headPoseEstimator.dispose?.();
    this.environmentAnalyzer.dispose?.();
  }
}