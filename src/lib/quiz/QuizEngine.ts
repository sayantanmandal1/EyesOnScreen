/**
 * QuizEngine - Core quiz orchestration and management
 * 
 * Handles question loading, randomization, answer collection,
 * validation, and auto-save functionality.
 */

import { Question, QuizSession, QuizConfig, QuizResult, QuestionResult, IntegrityViolation } from './types';
import { FlagEvent } from '../proctoring/types';
import { IntegrityEnforcer, IntegrityConfig } from './IntegrityEnforcer';

export class QuizEngine {
  private session: QuizSession | null = null;
  private config: QuizConfig;
  private questionBank: Question[] = [];
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private sessionUpdateCallback?: (session: QuizSession) => void;
  private autoSaveCallback?: (session: QuizSession) => void;
  private integrityEnforcer?: IntegrityEnforcer;
  private integrityConfig?: IntegrityConfig;

  constructor(config: QuizConfig, integrityConfig?: IntegrityConfig) {
    this.config = config;
    this.integrityConfig = integrityConfig;
  }

  /**
   * Initialize the quiz engine with question bank
   */
  async initialize(questionBank: Question[]): Promise<void> {
    this.questionBank = [...questionBank];
    
    if (this.questionBank.length < this.config.totalQuestions) {
      throw new Error(`Insufficient questions in bank. Need ${this.config.totalQuestions}, have ${this.questionBank.length}`);
    }

    // Validate question distribution
    const mcQuestions = this.questionBank.filter(q => q.type === 'multiple-choice');
    const saQuestions = this.questionBank.filter(q => q.type === 'short-answer');

    if (mcQuestions.length < this.config.multipleChoiceCount) {
      throw new Error(`Insufficient multiple choice questions. Need ${this.config.multipleChoiceCount}, have ${mcQuestions.length}`);
    }

    if (saQuestions.length < this.config.shortAnswerCount) {
      throw new Error(`Insufficient short answer questions. Need ${this.config.shortAnswerCount}, have ${saQuestions.length}`);
    }
  }

  /**
   * Create a new quiz session with randomized questions
   */
  createSession(sessionId?: string): QuizSession {
    if (this.session && this.session.status === 'in-progress') {
      throw new Error('Cannot create new session while another is in progress');
    }

    const selectedQuestions = this.selectAndRandomizeQuestions();
    
    this.session = {
      id: sessionId || this.generateSessionId(),
      questions: selectedQuestions,
      answers: {},
      startTime: Date.now(),
      currentQuestionIndex: 0,
      flags: [],
      riskScore: 0,
      status: 'not-started'
    };

    return this.session;
  }

  /**
   * Start the quiz session
   */
  startSession(): void {
    if (!this.session) {
      throw new Error('No session created');
    }

    if (this.session.status !== 'not-started') {
      throw new Error('Session already started or completed');
    }

    this.session.status = 'in-progress';
    this.session.startTime = Date.now();
    
    // Start auto-save
    this.startAutoSave();
    
    // Start integrity enforcement if configured
    this.startIntegrityEnforcement();
    
    this.notifySessionUpdate();
  }

  /**
   * Get current session
   */
  getCurrentSession(): QuizSession | null {
    return this.session;
  }

  /**
   * Get current question
   */
  getCurrentQuestion(): Question | null {
    if (!this.session || this.session.currentQuestionIndex >= this.session.questions.length) {
      return null;
    }
    return this.session.questions[this.session.currentQuestionIndex];
  }

  /**
   * Submit answer for current question
   */
  submitAnswer(answer: string): boolean {
    if (!this.session || this.session.status !== 'in-progress') {
      throw new Error('No active session');
    }

    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) {
      throw new Error('No current question');
    }

    // Validate answer format
    if (!this.validateAnswer(currentQuestion, answer)) {
      return false;
    }

    // Store answer
    this.session.answers[currentQuestion.id] = answer;
    
    // Auto-save after answer submission
    this.triggerAutoSave();
    
    this.notifySessionUpdate();
    return true;
  }

  /**
   * Move to next question
   */
  nextQuestion(): boolean {
    if (!this.session || this.session.status !== 'in-progress') {
      throw new Error('No active session');
    }

    if (this.session.currentQuestionIndex >= this.session.questions.length - 1) {
      // Quiz completed
      this.completeSession();
      return false;
    }

    this.session.currentQuestionIndex++;
    this.notifySessionUpdate();
    return true;
  }

  /**
   * Check if current question has been answered
   */
  isCurrentQuestionAnswered(): boolean {
    if (!this.session) return false;
    
    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) return false;
    
    return currentQuestion.id in this.session.answers;
  }

  /**
   * Get progress information
   */
  getProgress(): { current: number; total: number; percentage: number } {
    if (!this.session) {
      return { current: 0, total: 0, percentage: 0 };
    }

    const current = this.session.currentQuestionIndex + 1;
    const total = this.session.questions.length;
    const percentage = Math.round((current / total) * 100);

    return { current, total, percentage };
  }

  /**
   * Add flag event to session
   */
  addFlag(flag: FlagEvent): void {
    if (!this.session) return;
    
    this.session.flags.push(flag);
    this.notifySessionUpdate();
  }

  /**
   * Update risk score
   */
  updateRiskScore(score: number): void {
    if (!this.session) return;
    
    this.session.riskScore = Math.max(0, Math.min(100, score));
    
    // Auto-mark as under review if risk score is too high
    if (this.session.riskScore >= 60 && this.session.status === 'in-progress') {
      this.session.status = 'under-review';
    }
    
    this.notifySessionUpdate();
  }

  /**
   * Complete the quiz session
   */
  completeSession(): QuizResult {
    if (!this.session) {
      throw new Error('No active session');
    }

    this.session.status = 'completed';
    this.session.endTime = Date.now();
    
    // Stop auto-save
    this.stopAutoSave();
    
    // Stop integrity enforcement
    this.stopIntegrityEnforcement();
    
    const result = this.calculateResults();
    this.notifySessionUpdate();
    
    return result;
  }

  /**
   * Abandon/cancel the current session
   */
  abandonSession(): void {
    if (this.session) {
      this.session.status = 'completed';
      this.session.endTime = Date.now();
      this.stopAutoSave();
      this.stopIntegrityEnforcement();
      this.notifySessionUpdate();
    }
  }

  /**
   * Set session update callback
   */
  onSessionUpdate(callback: (session: QuizSession) => void): void {
    this.sessionUpdateCallback = callback;
  }

  /**
   * Set auto-save callback
   */
  onAutoSave(callback: (session: QuizSession) => void): void {
    this.autoSaveCallback = callback;
  }

  /**
   * Get integrity enforcer instance
   */
  getIntegrityEnforcer(): IntegrityEnforcer | undefined {
    return this.integrityEnforcer;
  }

  /**
   * Get integrity violations
   */
  getIntegrityViolations(): IntegrityViolation[] {
    return this.integrityEnforcer?.getViolations() || [];
  }

  /**
   * Select and randomize questions based on config
   */
  private selectAndRandomizeQuestions(): Question[] {
    const mcQuestions = this.questionBank.filter(q => q.type === 'multiple-choice');
    const saQuestions = this.questionBank.filter(q => q.type === 'short-answer');

    // Shuffle question pools if enabled
    if (this.config.shuffleQuestions) {
      this.shuffleArray(mcQuestions);
      this.shuffleArray(saQuestions);
    }

    // Select required number of each type
    const selectedMC = mcQuestions.slice(0, this.config.multipleChoiceCount);
    const selectedSA = saQuestions.slice(0, this.config.shortAnswerCount);

    // Combine and shuffle final selection
    const allSelected = [...selectedMC, ...selectedSA];
    if (this.config.shuffleQuestions) {
      this.shuffleArray(allSelected);
    }

    // Shuffle options for multiple choice questions if enabled
    if (this.config.shuffleOptions) {
      allSelected.forEach(question => {
        if (question.type === 'multiple-choice' && question.options) {
          // Store correct answer before shuffling
          const correctIndex = question.options.indexOf(question.correctAnswer);
          this.shuffleArray(question.options);
          // Update correct answer after shuffling
          question.correctAnswer = question.options[correctIndex];
        }
      });
    }

    return allSelected;
  }

  /**
   * Validate answer format and content
   */
  private validateAnswer(question: Question, answer: string): boolean {
    if (!answer || answer.trim().length === 0) {
      return false;
    }

    if (question.type === 'multiple-choice') {
      return question.options?.includes(answer) || false;
    }

    if (question.type === 'short-answer') {
      // Basic validation for short answers
      return answer.trim().length >= 1 && answer.trim().length <= 500;
    }

    return false;
  }

  /**
   * Calculate quiz results
   */
  private calculateResults(): QuizResult {
    if (!this.session) {
      throw new Error('No session to calculate results for');
    }

    const questionResults: QuestionResult[] = [];
    let totalScore = 0;
    let totalPoints = 0;

    this.session.questions.forEach(question => {
      const userAnswer = this.session!.answers[question.id] || '';
      const isCorrect = this.isAnswerCorrect(question, userAnswer);
      const points = isCorrect ? question.points : 0;
      
      totalScore += points;
      totalPoints += question.points;

      questionResults.push({
        questionId: question.id,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        points,
        timeSpent: 0, // Will be calculated by TimerManager
        flags: this.session!.flags.filter(f => f.questionId === question.id)
      });
    });

    const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
    let status: 'passed' | 'failed' | 'under-review' = 'failed';

    if (this.session.status === 'under-review' || this.session.riskScore >= 60) {
      status = 'under-review';
    } else if (percentage >= this.config.passingScore) {
      status = 'passed';
    }

    return {
      sessionId: this.session.id,
      score: totalScore,
      totalPoints,
      percentage,
      timeSpent: this.session.endTime ? this.session.endTime - this.session.startTime : 0,
      flagCount: this.session.flags.length,
      riskScore: this.session.riskScore,
      status,
      questionResults
    };
  }

  /**
   * Check if answer is correct
   */
  private isAnswerCorrect(question: Question, userAnswer: string): boolean {
    if (question.type === 'multiple-choice') {
      return question.correctAnswer === userAnswer;
    }

    if (question.type === 'short-answer') {
      // Simple case-insensitive comparison for short answers
      return question.correctAnswer.toLowerCase().trim() === userAnswer.toLowerCase().trim();
    }

    return false;
  }

  /**
   * Start auto-save functionality
   */
  private startAutoSave(): void {
    this.stopAutoSave(); // Clear any existing interval
    
    this.autoSaveInterval = setInterval(() => {
      this.triggerAutoSave();
    }, 5000); // Auto-save every 5 seconds
  }

  /**
   * Stop auto-save functionality
   */
  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Trigger auto-save callback
   */
  private triggerAutoSave(): void {
    if (this.session && this.autoSaveCallback) {
      this.autoSaveCallback(this.session);
    }
  }

  /**
   * Notify session update
   */
  private notifySessionUpdate(): void {
    if (this.session && this.sessionUpdateCallback) {
      this.sessionUpdateCallback(this.session);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Start integrity enforcement
   */
  private startIntegrityEnforcement(): void {
    if (!this.integrityConfig) {
      return;
    }

    this.integrityEnforcer = new IntegrityEnforcer(this.integrityConfig, {
      onViolation: (violation) => {
        // Log violation for debugging
        console.warn('Integrity violation detected:', violation);
      },
      onFlag: (flag) => {
        // Add flag to current session
        this.addFlag(flag);
      },
      onFullscreenExit: () => {
        // Handle fullscreen exit
        console.warn('Fullscreen mode exited during quiz');
      },
      onTabBlur: () => {
        // Handle tab blur
        console.warn('Tab blur detected during quiz');
      }
    });

    this.integrityEnforcer.start();
  }

  /**
   * Stop integrity enforcement
   */
  private stopIntegrityEnforcement(): void {
    if (this.integrityEnforcer) {
      this.integrityEnforcer.stop();
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoSave();
    this.stopIntegrityEnforcement();
    if (this.integrityEnforcer) {
      this.integrityEnforcer.destroy();
      this.integrityEnforcer = undefined;
    }
    this.session = null;
    this.sessionUpdateCallback = undefined;
    this.autoSaveCallback = undefined;
  }
}