/**
 * Comprehensive error handling system for the proctoring application
 * Handles camera errors, vision processing errors, performance issues, and network errors
 */

export interface ErrorContext {
  timestamp: number;
  component: string;
  operation: string;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, unknown>;
}

export interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'degrade' | 'notify' | 'abort';
  maxAttempts?: number;
  delay?: number;
  fallbackAction?: () => Promise<void>;
  userMessage?: string;
}

export interface CameraError extends Error {
  name: 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | 'OverconstrainedError' | 'AbortError' | 'TypeError';
  constraint?: string;
}

export interface VisionError extends Error {
  name: 'ModelLoadError' | 'ProcessingError' | 'CalibrationError' | 'DetectionError';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

export interface NetworkError extends Error {
  name: 'NetworkError' | 'TimeoutError' | 'AuthError' | 'ServerError';
  status?: number;
  endpoint?: string;
}

export interface PerformanceError extends Error {
  name: 'PerformanceError';
  metric: 'fps' | 'memory' | 'cpu' | 'latency';
  currentValue: number;
  threshold: number;
}

export type ApplicationError = CameraError | VisionError | NetworkError | PerformanceError | Error;

export interface ErrorHandler {
  handleCameraError(error: CameraError, context: ErrorContext): Promise<ErrorRecoveryStrategy>;
  handleVisionError(error: VisionError, context: ErrorContext): Promise<ErrorRecoveryStrategy>;
  handleNetworkError(error: NetworkError, context: ErrorContext): Promise<ErrorRecoveryStrategy>;
  handlePerformanceError(error: PerformanceError, context: ErrorContext): Promise<ErrorRecoveryStrategy>;
  handleGenericError(error: Error, context: ErrorContext): Promise<ErrorRecoveryStrategy>;
}

export class RobustErrorHandler implements ErrorHandler {
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;
  private errorLog: Array<{ error: ApplicationError; context: ErrorContext; timestamp: number }> = [];
  private recoveryCallbacks = new Map<string, () => Promise<void>>();
  private userNotificationCallback?: (message: string, type: 'info' | 'warning' | 'error') => void;
  
  constructor(
    maxRetries: number = 3,
    userNotificationCallback?: (message: string, type: 'info' | 'warning' | 'error') => void
  ) {
    this.maxRetries = maxRetries;
    this.userNotificationCallback = userNotificationCallback;
  }
  
  /**
   * Handle camera-related errors with appropriate recovery strategies
   */
  async handleCameraError(error: CameraError, context: ErrorContext): Promise<ErrorRecoveryStrategy> {
    this.logError(error, context);
    
    const errorKey = `camera_${error.name}_${context.component}`;
    const attempts = this.getRetryAttempts(errorKey);
    
    switch (error.name) {
      case 'NotAllowedError':
        return {
          type: 'notify',
          userMessage: 'Camera permission is required for proctoring. Please allow camera access and refresh the page.'
        };
        
      case 'NotFoundError':
        return {
          type: 'notify',
          userMessage: 'No camera found. Please connect a camera and refresh the page.'
        };
        
      case 'NotReadableError':
        if (attempts < this.maxRetries) {
          this.incrementRetryAttempts(errorKey);
          return {
            type: 'retry',
            maxAttempts: this.maxRetries,
            delay: 2000 * Math.pow(2, attempts), // Exponential backoff
            userMessage: 'Camera connection issue. Retrying...'
          };
        } else {
          return {
            type: 'fallback',
            fallbackAction: this.getCameraFallbackAction(),
            userMessage: 'Camera unavailable. Switching to manual verification mode.'
          };
        }
        
      case 'OverconstrainedError':
        return {
          type: 'degrade',
          fallbackAction: this.getCameraDegradeAction(error.constraint),
          userMessage: 'Adjusting camera settings for compatibility...'
        };
        
      case 'AbortError':
        if (attempts < this.maxRetries) {
          this.incrementRetryAttempts(errorKey);
          return {
            type: 'retry',
            maxAttempts: this.maxRetries,
            delay: 1000,
            userMessage: 'Camera initialization interrupted. Retrying...'
          };
        }
        return {
          type: 'notify',
          userMessage: 'Camera initialization failed. Please refresh the page.'
        };
        
      default:
        return {
          type: 'notify',
          userMessage: 'Camera error occurred. Please check your camera and refresh the page.'
        };
    }
  }
  
  /**
   * Handle vision processing errors with fallback systems
   */
  async handleVisionError(error: VisionError, context: ErrorContext): Promise<ErrorRecoveryStrategy> {
    this.logError(error, context);
    
    const errorKey = `vision_${error.name}_${context.component}`;
    const attempts = this.getRetryAttempts(errorKey);
    
    switch (error.name) {
      case 'ModelLoadError':
        if (attempts < this.maxRetries) {
          this.incrementRetryAttempts(errorKey);
          return {
            type: 'retry',
            maxAttempts: this.maxRetries,
            delay: 3000 * Math.pow(2, attempts),
            userMessage: 'Loading vision models. Please wait...'
          };
        } else {
          return {
            type: 'fallback',
            fallbackAction: this.getVisionFallbackAction(),
            userMessage: 'Using alternative vision processing. Some features may be limited.'
          };
        }
        
      case 'ProcessingError':
        if (error.severity === 'critical') {
          return {
            type: 'fallback',
            fallbackAction: this.getVisionFallbackAction(),
            userMessage: 'Vision processing error. Switching to backup system.'
          };
        } else if (error.recoverable && attempts < this.maxRetries) {
          this.incrementRetryAttempts(errorKey);
          return {
            type: 'retry',
            maxAttempts: this.maxRetries,
            delay: 1000,
            userMessage: 'Processing error. Retrying...'
          };
        } else {
          return {
            type: 'degrade',
            fallbackAction: this.getVisionDegradeAction(),
            userMessage: 'Reducing processing complexity to maintain stability.'
          };
        }
        
      case 'CalibrationError':
        return {
          type: 'retry',
          maxAttempts: 1,
          fallbackAction: this.getRecalibrationAction(),
          userMessage: 'Calibration failed. Please try calibrating again.'
        };
        
      case 'DetectionError':
        if (error.severity === 'high' || error.severity === 'critical') {
          return {
            type: 'fallback',
            fallbackAction: this.getDetectionFallbackAction(),
            userMessage: 'Detection system error. Using backup detection methods.'
          };
        } else {
          return {
            type: 'degrade',
            fallbackAction: this.getDetectionDegradeAction(),
            userMessage: 'Adjusting detection sensitivity.'
          };
        }
        
      default:
        return {
          type: 'notify',
          userMessage: 'Vision processing error. Some monitoring features may be affected.'
        };
    }
  }
  
  /**
   * Handle network errors for optional server sync
   */
  async handleNetworkError(error: NetworkError, context: ErrorContext): Promise<ErrorRecoveryStrategy> {
    this.logError(error, context);
    
    const errorKey = `network_${error.name}_${context.component}`;
    const attempts = this.getRetryAttempts(errorKey);
    
    switch (error.name) {
      case 'NetworkError':
      case 'TimeoutError':
        if (attempts < this.maxRetries) {
          this.incrementRetryAttempts(errorKey);
          return {
            type: 'retry',
            maxAttempts: this.maxRetries,
            delay: 5000 * Math.pow(2, attempts),
            userMessage: 'Network connection issue. Retrying...'
          };
        } else {
          return {
            type: 'fallback',
            fallbackAction: this.getOfflineModeAction(),
            userMessage: 'Network unavailable. Continuing in offline mode.'
          };
        }
        
      case 'AuthError':
        return {
          type: 'notify',
          userMessage: 'Authentication failed. Server sync disabled.'
        };
        
      case 'ServerError':
        if (error.status && error.status >= 500) {
          return {
            type: 'fallback',
            fallbackAction: this.getOfflineModeAction(),
            userMessage: 'Server temporarily unavailable. Continuing in offline mode.'
          };
        } else {
          return {
            type: 'notify',
            userMessage: 'Server error. Some features may be unavailable.'
          };
        }
        
      default:
        return {
          type: 'fallback',
          fallbackAction: this.getOfflineModeAction(),
          userMessage: 'Network error. Continuing in offline mode.'
        };
    }
  }
  
  /**
   * Handle performance-related errors with graceful degradation
   */
  async handlePerformanceError(error: PerformanceError, context: ErrorContext): Promise<ErrorRecoveryStrategy> {
    this.logError(error, context);
    
    const severity = this.getPerformanceSeverity(error.metric, error.currentValue, error.threshold);
    
    switch (severity) {
      case 'critical':
        return {
          type: 'degrade',
          fallbackAction: this.getPerformanceCriticalAction(error.metric),
          userMessage: `System performance critical. Reducing ${error.metric} usage.`
        };
        
      case 'high':
        return {
          type: 'degrade',
          fallbackAction: this.getPerformanceHighAction(error.metric),
          userMessage: `High ${error.metric} usage detected. Optimizing performance.`
        };
        
      case 'medium':
        return {
          type: 'degrade',
          fallbackAction: this.getPerformanceMediumAction(error.metric),
          userMessage: `Adjusting settings to improve ${error.metric} performance.`
        };
        
      default:
        return {
          type: 'notify',
          userMessage: `Performance warning: ${error.metric} usage elevated.`
        };
    }
  }
  
  /**
   * Handle generic errors with basic recovery strategies
   */
  async handleGenericError(error: Error, context: ErrorContext): Promise<ErrorRecoveryStrategy> {
    this.logError(error, context);
    
    const errorKey = `generic_${error.name}_${context.component}`;
    const attempts = this.getRetryAttempts(errorKey);
    
    if (attempts < this.maxRetries) {
      this.incrementRetryAttempts(errorKey);
      return {
        type: 'retry',
        maxAttempts: this.maxRetries,
        delay: 2000,
        userMessage: 'An error occurred. Retrying...'
      };
    } else {
      return {
        type: 'notify',
        userMessage: 'An unexpected error occurred. Please refresh the page if issues persist.'
      };
    }
  }
  
  /**
   * Register a recovery callback for a specific component
   */
  registerRecoveryCallback(component: string, callback: () => Promise<void>): void {
    this.recoveryCallbacks.set(component, callback);
  }
  
  /**
   * Execute recovery strategy
   */
  async executeRecovery(strategy: ErrorRecoveryStrategy, context: ErrorContext): Promise<boolean> {
    try {
      switch (strategy.type) {
        case 'retry':
          if (strategy.delay) {
            await this.delay(strategy.delay);
          }
          const callback = this.recoveryCallbacks.get(context.component);
          if (callback) {
            await callback();
          }
          return true;
          
        case 'fallback':
        case 'degrade':
          if (strategy.fallbackAction) {
            await strategy.fallbackAction();
          }
          return true;
          
        case 'notify':
          if (this.userNotificationCallback && strategy.userMessage) {
            this.userNotificationCallback(strategy.userMessage, 'error');
          }
          return false;
          
        case 'abort':
          return false;
          
        default:
          return false;
      }
    } catch (recoveryError) {
      console.error('Recovery strategy failed:', recoveryError);
      return false;
    }
  }
  
  /**
   * Get error statistics and patterns
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByComponent: Record<string, number>;
    recentErrors: Array<{ error: ApplicationError; context: ErrorContext; timestamp: number }>;
  } {
    const errorsByType: Record<string, number> = {};
    const errorsByComponent: Record<string, number> = {};
    
    this.errorLog.forEach(({ error, context }) => {
      errorsByType[error.name] = (errorsByType[error.name] || 0) + 1;
      errorsByComponent[context.component] = (errorsByComponent[context.component] || 0) + 1;
    });
    
    const recentErrors = this.errorLog
      .filter(entry => Date.now() - entry.timestamp < 300000) // Last 5 minutes
      .slice(-10); // Last 10 errors
    
    return {
      totalErrors: this.errorLog.length,
      errorsByType,
      errorsByComponent,
      recentErrors
    };
  }
  
  /**
   * Clear error history and retry attempts
   */
  clearErrorHistory(): void {
    this.errorLog = [];
    this.retryAttempts.clear();
  }
  
  // Private helper methods
  
  private logError(error: ApplicationError, context: ErrorContext): void {
    this.errorLog.push({
      error,
      context: {
        ...context,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      },
      timestamp: Date.now()
    });
    
    // Keep only last 100 errors to prevent memory issues
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }
    
    console.error(`[${context.component}] ${error.name}:`, error.message, context);
  }
  
  private getRetryAttempts(key: string): number {
    return this.retryAttempts.get(key) || 0;
  }
  
  private incrementRetryAttempts(key: string): void {
    const current = this.getRetryAttempts(key);
    this.retryAttempts.set(key, current + 1);
  }
  
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private getPerformanceSeverity(metric: string, current: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    let ratio: number;
    
    // For FPS, lower is worse, so invert the ratio
    if (metric === 'fps') {
      ratio = threshold / current; // Higher ratio means worse performance
    } else {
      ratio = current / threshold; // Higher ratio means worse performance
    }
    
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'high';
    if (ratio > 1.2) return 'medium';
    return 'low';
  }
  
  // Recovery action factories
  
  private getCameraFallbackAction(): () => Promise<void> {
    return async () => {
      // Switch to manual verification mode
      console.log('Switching to manual verification mode');
      // Implementation would disable camera-based monitoring
    };
  }
  
  private getCameraDegradeAction(constraint?: string): () => Promise<void> {
    return async () => {
      console.log('Degrading camera settings for constraint:', constraint);
      // Implementation would reduce camera resolution or frame rate
    };
  }
  
  private getVisionFallbackAction(): () => Promise<void> {
    return async () => {
      console.log('Switching to fallback vision processing');
      // Implementation would switch to WebGazer.js or simpler detection
    };
  }
  
  private getVisionDegradeAction(): () => Promise<void> {
    return async () => {
      console.log('Degrading vision processing complexity');
      // Implementation would reduce processing frequency or accuracy
    };
  }
  
  private getRecalibrationAction(): () => Promise<void> {
    return async () => {
      console.log('Initiating recalibration');
      // Implementation would restart calibration process
    };
  }
  
  private getDetectionFallbackAction(): () => Promise<void> {
    return async () => {
      console.log('Switching to backup detection methods');
      // Implementation would use simpler detection algorithms
    };
  }
  
  private getDetectionDegradeAction(): () => Promise<void> {
    return async () => {
      console.log('Adjusting detection sensitivity');
      // Implementation would modify detection thresholds
    };
  }
  
  private getOfflineModeAction(): () => Promise<void> {
    return async () => {
      console.log('Switching to offline mode');
      // Implementation would disable server sync features
    };
  }
  
  private getPerformanceCriticalAction(metric: string): () => Promise<void> {
    return async () => {
      console.log(`Critical performance action for ${metric}`);
      // Implementation would drastically reduce quality/features
    };
  }
  
  private getPerformanceHighAction(metric: string): () => Promise<void> {
    return async () => {
      console.log(`High performance action for ${metric}`);
      // Implementation would moderately reduce quality
    };
  }
  
  private getPerformanceMediumAction(metric: string): () => Promise<void> {
    return async () => {
      console.log(`Medium performance action for ${metric}`);
      // Implementation would slightly optimize settings
    };
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new RobustErrorHandler();

/**
 * Utility function to create error context
 */
export function createErrorContext(
  component: string,
  operation: string,
  additionalData?: Record<string, unknown>
): ErrorContext {
  return {
    timestamp: Date.now(),
    component,
    operation,
    userAgent: navigator.userAgent,
    url: window.location.href,
    additionalData
  };
}

/**
 * Utility functions to create specific error types
 */
export function createCameraError(
  name: CameraError['name'],
  message: string,
  constraint?: string
): CameraError {
  const error = new Error(message) as CameraError;
  error.name = name;
  if (constraint) {
    error.constraint = constraint;
  }
  return error;
}

export function createVisionError(
  name: VisionError['name'],
  message: string,
  severity: VisionError['severity'] = 'medium',
  recoverable: boolean = true
): VisionError {
  const error = new Error(message) as VisionError;
  error.name = name;
  error.severity = severity;
  error.recoverable = recoverable;
  return error;
}

export function createNetworkError(
  name: NetworkError['name'],
  message: string,
  status?: number,
  endpoint?: string
): NetworkError {
  const error = new Error(message) as NetworkError;
  error.name = name;
  if (status) error.status = status;
  if (endpoint) error.endpoint = endpoint;
  return error;
}

export function createPerformanceError(
  metric: PerformanceError['metric'],
  currentValue: number,
  threshold: number,
  message?: string
): PerformanceError {
  const error = new Error(
    message || `Performance threshold exceeded: ${metric} = ${currentValue} > ${threshold}`
  ) as PerformanceError;
  error.name = 'PerformanceError';
  error.metric = metric;
  error.currentValue = currentValue;
  error.threshold = threshold;
  return error;
}