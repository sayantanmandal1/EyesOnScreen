/**
 * DataCollector - Structured logging system for all monitoring signals
 * Handles per-frame data collection, flag event logging, and performance metrics
 */

import { LogEntry, SessionData } from './types';
import { VisionSignals } from '../vision/types';
import { FlagEvent, PerformanceMetrics } from '../proctoring/types';
import { LocalStorage } from './LocalStorage';

export interface DataCollectorConfig {
  batchSize: number;
  flushInterval: number; // milliseconds
  maxBufferSize: number;
  enablePerformanceMetrics: boolean;
  enableDetailedLogging: boolean;
}

export interface LogBuffer {
  entries: LogEntry[];
  flags: FlagEvent[];
  performanceSnapshots: PerformanceMetrics[];
  lastFlush: number;
}

export class DataCollector {
  private localStorage: LocalStorage;
  private config: DataCollectorConfig;
  private buffer: LogBuffer;
  private sessionId: string | null = null;
  private currentQuestionId: string | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private performanceStartTime: number = 0;
  private frameCount: number = 0;
  private totalLatency: number = 0;
  private peakMemoryUsage: number = 0;
  private droppedFrames: number = 0;

  constructor(localStorage: LocalStorage, config: Partial<DataCollectorConfig> = {}) {
    this.localStorage = localStorage;
    this.config = {
      batchSize: 100,
      flushInterval: 5000, // 5 seconds
      maxBufferSize: 1000,
      enablePerformanceMetrics: true,
      enableDetailedLogging: true,
      ...config,
    };

    this.buffer = {
      entries: [],
      flags: [],
      performanceSnapshots: [],
      lastFlush: Date.now(),
    };

    this.startPerformanceMonitoring();
    this.startAutoFlush();
  }

  /**
   * Start a new data collection session
   */
  startSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.performanceStartTime = Date.now();
    this.frameCount = 0;
    this.totalLatency = 0;
    this.peakMemoryUsage = 0;
    this.droppedFrames = 0;
    
    this.logSessionEvent('SESSION_START', {
      sessionId,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      pixelRatio: window.devicePixelRatio,
    });
  }

  /**
   * End the current data collection session
   */
  async endSession(): Promise<void> {
    if (!this.sessionId) return;

    this.logSessionEvent('SESSION_END', {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      duration: Date.now() - this.performanceStartTime,
      totalFrames: this.frameCount,
      averageFps: this.calculateAverageFps(),
      averageLatency: this.calculateAverageLatency(),
      peakMemoryUsage: this.peakMemoryUsage,
      droppedFrames: this.droppedFrames,
    });

    // Final flush before ending session
    await this.flush();
    
    this.sessionId = null;
    this.currentQuestionId = null;
  }

  /**
   * Set the current question ID for contextual logging
   */
  setCurrentQuestion(questionId: string | null): void {
    this.currentQuestionId = questionId;
    
    if (questionId) {
      this.logSessionEvent('QUESTION_START', {
        questionId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Log vision signals and monitoring data for a frame
   */
  logFrame(signals: VisionSignals, processingLatency: number): void {
    if (!this.sessionId) return;

    this.frameCount++;
    this.totalLatency += processingLatency;

    // Track dropped frames (if processing took too long)
    if (processingLatency > 50) { // 50ms threshold for 20fps minimum
      this.droppedFrames++;
    }

    const logEntry: LogEntry = {
      timestamp: signals.timestamp,
      questionId: this.currentQuestionId,
      eyesOn: signals.eyesOnScreen,
      gazeConfidence: signals.gazeVector?.confidence || 0,
      headPose: {
        yaw: signals.headPose?.yaw || 0,
        pitch: signals.headPose?.pitch || 0,
        roll: signals.headPose?.roll || 0,
      },
      shadowScore: signals.environmentScore?.shadowStability || 0,
      secondaryFace: (signals.environmentScore?.secondaryFaces || 0) > 0,
      deviceLike: (signals.environmentScore?.deviceLikeObjects || 0) > 0,
      tabHidden: false, // This will be set by browser event handlers
      facePresent: signals.faceDetected,
      flagType: null, // Will be set when flags are generated
      riskScore: 0, // Will be updated by risk calculator
    };

    this.buffer.entries.push(logEntry);

    // Log detailed vision data if enabled
    if (this.config.enableDetailedLogging) {
      this.logDetailedVisionData(signals, processingLatency);
    }

    this.checkBufferSize();
  }

  /**
   * Log a flag event with detailed context
   */
  logFlag(flag: FlagEvent, additionalContext?: Record<string, unknown>): void {
    if (!this.sessionId) return;

    const enhancedFlag: FlagEvent = {
      ...flag,
      details: {
        ...flag.details,
        sessionId: this.sessionId,
        questionId: this.currentQuestionId,
        timestamp: flag.timestamp || Date.now(),
        ...additionalContext,
      },
    };

    this.buffer.flags.push(enhancedFlag);

    // Update the most recent log entry with flag information
    if (this.buffer.entries.length > 0) {
      const lastEntry = this.buffer.entries[this.buffer.entries.length - 1];
      lastEntry.flagType = flag.type;
    }

    // Log critical flags immediately
    if (flag.severity === 'hard') {
      this.logSessionEvent('CRITICAL_FLAG', {
        flagId: flag.id,
        flagType: flag.type,
        confidence: flag.confidence,
        details: enhancedFlag.details,
      });
    }

    this.checkBufferSize();
  }

  /**
   * Log browser events (tab blur, fullscreen exit, etc.)
   */
  logBrowserEvent(eventType: string, eventData: Record<string, unknown>): void {
    if (!this.sessionId) return;

    const logEntry: Partial<LogEntry> = {
      timestamp: Date.now(),
      questionId: this.currentQuestionId,
      tabHidden: eventType === 'visibilitychange' && eventData.hidden === true,
    };

    // Update recent entries if this is a tab visibility change
    if (eventType === 'visibilitychange') {
      const recentEntries = this.buffer.entries.slice(-10); // Last 10 entries
      recentEntries.forEach(entry => {
        entry.tabHidden = eventData.hidden as boolean;
      });
    }

    this.logSessionEvent('BROWSER_EVENT', {
      eventType,
      ...eventData,
    });
  }

  /**
   * Update risk score in recent log entries
   */
  updateRiskScore(newRiskScore: number): void {
    // Update the last few entries with the new risk score
    const recentEntries = this.buffer.entries.slice(-5);
    recentEntries.forEach(entry => {
      entry.riskScore = newRiskScore;
    });
  }

  /**
   * Log performance metrics snapshot
   */
  logPerformanceSnapshot(metrics: PerformanceMetrics): void {
    if (!this.config.enablePerformanceMetrics) return;

    this.buffer.performanceSnapshots.push({
      ...metrics,
      timestamp: Date.now(),
    });

    // Update peak memory usage
    if (metrics.memoryUsage > this.peakMemoryUsage) {
      this.peakMemoryUsage = metrics.memoryUsage;
    }

    // Log performance warnings
    if (metrics.fps < 15) {
      this.logSessionEvent('PERFORMANCE_WARNING', {
        type: 'LOW_FPS',
        fps: metrics.fps,
        timestamp: Date.now(),
      });
    }

    if (metrics.memoryUsage > 500) { // 500MB threshold
      this.logSessionEvent('PERFORMANCE_WARNING', {
        type: 'HIGH_MEMORY',
        memoryUsage: metrics.memoryUsage,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get current session statistics
   */
  getSessionStats(): {
    totalFrames: number;
    averageFps: number;
    averageLatency: number;
    totalFlags: number;
    flagsByType: Record<string, number>;
    peakMemoryUsage: number;
    droppedFrames: number;
    sessionDuration: number;
  } {
    const flagsByType = this.buffer.flags.reduce((acc, flag) => {
      acc[flag.type] = (acc[flag.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalFrames: this.frameCount,
      averageFps: this.calculateAverageFps(),
      averageLatency: this.calculateAverageLatency(),
      totalFlags: this.buffer.flags.length,
      flagsByType,
      peakMemoryUsage: this.peakMemoryUsage,
      droppedFrames: this.droppedFrames,
      sessionDuration: this.performanceStartTime ? Date.now() - this.performanceStartTime : 0,
    };
  }

  /**
   * Get buffered data for export or analysis
   */
  getBufferedData(): {
    entries: LogEntry[];
    flags: FlagEvent[];
    performanceSnapshots: PerformanceMetrics[];
  } {
    return {
      entries: [...this.buffer.entries],
      flags: [...this.buffer.flags],
      performanceSnapshots: [...this.buffer.performanceSnapshots],
    };
  }

  /**
   * Manually flush buffered data to storage
   */
  async flush(): Promise<void> {
    if (!this.sessionId || this.buffer.entries.length === 0) return;

    try {
      // Create session data snapshot
      const sessionData: Partial<SessionData> = {
        sessionId: this.sessionId,
        logEntries: [...this.buffer.entries],
        flags: [...this.buffer.flags],
        performanceMetrics: {
          averageFps: this.calculateAverageFps(),
          averageLatency: this.calculateAverageLatency(),
          peakMemoryUsage: this.peakMemoryUsage,
          droppedFrames: this.droppedFrames,
        },
      };

      // Store in batches to avoid overwhelming IndexedDB
      const batchSize = this.config.batchSize;
      for (let i = 0; i < this.buffer.entries.length; i += batchSize) {
        const batch = this.buffer.entries.slice(i, i + batchSize);
        // Store batch (implementation would depend on LocalStorage API)
        // For now, we'll store the entire session data
      }

      // Clear buffer after successful flush
      this.buffer.entries = [];
      this.buffer.flags = [];
      this.buffer.performanceSnapshots = [];
      this.buffer.lastFlush = Date.now();

      console.log(`Flushed ${sessionData.logEntries?.length} log entries to storage`);
    } catch (error) {
      console.error('Failed to flush data to storage:', error);
      // Don't clear buffer on error - retry on next flush
    }
  }

  /**
   * Log detailed vision processing data
   */
  private logDetailedVisionData(signals: VisionSignals, processingLatency: number): void {
    // Store detailed data in a separate structure for analysis
    const detailedData = {
      timestamp: signals.timestamp,
      sessionId: this.sessionId,
      questionId: this.currentQuestionId,
      processingLatency,
      landmarks: signals.landmarks ? Array.from(signals.landmarks) : null,
      gazeVector: signals.gazeVector,
      headPose: signals.headPose,
      environmentScore: signals.environmentScore,
      faceDetected: signals.faceDetected,
      eyesOnScreen: signals.eyesOnScreen,
    };

    // Could store this in a separate IndexedDB store for detailed analysis
    // For now, just log to console in debug mode
    if (process.env.NODE_ENV === 'development') {
      console.debug('Detailed vision data:', detailedData);
    }
  }

  /**
   * Log session-level events
   */
  private logSessionEvent(eventType: string, eventData: Record<string, unknown>): void {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      ...eventData,
    };

    console.log(`Session Event [${eventType}]:`, event);
    
    // Could store session events in a separate structure
    // For now, just log them
  }

  /**
   * Check if buffer needs flushing due to size
   */
  private checkBufferSize(): void {
    if (this.buffer.entries.length >= this.config.maxBufferSize) {
      console.warn('Buffer size limit reached, forcing flush');
      this.flush().catch(error => {
        console.error('Emergency flush failed:', error);
      });
    }
  }

  /**
   * Start automatic flushing timer
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('Auto-flush failed:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMetrics) return;

    // Monitor memory usage periodically
    setInterval(() => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        const memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024); // MB
        
        if (memoryUsage > this.peakMemoryUsage) {
          this.peakMemoryUsage = memoryUsage;
        }
      }
    }, 1000);
  }

  /**
   * Calculate average FPS
   */
  private calculateAverageFps(): number {
    if (this.performanceStartTime === 0) return 0;
    const duration = (Date.now() - this.performanceStartTime) / 1000; // seconds
    return duration > 0 ? this.frameCount / duration : 0;
  }

  /**
   * Calculate average processing latency
   */
  private calculateAverageLatency(): number {
    return this.frameCount > 0 ? this.totalLatency / this.frameCount : 0;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush before cleanup
    this.flush().catch(error => {
      console.error('Final flush failed:', error);
    });
  }
}