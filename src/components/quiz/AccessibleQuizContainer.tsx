/**
 * AccessibleQuizContainer - Main quiz container with accessibility features
 * 
 * Provides focus management, keyboard navigation, and screen reader support
 * for the entire quiz experience
 */

import React, { useEffect, useRef, useState } from 'react';
import { Question } from '../../lib/quiz/types';
import { QuestionRenderer } from './QuestionRenderer';
import { NavigationControls } from './NavigationControls';
import { CountdownDisplay } from './CountdownDisplay';

interface AccessibleQuizContainerProps {
  questions: Question[];
  currentQuestionIndex: number;
  userAnswers: Record<string, string>;
  onAnswerChange: (questionId: string, answer: string) => void;
  onNext: () => void;
  onSubmit: () => void;
  timeDisplay: {
    questionTime: string;
    totalTime: string;
    questionStatus: 'normal' | 'warning' | 'critical' | 'expired';
    totalStatus: 'normal' | 'warning' | 'critical' | 'expired';
    questionProgress: number;
    totalProgress: number;
  };
  isReadOnly?: boolean;
  showCorrectAnswers?: boolean;
  className?: string;
}

export const AccessibleQuizContainer: React.FC<AccessibleQuizContainerProps> = ({
  questions,
  currentQuestionIndex,
  userAnswers,
  onAnswerChange,
  onNext,
  onSubmit,
  timeDisplay,
  isReadOnly = false,
  showCorrectAnswers = false,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);
  const [focusTrapActive, setFocusTrapActive] = useState(true);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const hasAnswer = currentQuestion && userAnswers[currentQuestion.id];

  // Focus trap management
  useEffect(() => {
    if (!focusTrapActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Focus skip link for emergency exit
        skipLinkRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [focusTrapActive, currentQuestionIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in inputs
      const activeElement = document.activeElement;
      const isTyping = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      if (isTyping) return;

      switch (event.key) {
        case 'n':
        case 'N':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (hasAnswer && !isLastQuestion) {
              onNext();
            }
          }
          break;
        case 's':
        case 'S':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (hasAnswer && isLastQuestion) {
              onSubmit();
            }
          }
          break;
        case '?':
          event.preventDefault();
          showKeyboardShortcuts();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasAnswer, isLastQuestion, onNext, onSubmit]);

  const showKeyboardShortcuts = () => {
    const shortcuts = [
      'Arrow Up/Down: Navigate between answer options',
      'Tab/Shift+Tab: Move between interactive elements',
      'Ctrl+N: Next question (when answered)',
      'Ctrl+S: Submit quiz (on last question)',
      'Escape: Focus skip link',
      '?: Show this help'
    ];

    // Announce shortcuts to screen readers
    const announcement = `Keyboard shortcuts: ${shortcuts.join('. ')}`;
    const liveRegion = document.getElementById('quiz-announcements');
    if (liveRegion) {
      liveRegion.textContent = announcement;
    }
  };

  const handleSkipToContent = (event: React.MouseEvent) => {
    event.preventDefault();
    const questionElement = containerRef.current?.querySelector('[role="group"]') as HTMLElement;
    questionElement?.focus();
  };

  if (!currentQuestion) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No questions available</p>
      </div>
    );
  }

  return (
    <>
      {/* Skip link for accessibility */}
      <a
        ref={skipLinkRef}
        href="#quiz-content"
        onClick={handleSkipToContent}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
      >
        Skip to quiz content
      </a>

      {/* Live region for announcements */}
      <div
        id="quiz-announcements"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      {/* Quiz container */}
      <div
        ref={containerRef}
        className={`quiz-container ${className}`}
        data-quiz-container
        role="main"
        aria-label="Quiz interface"
      >
        {/* Quiz header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {isReadOnly ? 'Quiz Review' : 'Quiz in Progress'}
            </h1>
            
            {/* Keyboard shortcut help */}
            <button
              type="button"
              onClick={showKeyboardShortcuts}
              className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              aria-label="Show keyboard shortcuts"
              title="Press ? for keyboard shortcuts"
            >
              Keyboard Help (?)
            </button>
          </div>

          {/* Timer display */}
          {!isReadOnly && (
            <CountdownDisplay
              questionTime={timeDisplay.questionTime}
              totalTime={timeDisplay.totalTime}
              questionStatus={timeDisplay.questionStatus}
              totalStatus={timeDisplay.totalStatus}
              questionProgress={timeDisplay.questionProgress}
              totalProgress={timeDisplay.totalProgress}
              className="mb-4"
            />
          )}
        </header>

        {/* Main quiz content */}
        <main id="quiz-content" className="mb-6">
          <QuestionRenderer
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            userAnswer={userAnswers[currentQuestion.id] || ''}
            onAnswerChange={(answer) => onAnswerChange(currentQuestion.id, answer)}
            isReadOnly={isReadOnly}
            showCorrectAnswer={showCorrectAnswers}
            className="mb-6"
          />
        </main>

        {/* Navigation footer */}
        <footer>
          <NavigationControls
            currentQuestion={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            canGoNext={!!hasAnswer}
            canGoPrevious={false} // Disabled for quiz integrity
            autoProgressEnabled={false}
            onNext={onNext}
            onPrevious={() => {}} // Disabled
            onSubmit={onSubmit}
            isLastQuestion={isLastQuestion}
            preventNavigation={!isReadOnly}
            className="border-t pt-4"
          />
        </footer>

        {/* Status summary for screen readers */}
        <div className="sr-only" aria-live="polite">
          Question {currentQuestionIndex + 1} of {questions.length}.
          {hasAnswer ? ' Answer provided.' : ' No answer provided.'}
          {isLastQuestion ? ' This is the last question.' : ''}
          {timeDisplay.questionStatus === 'critical' ? ' Time is running low for this question.' : ''}
          {timeDisplay.totalStatus === 'critical' ? ' Total quiz time is running low.' : ''}
        </div>
      </div>
    </>
  );
};