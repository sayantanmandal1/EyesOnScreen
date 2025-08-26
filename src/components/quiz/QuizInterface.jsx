/**
 * Main quiz interface component that brings together all quiz functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { QuestionRenderer } from './QuestionRenderer';
import { CountdownDisplay, useCountdownDisplay } from './CountdownDisplay';
import { NavigationControls, AutoProgressNotification } from './NavigationControls';
import { FullscreenEnforcement } from './FullscreenEnforcement';
import { IntegrityViolationAlert } from './IntegrityViolationAlert';
import { useQuizTimer } from '../../hooks/useQuizTimer';
import { useIntegrityEnforcer } from '../../hooks/useIntegrityEnforcer';
import { QuizEngine } from '../../lib/quiz/QuizEngine';

export const QuizInterface = ({
  questions,
  onComplete,
  onCancel,
  className = ''
}) => {
  const { session, setSession, showAlert } = useAppStore();
  const [quizEngine] = useState(() => new QuizEngine({ questions }));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAutoProgressNotification, setShowAutoProgressNotification] = useState(false);
  const [autoProgressCountdown, setAutoProgressCountdown] = useState(0);

  // Initialize quiz session
  useEffect(() => {
    if (!session) {
      const newSession = {
        id: Date.now().toString(),
        startTime: Date.now(),
        questions: questions,
        answers: {},
        flags: []
      };
      setSession(newSession);
    }
  }, [session, setSession, questions]);

  // Timer management
  const timerManager = useQuizTimer({
    questionTimeLimit: questions[currentQuestionIndex]?.timeLimitSeconds || 30,
    totalTimeLimit: questions.reduce((sum, q) => sum + (q.timeLimitSeconds || 30), 0),
    onQuestionTimeUp: handleQuestionTimeUp,
    onTotalTimeUp: handleTotalTimeUp,
    onWarning: handleTimeWarning
  });

  // Integrity enforcement
  const {
    isFullscreen,
    violations,
    requestFullscreen,
    acknowledgeViolation
  } = useIntegrityEnforcer({
    enableFullscreen: true,
    enableCopyPasteBlocking: true,
    enableRightClickBlocking: true,
    enableDevToolsBlocking: true,
    onViolation: handleIntegrityViolation
  });

  // Countdown display state
  const countdownState = useCountdownDisplay(timerManager.timerManager);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const currentAnswer = answers[currentQuestion?.id] || '';

  // Handle answer changes
  const handleAnswerChange = useCallback((answer) => {
    if (!currentQuestion) return;

    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));

    // Auto-save to quiz engine
    if (quizEngine.submitAnswer) {
      quizEngine.submitAnswer(currentQuestion.id, answer);
    }
  }, [currentQuestion, quizEngine]);

  // Handle navigation
  const handleNext = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      if (timerManager?.startQuestion) {
        timerManager.startQuestion(currentQuestionIndex + 1);
      }
    }
  }, [currentQuestionIndex, questions.length, timerManager]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const results = {
        sessionId: session?.id,
        answers: answers,
        completedAt: Date.now(),
        flags: session?.flags || []
      };
      await onComplete(results);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      showAlert('hard', 'Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, session, answers, onComplete, showAlert]);

  // Timer event handlers
  function handleQuestionTimeUp() {
    // Show auto-progress notification
    setShowAutoProgressNotification(true);
    setAutoProgressCountdown(5);

    const countdownInterval = setInterval(() => {
      setAutoProgressCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setShowAutoProgressNotification(false);
          
          if (isLastQuestion) {
            handleSubmit();
          } else {
            handleNext();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleTotalTimeUp() {
    showAlert('hard', 'Total quiz time has expired. Submitting your answers automatically.');
    handleSubmit();
  }

  function handleTimeWarning(timeRemaining) {
    const message = `${timeRemaining} seconds remaining`;
    showAlert('soft', message);
  }

  // Integrity violation handler
  function handleIntegrityViolation(violation) {
    const violationMessages = {
      'fullscreen-exit': 'Fullscreen mode was exited',
      'tab-blur': 'Browser tab lost focus',
      'copy-paste': 'Copy/paste operation detected',
      'right-click': 'Right-click menu accessed',
      'dev-tools': 'Developer tools opened',
      'page-visibility': 'Page became hidden'
    };

    const message = violationMessages[violation.type] || 'Integrity violation detected';
    showAlert('hard', message);
  }

  // Cancel auto-progress
  const handleCancelAutoProgress = () => {
    setShowAutoProgressNotification(false);
    setAutoProgressCountdown(0);
  };

  // Check if user can proceed to next question
  const canGoNext = currentAnswer.trim().length > 0;

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-gray-600">Loading quiz...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Fullscreen enforcement */}
      <FullscreenEnforcement
        isRequired={true}
        isFullscreen={isFullscreen}
        onRequestFullscreen={requestFullscreen}
      />

      {/* Integrity violation alerts */}
      {violations.map((violation, index) => (
        <IntegrityViolationAlert
          key={violation.timestamp || index}
          violation={violation}
          onAcknowledge={() => acknowledgeViolation && acknowledgeViolation(violation.timestamp)}
        />
      ))}

      {/* Auto-progress notification */}
      {AutoProgressNotification && (
        <AutoProgressNotification
          show={showAutoProgressNotification}
          timeRemaining={autoProgressCountdown}
          onCancel={handleCancelAutoProgress}
        />
      )}

      {/* Main quiz container */}
      <div className="max-w-4xl mx-auto px-4 py-8" data-quiz-container>
        {/* Header with timer */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Eyes-On-Screen Proctored Quiz
            </h1>
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 text-sm"
              disabled={isSubmitting}
            >
              Exit Quiz
            </button>
          </div>

          {/* Timer display */}
          <CountdownDisplay
            questionTime={countdownState.questionTime}
            totalTime={countdownState.totalTime}
            questionStatus={countdownState.questionStatus}
            totalStatus={countdownState.totalStatus}
            questionProgress={countdownState.questionProgress}
            totalProgress={countdownState.totalProgress}
            className="mb-6"
          />
        </div>

        {/* Question content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <QuestionRenderer
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            userAnswer={currentAnswer}
            onAnswerChange={handleAnswerChange}
            isReadOnly={isSubmitting}
          />
        </div>

        {/* Navigation controls */}
        <NavigationControls
          currentQuestion={currentQuestionIndex + 1}
          totalQuestions={questions.length}
          canGoNext={canGoNext && !isSubmitting}
          canGoPrevious={false} // Always false for quiz integrity
          autoProgressEnabled={showAutoProgressNotification}
          onNext={handleNext}
          onPrevious={() => {}} // No-op for quiz integrity
          onSubmit={handleSubmit}
          isLastQuestion={isLastQuestion}
          preventNavigation={true}
          onNavigationAttempt={() => showAlert('soft', 'Navigation is restricted during the quiz')}
          className="mb-8"
        />

        {/* Quiz status */}
        <div className="text-center text-sm text-gray-500">
          <div className="flex items-center justify-center space-x-4">
            <span>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span>•</span>
            <span>
              {Object.keys(answers).length} of {questions.length} answered
            </span>
            {isSubmitting && (
              <>
                <span>•</span>
                <span className="text-blue-600">Submitting...</span>
              </>
            )}
          </div>
        </div>

        {/* Accessibility announcements */}
        <div
          id="quiz-announcements"
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />
      </div>

      {/* Submission overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div className="text-lg font-semibold text-gray-900 mb-2">
              Submitting Quiz
            </div>
            <div className="text-gray-600">
              Please wait while we process your answers...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};