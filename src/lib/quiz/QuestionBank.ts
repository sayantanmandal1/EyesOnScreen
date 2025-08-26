/**
 * QuestionBank - Sample question bank and loading utilities
 * 
 * Provides sample questions for the quiz system and utilities
 * for loading questions from various sources.
 */

import { Question } from './types';

/**
 * Sample question bank for demonstration and testing
 */
export const SAMPLE_QUESTION_BANK: Question[] = [
  // Multiple Choice Questions
  {
    id: 'mc_001',
    type: 'multiple-choice',
    text: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctAnswer: 'Paris',
    timeLimitSeconds: 30,
    points: 10
  },
  {
    id: 'mc_002',
    type: 'multiple-choice',
    text: 'Which programming language is known for its use in web development?',
    options: ['Python', 'JavaScript', 'C++', 'Assembly'],
    correctAnswer: 'JavaScript',
    timeLimitSeconds: 25,
    points: 10
  },
  {
    id: 'mc_003',
    type: 'multiple-choice',
    text: 'What does HTML stand for?',
    options: ['Hyper Text Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language', 'Hyperlink and Text Markup Language'],
    correctAnswer: 'Hyper Text Markup Language',
    timeLimitSeconds: 30,
    points: 10
  },
  {
    id: 'mc_004',
    type: 'multiple-choice',
    text: 'Which of the following is a NoSQL database?',
    options: ['MySQL', 'PostgreSQL', 'MongoDB', 'SQLite'],
    correctAnswer: 'MongoDB',
    timeLimitSeconds: 25,
    points: 10
  },
  {
    id: 'mc_005',
    type: 'multiple-choice',
    text: 'What is the time complexity of binary search?',
    options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
    correctAnswer: 'O(log n)',
    timeLimitSeconds: 30,
    points: 15
  },
  {
    id: 'mc_006',
    type: 'multiple-choice',
    text: 'Which HTTP status code indicates "Not Found"?',
    options: ['200', '404', '500', '301'],
    correctAnswer: '404',
    timeLimitSeconds: 20,
    points: 10
  },
  {
    id: 'mc_007',
    type: 'multiple-choice',
    text: 'What does CSS stand for?',
    options: ['Computer Style Sheets', 'Cascading Style Sheets', 'Creative Style Sheets', 'Colorful Style Sheets'],
    correctAnswer: 'Cascading Style Sheets',
    timeLimitSeconds: 25,
    points: 10
  },
  {
    id: 'mc_008',
    type: 'multiple-choice',
    text: 'Which data structure uses LIFO (Last In, First Out) principle?',
    options: ['Queue', 'Stack', 'Array', 'Linked List'],
    correctAnswer: 'Stack',
    timeLimitSeconds: 25,
    points: 10
  },
  {
    id: 'mc_009',
    type: 'multiple-choice',
    text: 'What is the default port for HTTPS?',
    options: ['80', '443', '8080', '3000'],
    correctAnswer: '443',
    timeLimitSeconds: 20,
    points: 10
  },
  {
    id: 'mc_010',
    type: 'multiple-choice',
    text: 'Which of the following is NOT a JavaScript framework?',
    options: ['React', 'Angular', 'Vue', 'Laravel'],
    correctAnswer: 'Laravel',
    timeLimitSeconds: 25,
    points: 10
  },

  // Short Answer Questions
  {
    id: 'sa_001',
    type: 'short-answer',
    text: 'What does API stand for? (Provide the full form)',
    correctAnswer: 'Application Programming Interface',
    timeLimitSeconds: 30,
    points: 15
  },
  {
    id: 'sa_002',
    type: 'short-answer',
    text: 'Name the process of converting source code into machine code.',
    correctAnswer: 'Compilation',
    timeLimitSeconds: 25,
    points: 15
  },
  {
    id: 'sa_003',
    type: 'short-answer',
    text: 'What is the term for a variable that can hold multiple values of the same type?',
    correctAnswer: 'Array',
    timeLimitSeconds: 25,
    points: 15
  },
  {
    id: 'sa_004',
    type: 'short-answer',
    text: 'What does SQL stand for?',
    correctAnswer: 'Structured Query Language',
    timeLimitSeconds: 30,
    points: 15
  },
  {
    id: 'sa_005',
    type: 'short-answer',
    text: 'Name the design pattern that ensures a class has only one instance.',
    correctAnswer: 'Singleton',
    timeLimitSeconds: 30,
    points: 20
  },
  {
    id: 'sa_006',
    type: 'short-answer',
    text: 'What is the term for writing code that can run on multiple platforms without modification?',
    correctAnswer: 'Cross-platform',
    timeLimitSeconds: 30,
    points: 15
  },
  {
    id: 'sa_007',
    type: 'short-answer',
    text: 'What does DOM stand for in web development?',
    correctAnswer: 'Document Object Model',
    timeLimitSeconds: 30,
    points: 15
  },
  {
    id: 'sa_008',
    type: 'short-answer',
    text: 'Name the HTTP method used to retrieve data from a server.',
    correctAnswer: 'GET',
    timeLimitSeconds: 20,
    points: 10
  }
];

/**
 * Default quiz configuration
 */
export const DEFAULT_QUIZ_CONFIG = {
  totalQuestions: 10,
  multipleChoiceCount: 7,
  shortAnswerCount: 3,
  timePerQuestionSeconds: 30,
  totalTimeMinutes: 15,
  passingScore: 70,
  allowReview: false,
  shuffleQuestions: true,
  shuffleOptions: true
};

/**
 * Question bank loader utility
 */
export class QuestionBankLoader {
  /**
   * Load sample question bank
   */
  static loadSampleBank(): Question[] {
    return SAMPLE_QUESTION_BANK.map(q => ({ ...q, options: q.options ? [...q.options] : undefined }));
  }

  /**
   * Load questions from JSON data
   */
  static loadFromJSON(jsonData: string): Question[] {
    try {
      const data = JSON.parse(jsonData);
      return this.validateQuestions(data);
    } catch (error) {
      throw new Error(`Failed to parse question bank JSON: ${error}`);
    }
  }

  /**
   * Load questions from array
   */
  static loadFromArray(questions: any[]): Question[] {
    return this.validateQuestions(questions);
  }

  /**
   * Validate question format
   */
  private static validateQuestions(questions: any[]): Question[] {
    if (!Array.isArray(questions)) {
      throw new Error('Questions must be an array');
    }

    return questions.map((q, index) => {
      if (!q.id || typeof q.id !== 'string') {
        throw new Error(`Question ${index}: id is required and must be a string`);
      }

      if (!q.type || !['multiple-choice', 'short-answer'].includes(q.type)) {
        throw new Error(`Question ${index}: type must be 'multiple-choice' or 'short-answer'`);
      }

      if (!q.text || typeof q.text !== 'string') {
        throw new Error(`Question ${index}: text is required and must be a string`);
      }

      if (!q.correctAnswer || typeof q.correctAnswer !== 'string') {
        throw new Error(`Question ${index}: correctAnswer is required and must be a string`);
      }

      if (typeof q.timeLimitSeconds !== 'number' || q.timeLimitSeconds <= 0) {
        throw new Error(`Question ${index}: timeLimitSeconds must be a positive number`);
      }

      if (typeof q.points !== 'number' || q.points <= 0) {
        throw new Error(`Question ${index}: points must be a positive number`);
      }

      if (q.type === 'multiple-choice') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          throw new Error(`Question ${index}: multiple-choice questions must have at least 2 options`);
        }

        if (!q.options.includes(q.correctAnswer)) {
          throw new Error(`Question ${index}: correctAnswer must be one of the options`);
        }
      }

      return q as Question;
    });
  }

  /**
   * Filter questions by type
   */
  static filterByType(questions: Question[], type: 'multiple-choice' | 'short-answer'): Question[] {
    return questions.filter(q => q.type === type);
  }

  /**
   * Get questions by difficulty (based on points)
   */
  static filterByDifficulty(questions: Question[], minPoints: number, maxPoints: number): Question[] {
    return questions.filter(q => q.points >= minPoints && q.points <= maxPoints);
  }

  /**
   * Get random subset of questions
   */
  static getRandomSubset(questions: Question[], count: number): Question[] {
    if (count >= questions.length) {
      return [...questions];
    }

    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }
}