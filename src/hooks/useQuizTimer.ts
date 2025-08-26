/**
 * useQuizTimer - Hook for managing quiz timing and automatic progression
 * 
 * Integrates TimerManager with quiz state and handles automatic progression
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TimerManager, NavigationPrevention } from '../lib/quiz/TimerManager';
import { Question } from '../lib/quiz/types';

interface UseQuizTimerOptions {
  questions: Question[];
  currentQuestionIndex: number;
  totalTimeMinutes: number;
  autoProgressEnabled?: boolean;
  warningThresholdSeconds?: number;
  criticalThresholdSeconds?: number;
  onQuestionTimeUp?: () => void;
  onTotalTimeUp?: () => void;
  onWarning?: (timeRemaining: number) => void;
  onCritical?: (timeRemaining: number) => void;
  onNavigationAttempt?: () => void;
}

interface QuizTimerState {
  isRunning: boolean;
  isPaused: boolean;
  questionTime: string;
  totalTime: string;
  questionStatus: 'normal' | 'warning' | 'critical' | 'expired';
  totalStatus: 'normal' | 'warning' | 'critical' | 'expired';
  questionProgress: number;
  totalProgress: number;
  showAutoProgressNotification: boolean;
  autoProgressCountdown: number;
}

export const useQuizTimer = (options: UseQuizTimerOptions) => {
  const {
    questions,
    currentQuestionIndex,
    totalTimeMinutes,
    autoProgressEnabled = true,
    warningThresholdSeconds = 10,
    criticalThresholdSeconds = 5,
    onQuestionTimeUp,
    onTotalTimeUp,
    onWarning,
    onCritical,
    onNavigationAttempt
  } = options;

  const timerManagerRef = useRef<TimerManager | null>(null);
  const autoProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoProgressCountdownRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<QuizTimerState>({
    isRunning: false,
    isPaused: false,
    questionTime: '00:00',
    totalTime: '00:00',
    questionStatus: 'normal',
    totalStatus: 'normal',
    questionProgress: 0,
    totalProgress: 0,
    showAutoProgressNotification: false,
    autoProgressCountdown: 0
  });

  // Initialize timer manager
  useEffect(() => {
    const timerManager = new TimerManager(
      {
        totalTimeMinutes,
        autoProgressEnabled,
        warningThresholdSeconds,
        criticalThresholdSeconds
      },
      {
        onTick: () => {
          if (timerManagerRef.current) {
            const timeDisplay = timerManagerRef.current.getTimeDisplay();
            setState(prev => ({
              ...prev,
              ...timeDisplay
            }));
          }
        },
        onQuestionTimeUp: () => {
          if (autoProgressEnabled) {
            handleAutoProgress();
          }
          onQuestionTimeUp?.();
        },
        onTotalTimeUp: () => {
          setState(prev => ({ ...prev, isRunning: false }));
          onTotalTimeUp?.();
        },
        onWarning: (timeRemaining) => {
          onWarning?.(timeRemaining);
        },
        onCritical: (timeRemaining) => {
          onCritical?.(timeRemaining);
        }
      }
    );

    timerManagerRef.current = timerManager;

    return () => {
      timerManager.destroy();
      clearAutoProgressTimers();
    };
  }, [totalTimeMinutes, autoProgressEnabled, warningThresholdSeconds, criticalThresholdSeconds]);

  // Handle auto-progression logic
  const handleAutoProgress = useCallback(() => {
    if (!autoProgressEnabled) return;

    // Show notification and start countdown
    setState(prev => ({ 
      ...prev, 
      showAutoProgressNotification: true,
      autoProgressCountdown: 3
    }));

    let countdown = 3;
    autoProgressCountdownRef.current = setInterval(() => {
      countdown--;
      setState(prev => ({ ...prev, autoProgressCountdown: countdown }));
      
      if (countdown <= 0) {
        clearInterval(autoProgressCountdownRef.current!);
        setState(prev => ({ 
          ...prev, 
          showAutoProgressNotification: false,
          autoProgressCountdown: 0
        }));
        onQuestionTimeUp?.();
      }
    }, 1000);

  }, [autoProgressEnabled, onQuestionTimeUp]);

  // Clear auto-progress timers
  const clearAutoProgressTimers = useCallback(() => {
    if (autoProgressTimeoutRef.current) {
      clearTimeout(autoProgressTimeoutRef.current);
      autoProgressTimeoutRef.current = null;
    }
    if (autoProgressCountdownRef.current) {
      clearInterval(autoProgressCountdownRef.current);
      autoProgressCountdownRef.current = null;
    }
  }, []);

  // Start quiz timer
  const startQuiz = useCallback(() => {
    if (timerManagerRef.current) {
      timerManagerRef.current.startQuizTimer();
      setState(prev => ({ ...prev, isRunning: true, isPaused: false }));
    }
  }, []);

  // Start question timer
  const startQuestion = useCallback((questionIndex: number) => {
    if (timerManagerRef.current && questions[questionIndex]) {
      const question = questions[questionIndex];
      timerManagerRef.current.startQuestionTimer(question.timeLimitSeconds);
      
      // Clear any existing auto-progress timers
      clearAutoProgressTimers();
      
      setState(prev => ({ 
        ...prev, 
        showAutoProgressNotification: false,
        autoProgressCountdown: 0
      }));
    }
  }, [questions, clearAutoProgressTimers]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    if (timerManagerRef.current) {
      timerManagerRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));
      clearAutoProgressTimers();
    }
  }, [clearAutoProgressTimers]);

  // Resume timer
  const resumeTimer = useCallback(() => {
    if (timerManagerRef.current) {
      timerManagerRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, []);

  // Stop timer
  const stopTimer = useCallback(() => {
    if (timerManagerRef.current) {
      timerManagerRef.current.stop();
      setState(prev => ({ ...prev, isRunning: false, isPaused: false }));
      clearAutoProgressTimers();
    }
  }, [clearAutoProgressTimers]);

  // Cancel auto-progress
  const cancelAutoProgress = useCallback(() => {
    clearAutoProgressTimers();
    setState(prev => ({ 
      ...prev, 
      showAutoProgressNotification: false,
      autoProgressCountdown: 0
    }));
  }, [clearAutoProgressTimers]);

  // Add time to current question
  const addQuestionTime = useCallback((seconds: number) => {
    if (timerManagerRef.current) {
      timerManagerRef.current.addQuestionTime(seconds);
    }
  }, []);

  // Add time to total quiz
  const addTotalTime = useCallback((seconds: number) => {
    if (timerManagerRef.current) {
      timerManagerRef.current.addTotalTime(seconds);
    }
  }, []);

  // Get time remaining
  const getTimeRemaining = useCallback(() => {
    if (!timerManagerRef.current) {
      return { question: 0, total: 0 };
    }
    
    return {
      question: timerManagerRef.current.getQuestionTimeRemaining(),
      total: timerManagerRef.current.getTotalTimeRemaining()
    };
  }, []);

  // Get time elapsed
  const getTimeElapsed = useCallback(() => {
    if (!timerManagerRef.current) {
      return { question: 0, total: 0 };
    }
    
    return {
      question: timerManagerRef.current.getQuestionTimeElapsed(),
      total: timerManagerRef.current.getTotalTimeElapsed()
    };
  }, []);

  // Check if time is up
  const isTimeUp = useCallback(() => {
    if (!timerManagerRef.current) {
      return { question: false, total: false };
    }
    
    return {
      question: timerManagerRef.current.isQuestionTimeUp(),
      total: timerManagerRef.current.isTotalTimeUp()
    };
  }, []);

  // Start question when index changes
  useEffect(() => {
    if (state.isRunning && currentQuestionIndex >= 0) {
      startQuestion(currentQuestionIndex);
    }
  }, [currentQuestionIndex, state.isRunning, startQuestion]);

  return {
    // State
    ...state,
    timerManager: timerManagerRef.current,
    
    // Actions
    startQuiz,
    startQuestion,
    pauseTimer,
    resumeTimer,
    stopTimer,
    cancelAutoProgress,
    addQuestionTime,
    addTotalTime,
    
    // Getters
    getTimeRemaining,
    getTimeElapsed,
    isTimeUp
  };
};

/**
 * Hook for navigation prevention during quiz
 */
export const useNavigationPrevention = (
  enabled: boolean = true,
  onNavigationAttempt?: () => void
) => {
  const navigationPreventionRef = useRef<NavigationPrevention | null>(null);

  useEffect(() => {
    if (enabled) {
      navigationPreventionRef.current = new NavigationPrevention();
      navigationPreventionRef.current.enable(onNavigationAttempt);
    }

    return () => {
      if (navigationPreventionRef.current) {
        navigationPreventionRef.current.disable();
        navigationPreventionRef.current = null;
      }
    };
  }, [enabled, onNavigationAttempt]);

  const disable = useCallback(() => {
    if (navigationPreventionRef.current) {
      navigationPreventionRef.current.disable();
      navigationPreventionRef.current = null;
    }
  }, []);

  return {
    isEnabled: enabled && navigationPreventionRef.current?.isEnabled(),
    disable
  };
};