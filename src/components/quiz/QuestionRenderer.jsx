/**
 * QuestionRenderer - Accessible quiz question display component
 * 
 * Provides fully accessible question rendering with keyboard navigation,
 * ARIA labels, and screen reader support
 */

import { useEffect, useRef } from 'react';

export const QuestionRenderer = ({
  question,
  questionNumber,
  totalQuestions,
  userAnswer,
  onAnswerChange,
  isReadOnly = false,
  showCorrectAnswer = false,
  className = ''
}) => {
  const questionRef = useRef(null);
  const firstInputRef = useRef(null);

  // Focus management - focus first input when question changes
  useEffect(() => {
    if (!isReadOnly && firstInputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [question.id, isReadOnly]);

  // Announce question change to screen readers
  useEffect(() => {
    if (questionRef.current) {
      // Create announcement for screen readers
      const announcement = `Question ${questionNumber} of ${totalQuestions}: ${question.text}`;
      
      // Use aria-live region for announcement
      const liveRegion = document.getElementById('quiz-announcements');
      if (liveRegion) {
        liveRegion.textContent = announcement;
      }
    }
  }, [question.id, questionNumber, totalQuestions, question.text]);

  const handleKeyDown = (event) => {
    // Handle keyboard navigation within question
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const focusableElements = questionRef.current?.querySelectorAll(
        'input[type="radio"], input[type="text"], textarea, button'
      );
      
      if (focusableElements && focusableElements.length > 1) {
        const currentIndex = Array.from(focusableElements).indexOf(document.activeElement);
        let nextIndex;
        
        if (event.key === 'ArrowDown') {
          nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        }
        
        event.preventDefault();
        focusableElements[nextIndex].focus();
      }
    }
  };

  const renderMultipleChoice = () => {
    if (!question.options) return null;

    return (
      <fieldset className="mt-4">
        <legend className="sr-only">
          Choose one answer for question {questionNumber}
        </legend>
        <div className="space-y-3" role="radiogroup" aria-labelledby={`question-${question.id}-text`}>
          {question.options.map((option, index) => {
            const optionId = `${question.id}-option-${index}`;
            const isSelected = userAnswer === option;
            const isCorrect = showCorrectAnswer && option === question.correctAnswer;
            const isIncorrect = showCorrectAnswer && isSelected && option !== question.correctAnswer;
            
            return (
              <div
                key={optionId}
                className={`
                  relative flex items-start p-3 rounded-lg border-2 transition-all duration-200
                  ${isSelected 
                    ? isCorrect 
                      ? 'border-green-500 bg-green-50' 
                      : isIncorrect 
                        ? 'border-red-500 bg-red-50'
                        : 'border-blue-500 bg-blue-50'
                    : isCorrect && showCorrectAnswer
                      ? 'border-green-300 bg-green-25'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }
                  ${!isReadOnly ? 'cursor-pointer' : 'cursor-default'}
                `}
                onClick={() => !isReadOnly && onAnswerChange(option)}
              >
                <div className="flex items-center h-5">
                  <input
                    ref={index === 0 ? firstInputRef : undefined}
                    id={optionId}
                    name={`question-${question.id}`}
                    type="radio"
                    value={option}
                    checked={isSelected}
                    onChange={(e) => onAnswerChange(e.target.value)}
                    disabled={isReadOnly}
                    className={`
                      h-4 w-4 border-gray-300 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                      ${isCorrect ? 'text-green-600' : isIncorrect ? 'text-red-600' : 'text-blue-600'}
                    `}
                    aria-describedby={showCorrectAnswer ? `${optionId}-feedback` : undefined}
                  />
                </div>
                <div className="ml-3 flex-1">
                  <label 
                    htmlFor={optionId} 
                    className={`
                      text-sm font-medium cursor-pointer
                      ${isCorrect ? 'text-green-800' : isIncorrect ? 'text-red-800' : 'text-gray-900'}
                    `}
                  >
                    {option}
                  </label>
                  
                  {/* Feedback for review mode */}
                  {showCorrectAnswer && (
                    <div id={`${optionId}-feedback`} className="mt-1 text-xs">
                      {isCorrect && (
                        <span className="text-green-600 font-medium" aria-label="Correct answer">
                          ✓ Correct answer
                        </span>
                      )}
                      {isIncorrect && (
                        <span className="text-red-600 font-medium" aria-label="Incorrect - your selection">
                          ✗ Your answer (incorrect)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Visual indicators */}
                {showCorrectAnswer && (
                  <div className="ml-2 flex-shrink-0">
                    {isCorrect && (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {isIncorrect && (
                      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>
    );
  };

  const renderShortAnswer = () => {
    const isCorrect = showCorrectAnswer && userAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
    
    return (
      <div className="mt-4">
        <label 
          htmlFor={`${question.id}-answer`}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Your answer:
        </label>
        <textarea
          ref={firstInputRef}
          id={`${question.id}-answer`}
          name={`question-${question.id}`}
          value={userAnswer}
          onChange={(e) => onAnswerChange(e.target.value)}
          disabled={isReadOnly}
          rows={3}
          className={`
            w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500
            ${isReadOnly ? 'bg-gray-50 cursor-default' : 'bg-white'}
            ${showCorrectAnswer 
              ? isCorrect 
                ? 'border-green-500 bg-green-50' 
                : 'border-red-500 bg-red-50'
              : 'border-gray-300'
            }
          `}
          placeholder={isReadOnly ? '' : 'Type your answer here...'}
          aria-describedby={`${question.id}-answer-help ${showCorrectAnswer ? `${question.id}-answer-feedback` : ''}`}
          maxLength={500}
        />
        
        {/* Character count */}
        {!isReadOnly && (
          <div id={`${question.id}-answer-help`} className="mt-1 text-xs text-gray-500">
            {userAnswer.length}/500 characters
          </div>
        )}
        
        {/* Feedback for review mode */}
        {showCorrectAnswer && (
          <div id={`${question.id}-answer-feedback`} className="mt-2 p-3 rounded-md bg-gray-50 border">
            <div className="text-sm">
              <div className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
              </div>
              <div className="mt-1 text-gray-700">
                <strong>Correct answer:</strong> {question.correctAnswer}
              </div>
              {!isCorrect && userAnswer && (
                <div className="mt-1 text-gray-600">
                  <strong>Your answer:</strong> {userAnswer}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={questionRef}
      className={`quiz-question ${className}`}
      onKeyDown={handleKeyDown}
      role="group"
      aria-labelledby={`question-${question.id}-text`}
    >
      {/* Question header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">
            Question {questionNumber} of {totalQuestions}
          </span>
          <span className="text-sm text-gray-500">
            {question.points} point{question.points !== 1 ? 's' : ''}
          </span>
        </div>
        
        <h2 
          id={`question-${question.id}-text`}
          className="text-lg font-semibold text-gray-900 leading-relaxed"
        >
          {question.text}
        </h2>
        
        {/* Question type indicator for screen readers */}
        <div className="sr-only">
          {question.type === 'multiple-choice' 
            ? `Multiple choice question with ${question.options?.length} options` 
            : 'Short answer question'
          }
        </div>
      </div>

      {/* Question content */}
      {question.type === 'multiple-choice' ? renderMultipleChoice() : renderShortAnswer()}
      
      {/* Answer status for screen readers */}
      <div className="sr-only" aria-live="polite">
        {userAnswer 
          ? `Answer provided: ${question.type === 'multiple-choice' ? userAnswer : 'Text entered'}`
          : 'No answer provided'
        }
      </div>
    </div>
  );
};