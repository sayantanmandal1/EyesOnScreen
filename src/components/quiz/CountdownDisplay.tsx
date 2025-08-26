/**
 * CountdownDisplay - Visual timer component with progress indicators
 * 
 * Displays question and total time remaining with visual status indicators
 */

import React from 'react';
import { TimerManager } from '../../lib/quiz/TimerManager';

interface CountdownDisplayProps {
  questionTime: string;
  totalTime: string;
  questionStatus: 'normal' | 'warning' | 'critical' | 'expired';
  totalStatus: 'normal' | 'warning' | 'critical' | 'expired';
  questionProgress: number; // 0-100 percentage
  totalProgress: number; // 0-100 percentage
  showQuestionTimer?: boolean;
  showTotalTimer?: boolean;
  className?: string;
}

export const CountdownDisplay: React.FC<CountdownDisplayProps> = ({
  questionTime,
  totalTime,
  questionStatus,
  totalStatus,
  questionProgress,
  totalProgress,
  showQuestionTimer = true,
  showTotalTimer = true,
  className = ''
}) => {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'expired':
        return 'text-red-700 bg-red-100 border-red-300';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getProgressColor = (status: string): string => {
    switch (status) {
      case 'critical':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'expired':
        return 'bg-red-600';
      default:
        return 'bg-blue-500';
    }
  };

  const shouldPulse = (status: string): boolean => {
    return status === 'critical' || status === 'expired';
  };

  return (
    <div className={`flex flex-col space-y-4 ${className}`}>
      {showQuestionTimer && (
        <div className={`
          p-4 rounded-lg border-2 transition-all duration-300
          ${getStatusColor(questionStatus)}
          ${shouldPulse(questionStatus) ? 'animate-pulse' : ''}
        `}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" id="question-timer-label">Question Time</span>
            <span
              className={`
                text-2xl font-bold tabular-nums
                ${shouldPulse(questionStatus) ? 'animate-pulse' : ''}
              `}
              aria-labelledby="question-timer-label"
              aria-live={questionStatus === 'critical' ? 'assertive' : 'polite'}
            >
              {questionTime}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`
                h-2 rounded-full transition-all duration-1000 ease-linear
                ${getProgressColor(questionStatus)}
              `}
              style={{ width: `${questionProgress}%` }}
              role="progressbar"
              aria-valuenow={questionProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Question progress: ${questionProgress}%`}
            />
          </div>

          {questionStatus === 'expired' && (
            <div className="mt-2 text-sm font-medium text-red-700">
              Time&apos;s up!
            </div>
          )}
        </div>
      )}

      {showTotalTimer && (
        <div className={`
          p-3 rounded-lg border transition-all duration-300
          ${getStatusColor(totalStatus)}
          ${shouldPulse(totalStatus) ? 'animate-pulse' : ''}
        `}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" id="total-timer-label">Total Time</span>
            <span
              className={`
                text-lg font-semibold tabular-nums
                ${shouldPulse(totalStatus) ? 'animate-pulse' : ''}
              `}
              aria-labelledby="total-timer-label"
              aria-live={totalStatus === 'critical' ? 'assertive' : 'polite'}
            >
              {totalTime}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`
                h-1.5 rounded-full transition-all duration-1000 ease-linear
                ${getProgressColor(totalStatus)}
              `}
              style={{ width: `${totalProgress}%` }}
              role="progressbar"
              aria-valuenow={totalProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Total quiz progress: ${totalProgress}%`}
            />
          </div>

          {totalStatus === 'expired' && (
            <div className="mt-2 text-sm font-medium text-red-700">
              Quiz time expired!
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Hook for managing countdown display state
 */
export const useCountdownDisplay = (timerManager: TimerManager | null) => {
  const [displayState, setDisplayState] = React.useState({
    questionTime: '00:00',
    totalTime: '00:00',
    questionStatus: 'normal' as const,
    totalStatus: 'normal' as const,
    questionProgress: 0,
    totalProgress: 0
  });

  React.useEffect(() => {
    if (!timerManager) {
      return;
    }

    const updateDisplay = () => {
      const timeDisplay = timerManager.getTimeDisplay();
      setDisplayState(timeDisplay);
    };

    // Update immediately
    updateDisplay();

    // Set up timer callbacks
    timerManager.updateCallbacks({
      onTick: updateDisplay,
      onWarning: updateDisplay,
      onCritical: updateDisplay
    });

    // Update every second as backup
    const intervalId = setInterval(updateDisplay, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [timerManager]);

  return displayState;
};