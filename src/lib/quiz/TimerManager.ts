/**
 * TimerManager - Handles quiz timing and navigation controls
 * 
 * Manages per-question and overall timing, countdown display,
 * automatic question progression, and navigation prevention.
 */

import { TimerState } from './types';

export interface TimerConfig {
  totalTimeMinutes: number;
  autoProgressEnabled: boolean;
  warningThresholdSeconds: number; // Show warning when time is low
  criticalThresholdSeconds: number; // Show critical warning
}

export interface TimerCallbacks {
  onTick?: (state: TimerState) => void;
  onQuestionTimeUp?: () => void;
  onTotalTimeUp?: () => void;
  onWarning?: (timeRemaining: number) => void;
  onCritical?: (timeRemaining: number) => void;
}

export class TimerManager {
  private config: TimerConfig;
  private callbacks: TimerCallbacks;
  private state: TimerState;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastWarningTime = 0;
  private lastCriticalTime = 0;

  constructor(config: TimerConfig, callbacks: TimerCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
    
    this.state = {
      questionStartTime: 0,
      questionTimeLimit: 0,
      totalStartTime: 0,
      totalTimeLimit: config.totalTimeMinutes * 60 * 1000, // Convert to milliseconds
      isPaused: false,
      remainingTime: 0
    };
  }

  /**
   * Start the overall quiz timer
   */
  startQuizTimer(): void {
    if (this.isRunning) {
      return;
    }

    this.state.totalStartTime = Date.now();
    this.state.isPaused = false;
    this.isRunning = true;
    
    this.startTicking();
  }

  /**
   * Start timer for a specific question
   */
  startQuestionTimer(timeLimitSeconds: number): void {
    this.state.questionStartTime = Date.now();
    this.state.questionTimeLimit = timeLimitSeconds * 1000; // Convert to milliseconds
    
    // Reset warning flags for new question
    this.lastWarningTime = 0;
    this.lastCriticalTime = 0;
    
    if (!this.isRunning) {
      this.startQuizTimer();
    }
  }

  /**
   * Pause the timer
   */
  pause(): void {
    if (!this.isRunning || this.state.isPaused) {
      return;
    }

    this.state.isPaused = true;
    this.stopTicking();
  }

  /**
   * Resume the timer
   */
  resume(): void {
    if (!this.isRunning || !this.state.isPaused) {
      return;
    }

    this.state.isPaused = false;
    this.startTicking();
  }

  /**
   * Stop the timer completely
   */
  stop(): void {
    this.isRunning = false;
    this.state.isPaused = false;
    this.stopTicking();
  }

  /**
   * Get current timer state
   */
  getState(): TimerState {
    this.updateRemainingTime();
    return { ...this.state };
  }

  /**
   * Get remaining time for current question in seconds
   */
  getQuestionTimeRemaining(): number {
    if (!this.state.questionStartTime || this.state.isPaused) {
      return Math.max(0, this.state.questionTimeLimit / 1000);
    }

    const elapsed = Date.now() - this.state.questionStartTime;
    const remaining = Math.max(0, this.state.questionTimeLimit - elapsed);
    return Math.floor(remaining / 1000);
  }

  /**
   * Get remaining time for total quiz in seconds
   */
  getTotalTimeRemaining(): number {
    if (!this.state.totalStartTime || this.state.isPaused) {
      return Math.max(0, this.state.totalTimeLimit / 1000);
    }

    const elapsed = Date.now() - this.state.totalStartTime;
    const remaining = Math.max(0, this.state.totalTimeLimit - elapsed);
    return Math.floor(remaining / 1000);
  }

  /**
   * Get elapsed time for current question in seconds
   */
  getQuestionTimeElapsed(): number {
    if (!this.state.questionStartTime) {
      return 0;
    }

    const elapsed = this.state.isPaused 
      ? 0 
      : Date.now() - this.state.questionStartTime;
    return Math.floor(elapsed / 1000);
  }

  /**
   * Get elapsed time for total quiz in seconds
   */
  getTotalTimeElapsed(): number {
    if (!this.state.totalStartTime) {
      return 0;
    }

    const elapsed = this.state.isPaused 
      ? 0 
      : Date.now() - this.state.totalStartTime;
    return Math.floor(elapsed / 1000);
  }

  /**
   * Check if question time is up
   */
  isQuestionTimeUp(): boolean {
    return this.getQuestionTimeRemaining() <= 0;
  }

  /**
   * Check if total time is up
   */
  isTotalTimeUp(): boolean {
    return this.getTotalTimeRemaining() <= 0;
  }

  /**
   * Format time as MM:SS
   */
  static formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format time as HH:MM:SS for longer durations
   */
  static formatLongTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return TimerManager.formatTime(seconds);
  }

  /**
   * Get time display info with formatting and status
   */
  getTimeDisplay(): {
    questionTime: string;
    totalTime: string;
    questionStatus: 'normal' | 'warning' | 'critical' | 'expired';
    totalStatus: 'normal' | 'warning' | 'critical' | 'expired';
    questionProgress: number; // 0-100 percentage
    totalProgress: number; // 0-100 percentage
  } {
    const questionRemaining = this.getQuestionTimeRemaining();
    const totalRemaining = this.getTotalTimeRemaining();
    
    const questionTotal = this.state.questionTimeLimit / 1000;
    const totalTotal = this.state.totalTimeLimit / 1000;
    
    return {
      questionTime: TimerManager.formatTime(questionRemaining),
      totalTime: TimerManager.formatLongTime(totalRemaining),
      questionStatus: this.getTimeStatus(questionRemaining, this.config.warningThresholdSeconds, this.config.criticalThresholdSeconds),
      totalStatus: this.getTimeStatus(totalRemaining, 60, 30), // 1 minute warning, 30 second critical for total
      questionProgress: questionTotal > 0 ? Math.max(0, Math.min(100, ((questionTotal - questionRemaining) / questionTotal) * 100)) : 0,
      totalProgress: totalTotal > 0 ? Math.max(0, Math.min(100, ((totalTotal - totalRemaining) / totalTotal) * 100)) : 0
    };
  }

  /**
   * Update callbacks
   */
  updateCallbacks(callbacks: Partial<TimerCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Add time to current question (for extensions)
   */
  addQuestionTime(seconds: number): void {
    this.state.questionTimeLimit += seconds * 1000;
  }

  /**
   * Add time to total quiz (for extensions)
   */
  addTotalTime(seconds: number): void {
    this.state.totalTimeLimit += seconds * 1000;
  }

  /**
   * Start the tick interval
   */
  private startTicking(): void {
    this.stopTicking(); // Clear any existing interval
    
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000); // Tick every second
  }

  /**
   * Stop the tick interval
   */
  private stopTicking(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Handle timer tick
   */
  private tick(): void {
    if (this.state.isPaused) {
      return;
    }

    this.updateRemainingTime();
    
    // Check for time up conditions
    if (this.isTotalTimeUp()) {
      this.callbacks.onTotalTimeUp?.();
      this.stop();
      return;
    }

    if (this.isQuestionTimeUp() && this.config.autoProgressEnabled) {
      this.callbacks.onQuestionTimeUp?.();
      return;
    }

    // Check for warnings
    this.checkWarnings();
    
    // Notify tick callback
    this.callbacks.onTick?.(this.getState());
  }

  /**
   * Update remaining time in state
   */
  private updateRemainingTime(): void {
    this.state.remainingTime = this.getTotalTimeRemaining();
  }

  /**
   * Check and trigger warning callbacks
   */
  private checkWarnings(): void {
    const questionRemaining = this.getQuestionTimeRemaining();
    const totalRemaining = this.getTotalTimeRemaining();
    
    // Question warnings
    if (questionRemaining <= this.config.criticalThresholdSeconds && 
        questionRemaining > 0 && 
        this.lastCriticalTime !== questionRemaining) {
      this.lastCriticalTime = questionRemaining;
      this.callbacks.onCritical?.(questionRemaining);
    } else if (questionRemaining <= this.config.warningThresholdSeconds && 
               questionRemaining > this.config.criticalThresholdSeconds &&
               this.lastWarningTime !== questionRemaining) {
      this.lastWarningTime = questionRemaining;
      this.callbacks.onWarning?.(questionRemaining);
    }
    
    // Total time warnings (1 minute and 30 seconds)
    if (totalRemaining <= 30 && totalRemaining > 0) {
      this.callbacks.onCritical?.(totalRemaining);
    } else if (totalRemaining <= 60 && totalRemaining > 30) {
      this.callbacks.onWarning?.(totalRemaining);
    }
  }

  /**
   * Get time status based on thresholds
   */
  private getTimeStatus(timeRemaining: number, warningThreshold: number, criticalThreshold: number): 'normal' | 'warning' | 'critical' | 'expired' {
    if (timeRemaining <= 0) {
      return 'expired';
    } else if (timeRemaining <= criticalThreshold) {
      return 'critical';
    } else if (timeRemaining <= warningThreshold) {
      return 'warning';
    }
    return 'normal';
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.callbacks = {};
  }
}

/**
 * Navigation Prevention Utility
 * 
 * Prevents back navigation and other navigation attempts during quiz
 */
export class NavigationPrevention {
  private isActive = false;
  private originalOnBeforeUnload: ((event: BeforeUnloadEvent) => string | null | undefined) | null = null;
  private originalOnPopState: ((event: PopStateEvent) => void) | null = null;
  private onNavigationAttempt?: () => void;

  /**
   * Enable navigation prevention
   */
  enable(onNavigationAttempt?: () => void): void {
    if (this.isActive) {
      return;
    }

    this.onNavigationAttempt = onNavigationAttempt;
    this.isActive = true;

    // Prevent page unload/refresh
    this.originalOnBeforeUnload = window.onbeforeunload;
    window.onbeforeunload = (event: BeforeUnloadEvent) => {
      const message = 'Are you sure you want to leave? Your quiz progress will be lost.';
      event.returnValue = message;
      this.onNavigationAttempt?.();
      return message;
    };

    // Prevent back button
    this.originalOnPopState = window.onpopstate;
    window.onpopstate = (event: PopStateEvent) => {
      // Push a new state to prevent going back
      window.history.pushState(null, '', window.location.href);
      this.onNavigationAttempt?.();
    };

    // Push initial state to enable back button prevention
    window.history.pushState(null, '', window.location.href);

    // Prevent common keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Disable navigation prevention
   */
  disable(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Restore original handlers
    window.onbeforeunload = this.originalOnBeforeUnload;
    window.onpopstate = this.originalOnPopState;

    // Remove keyboard event listener
    document.removeEventListener('keydown', this.handleKeyDown);

    this.onNavigationAttempt = undefined;
  }

  /**
   * Check if navigation prevention is active
   */
  isEnabled(): boolean {
    return this.isActive;
  }

  /**
   * Handle keyboard shortcuts that might cause navigation
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    // Prevent common navigation shortcuts
    if (
      // Ctrl+R (refresh)
      (event.ctrlKey && event.key === 'r') ||
      // F5 (refresh)
      event.key === 'F5' ||
      // Alt+Left (back)
      (event.altKey && event.key === 'ArrowLeft') ||
      // Alt+Right (forward)
      (event.altKey && event.key === 'ArrowRight') ||
      // Backspace (back in some browsers)
      (event.key === 'Backspace' && 
       event.target instanceof HTMLElement && 
       !['INPUT', 'TEXTAREA'].includes(event.target.tagName) &&
       !event.target.isContentEditable)
    ) {
      event.preventDefault();
      this.onNavigationAttempt?.();
    }
  };
}