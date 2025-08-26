/**
 * Tests for QuizResultsInterface component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuizResultsInterface } from '../QuizResultsInterface';
import { QuizSession } from '../../../lib/quiz/types';
import { FlagEvent } from '../../../lib/proctoring/types';

// Mock child components
jest.mock('../QuizResultsSummary', () => ({
  QuizResultsSummary: () => <div data-testid="quiz-results-summary">Summary Content</div>
}));

jest.mock('../QuizTimeline', () => ({
  QuizTimeline: () => <div data-testid="quiz-timeline">Timeline Content</div>
}));

jest.mock('../FlagExplanationSystem', () => ({
  FlagExplanationSystem: () => <div data-testid="flag-explanation-system">Flags Content</div>
}));

jest.mock('../ExportControls', () => ({
  ExportControls: () => <div data-testid="export-controls">Export Content</div>
}));

describe('QuizResultsInterface', () => {
  const mockOnRetakeQuiz = jest.fn();
  const mockOnClose = jest.fn();

  const mockSession = {
    id: 'test-session-123',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        text: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        timeLimitSeconds: 30,
        points: 1
      },
      {
        id: 'q2',
        type: 'short-answer',
        text: 'Explain photosynthesis.',
        correctAnswer: 'Process by which plants make food',
        timeLimitSeconds: 60,
        points: 2
      }
    ],
    answers: {
      'q1': '4',
      'q2': 'Plants use sunlight to make food'
    },
    startTime: Date.now() - 300000, // 5 minutes ago
    endTime: Date.now(),
    status: 'completed'
  };

  const mockFlags = [
    {
      id: 'flag-1',
      timestamp: Date.now() - 200000,
      endTimestamp: Date.now() - 190000,
      type: 'EYES_OFF',
      severity: 'soft',
      confidence: 0.85,
      details: { duration: 10000 },
      questionId: 'q1'
    },
    {
      id: 'flag-2',
      timestamp: Date.now() - 100000,
      type: 'TAB_BLUR',
      severity: 'hard',
      confidence: 0.95,
      details: { reason: 'focus_lost' },
      questionId: 'q2'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders quiz results interface with header', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={35}
        onRetakeQuiz={mockOnRetakeQuiz}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Quiz Results')).toBeInTheDocument();
    expect(screen.getByText('Risk Score: 35/100')).toBeInTheDocument();
  });

  it('displays correct status message for low risk score', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={15}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Quiz completed successfully with minimal integrity concerns.')).toBeInTheDocument();
    expect(screen.getByText('Great job maintaining academic integrity!')).toBeInTheDocument();
  });

  it('displays warning status message for medium risk score', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={50}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Some integrity concerns were noted during your quiz.')).toBeInTheDocument();
    expect(screen.getByText('Check the explanations tab for details on how to improve.')).toBeInTheDocument();
  });

  it('displays error status message for high risk score', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={80}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('High risk score detected. This session may require additional verification.')).toBeInTheDocument();
    expect(screen.getByText('Review the explanations tab to understand what was flagged.')).toBeInTheDocument();
  });

  it('displays under review status message', () => {
    const underReviewSession = { ...mockSession, status: 'under-review' };
    
    render(
      <QuizResultsInterface
        session={underReviewSession}
        flags={mockFlags}
        riskScore={35}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('This quiz session has been flagged for review due to integrity concerns.')).toBeInTheDocument();
    expect(screen.getByText('Contact your instructor for more information.')).toBeInTheDocument();
  });

  it('renders all navigation tabs', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={35}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Explanations')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('shows flag count badge on explanations tab', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={35}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument(); // Flag count badge
  });

  it('switches tabs when clicked', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={35}
        onClose={mockOnClose}
      />
    );

    // Initially shows summary
    expect(screen.getByTestId('quiz-results-summary')).toBeInTheDocument();

    // Click timeline tab
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByTestId('quiz-timeline')).toBeInTheDocument();
    expect(screen.queryByTestId('quiz-results-summary')).not.toBeInTheDocument();

    // Click flags tab
    fireEvent.click(screen.getByText('Explanations'));
    expect(screen.getByTestId('flag-explanation-system')).toBeInTheDocument();
    expect(screen.queryByTestId('quiz-timeline')).not.toBeInTheDocument();

    // Click export tab
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByTestId('export-controls')).toBeInTheDocument();
    expect(screen.queryByTestId('flag-explanation-system')).not.toBeInTheDocument();
  });

  it('calls onRetakeQuiz when retake button is clicked', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={35}
        onRetakeQuiz={mockOnRetakeQuiz}
        onClose={mockOnClose}
      />
    );

    const retakeButton = screen.getByText('Retake Quiz');
    fireEvent.click(retakeButton);

    expect(mockOnRetakeQuiz).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={35}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not show retake button when onRetakeQuiz is not provided', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={35}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Retake Quiz')).not.toBeInTheDocument();
  });

  it('displays session information in footer', () => {
    render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={35}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(`Session ID: ${mockSession.id}`)).toBeInTheDocument();
    expect(screen.getByText('Eyes-On-Screen Proctored Quiz v1.0')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={35}
        onClose={mockOnClose}
        className="custom-results-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-results-class');
  });

  it('displays correct risk level colors', () => {
    const { rerender } = render(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={15}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Risk Score: 15/100')).toHaveClass('text-green-600');

    rerender(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={50}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Risk Score: 50/100')).toHaveClass('text-yellow-600');

    rerender(
      <QuizResultsInterface
        session={mockSession}
        flags={mockFlags}
        riskScore={80}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Risk Score: 80/100')).toHaveClass('text-red-600');
  });
});