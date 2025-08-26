/**
 * Performance monitoring utilities
 */

export interface PerformanceMonitor {
  startFrame(): void;
  endFrame(): void;
  getFPS(): number;
  getAverageLatency(): number;
  getMemoryUsage(): number;
  reset(): void;
}

export class PerformanceTracker implements PerformanceMonitor {
  private frameTimes: number[] = [];
  private frameStartTime: number = 0;
  private maxSamples: number = 60; // Track last 60 frames
  
  startFrame(): void {
    this.frameStartTime = performance.now();
  }
  
  endFrame(): void {
    const frameTime = performance.now() - this.frameStartTime;
    this.frameTimes.push(frameTime);
    
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }
  
  getFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    
    const averageFrameTime = this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
    return Math.round(1000 / averageFrameTime);
  }
  
  getAverageLatency(): number {
    if (this.frameTimes.length === 0) return 0;
    
    return this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
  }
  
  getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      return memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0; // MB
    }
    return 0;
  }
  
  reset(): void {
    this.frameTimes = [];
    this.frameStartTime = 0;
  }
}

/**
 * CPU usage estimation based on frame processing time
 */
export function estimateCPUUsage(processingTime: number, targetFrameTime: number = 33.33): number {
  return Math.min(100, (processingTime / targetFrameTime) * 100);
}

/**
 * Memory pressure detection
 */
export function detectMemoryPressure(): {
  pressure: 'low' | 'medium' | 'high';
  usagePercent: number;
  recommendation: string;
} {
  const memoryUsage = new PerformanceTracker().getMemoryUsage();
  
  if (memoryUsage < 100) {
    return {
      pressure: 'low',
      usagePercent: memoryUsage,
      recommendation: 'Normal operation',
    };
  } else if (memoryUsage < 200) {
    return {
      pressure: 'medium',
      usagePercent: memoryUsage,
      recommendation: 'Consider reducing quality settings',
    };
  } else {
    return {
      pressure: 'high',
      usagePercent: memoryUsage,
      recommendation: 'Reduce quality settings or restart application',
    };
  }
}

/**
 * Adaptive quality adjustment based on performance
 */
export interface QualitySettings {
  resolution: 'low' | 'medium' | 'high';
  frameRate: number;
  processingInterval: number;
  enableFiltering: boolean;
}

export function adjustQualityForPerformance(
  currentFPS: number,
  targetFPS: number,
  currentSettings: QualitySettings
): QualitySettings {
  const fpsRatio = currentFPS / targetFPS;
  
  if (fpsRatio < 0.8) {
    // Performance is poor, reduce quality
    return {
      ...currentSettings,
      resolution: currentSettings.resolution === 'high' ? 'medium' : 'low',
      frameRate: Math.max(15, currentSettings.frameRate - 5),
      processingInterval: Math.min(100, currentSettings.processingInterval + 10),
      enableFiltering: false,
    };
  } else if (fpsRatio > 1.2 && currentSettings.resolution !== 'high') {
    // Performance is good, can increase quality
    return {
      ...currentSettings,
      resolution: currentSettings.resolution === 'low' ? 'medium' : 'high',
      frameRate: Math.min(30, currentSettings.frameRate + 5),
      processingInterval: Math.max(33, currentSettings.processingInterval - 10),
      enableFiltering: true,
    };
  }
  
  return currentSettings;
}

/**
 * Performance benchmark for system capabilities
 */
export async function runPerformanceBenchmark(): Promise<{
  score: number;
  capabilities: {
    canRunHighQuality: boolean;
    recommendedSettings: QualitySettings;
  };
}> {
  const tracker = new PerformanceTracker();
  const iterations = 100;
  
  // Simulate processing load
  for (let i = 0; i < iterations; i++) {
    tracker.startFrame();
    
    // Simulate vision processing work
    const start = performance.now();
    while (performance.now() - start < 10) {
      // Busy wait to simulate processing
      Math.random();
    }
    
    tracker.endFrame();
  }
  
  const averageFPS = tracker.getFPS();
  const averageLatency = tracker.getAverageLatency();
  const memoryUsage = tracker.getMemoryUsage();
  
  // Calculate performance score (0-100)
  const fpsScore = Math.min(100, (averageFPS / 30) * 100);
  const latencyScore = Math.max(0, 100 - (averageLatency / 50) * 100);
  const memoryScore = Math.max(0, 100 - (memoryUsage / 300) * 100);
  
  const score = (fpsScore + latencyScore + memoryScore) / 3;
  
  const canRunHighQuality = score > 70;
  const recommendedSettings: QualitySettings = {
    resolution: score > 80 ? 'high' : score > 50 ? 'medium' : 'low',
    frameRate: score > 70 ? 30 : score > 40 ? 24 : 15,
    processingInterval: score > 60 ? 33 : score > 40 ? 50 : 66,
    enableFiltering: score > 60,
  };
  
  return {
    score,
    capabilities: {
      canRunHighQuality,
      recommendedSettings,
    },
  };
}