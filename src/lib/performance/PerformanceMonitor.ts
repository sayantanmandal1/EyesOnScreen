/**
 * Comprehensive performance monitoring system for the proctoring application
 * Tracks FPS, latency, memory usage, CPU estimation, and provides adaptive quality adjustment
 */

export interface PerformanceMetrics {
  fps: number;
  processingLatency: number;
  memoryUsage: number;
  cpuUsage: number;
  droppedFrames: number;
  timestamp: number;
}

export interface QualitySettings {
  resolution: 'low' | 'medium' | 'high';
  frameRate: number;
  processingInterval: number;
  enableFiltering: boolean;
  enableOptimizations: boolean;
}

export interface PerformanceThresholds {
  targetFPS: number;
  maxCPUUsage: number;
  maxMemoryUsage: number;
  maxLatency: number;
}

export interface AdaptiveQualityConfig {
  enabled: boolean;
  adjustmentInterval: number;
  performanceWindow: number;
  thresholds: PerformanceThresholds;
}

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private frameStartTime: number = 0;
  private lastFrameTime: number = 0;
  private droppedFrameCount: number = 0;
  private maxSamples: number = 120; // Track last 2 seconds at 60fps
  private memoryCheckInterval: number = 1000; // Check memory every second
  private lastMemoryCheck: number = 0;
  private cachedMemoryUsage: number = 0;
  
  private currentQuality: QualitySettings = {
    resolution: 'medium',
    frameRate: 30,
    processingInterval: 33,
    enableFiltering: true,
    enableOptimizations: false
  };
  
  private adaptiveConfig: AdaptiveQualityConfig = {
    enabled: true,
    adjustmentInterval: 5000, // Adjust every 5 seconds
    performanceWindow: 3000, // Consider last 3 seconds of performance
    thresholds: {
      targetFPS: 24,
      maxCPUUsage: 60,
      maxMemoryUsage: 300, // MB
      maxLatency: 50 // ms
    }
  };
  
  private lastAdjustment: number = 0;
  private performanceHistory: PerformanceMetrics[] = [];
  private cleanupTimer: number | null = null;
  
  constructor(config?: Partial<AdaptiveQualityConfig>) {
    if (config) {
      this.adaptiveConfig = { ...this.adaptiveConfig, ...config };
    }
    
    this.startCleanupTimer();
  }
  
  /**
   * Mark the start of frame processing
   */
  startFrame(): void {
    this.frameStartTime = performance.now();
    
    // Check for dropped frames
    if (this.lastFrameTime > 0) {
      const timeSinceLastFrame = this.frameStartTime - this.lastFrameTime;
      const expectedFrameTime = 1000 / this.currentQuality.frameRate;
      
      if (timeSinceLastFrame > expectedFrameTime * 1.5) {
        this.droppedFrameCount++;
      }
    }
    
    this.lastFrameTime = this.frameStartTime;
  }
  
  /**
   * Mark the end of frame processing and record metrics
   */
  endFrame(): void {
    const frameTime = performance.now() - this.frameStartTime;
    this.frameTimes.push(frameTime);
    
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
    
    // Record performance metrics
    const metrics: PerformanceMetrics = {
      fps: this.getFPS(),
      processingLatency: frameTime,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.estimateCPUUsage(frameTime),
      droppedFrames: this.droppedFrameCount,
      timestamp: performance.now()
    };
    
    this.performanceHistory.push(metrics);
    
    // Keep only recent history
    const cutoffTime = performance.now() - this.adaptiveConfig.performanceWindow;
    this.performanceHistory = this.performanceHistory.filter(m => m.timestamp > cutoffTime);
    
    // Check if we should adjust quality
    if (this.adaptiveConfig.enabled) {
      this.checkAndAdjustQuality();
    }
  }
  
  /**
   * Get current frames per second
   */
  getFPS(): number {
    if (this.frameTimes.length < 2) return 0;
    
    const recentFrames = this.frameTimes.slice(-30); // Last 30 frames
    const averageFrameTime = recentFrames.reduce((sum, time) => sum + time, 0) / recentFrames.length;
    
    return Math.round(1000 / averageFrameTime);
  }
  
  /**
   * Get average processing latency
   */
  getAverageLatency(): number {
    if (this.frameTimes.length === 0) return 0;
    
    const recentFrames = this.frameTimes.slice(-60); // Last 60 frames
    return recentFrames.reduce((sum, time) => sum + time, 0) / recentFrames.length;
  }
  
  /**
   * Get current memory usage in MB
   */
  getMemoryUsage(): number {
    const now = performance.now();
    
    // Cache memory checks to avoid frequent expensive calls
    if (now - this.lastMemoryCheck > this.memoryCheckInterval) {
      if ('memory' in performance) {
        const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
        this.cachedMemoryUsage = memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0;
      } else {
        // Fallback estimation based on performance degradation
        this.cachedMemoryUsage = this.estimateMemoryFromPerformance();
      }
      
      this.lastMemoryCheck = now;
    }
    
    return this.cachedMemoryUsage;
  }
  
  /**
   * Estimate CPU usage based on processing time
   */
  estimateCPUUsage(processingTime: number): number {
    const targetFrameTime = 1000 / this.adaptiveConfig.thresholds.targetFPS;
    return Math.min(100, (processingTime / targetFrameTime) * 100);
  }
  
  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return {
      fps: this.getFPS(),
      processingLatency: this.getAverageLatency(),
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.estimateCPUUsage(this.getAverageLatency()),
      droppedFrames: this.droppedFrameCount,
      timestamp: performance.now()
    };
  }
  
  /**
   * Get performance statistics over a time window
   */
  getPerformanceStats(windowMs: number = 5000): {
    average: PerformanceMetrics;
    min: PerformanceMetrics;
    max: PerformanceMetrics;
    trend: 'improving' | 'stable' | 'degrading';
  } {
    const cutoffTime = performance.now() - windowMs;
    const recentMetrics = this.performanceHistory.filter(m => m.timestamp > cutoffTime);
    
    if (recentMetrics.length === 0) {
      const current = this.getCurrentMetrics();
      return {
        average: current,
        min: current,
        max: current,
        trend: 'stable'
      };
    }
    
    const average: PerformanceMetrics = {
      fps: recentMetrics.reduce((sum, m) => sum + m.fps, 0) / recentMetrics.length,
      processingLatency: recentMetrics.reduce((sum, m) => sum + m.processingLatency, 0) / recentMetrics.length,
      memoryUsage: recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length,
      cpuUsage: recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length,
      droppedFrames: Math.max(...recentMetrics.map(m => m.droppedFrames)),
      timestamp: performance.now()
    };
    
    const min: PerformanceMetrics = {
      fps: Math.min(...recentMetrics.map(m => m.fps)),
      processingLatency: Math.min(...recentMetrics.map(m => m.processingLatency)),
      memoryUsage: Math.min(...recentMetrics.map(m => m.memoryUsage)),
      cpuUsage: Math.min(...recentMetrics.map(m => m.cpuUsage)),
      droppedFrames: Math.min(...recentMetrics.map(m => m.droppedFrames)),
      timestamp: Math.min(...recentMetrics.map(m => m.timestamp))
    };
    
    const max: PerformanceMetrics = {
      fps: Math.max(...recentMetrics.map(m => m.fps)),
      processingLatency: Math.max(...recentMetrics.map(m => m.processingLatency)),
      memoryUsage: Math.max(...recentMetrics.map(m => m.memoryUsage)),
      cpuUsage: Math.max(...recentMetrics.map(m => m.cpuUsage)),
      droppedFrames: Math.max(...recentMetrics.map(m => m.droppedFrames)),
      timestamp: Math.max(...recentMetrics.map(m => m.timestamp))
    };
    
    // Calculate trend based on FPS and latency
    const firstHalf = recentMetrics.slice(0, Math.floor(recentMetrics.length / 2));
    const secondHalf = recentMetrics.slice(Math.floor(recentMetrics.length / 2));
    
    if (firstHalf.length === 0 || secondHalf.length === 0) {
      return { average, min, max, trend: 'stable' };
    }
    
    const firstHalfAvgFPS = firstHalf.reduce((sum, m) => sum + m.fps, 0) / firstHalf.length;
    const secondHalfAvgFPS = secondHalf.reduce((sum, m) => sum + m.fps, 0) / secondHalf.length;
    
    const fpsChange = (secondHalfAvgFPS - firstHalfAvgFPS) / firstHalfAvgFPS;
    
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (fpsChange > 0.1) trend = 'improving';
    else if (fpsChange < -0.1) trend = 'degrading';
    
    return { average, min, max, trend };
  }
  
  /**
   * Get current quality settings
   */
  getCurrentQuality(): QualitySettings {
    return { ...this.currentQuality };
  }
  
  /**
   * Manually set quality settings
   */
  setQuality(quality: Partial<QualitySettings>): void {
    this.currentQuality = { ...this.currentQuality, ...quality };
  }
  
  /**
   * Check performance and adjust quality if needed
   */
  private checkAndAdjustQuality(): void {
    const now = performance.now();
    
    if (now - this.lastAdjustment < this.adaptiveConfig.adjustmentInterval) {
      return;
    }
    
    const stats = this.getPerformanceStats();
    const metrics = stats.average;
    const thresholds = this.adaptiveConfig.thresholds;
    
    let shouldDegrade = false;
    let shouldImprove = false;
    
    // Check if performance is below thresholds
    if (metrics.fps < thresholds.targetFPS * 0.8 ||
        metrics.cpuUsage > thresholds.maxCPUUsage ||
        metrics.memoryUsage > thresholds.maxMemoryUsage ||
        metrics.processingLatency > thresholds.maxLatency) {
      shouldDegrade = true;
    }
    
    // Check if performance is good enough to improve quality
    if (metrics.fps > thresholds.targetFPS * 1.2 &&
        metrics.cpuUsage < thresholds.maxCPUUsage * 0.7 &&
        metrics.memoryUsage < thresholds.maxMemoryUsage * 0.7 &&
        metrics.processingLatency < thresholds.maxLatency * 0.7) {
      shouldImprove = true;
    }
    
    if (shouldDegrade) {
      this.degradeQuality();
      this.lastAdjustment = now;
    } else if (shouldImprove && stats.trend !== 'degrading') {
      this.improveQuality();
      this.lastAdjustment = now;
    }
  }
  
  /**
   * Reduce quality settings to improve performance
   */
  private degradeQuality(): void {
    const current = this.currentQuality;
    
    if (current.resolution === 'high') {
      this.currentQuality.resolution = 'medium';
    } else if (current.resolution === 'medium') {
      this.currentQuality.resolution = 'low';
    }
    
    if (current.frameRate > 15) {
      this.currentQuality.frameRate = Math.max(15, current.frameRate - 5);
    }
    
    if (current.processingInterval < 100) {
      this.currentQuality.processingInterval = Math.min(100, current.processingInterval + 10);
    }
    
    this.currentQuality.enableFiltering = false;
    this.currentQuality.enableOptimizations = true;
    
    console.log('Performance: Quality degraded', this.currentQuality);
  }
  
  /**
   * Improve quality settings when performance allows
   */
  private improveQuality(): void {
    const current = this.currentQuality;
    
    if (current.resolution === 'low') {
      this.currentQuality.resolution = 'medium';
    } else if (current.resolution === 'medium') {
      this.currentQuality.resolution = 'high';
    }
    
    if (current.frameRate < 30) {
      this.currentQuality.frameRate = Math.min(30, current.frameRate + 5);
    }
    
    if (current.processingInterval > 33) {
      this.currentQuality.processingInterval = Math.max(33, current.processingInterval - 10);
    }
    
    this.currentQuality.enableFiltering = true;
    
    console.log('Performance: Quality improved', this.currentQuality);
  }
  
  /**
   * Estimate memory usage from performance degradation when memory API unavailable
   */
  private estimateMemoryFromPerformance(): number {
    const stats = this.getPerformanceStats(10000);
    const baseMemory = 50; // Base memory estimate
    
    // Estimate based on performance degradation
    const fpsRatio = stats.average.fps / this.adaptiveConfig.thresholds.targetFPS;
    const latencyRatio = stats.average.processingLatency / this.adaptiveConfig.thresholds.maxLatency;
    
    const estimatedMemory = baseMemory + (1 - fpsRatio) * 100 + latencyRatio * 50;
    
    return Math.max(baseMemory, Math.min(500, estimatedMemory));
  }
  
  /**
   * Start cleanup timer for old performance data
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = window.setInterval(() => {
      this.cleanup();
    }, 30000); // Cleanup every 30 seconds
  }
  
  /**
   * Clean up old performance data and reset counters
   */
  cleanup(): void {
    const cutoffTime = performance.now() - (this.adaptiveConfig.performanceWindow * 2);
    this.performanceHistory = this.performanceHistory.filter(m => m.timestamp > cutoffTime);
    
    // Reset dropped frame counter periodically
    if (this.droppedFrameCount > 1000) {
      this.droppedFrameCount = 0;
    }
    
    // Trim frame times array if it gets too large
    if (this.frameTimes.length > this.maxSamples * 2) {
      this.frameTimes = this.frameTimes.slice(-this.maxSamples);
    }
  }
  
  /**
   * Reset all performance tracking
   */
  reset(): void {
    this.frameTimes = [];
    this.frameStartTime = 0;
    this.lastFrameTime = 0;
    this.droppedFrameCount = 0;
    this.performanceHistory = [];
    this.lastAdjustment = 0;
    this.lastMemoryCheck = 0;
    this.cachedMemoryUsage = 0;
  }
  
  /**
   * Enable or disable adaptive quality adjustment
   */
  setAdaptiveQuality(enabled: boolean): void {
    this.adaptiveConfig.enabled = enabled;
  }
  
  /**
   * Update adaptive quality configuration
   */
  updateAdaptiveConfig(config: Partial<AdaptiveQualityConfig>): void {
    this.adaptiveConfig = { ...this.adaptiveConfig, ...config };
  }
  
  /**
   * Get performance recommendations based on current metrics
   */
  getRecommendations(): string[] {
    const metrics = this.getCurrentMetrics();
    const recommendations: string[] = [];
    
    if (metrics.fps < this.adaptiveConfig.thresholds.targetFPS) {
      recommendations.push('Consider reducing video resolution or frame rate');
    }
    
    if (metrics.cpuUsage > this.adaptiveConfig.thresholds.maxCPUUsage) {
      recommendations.push('High CPU usage detected - disable non-essential features');
    }
    
    if (metrics.memoryUsage > this.adaptiveConfig.thresholds.maxMemoryUsage) {
      recommendations.push('High memory usage - consider restarting the application');
    }
    
    if (metrics.processingLatency > this.adaptiveConfig.thresholds.maxLatency) {
      recommendations.push('High processing latency - reduce quality settings');
    }
    
    if (metrics.droppedFrames > 10) {
      recommendations.push('Frames are being dropped - check system resources');
    }
    
    return recommendations;
  }
  
  /**
   * Destroy the performance monitor and clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.reset();
  }
}