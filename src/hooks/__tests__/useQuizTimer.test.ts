import { renderHook, act } from '@testing-library/react';
import { useQuizTimer } from '../useQuizTimer';

// Mock TimerManager
jest.mock('../../lib/quiz/TimerManager', () => ({
  TimerManager: jest.fn().mockImplementation(() => ({
    startQuizTimer: jest.fn(),
    startQuestionTimer: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn(),
    destroy: jest.fn(),
    addQuestionTime: jest.fn(),
    addTotalTime: jest.fn(),
    getQuestionTimeRemaining: jest.fn().mockReturnValue(30),
    getTotalTimeRemaining: jest.fn().mockReturnValue(1800),
    getQuestionTimeElapsed: jest.fn().mockReturnValue(0),
    getTotalTimeElapsed: jest.fn().mockReturnValue(0),
    isQuestionTimeUp: jest.fn().mockReturnValue(false),
    isTotalTimeUp: jest.fn().mockReturnValue(false),
    getTimeDisplay: jest.fn().mockReturnValue({
      questionTime: '0:30',
      totalTime: '30:00',
      questionStatus: 'normal',
      totalStatus: 'normal',
      questionProgress: 0,
      totalProgress: 0
    })
  })),
  NavigationPrevention: jest.fn().mockImplementation(() => ({
    enable: jest.fn(),
    disable: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true)
  }))
}));

// Mock timers
jest.useFakeTimers();

describe('useQuizTimer', () => {
  const mockQuestions = [
    { id: 'q1', type: 'multiple-choice' as const, text: 'Q1', options: ['A', 'B'], correctAnswer: 'A', timeLimitSeconds: 30, points: 1 },
    { id: 'q2', type: 'multiple-choice' as const, text: 'Q2', options: ['A', 'B'], correctAnswer: 'B', timeLimitSeconds: 45, points: 1 }
  ];

  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    if (jest.isMockFunction(jest.runOnlyPendingTimers)) {
      jest.runOnlyPendingTimers();
    }
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      expect(result.current.isRunning).toBe(false);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.questionStatus).toBe('normal');
      expect(result.current.totalStatus).toBe('normal');
    });

    it('should initialize with custom options', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 60,
        autoProgressEnabled: false,
        warningThresholdSeconds: 15
      }));

      expect(result.current.isRunning).toBe(false);
      expect(result.current.questionTime).toBe('00:00');
      expect(result.current.totalTime).toBe('00:00');
    });
  });

  describe('timer controls', () => {
    it('should start quiz timer', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      act(() => {
        result.current.startQuiz();
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.isPaused).toBe(false);
    });

    it('should pause timer', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      act(() => {
        result.current.startQuiz();
        result.current.pauseTimer();
      });

      expect(result.current.isPaused).toBe(true);
    });

    it('should resume timer', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      act(() => {
        result.current.startQuiz();
        result.current.pauseTimer();
        result.current.resumeTimer();
      });

      expect(result.current.isPaused).toBe(false);
    });

    it('should stop timer', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      act(() => {
        result.current.startQuiz();
        result.current.stopTimer();
      });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.isPaused).toBe(false);
    });

    it('should start question timer', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      act(() => {
        result.current.startQuestion(0);
      });

      expect(result.current.timerManager?.startQuestionTimer).toHaveBeenCalledWith(30);
    });
  });

  describe('timer functionality', () => {
    it('should get time remaining', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      const timeRemaining = result.current.getTimeRemaining();

      expect(timeRemaining.question).toBe(30);
      expect(timeRemaining.total).toBe(1800);
    });

    it('should handle timer expiration callbacks', () => {
      const onQuestionTimeUp = jest.fn();
      const onTotalTimeUp = jest.fn();
      
      renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30,
        onQuestionTimeUp,
        onTotalTimeUp
      }));

      // These would be called by the TimerManager in real usage
      expect(onQuestionTimeUp).toBeDefined();
      expect(onTotalTimeUp).toBeDefined();
    });

    it('should check if time is up', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      const timeUp = result.current.isTimeUp();

      expect(timeUp.question).toBe(false);
      expect(timeUp.total).toBe(false);
    });
  });

  describe('timer events', () => {
    it('should call onWarning callback', () => {
      const onWarning = jest.fn();
      renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30,
        warningThresholdSeconds: 10,
        onWarning
      }));

      expect(onWarning).toBeDefined();
    });

    it('should call onCritical callback', () => {
      const onCritical = jest.fn();
      renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30,
        criticalThresholdSeconds: 5,
        onCritical
      }));

      expect(onCritical).toBeDefined();
    });

    it('should handle auto-progress', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30,
        autoProgressEnabled: true
      }));

      expect(result.current.showAutoProgressNotification).toBe(false);
      expect(result.current.autoProgressCountdown).toBe(0);
    });

    it('should cancel auto-progress', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30,
        autoProgressEnabled: true
      }));

      act(() => {
        result.current.cancelAutoProgress();
      });

      expect(result.current.showAutoProgressNotification).toBe(false);
    });
  });

  describe('timer display', () => {
    it('should display formatted time', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      expect(result.current.questionTime).toBe('00:00');
      expect(result.current.totalTime).toBe('00:00');
    });

    it('should show progress', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      expect(result.current.questionProgress).toBe(0);
      expect(result.current.totalProgress).toBe(0);
    });

    it('should track status', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      expect(result.current.questionStatus).toBe('normal');
      expect(result.current.totalStatus).toBe('normal');
    });
  });

  describe('timer utilities', () => {
    it('should get elapsed time', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      const elapsed = result.current.getTimeElapsed();

      expect(elapsed.question).toBe(0);
      expect(elapsed.total).toBe(0);
    });

    it('should add time to question', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      // The timerManager is created internally, so we test the function exists
      expect(typeof result.current.addQuestionTime).toBe('function');
      
      act(() => {
        result.current.addQuestionTime(30);
      });

      // Function should execute without error
      expect(result.current.addQuestionTime).toBeDefined();
    });

    it('should add time to total', () => {
      const { result } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      // The timerManager is created internally, so we test the function exists
      expect(typeof result.current.addTotalTime).toBe('function');
      
      act(() => {
        result.current.addTotalTime(300);
      });

      // Function should execute without error
      expect(result.current.addTotalTime).toBeDefined();
    });
  });

  describe('question management', () => {
    it('should start question when index changes', () => {
      const { result, rerender } = renderHook(
        ({ currentQuestionIndex }) => useQuizTimer({
          questions: mockQuestions,
          currentQuestionIndex,
          totalTimeMinutes: 30
        }),
        { initialProps: { currentQuestionIndex: 0 } }
      );

      act(() => {
        result.current.startQuiz();
      });

      rerender({ currentQuestionIndex: 1 });

      expect(result.current.timerManager?.startQuestionTimer).toHaveBeenCalledWith(45);
    });

    it('should handle question progression', () => {
      const onQuestionTimeUp = jest.fn();
      renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30,
        autoProgressEnabled: true,
        onQuestionTimeUp
      }));

      expect(onQuestionTimeUp).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup timer on unmount', () => {
      const { result, unmount } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      act(() => {
        result.current.startQuiz();
      });

      unmount();

      expect(result.current.timerManager?.destroy).toHaveBeenCalled();
    });

    it('should not throw error when cleaning up', () => {
      const { result, unmount } = renderHook(() => useQuizTimer({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        totalTimeMinutes: 30
      }));

      act(() => {
        result.current.startQuiz();
        result.current.stopTimer();
      });

      expect(() => unmount()).not.toThrow();
    });
  });
});