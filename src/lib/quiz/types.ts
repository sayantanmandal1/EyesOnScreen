/**
 * Quiz module type definitions
 */

import { FlagEvent } from '../proctoring/types';

export interface Question {
  id: string;
  type: 'multiple-choice' | 'short-answer';
  text: string;
  options?: string[];
  correctAnswer: string;
  timeLimitSeconds: number;
  points: number;
}

export interface QuizSession {
  id: string;
  questions: Question[];
  answers: Record<string, string>;
  startTime: number;
  endTime?: number;
  currentQuestionIndex: number;
  flags: FlagEvent[];
  riskScore: number;
  status: 'not-started' | 'in-progress' | 'completed' | 'under-review';
}

export interface QuizConfig {
  totalQuestions: number;
  multipleChoiceCount: number;
  shortAnswerCount: number;
  timePerQuestionSeconds: number;
  totalTimeMinutes: number;
  passingScore: number;
  allowReview: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export interface QuizResult {
  sessionId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  timeSpent: number;
  flagCount: number;
  riskScore: number;
  status: 'passed' | 'failed' | 'under-review';
  questionResults: QuestionResult[];
}

export interface QuestionResult {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  points: number;
  timeSpent: number;
  flags: FlagEvent[];
}

export interface TimerState {
  questionStartTime: number;
  questionTimeLimit: number;
  totalStartTime: number;
  totalTimeLimit: number;
  isPaused: boolean;
  remainingTime: number;
}

export interface IntegrityViolation {
  type: 'copy-paste' | 'right-click' | 'dev-tools' | 'fullscreen-exit' | 'tab-blur';
  timestamp: number;
  details: Record<string, unknown>;
}