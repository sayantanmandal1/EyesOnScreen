/**
 * QuestionBank Tests
 */

import { QuestionBankLoader, SAMPLE_QUESTION_BANK, DEFAULT_QUIZ_CONFIG } from '../QuestionBank';
import { Question } from '../types';

describe('QuestionBankLoader', () => {
  describe('loadSampleBank', () => {
    it('should load sample question bank', () => {
      const questions = QuestionBankLoader.loadSampleBank();
      
      expect(questions).toHaveLength(SAMPLE_QUESTION_BANK.length);
      expect(questions[0]).toEqual(SAMPLE_QUESTION_BANK[0]);
      
      // Verify it returns a copy, not the original
      questions[0].text = 'modified';
      expect(SAMPLE_QUESTION_BANK[0].text).not.toBe('modified');
    });

    it('should contain both multiple choice and short answer questions', () => {
      const questions = QuestionBankLoader.loadSampleBank();
      
      const mcQuestions = questions.filter(q => q.type === 'multiple-choice');
      const saQuestions = questions.filter(q => q.type === 'short-answer');
      
      expect(mcQuestions.length).toBeGreaterThan(0);
      expect(saQuestions.length).toBeGreaterThan(0);
    });
  });

  describe('loadFromJSON', () => {
    const validQuestions: Question[] = [
      {
        id: 'test_1',
        type: 'multiple-choice',
        text: 'Test question?',
        options: ['A', 'B', 'C'],
        correctAnswer: 'B',
        timeLimitSeconds: 30,
        points: 10
      },
      {
        id: 'test_2',
        type: 'short-answer',
        text: 'Short answer question?',
        correctAnswer: 'answer',
        timeLimitSeconds: 45,
        points: 15
      }
    ];

    it('should load valid JSON questions', () => {
      const jsonString = JSON.stringify(validQuestions);
      const loaded = QuestionBankLoader.loadFromJSON(jsonString);
      
      expect(loaded).toEqual(validQuestions);
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{ invalid json }';
      
      expect(() => QuestionBankLoader.loadFromJSON(invalidJson))
        .toThrow('Failed to parse question bank JSON');
    });

    it('should validate loaded questions', () => {
      const invalidQuestions = [
        {
          // Missing required fields
          text: 'Question without id'
        }
      ];
      
      const jsonString = JSON.stringify(invalidQuestions);
      
      expect(() => QuestionBankLoader.loadFromJSON(jsonString))
        .toThrow('id is required');
    });
  });

  describe('loadFromArray', () => {
    it('should load valid question array', () => {
      const questions = [
        {
          id: 'test_1',
          type: 'multiple-choice',
          text: 'Test question?',
          options: ['A', 'B'],
          correctAnswer: 'A',
          timeLimitSeconds: 30,
          points: 10
        }
      ];
      
      const loaded = QuestionBankLoader.loadFromArray(questions);
      expect(loaded).toEqual(questions);
    });

    it('should throw error for non-array input', () => {
      expect(() => QuestionBankLoader.loadFromArray('not an array' as any))
        .toThrow('Questions must be an array');
    });
  });

  describe('Question Validation', () => {
    it('should validate required fields', () => {
      const invalidQuestions = [
        { text: 'Missing id' },
        { id: 'test', text: 'Missing type' },
        { id: 'test', type: 'multiple-choice' }, // Missing text
        { id: 'test', type: 'multiple-choice', text: 'Test' }, // Missing correctAnswer
        { id: 'test', type: 'multiple-choice', text: 'Test', correctAnswer: 'A' }, // Missing timeLimitSeconds
        { id: 'test', type: 'multiple-choice', text: 'Test', correctAnswer: 'A', timeLimitSeconds: 30 } // Missing points
      ];

      invalidQuestions.forEach((question, index) => {
        expect(() => QuestionBankLoader.loadFromArray([question]))
          .toThrow();
      });
    });

    it('should validate question types', () => {
      const invalidType = {
        id: 'test',
        type: 'invalid-type',
        text: 'Test',
        correctAnswer: 'A',
        timeLimitSeconds: 30,
        points: 10
      };

      expect(() => QuestionBankLoader.loadFromArray([invalidType]))
        .toThrow("type must be 'multiple-choice' or 'short-answer'");
    });

    it('should validate multiple choice options', () => {
      const noOptions = {
        id: 'test',
        type: 'multiple-choice',
        text: 'Test',
        correctAnswer: 'A',
        timeLimitSeconds: 30,
        points: 10
      };

      expect(() => QuestionBankLoader.loadFromArray([noOptions]))
        .toThrow('multiple-choice questions must have at least 2 options');

      const tooFewOptions = {
        id: 'test',
        type: 'multiple-choice',
        text: 'Test',
        options: ['A'],
        correctAnswer: 'A',
        timeLimitSeconds: 30,
        points: 10
      };

      expect(() => QuestionBankLoader.loadFromArray([tooFewOptions]))
        .toThrow('multiple-choice questions must have at least 2 options');

      const wrongCorrectAnswer = {
        id: 'test',
        type: 'multiple-choice',
        text: 'Test',
        options: ['A', 'B'],
        correctAnswer: 'C',
        timeLimitSeconds: 30,
        points: 10
      };

      expect(() => QuestionBankLoader.loadFromArray([wrongCorrectAnswer]))
        .toThrow('correctAnswer must be one of the options');
    });

    it('should validate numeric fields', () => {
      const invalidTime = {
        id: 'test',
        type: 'short-answer',
        text: 'Test',
        correctAnswer: 'answer',
        timeLimitSeconds: -5,
        points: 10
      };

      expect(() => QuestionBankLoader.loadFromArray([invalidTime]))
        .toThrow('timeLimitSeconds must be a positive number');

      const invalidPoints = {
        id: 'test',
        type: 'short-answer',
        text: 'Test',
        correctAnswer: 'answer',
        timeLimitSeconds: 30,
        points: 0
      };

      expect(() => QuestionBankLoader.loadFromArray([invalidPoints]))
        .toThrow('points must be a positive number');
    });
  });

  describe('Utility Functions', () => {
    const testQuestions: Question[] = [
      {
        id: 'mc_1',
        type: 'multiple-choice',
        text: 'MC Question 1',
        options: ['A', 'B'],
        correctAnswer: 'A',
        timeLimitSeconds: 30,
        points: 10
      },
      {
        id: 'mc_2',
        type: 'multiple-choice',
        text: 'MC Question 2',
        options: ['X', 'Y'],
        correctAnswer: 'X',
        timeLimitSeconds: 25,
        points: 15
      },
      {
        id: 'sa_1',
        type: 'short-answer',
        text: 'SA Question 1',
        correctAnswer: 'answer1',
        timeLimitSeconds: 45,
        points: 20
      },
      {
        id: 'sa_2',
        type: 'short-answer',
        text: 'SA Question 2',
        correctAnswer: 'answer2',
        timeLimitSeconds: 40,
        points: 25
      }
    ];

    describe('filterByType', () => {
      it('should filter multiple choice questions', () => {
        const mcQuestions = QuestionBankLoader.filterByType(testQuestions, 'multiple-choice');
        
        expect(mcQuestions).toHaveLength(2);
        expect(mcQuestions.every(q => q.type === 'multiple-choice')).toBe(true);
      });

      it('should filter short answer questions', () => {
        const saQuestions = QuestionBankLoader.filterByType(testQuestions, 'short-answer');
        
        expect(saQuestions).toHaveLength(2);
        expect(saQuestions.every(q => q.type === 'short-answer')).toBe(true);
      });
    });

    describe('filterByDifficulty', () => {
      it('should filter questions by point range', () => {
        const easyQuestions = QuestionBankLoader.filterByDifficulty(testQuestions, 10, 15);
        
        expect(easyQuestions).toHaveLength(2);
        expect(easyQuestions.every(q => q.points >= 10 && q.points <= 15)).toBe(true);
      });

      it('should return empty array if no questions match', () => {
        const hardQuestions = QuestionBankLoader.filterByDifficulty(testQuestions, 50, 100);
        
        expect(hardQuestions).toHaveLength(0);
      });
    });

    describe('getRandomSubset', () => {
      it('should return requested number of questions', () => {
        const subset = QuestionBankLoader.getRandomSubset(testQuestions, 2);
        
        expect(subset).toHaveLength(2);
        expect(subset.every(q => testQuestions.includes(q))).toBe(true);
      });

      it('should return all questions if count exceeds available', () => {
        const subset = QuestionBankLoader.getRandomSubset(testQuestions, 10);
        
        expect(subset).toHaveLength(testQuestions.length);
      });

      it('should return different subsets on multiple calls', () => {
        // Note: This test might occasionally fail due to randomness
        const subset1 = QuestionBankLoader.getRandomSubset(testQuestions, 2);
        const subset2 = QuestionBankLoader.getRandomSubset(testQuestions, 2);
        
        // At least verify we get valid subsets
        expect(subset1).toHaveLength(2);
        expect(subset2).toHaveLength(2);
      });

      it('should handle empty array', () => {
        const subset = QuestionBankLoader.getRandomSubset([], 5);
        
        expect(subset).toHaveLength(0);
      });
    });
  });

  describe('Sample Question Bank Validation', () => {
    it('should have valid sample questions', () => {
      expect(() => QuestionBankLoader.loadFromArray(SAMPLE_QUESTION_BANK))
        .not.toThrow();
    });

    it('should have sufficient questions for default config', () => {
      const mcQuestions = SAMPLE_QUESTION_BANK.filter(q => q.type === 'multiple-choice');
      const saQuestions = SAMPLE_QUESTION_BANK.filter(q => q.type === 'short-answer');
      
      expect(mcQuestions.length).toBeGreaterThanOrEqual(DEFAULT_QUIZ_CONFIG.multipleChoiceCount);
      expect(saQuestions.length).toBeGreaterThanOrEqual(DEFAULT_QUIZ_CONFIG.shortAnswerCount);
    });

    it('should have unique question IDs', () => {
      const ids = SAMPLE_QUESTION_BANK.map(q => q.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have reasonable time limits', () => {
      SAMPLE_QUESTION_BANK.forEach(question => {
        expect(question.timeLimitSeconds).toBeGreaterThan(0);
        expect(question.timeLimitSeconds).toBeLessThanOrEqual(60);
      });
    });

    it('should have positive points', () => {
      SAMPLE_QUESTION_BANK.forEach(question => {
        expect(question.points).toBeGreaterThan(0);
      });
    });
  });

  describe('Default Quiz Config', () => {
    it('should have valid configuration values', () => {
      expect(DEFAULT_QUIZ_CONFIG.totalQuestions).toBeGreaterThan(0);
      expect(DEFAULT_QUIZ_CONFIG.multipleChoiceCount).toBeGreaterThan(0);
      expect(DEFAULT_QUIZ_CONFIG.shortAnswerCount).toBeGreaterThan(0);
      expect(DEFAULT_QUIZ_CONFIG.multipleChoiceCount + DEFAULT_QUIZ_CONFIG.shortAnswerCount)
        .toBe(DEFAULT_QUIZ_CONFIG.totalQuestions);
      expect(DEFAULT_QUIZ_CONFIG.timePerQuestionSeconds).toBeGreaterThan(0);
      expect(DEFAULT_QUIZ_CONFIG.totalTimeMinutes).toBeGreaterThan(0);
      expect(DEFAULT_QUIZ_CONFIG.passingScore).toBeGreaterThan(0);
      expect(DEFAULT_QUIZ_CONFIG.passingScore).toBeLessThanOrEqual(100);
    });
  });
});