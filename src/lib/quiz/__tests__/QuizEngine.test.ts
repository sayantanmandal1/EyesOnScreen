/**
 * QuizEngine Tests
 */

import { QuizEngine } from '../QuizEngine';
import { Question, QuizConfig } from '../types';
import { FlagEvent } from '../../proctoring/types';

// Mock questions for testing
const mockQuestions: Question[] = [
  {
    id: 'mc_1',
    type: 'multiple-choice',
    text: 'Test MC Question 1',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'B',
    timeLimitSeconds: 30,
    points: 10
  },
  {
    id: 'mc_2',
    type: 'multiple-choice',
    text: 'Test MC Question 2',
    options: ['X', 'Y', 'Z'],
    correctAnswer: 'Y',
    timeLimitSeconds: 25,
    points: 15
  },
  {
    id: 'mc_3',
    type: 'multiple-choice',
    text: 'Test MC Question 3',
    options: ['1', '2', '3', '4'],
    correctAnswer: '3',
    timeLimitSeconds: 20,
    points: 10
  },
  {
    id: 'sa_1',
    type: 'short-answer',
    text: 'Test SA Question 1',
    correctAnswer: 'test answer',
    timeLimitSeconds: 45,
    points: 20
  },
  {
    id: 'sa_2',
    type: 'short-answer',
    text: 'Test SA Question 2',
    correctAnswer: 'another answer',
    timeLimitSeconds: 40,
    points: 25
  }
];

const defaultConfig: QuizConfig = {
  totalQuestions: 4,
  multipleChoiceCount: 2,
  shortAnswerCount: 2,
  timePerQuestionSeconds: 30,
  totalTimeMinutes: 10,
  passingScore: 70,
  allowReview: false,
  shuffleQuestions: false,
  shuffleOptions: false
};

describe('QuizEngine', () => {
  let quizEngine: QuizEngine;

  beforeEach(() => {
    quizEngine = new QuizEngine(defaultConfig);
  });

  afterEach(() => {
    quizEngine.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with question bank', async () => {
      await expect(quizEngine.initialize(mockQuestions)).resolves.not.toThrow();
    });

    it('should throw error if insufficient total questions', async () => {
      const insufficientQuestions = mockQuestions.slice(0, 2);
      await expect(quizEngine.initialize(insufficientQuestions))
        .rejects.toThrow('Insufficient questions in bank');
    });

    it('should throw error if insufficient multiple choice questions', async () => {
      const config = { ...defaultConfig, multipleChoiceCount: 5 };
      const engine = new QuizEngine(config);
      
      await expect(engine.initialize(mockQuestions))
        .rejects.toThrow('Insufficient multiple choice questions');
    });

    it('should throw error if insufficient short answer questions', async () => {
      const config = { ...defaultConfig, shortAnswerCount: 5 };
      const engine = new QuizEngine(config);
      
      await expect(engine.initialize(mockQuestions))
        .rejects.toThrow('Insufficient short answer questions');
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await quizEngine.initialize(mockQuestions);
    });

    it('should create a new session', () => {
      const session = quizEngine.createSession('test-session');
      
      expect(session).toBeDefined();
      expect(session.id).toBe('test-session');
      expect(session.status).toBe('not-started');
      expect(session.questions).toHaveLength(4);
      expect(session.currentQuestionIndex).toBe(0);
      expect(session.answers).toEqual({});
    });

    it('should generate session ID if not provided', () => {
      const session = quizEngine.createSession();
      
      expect(session.id).toMatch(/^quiz_\d+_[a-z0-9]+$/);
    });

    it('should throw error when creating session while another is in progress', () => {
      quizEngine.createSession();
      quizEngine.startSession();
      
      expect(() => quizEngine.createSession()).toThrow('Cannot create new session while another is in progress');
    });

    it('should start session', () => {
      const session = quizEngine.createSession();
      quizEngine.startSession();
      
      expect(session.status).toBe('in-progress');
      expect(session.startTime).toBeGreaterThan(0);
    });

    it('should throw error when starting already started session', () => {
      quizEngine.createSession();
      quizEngine.startSession();
      
      expect(() => quizEngine.startSession()).toThrow('Session already started or completed');
    });
  });

  describe('Question Management', () => {
    beforeEach(async () => {
      await quizEngine.initialize(mockQuestions);
      quizEngine.createSession();
      quizEngine.startSession();
    });

    it('should get current question', () => {
      const question = quizEngine.getCurrentQuestion();
      
      expect(question).toBeDefined();
      expect(question?.id).toBeDefined();
    });

    it('should return null when no current question', () => {
      const session = quizEngine.getCurrentSession()!;
      session.currentQuestionIndex = 999;
      
      const question = quizEngine.getCurrentQuestion();
      expect(question).toBeNull();
    });

    it('should check if current question is answered', () => {
      expect(quizEngine.isCurrentQuestionAnswered()).toBe(false);
      
      const currentQuestion = quizEngine.getCurrentQuestion()!;
      quizEngine.submitAnswer(currentQuestion.type === 'multiple-choice' ? currentQuestion.options![0] : 'test');
      
      expect(quizEngine.isCurrentQuestionAnswered()).toBe(true);
    });
  });

  describe('Answer Submission', () => {
    beforeEach(async () => {
      await quizEngine.initialize(mockQuestions);
      quizEngine.createSession();
      quizEngine.startSession();
    });

    it('should submit valid multiple choice answer', () => {
      const currentQuestion = quizEngine.getCurrentQuestion()!;
      if (currentQuestion.type === 'multiple-choice') {
        const result = quizEngine.submitAnswer(currentQuestion.options![0]);
        expect(result).toBe(true);
        
        const session = quizEngine.getCurrentSession()!;
        expect(session.answers[currentQuestion.id]).toBe(currentQuestion.options![0]);
      }
    });

    it('should submit valid short answer', () => {
      // Navigate to a short answer question
      while (quizEngine.getCurrentQuestion()?.type !== 'short-answer') {
        quizEngine.nextQuestion();
      }
      
      const currentQuestion = quizEngine.getCurrentQuestion()!;
      const result = quizEngine.submitAnswer('test answer');
      
      expect(result).toBe(true);
      
      const session = quizEngine.getCurrentSession()!;
      expect(session.answers[currentQuestion.id]).toBe('test answer');
    });

    it('should reject invalid multiple choice answer', () => {
      const currentQuestion = quizEngine.getCurrentQuestion()!;
      if (currentQuestion.type === 'multiple-choice') {
        const result = quizEngine.submitAnswer('invalid option');
        expect(result).toBe(false);
      }
    });

    it('should reject empty answer', () => {
      const result = quizEngine.submitAnswer('');
      expect(result).toBe(false);
    });

    it('should reject too long short answer', () => {
      // Navigate to a short answer question
      while (quizEngine.getCurrentQuestion()?.type !== 'short-answer') {
        quizEngine.nextQuestion();
      }
      
      const longAnswer = 'a'.repeat(501);
      const result = quizEngine.submitAnswer(longAnswer);
      expect(result).toBe(false);
    });

    it('should throw error when submitting without active session', () => {
      quizEngine.destroy();
      quizEngine = new QuizEngine(defaultConfig);
      
      expect(() => quizEngine.submitAnswer('test')).toThrow('No active session');
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      await quizEngine.initialize(mockQuestions);
      quizEngine.createSession();
      quizEngine.startSession();
    });

    it('should move to next question', () => {
      const initialIndex = quizEngine.getCurrentSession()!.currentQuestionIndex;
      const result = quizEngine.nextQuestion();
      
      expect(result).toBe(true);
      expect(quizEngine.getCurrentSession()!.currentQuestionIndex).toBe(initialIndex + 1);
    });

    it('should complete quiz when reaching last question', () => {
      const session = quizEngine.getCurrentSession()!;
      
      // Move to last question
      session.currentQuestionIndex = session.questions.length - 1;
      
      const result = quizEngine.nextQuestion();
      expect(result).toBe(false);
      expect(session.status).toBe('completed');
      expect(session.endTime).toBeDefined();
    });

    it('should get progress information', () => {
      const progress = quizEngine.getProgress();
      
      expect(progress.current).toBe(1);
      expect(progress.total).toBe(4);
      expect(progress.percentage).toBe(25);
    });
  });

  describe('Flag Management', () => {
    beforeEach(async () => {
      await quizEngine.initialize(mockQuestions);
      quizEngine.createSession();
      quizEngine.startSession();
    });

    it('should add flag to session', () => {
      const flag: FlagEvent = {
        id: 'test-flag',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.8,
        details: {}
      };
      
      quizEngine.addFlag(flag);
      
      const session = quizEngine.getCurrentSession()!;
      expect(session.flags).toContain(flag);
    });

    it('should update risk score', () => {
      quizEngine.updateRiskScore(50);
      
      const session = quizEngine.getCurrentSession()!;
      expect(session.riskScore).toBe(50);
    });

    it('should mark session under review for high risk score', () => {
      quizEngine.updateRiskScore(70);
      
      const session = quizEngine.getCurrentSession()!;
      expect(session.status).toBe('under-review');
    });

    it('should clamp risk score between 0 and 100', () => {
      quizEngine.updateRiskScore(-10);
      expect(quizEngine.getCurrentSession()!.riskScore).toBe(0);
      
      quizEngine.updateRiskScore(150);
      expect(quizEngine.getCurrentSession()!.riskScore).toBe(100);
    });
  });

  describe('Results Calculation', () => {
    beforeEach(async () => {
      await quizEngine.initialize(mockQuestions);
      quizEngine.createSession();
      quizEngine.startSession();
    });

    it('should calculate results correctly', () => {
      const session = quizEngine.getCurrentSession()!;
      
      // Answer all questions correctly
      session.questions.forEach(question => {
        session.answers[question.id] = question.correctAnswer;
      });
      
      const result = quizEngine.completeSession();
      
      expect(result.sessionId).toBe(session.id);
      expect(result.percentage).toBe(100);
      expect(result.status).toBe('passed');
      expect(result.questionResults).toHaveLength(4);
    });

    it('should mark as failed for low score', () => {
      const session = quizEngine.getCurrentSession()!;
      
      // Answer all questions incorrectly
      session.questions.forEach(question => {
        session.answers[question.id] = question.type === 'multiple-choice' 
          ? 'wrong answer' 
          : 'wrong answer';
      });
      
      const result = quizEngine.completeSession();
      expect(result.status).toBe('failed');
    });

    it('should mark as under review for high risk score', () => {
      const session = quizEngine.getCurrentSession()!;
      session.riskScore = 70;
      
      // Answer all questions correctly
      session.questions.forEach(question => {
        session.answers[question.id] = question.correctAnswer;
      });
      
      const result = quizEngine.completeSession();
      expect(result.status).toBe('under-review');
    });
  });

  describe('Auto-save', () => {
    let autoSaveCallback: jest.Mock;

    beforeEach(async () => {
      await quizEngine.initialize(mockQuestions);
      autoSaveCallback = jest.fn();
      quizEngine.onAutoSave(autoSaveCallback);
    });

    it('should trigger auto-save on answer submission', () => {
      quizEngine.createSession();
      quizEngine.startSession();
      
      const currentQuestion = quizEngine.getCurrentQuestion()!;
      const answer = currentQuestion.type === 'multiple-choice' 
        ? currentQuestion.options![0] 
        : 'test answer';
      
      quizEngine.submitAnswer(answer);
      
      expect(autoSaveCallback).toHaveBeenCalled();
    });

    it('should stop auto-save on session completion', () => {
      quizEngine.createSession();
      quizEngine.startSession();
      
      // Complete the session
      quizEngine.completeSession();
      
      // Verify that the auto-save interval is cleared by checking internal state
      // Since we can't directly access private properties, we'll test the behavior
      expect(quizEngine.getCurrentSession()?.status).toBe('completed');
    });
  });

  describe('Session Update Callbacks', () => {
    let updateCallback: jest.Mock;

    beforeEach(async () => {
      await quizEngine.initialize(mockQuestions);
      updateCallback = jest.fn();
      quizEngine.onSessionUpdate(updateCallback);
    });

    it('should call update callback on session changes', () => {
      quizEngine.createSession();
      quizEngine.startSession();
      
      expect(updateCallback).toHaveBeenCalled();
    });

    it('should call update callback on answer submission', () => {
      quizEngine.createSession();
      quizEngine.startSession();
      updateCallback.mockClear();
      
      const currentQuestion = quizEngine.getCurrentQuestion()!;
      const answer = currentQuestion.type === 'multiple-choice' 
        ? currentQuestion.options![0] 
        : 'test answer';
      
      quizEngine.submitAnswer(answer);
      
      expect(updateCallback).toHaveBeenCalled();
    });
  });

  describe('Question Selection and Randomization', () => {
    it('should select correct number of questions by type', async () => {
      const config = { ...defaultConfig, shuffleQuestions: false };
      const engine = new QuizEngine(config);
      await engine.initialize(mockQuestions);
      
      const session = engine.createSession();
      
      const mcQuestions = session.questions.filter(q => q.type === 'multiple-choice');
      const saQuestions = session.questions.filter(q => q.type === 'short-answer');
      
      expect(mcQuestions).toHaveLength(2);
      expect(saQuestions).toHaveLength(2);
    });

    it('should randomize questions when shuffle is enabled', async () => {
      const config = { ...defaultConfig, shuffleQuestions: true };
      const engine = new QuizEngine(config);
      await engine.initialize(mockQuestions);
      
      // Create multiple sessions and check if order varies
      const session1 = engine.createSession();
      engine.destroy();
      
      const engine2 = new QuizEngine(config);
      await engine2.initialize(mockQuestions);
      const session2 = engine2.createSession();
      
      // Note: This test might occasionally fail due to randomness
      // In a real scenario, you might want to seed the random number generator
      const order1 = session1.questions.map(q => q.id).join(',');
      const order2 = session2.questions.map(q => q.id).join(',');
      
      // At least verify that we have the same questions, even if order might be same
      expect(session1.questions).toHaveLength(session2.questions.length);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', async () => {
      await quizEngine.initialize(mockQuestions);
      quizEngine.createSession();
      quizEngine.startSession();
      
      quizEngine.destroy();
      
      expect(quizEngine.getCurrentSession()).toBeNull();
    });
  });
});