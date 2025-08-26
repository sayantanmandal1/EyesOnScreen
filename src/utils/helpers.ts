/**
 * Utility helper functions
 */

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format timestamp to readable string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Calculate time difference in seconds
 */
export function getTimeDifferenceSeconds(start: number, end: number): number {
  return Math.round((end - start) / 1000);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Convert degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate Euclidean distance between two points
 */
export function calculateDistance(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate angle between two vectors
 */
export function calculateAngle(
  vector1: { x: number; y: number },
  vector2: { x: number; y: number }
): number {
  const dot = vector1.x * vector2.x + vector1.y * vector2.y;
  const mag1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
  const mag2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);
  return Math.acos(dot / (mag1 * mag2));
}

/**
 * Normalize a vector
 */
export function normalizeVector(vector: { x: number; y: number; z?: number }): typeof vector {
  const magnitude = Math.sqrt(
    vector.x * vector.x + 
    vector.y * vector.y + 
    (vector.z ? vector.z * vector.z : 0)
  );
  
  if (magnitude === 0) return vector;
  
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    ...(vector.z !== undefined && { z: vector.z / magnitude }),
  };
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

/**
 * Exponential moving average
 */
export function exponentialMovingAverage(
  current: number,
  previous: number,
  alpha: number
): number {
  return alpha * current + (1 - alpha) * previous;
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
  const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

/**
 * Check if browser supports required features
 */
export function checkBrowserSupport(): {
  supported: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  
  if (!navigator.mediaDevices?.getUserMedia) {
    missing.push('getUserMedia');
  }
  
  if (!window.indexedDB) {
    missing.push('IndexedDB');
  }
  
  if (!document.fullscreenEnabled) {
    missing.push('Fullscreen API');
  }
  
  if (!window.AudioContext && !(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) {
    missing.push('Web Audio API');
  }
  
  return {
    supported: missing.length === 0,
    missing,
  };
}

/**
 * Get device information
 */
export function getDeviceInfo(): {
  userAgent: string;
  platform: string;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
} {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;
  
  return {
    userAgent,
    platform,
    isMobile,
    isTablet,
    isDesktop,
  };
}