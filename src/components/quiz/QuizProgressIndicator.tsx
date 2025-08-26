/**
 * Quiz progress indicator with visual progress tracking
 */

import React from 'react';

interface QuizProgressIndicatorProps {
  currentQuestion: number;
  totalQuestions: number;
  answeredQuestions: number[];
  className?: string;
  showLabels?: boolean;
  compact?: boolean;
}

export const QuizProgressIndicator: React.FC<QuizProgressIndicatorProps> = ({
  currentQuestion,
  totalQuestions,
  answeredQuestions,
  className = '',
  showLabels = true,
  compact = false
}) => {
  const progressPercentage = (currentQuestion / totalQuestions) * 100;
  const answeredPercentage = (answeredQuestions.length / totalQuestions) * 100;

  const getQuestionStatus = (questionIndex: number) => {
    if (questionIndex < currentQuestion) {
      return answeredQuestions.includes(questionIndex) ? 'completed' : 'skipped';
    } else if (questionIndex === currentQuestion) {
      return 'current';
    } else {
      return 'upcoming';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 border-green-500';
      case 'current':
        return 'bg-blue-500 border-blue-500 ring-2 ring-blue-200';
      case 'skipped':
        return 'bg-yellow-500 border-yellow-500';
      default:
        return 'bg-gray-300 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'current':
        return currentQuestion + 1;
      case 'skipped':
        return '!';
      default:
        return '';
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        {/* Compact progress bar */}
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Compact text */}
        <span className="text-sm text-gray-600 whitespace-nowrap">
          {currentQuestion + 1}/{totalQuestions}
        </span>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Progress header */}
      {showLabels && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Quiz Progress
          </h3>
          <div className="text-sm text-gray-600">
            {answeredQuestions.length} of {totalQuestions} answered
          </div>
        </div>
      )}

      {/* Overall progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Overall Progress
          </span>
          <span className="text-sm text-gray-600">
            {Math.round(progressPercentage)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all duration-500 relative"
            style={{ width: `${progressPercentage}%` }}
          >
            {/* Answered questions overlay */}
            <div
              className="absolute top-0 left-0 h-full bg-green-500 rounded-full opacity-60"
              style={{ width: `${(answeredPercentage / progressPercentage) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question indicators */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Questions
          </span>
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Current</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Skipped</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span>Upcoming</span>
            </div>
          </div>
        </div>

        {/* Question grid */}
        <div className="grid grid-cols-10 gap-2">
          {Array.from({ length: totalQuestions }, (_, index) => {
            const status = getQuestionStatus(index);
            return (
              <div
                key={index}
                className={`
                  w-8 h-8 rounded-full border-2 flex items-center justify-center
                  text-xs font-semibold text-white transition-all duration-200
                  ${getStatusColor(status)}
                `}
                title={`Question ${index + 1}: ${status}`}
                role="img"
                aria-label={`Question ${index + 1} is ${status}`}
              >
                {getStatusIcon(status)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Statistics */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">
            {currentQuestion + 1}
          </div>
          <div className="text-xs text-gray-600">Current</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">
            {answeredQuestions.length}
          </div>
          <div className="text-xs text-gray-600">Answered</div>
        </div>
        
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-600">
            {currentQuestion - answeredQuestions.length}
          </div>
          <div className="text-xs text-gray-600">Skipped</div>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600">
            {totalQuestions - currentQuestion - 1}
          </div>
          <div className="text-xs text-gray-600">Remaining</div>
        </div>
      </div>

      {/* Time estimates (if available) */}
      <div className="mt-4 text-center text-sm text-gray-500">
        <div>
          Estimated time remaining: {Math.max(0, totalQuestions - currentQuestion - 1)} × 30s = {' '}
          {Math.ceil((totalQuestions - currentQuestion - 1) * 30 / 60)} minutes
        </div>
      </div>
    </div>
  );
};