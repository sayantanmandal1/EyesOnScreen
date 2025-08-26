/**
 * NavigationControls - Quiz navigation with automatic progression
 * 
 * Handles question navigation, automatic progression, and navigation prevention
 */

import { useRef, useEffect } from 'react';
import { NavigationPrevention } from '../../lib/quiz/TimerManager';

export const NavigationControls = ({
  currentQuestion,
  totalQuestions,
  canGoNext,
  canGoPrevious,
  autoProgressEnabled,
  onNext,
  onPrevious,
  onSubmit,
  isLastQuestion,
  preventNavigation = true,
  onNavigationAttempt,
  className = ''
}) => {
  const navigationPrevention = useRef(null);

  // Initialize navigation prevention
  useEffect(() => {
    if (preventNavigation) {
      navigationPrevention.current = new NavigationPrevention();
      navigationPrevention.current.enable(onNavigationAttempt);
    }

    return () => {
      if (navigationPrevention.current) {
        navigationPrevention.current.disable();
        navigationPrevention.current = null;
      }
    };
  }, [preventNavigation, onNavigationAttempt]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only allow specific navigation keys
      if (event.key === 'Enter' && canGoNext) {
        event.preventDefault();
        if (isLastQuestion) {
          onSubmit();
        } else {
          onNext();
        }
      }
      
      // Prevent tab navigation outside of quiz area
      if (event.key === 'Tab') {
        const activeElement = document.activeElement;
        const quizContainer = document.querySelector('[data-quiz-container]');
        
        if (quizContainer && !quizContainer.contains(activeElement)) {
          event.preventDefault();
          // Focus back to quiz container
          const firstFocusable = quizContainer.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canGoNext, isLastQuestion, onNext, onSubmit]);

  return (
    <div className={`flex items-center justify-between ${className}`} data-quiz-container>
      {/* Progress indicator */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">
          Question {currentQuestion} of {totalQuestions}
        </span>
        
        {/* Progress dots */}
        <div className="flex space-x-1" role="progressbar" aria-label="Quiz progress">
          {Array.from({ length: totalQuestions }, (_, index) => (
            <div
              key={index}
              className={`
                w-2 h-2 rounded-full transition-colors duration-200
                ${index < currentQuestion 
                  ? 'bg-green-500' 
                  : index === currentQuestion - 1 
                    ? 'bg-blue-500' 
                    : 'bg-gray-300'
                }
              `}
              role="img"
              aria-label={`Question ${index + 1} ${
                index < currentQuestion 
                  ? 'completed' 
                  : index === currentQuestion - 1 
                    ? 'current' 
                    : 'upcoming'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center space-x-3">
        {autoProgressEnabled && (
          <div className="text-sm text-gray-500 italic">
            Auto-advance enabled
          </div>
        )}
        
        {/* Previous button - disabled for quiz integrity */}
        <button
          type="button"
          disabled={true} // Always disabled to prevent going back
          className="
            px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 
            border border-gray-300 rounded-md cursor-not-allowed
            opacity-50
          "
          title="Navigation back is disabled during quiz"
        >
          Previous
        </button>

        {/* Next/Submit button */}
        {isLastQuestion ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canGoNext}
            className={`
              px-6 py-2 text-sm font-medium rounded-md transition-colors duration-200
              ${canGoNext
                ? 'text-white bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
                : 'text-gray-400 bg-gray-100 border border-gray-300 cursor-not-allowed'
              }
            `}
            aria-label="Submit quiz"
          >
            Submit Quiz
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext}
            className={`
              px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200
              ${canGoNext
                ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                : 'text-gray-400 bg-gray-100 border border-gray-300 cursor-not-allowed'
              }
            `}
            aria-label={`Go to question ${currentQuestion + 1}`}
          >
            Next
          </button>
        )}
      </div>

      {/* Navigation prevention indicator */}
      {preventNavigation && (
        <div className="absolute top-0 right-0 mt-2 mr-2">
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Navigation locked</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Auto-progression notification component
 */
export const AutoProgressNotification = ({
  show,
  timeRemaining,
  onCancel
}) => {
  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              Auto-advancing in {timeRemaining}s
            </h3>
            <p className="mt-1 text-sm text-yellow-700">
              Time is up for this question. Moving to next question automatically.
            </p>
            {onCancel && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-sm font-medium text-yellow-800 hover:text-yellow-900"
                >
                  Cancel auto-advance
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};