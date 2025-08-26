/**
 * Integration tests for academic integrity enforcement
 */

import { QuizEngine } from '../QuizEngine';
import { IntegrityEnforcer } from '../IntegrityEnforcer';
import { QuizConfig, Question, IntegrityViolation } from '../types';
import { FlagEvent } from '../../proctoring/types';

// Mock DOM APIs
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
const mockRequestFullscreen = jest.fn();

Object.defineProperty(document, 'addEventListener', {
  value: mockAddEventListener,
  writable: true
});

Object.defineProperty(document, 'removeEventListener', {
  value: mockRemoveEventListener,
  writable: true
});

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
  writable: true
});

Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
  writable: true
});

Object.defineProperty(document.documentElement, 'requestFullscreen', {
  value: mockRequestFullscreen,
  writable: true
});

Object.defineProperty(document, 'fullscreenElement', {
  value: null,
  writable: true,
  configurable: true
});

describe('Academic Integrity Enforcement Integration', () => {
  let quizEngine: QuizEngine;
  let questions: Question[];
  let flags: FlagEvent[];
  let violations: IntegrityViolation[];

  const quizConfig: QuizConfig = {
    totalQuestions: 3,
    multipleChoiceCount: 2,
    shortAnswerCount: 1,
    timePerQuestionSeconds: 30,
    totalTimeMinutes: 5,
    passingScore: 70,
    allowReview: false,
    shuffleQuestions: false,
    shuffleOptions: false
  };

  const integrityConfig = {
    preventCopyPaste: true,
    blockRightClick: true,
    blockDevTools: true,
    enforceFullscreen: true,
    monitorPageVisibility: true,
    flagOnViolation: true,
    gracePeriodMs: 100
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    flags = [];
    violations = [];

    questions = [
      {
        id: 'q1',
        type: 'multiple-choice',
        text: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        timeLimitSeconds: 30,
        points: 10
      },
      {
        id: 'q2',
        type: 'multiple-choice',
        text: 'What is the capital of France?',
        options: ['London', 'Berlin', 'Paris', 'Madrid'],
        correctAnswer: 'Paris',
        timeLimitSeconds: 30,
        points: 10
      },
      {
        id: 'q3',
        type: 'short-answer',
        text: 'Explain photosynthesis',
        correctAnswer: 'process by which plants make food',
        timeLimitSeconds: 60,
        points: 20
      }
    ];

    quizEngine = new QuizEngine(quizConfig, integrityConfig);
    
    // Set up callbacks to capture flags
    quizEngine.onSessionUpdate((session) => {
      flags.push(...session.flags);
    });
  });

  afterEach(() => {
    quizEngine.destroy();
    jest.useRealTimers();
  });

  describe('Quiz Session with Integrity Enforcement', () => {
    it('should start integrity enforcement when quiz starts', async () => {
      await quizEngine.initialize(questions);
      const session = quizEngine.createSession();
      
      expect(mockAddEventListener).not.toHaveBeenCalled();
      
      quizEngine.startSession();
      
      // Should have set up event listeners for integrity enforcement
      expect(mockAddEventListener).toHaveBeenCalledWith('copy', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('paste', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });

    it('should stop integrity enforcement when quiz completes', async () => {
      await quizEngine.initialize(questions);
      quizEngine.createSession();
      quizEngine.startSession();
      
      // Answer all questions
      quizEngine.submitAnswer('4');
      quizEngine.nextQuestion();
      quizEngine.submitAnswer('Paris');
      quizEngine.nextQuestion();
      quizEngine.submitAnswer('process by which plants make food');
      
      const result = quizEngine.completeSession();
      
      expect(result).toBeDefined();
      expect(mockRemoveEventListener).toHaveBeenCalled();
    });

    it('should generate flags for integrity violations during quiz', async () => {
      await quizEngine.initialize(questions);
      quizEngine.createSession();
      quizEngine.startSession();
      
      // Wait for grace period
      jest.advanceTimersByTime(200);
      
      // Simulate copy/paste violation
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      document.dispatchEvent(copyEvent);
      
      const session = quizEngine.getCurrentSession();
      expect(session?.flags).toHaveLength(1);
      expect(session?.flags[0].type).toBe('INTEGRITY_VIOLATION');
    });

    it('should track violations across multiple questions', async () => {
      await quizEngine.initialize(questions);
      quizEngine.createSession();
      quizEngine.startSession();
      
      jest.advanceTimersByTime(200);
      
      // First question - copy violation
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      document.dispatchEvent(copyEvent);
      
      quizEngine.submitAnswer('4');
      quizEngine.nextQuestion();
      
      // Second question - right-click violation
      const rightClickEvent = new MouseEvent('mousedown', {
        button: 2,
        bubbles: true
      });
      document.dispatchEvent(rightClickEvent);
      
      const violations = quizEngine.getIntegrityViolations();
      expect(violations).toHaveLength(2);
      expect(violations[0].type).toBe('copy-paste');
      expect(violations[1].type).toBe('right-click');
    });

    it('should handle fullscreen enforcement', async () => {
      await quizEngine.initialize(questions);
      quizEngine.createSession();
      quizEngine.startSession();
      
      jest.advanceTimersByTime(200);
      
      const enforcer = quizEngine.getIntegrityEnforcer();
      expect(enforcer).toBeDefined();
      
      // Test fullscreen request
      mockRequestFullscreen.mockResolvedValue(undefined);
      const result = await enforcer!.requestFullscreen();
      expect(result).toBe(true);
      expect(mockRequestFullscreen).toHaveBeenCalled();
    });

    it('should prevent common cheating methods', async () => {
      await quizEngine.initialize(questions);
      quizEngine.createSession();
      quizEngine.startSession();
      
      jest.advanceTimersByTime(200);
      
      // Test various cheating attempts
      const violations: { event: Event; expectedType: string }[] = [
        { event: new ClipboardEvent('copy', { bubbles: true }), expectedType: 'copy-paste' },
        { event: new ClipboardEvent('paste', { bubbles: true }), expectedType: 'copy-paste' },
        { event: new MouseEvent('mousedown', { button: 2, bubbles: true }), expectedType: 'right-click' },
        { event: new KeyboardEvent('keydown', { key: 'F12', bubbles: true }), expectedType: 'dev-tools' },
        { event: new KeyboardEvent('keydown', { key: 'I', ctrlKey: true, shiftKey: true, bubbles: true }), expectedType: 'dev-tools' }
      ];
      
      violations.forEach(({ event }) => {
        const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
        document.dispatchEvent(event);
        expect(preventDefaultSpy).toHaveBeenCalled();
      });
      
      const detectedViolations = quizEngine.getIntegrityViolations();
      expect(detectedViolations.length).toBeGreaterThanOrEqual(violations.length);
    });

    it('should handle page visibility changes', async () => {
      await quizEngine.initialize(questions);
      quizEngine.createSession();
      quizEngine.startSession();
      
      jest.advanceTimersByTime(200);
      
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true
      });
      
      const visibilityEvent = new Event('visibilitychange');
      document.dispatchEvent(visibilityEvent);
      
      const violations = quizEngine.getIntegrityViolations();
      expect(violations.some(v => v.type === 'tab-blur')).toBe(true);
    });

    it('should respect grace period for violations', async () => {
      await quizEngine.initialize(questions);
      quizEngine.createSession();
      quizEngine.startSession();
      
      // Trigger violation immediately (within grace period)
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      document.dispatchEvent(copyEvent);
      
      let violations = quizEngine.getIntegrityViolations();
      expect(violations).toHaveLength(0);
      
      // Wait for grace period to end
      jest.advanceTimersByTime(200);
      
      // Trigger violation after grace period
      const copyEvent2 = new ClipboardEvent('copy', { bubbles: true });
      document.dispatchEvent(copyEvent2);
      
      violations = quizEngine.getIntegrityViolations();
      expect(violations).toHaveLength(1);
    });

    it('should clean up properly on session abandonment', async () => {
      await quizEngine.initialize(questions);
      quizEngine.createSession();
      quizEngine.startSession();
      
      quizEngine.abandonSession();
      
      expect(mockRemoveEventListener).toHaveBeenCalled();
      
      const session = quizEngine.getCurrentSession();
      expect(session?.status).toBe('completed');
    });
  });

  describe('Selective Integrity Enforcement', () => {
    it('should only enforce enabled features', async () => {
      const selectiveConfig = {
        preventCopyPaste: true,
        blockRightClick: false,
        blockDevTools: false,
        enforceFullscreen: false,
        monitorPageVisibility: false,
        flagOnViolation: true,
        gracePeriodMs: 100
      };

      const selectiveEngine = new QuizEngine(quizConfig, selectiveConfig);
      await selectiveEngine.initialize(questions);
      selectiveEngine.createSession();
      selectiveEngine.startSession();
      
      jest.advanceTimersByTime(200);
      
      // Should prevent copy/paste
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      document.dispatchEvent(copyEvent);
      
      // Should not prevent right-click
      const rightClickEvent = new MouseEvent('mousedown', {
        button: 2,
        bubbles: true
      });
      const preventDefaultSpy = jest.spyOn(rightClickEvent, 'preventDefault');
      document.dispatchEvent(rightClickEvent);
      
      const violations = selectiveEngine.getIntegrityViolations();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('copy-paste');
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      
      selectiveEngine.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle integrity enforcer creation failure gracefully', async () => {
      // Create engine without integrity config
      const engineWithoutIntegrity = new QuizEngine(quizConfig);
      await engineWithoutIntegrity.initialize(questions);
      engineWithoutIntegrity.createSession();
      
      // Should not throw error
      expect(() => {
        engineWithoutIntegrity.startSession();
      }).not.toThrow();
      
      expect(engineWithoutIntegrity.getIntegrityEnforcer()).toBeUndefined();
      expect(engineWithoutIntegrity.getIntegrityViolations()).toEqual([]);
      
      engineWithoutIntegrity.destroy();
    });

    it('should handle fullscreen request failure', async () => {
      await quizEngine.initialize(questions);
      quizEngine.createSession();
      quizEngine.startSession();
      
      const enforcer = quizEngine.getIntegrityEnforcer();
      mockRequestFullscreen.mockRejectedValue(new Error('Not allowed'));
      
      const result = await enforcer!.requestFullscreen();
      expect(result).toBe(false);
    });
  });
});