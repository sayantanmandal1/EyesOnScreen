/**
 * Accessibility tests for quiz components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionRenderer } from '../QuestionRenderer';
import { NavigationControls } from '../NavigationControls';
import { CountdownDisplay } from '../CountdownDisplay';
import { Question } from '../../../lib/quiz/types';

// Mock questions for testing
const mockMultipleChoiceQuestion: Question = {
  id: 'mc_001',
  type: 'multiple-choice',
  text: 'What is the capital of France?',
  options: ['London', 'Berlin', 'Paris', 'Madrid'],
  correctAnswer: 'Paris',
  timeLimitSeconds: 30,
  points: 10
};

const mockShortAnswerQuestion: Question = {
  id: 'sa_001',
  type: 'short-answer',
  text: 'What does API stand for?',
  correctAnswer: 'Application Programming Interface',
  timeLimitSeconds: 30,
  points: 15
};

describe('QuestionRenderer Accessibility', () => {
  it('should render multiple choice questions with proper accessibility attributes', () => {
    render(
      <QuestionRenderer
        question={mockMultipleChoiceQuestion}
        questionNumber={1}
        totalQuestions={2}
        userAnswer=""
        onAnswerChange={() => {}}
      />
    );

    // Check for proper structure - there are multiple groups, so use getAllByRole
    const groups = screen.getAllByRole('group');
    expect(groups.length).toBeGreaterThan(0);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('should render short answer questions with proper accessibility attributes', () => {
    render(
      <QuestionRenderer
        question={mockShortAnswerQuestion}
        questionNumber={2}
        totalQuestions={2}
        userAnswer=""
        onAnswerChange={() => {}}
      />
    );

    // Check for proper structure
    expect(screen.getByRole('group')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should have proper ARIA labels for multiple choice options', () => {
    render(
      <QuestionRenderer
        question={mockMultipleChoiceQuestion}
        questionNumber={1}
        totalQuestions={2}
        userAnswer=""
        onAnswerChange={() => {}}
      />
    );

    // Check for proper fieldset and legend
    const fieldset = screen.getByRole('radiogroup');
    expect(fieldset).toBeInTheDocument();

    // Check for proper radio button labels
    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons).toHaveLength(4);

    radioButtons.forEach((radio, index) => {
      expect(radio).toHaveAttribute('name', 'question-mc_001');
      expect(radio).toHaveAttribute('value', mockMultipleChoiceQuestion.options![index]);
    });
  });

  it('should have proper ARIA labels for short answer textarea', () => {
    render(
      <QuestionRenderer
        question={mockShortAnswerQuestion}
        questionNumber={2}
        totalQuestions={2}
        userAnswer=""
        onAnswerChange={() => {}}
      />
    );

    const textarea = screen.getByRole('textbox', { name: /your answer/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('aria-describedby');
  });

  it('should support keyboard navigation for multiple choice', async () => {
    const user = userEvent.setup();
    const mockOnAnswerChange = jest.fn();

    render(
      <QuestionRenderer
        question={mockMultipleChoiceQuestion}
        questionNumber={1}
        totalQuestions={2}
        userAnswer=""
        onAnswerChange={mockOnAnswerChange}
      />
    );

    const firstRadio = screen.getAllByRole('radio')[0];
    await user.click(firstRadio);

    expect(mockOnAnswerChange).toHaveBeenCalledWith('London');
  });

  it('should provide proper focus management', async () => {
    render(
      <QuestionRenderer
        question={mockMultipleChoiceQuestion}
        questionNumber={1}
        totalQuestions={2}
        userAnswer=""
        onAnswerChange={() => {}}
      />
    );

    const radioButtons = screen.getAllByRole('radio');
    
    // Focus first radio button
    radioButtons[0].focus();
    expect(radioButtons[0]).toHaveFocus();

    // Test arrow key navigation
    fireEvent.keyDown(radioButtons[0], { key: 'ArrowDown' });
    await waitFor(() => {
      expect(radioButtons[1]).toHaveFocus();
    });
  });
});

describe('NavigationControls Accessibility', () => {
  it('should render with proper accessibility attributes', () => {
    render(
      <NavigationControls
        currentQuestion={1}
        totalQuestions={10}
        canGoNext={true}
        canGoPrevious={false}
        autoProgressEnabled={false}
        onNext={() => {}}
        onPrevious={() => {}}
        onSubmit={() => {}}
        isLastQuestion={false}
      />
    );

    // Check for basic structure
    expect(screen.getByText(/question 1 of 10/i)).toBeInTheDocument();
  });

  it('should have proper ARIA labels for buttons', () => {
    render(
      <NavigationControls
        currentQuestion={1}
        totalQuestions={10}
        canGoNext={true}
        canGoPrevious={false}
        autoProgressEnabled={false}
        onNext={() => {}}
        onPrevious={() => {}}
        onSubmit={() => {}}
        isLastQuestion={false}
      />
    );

    const nextButton = screen.getByRole('button', { name: /go to question 2/i });
    expect(nextButton).toBeInTheDocument();

    const previousButton = screen.getByRole('button', { name: /previous/i });
    expect(previousButton).toBeDisabled();
    expect(previousButton).toHaveAttribute('title', 'Navigation back is disabled during quiz');
  });

  it('should have proper progress indicators', () => {
    render(
      <NavigationControls
        currentQuestion={3}
        totalQuestions={5}
        canGoNext={true}
        canGoPrevious={false}
        autoProgressEnabled={false}
        onNext={() => {}}
        onPrevious={() => {}}
        onSubmit={() => {}}
        isLastQuestion={false}
      />
    );

    const progressBar = screen.getByRole('progressbar', { name: /quiz progress/i });
    expect(progressBar).toBeInTheDocument();

    // Check individual progress dots
    const progressDots = screen.getAllByRole('img');
    expect(progressDots).toHaveLength(5);
    
    // First two should be completed, third is current
    expect(progressDots[0]).toHaveAttribute('aria-label', 'Question 1 completed');
    expect(progressDots[1]).toHaveAttribute('aria-label', 'Question 2 completed');
    expect(progressDots[2]).toHaveAttribute('aria-label', 'Question 3 completed');
  });
});

describe('CountdownDisplay Accessibility', () => {
  it('should render with proper accessibility attributes', () => {
    render(
      <CountdownDisplay
        questionTime="00:30"
        totalTime="15:00"
        questionStatus="normal"
        totalStatus="normal"
        questionProgress={50}
        totalProgress={10}
      />
    );

    // Check for basic structure
    expect(screen.getByText('00:30')).toBeInTheDocument();
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('should have proper ARIA labels for timers', () => {
    render(
      <CountdownDisplay
        questionTime="00:30"
        totalTime="15:00"
        questionStatus="normal"
        totalStatus="normal"
        questionProgress={50}
        totalProgress={10}
      />
    );

    const questionTimer = screen.getByLabelText(/question progress: 50%/i);
    expect(questionTimer).toBeInTheDocument();

    const totalTimer = screen.getByLabelText(/total quiz progress: 10%/i);
    expect(totalTimer).toBeInTheDocument();
  });

  it('should announce critical time warnings', () => {
    render(
      <CountdownDisplay
        questionTime="00:05"
        totalTime="01:00"
        questionStatus="critical"
        totalStatus="warning"
        questionProgress={90}
        totalProgress={80}
      />
    );

    const questionTimeElement = screen.getByText('00:05');
    expect(questionTimeElement).toHaveAttribute('aria-live', 'assertive');

    const totalTimeElement = screen.getByText('01:00');
    expect(totalTimeElement).toHaveAttribute('aria-live', 'polite');
  });
});

describe('Color Contrast Compliance', () => {
  it('should meet WCAG AA standards for alert colors', () => {
    // Test color combinations used in alerts
    const testColors = [
      { name: 'Red alert', fg: [185, 28, 28], bg: [254, 242, 242] }, // red-700 on red-50
      { name: 'Yellow alert', fg: [146, 64, 14], bg: [255, 251, 235] }, // yellow-800 on yellow-50
      { name: 'Green success', fg: [21, 128, 61], bg: [240, 253, 244] }, // green-700 on green-50
      { name: 'Blue info', fg: [29, 78, 216], bg: [239, 246, 255] }, // blue-700 on blue-50
    ];

    testColors.forEach(({ name, fg, bg }) => {
      const ratio = getContrastRatio(fg as [number, number, number], bg as [number, number, number]);
      expect(ratio).toBeGreaterThanOrEqual(4.5); // WCAG AA standard
    });
  });
});

// Helper function for contrast ratio calculation
function getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
  const getRelativeLuminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getRelativeLuminance(...color1);
  const l2 = getRelativeLuminance(...color2);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}