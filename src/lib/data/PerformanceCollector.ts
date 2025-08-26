/**
 * PerformanceCollector - Specialized collector for performance metrics
 * Monitors FPS, memory usage, CPU usage, and processing latencies
 */

import { PerformanceMetrics } from '../proctoring/types';

export interface PerformanceSnapshot extends PerformanceMetrics {
  timestamp: number;
  cpuUsageEstimate: number;
  memoryPressure: 'low' | 'medium' | 'high';
  thermalState?: 'nominal' | 'fair' | 'serious' | 'critical';
}

export interface PerformanceThresholds {
  minFps: number;
  maxLatency: number;
  maxMemoryUsage: number;
  maxCpuUsage: number;
}

export class PerformanceCollector {
  private metrics: PerformanceSnapshot[] = [];
  private frameTimestamps: number[] = [];
  private processingTimes: number[] = [];
  private lastFrameTime: number = 0;
  private thresholds: PerformanceThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private performanceObserver: PerformanceObserver | null = null;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = {
      minFps: 15,
      maxLatency: 100, // ms
      maxMemoryUsage: 300, // MB
      maxCpuUsage: 70, // %
      ...thresholds,
    };

    this.initializePerformanceObserver();
    this.startMonitoring();
  }

  /**
   * Record a frame processing cycle
   */
  recordFrame(processingLatency: number): void {
    const now = performance.now();
    
    // Record frame timestamp
    this.frameTimestamps.push(now);
    this.processingTimes.push(processingLatency);
    
    // Keep only recent data (last 60 frames for FPS calculation)
    if (this.frameTimestamps.length > 60) {
      this.frameTimestamps.shift();
      this.processingTimes.shift();
    }

    this.lastFrameTime = now;
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return {
      fps: this.calculateFPS(),
      processingLatency: this.calculateAverageLatency(),
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.estimateCPUUsage(),
      droppedFrames: this.calculateDroppedFrames(),
      timestamp: Date.now(),
    };
  }

  /**
   * Get detailed performance snapshot
   */
  getDetailedSnapshot(): PerformanceSnapshot {
    const basicMetrics = this.getCurrentMetrics();
    
    return {
      ...basicMetrics,
      cpuUsageEstimate: this.estimateCPUUsage(),
      memoryPressure: this.assessMemoryPressure(),
      thermalState: this.getThermalState(),
    };
  }

  /**
   * Check if performance is within acceptable thresholds
   */
  isPerformanceAcceptable(): {
    acceptable: boolean;
    issues: string[];
    metrics: PerformanceMetrics;
  } {
    const metrics = this.getCurrentMetrics();
    const issues: string[] = [];

    if (metrics.fps < this.thresholds.minFps) {
      issues.push(`Low FPS: ${metrics.fps.toFixed(1)} < ${this.thresholds.minFps}`);
    }

    if (metrics.processingLatency > this.thresholds.maxLatency) {
      issues.push(`High latency: ${metrics.processingLatency.toFixed(1)}ms > ${this.thresholds.maxLatency}ms`);
    }

    if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      issues.push(`High memory usage: ${metrics.memoryUsage.toFixed(1)}MB > ${this.thresholds.maxMemoryUsage}MB`);
    }

    if (metrics.cpuUsage > this.thresholds.maxCpuUsage) {
      issues.push(`High CPU usage: ${metrics.cpuUsage.toFixed(1)}% > ${this.thresholds.maxCpuUsage}%`);
    }

    return {
      acceptable: issues.length === 0,
      issues,
      metrics,
    };
  }

  /**
   * Get performance trend over time
   */
  getPerformanceTrend(windowSize: number = 10): {
    fps: { trend: 'improving' | 'stable' | 'degrading'; change: number };
    latency: { trend: 'improving' | 'stable' | 'degrading'; change: number };
    memory: { trend: 'improving' | 'stable' | 'degrading'; change: number };
  } {
    if (this.metrics.length < windowSize) {
      return {
        fps: { trend: 'stable', change: 0 },
        latency: { trend: 'stable', change: 0 },
        memory: { trend: 'stable', change: 0 },
      };
    }

    const recent = this.metrics.slice(-windowSize);
    const older = this.metrics.slice(-windowSize * 2, -windowSize);

    const recentAvg = {
      fps: recent.reduce((sum, m) => sum + m.fps, 0) / recent.length,
      latency: recent.reduce((sum, m) => sum + m.processingLatency, 0) / recent.length,
      memory: recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length,
    };

    const olderAvg = {
      fps: older.reduce((sum, m) => sum + m.fps, 0) / older.length,
      latency: older.reduce((sum, m) => sum + m.processingLatency, 0) / older.length,
      memory: older.reduce((sum, m) => sum + m.memoryUsage, 0) / older.length,
    };

    return {
      fps: {
        trend: this.getTrend(recentAvg.fps, olderAvg.fps, true),
        change: recentAvg.fps - olderAvg.fps,
      },
      latency: {
        trend: this.getTrend(recentAvg.latency, olderAvg.latency, false),
        change: recentAvg.latency - olderAvg.latency,
      },
      memory: {
        trend: this.getTrend(recentAvg.memory, olderAvg.memory, false),
        change: recentAvg.memory - olderAvg.memory,
      },
    };
  }

  /**
   * Get performance recommendations based on current metrics
   */
  getPerformanceRecommendations(): string[] {
    const metrics = this.getCurrentMetrics();
    const recommendations: string[] = [];

    if (metrics.fps < 20) {
      recommendations.push('Consider reducing video resolution or processing frequency');
    }

    if (metrics.processingLatency > 80) {
      recommendations.push('Enable frame skipping or reduce processing complexity');
    }

    if (metrics.memoryUsage > 250) {
      recommendations.push('Clear old data buffers and optimize memory usage');
    }

    if (metrics.droppedFrames > 10) {
      recommendations.push('Increase processing timeout or reduce frame rate');
    }

    const memoryPressure = this.assessMemoryPressure();
    if (memoryPressure === 'high') {
      recommendations.push('Force garbage collection and reduce buffer sizes');
    }

    return recommendations;
  }

  /**
   * Calculate current FPS based on recent frame timestamps
   */
  private calculateFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;

    const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
    const frameCount = this.frameTimestamps.length - 1;
    
    return timeSpan > 0 ? (frameCount * 1000) / timeSpan : 0;
  }

  /**
   * Calculate average processing latency
   */
  private calculateAverageLatency(): number {
    if (this.processingTimes.length === 0) return 0;
    
    return this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return memInfo.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * Estimate CPU usage based on processing times and frame rates
   */
  private estimateCPUUsage(): number {
    if (this.processingTimes.length === 0) return 0;

    const avgProcessingTime = this.calculateAverageLatency();
    const fps = this.calculateFPS();
    
    // Rough estimation: processing time * fps gives us the fraction of time spent processing
    const processingFraction = (avgProcessingTime * fps) / 1000;
    
    // Convert to percentage and cap at 100%
    return Math.min(processingFraction * 100, 100);
  }

  /**
   * Calculate number of dropped frames
   */
  private calculateDroppedFrames(): number {
    return this.processingTimes.filter(time => time > 50).length; // Frames taking >50ms
  }

  /**
   * Assess memory pressure level
   */
  private assessMemoryPressure(): 'low' | 'medium' | 'high' {
    const memoryUsage = this.getMemoryUsage();
    
    if (memoryUsage < 100) return 'low';
    if (memoryUsage < 200) return 'medium';
    return 'high';
  }

  /**
   * Get thermal state if available
   */
  private getThermalState(): 'nominal' | 'fair' | 'serious' | 'critical' | undefined {
    // This would use the Web Thermal API if available
    // For now, return undefined as it's not widely supported
    return undefined;
  }

  /**
   * Determine trend direction
   */
  private getTrend(recent: number, older: number, higherIsBetter: boolean): 'improving' | 'stable' | 'degrading' {
    const threshold = 0.05; // 5% change threshold
    const change = (recent - older) / older;

    if (Math.abs(change) < threshold) return 'stable';
    
    if (higherIsBetter) {
      return change > 0 ? 'improving' : 'degrading';
    } else {
      return change < 0 ? 'improving' : 'degrading';
    }
  }

  /**
   * Initialize Performance Observer for detailed metrics
   */
  private initializePerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        for (const entry of entries) {
          if (entry.entryType === 'measure' && entry.name.startsWith('vision-processing')) {
            this.recordFrame(entry.duration);
          }
        }
      });

      this.performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      console.warn('Failed to initialize PerformanceObserver:', error);
    }
  }

  /**
   * Start periodic monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const snapshot = this.getDetailedSnapshot();
      this.metrics.push(snapshot);

      // Keep only recent metrics (last 100 snapshots)
      if (this.metrics.length > 100) {
        this.metrics.shift();
      }
    }, 1000); // Collect metrics every second
  }

  /**
   * Stop monitoring and clean up
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
  }
}