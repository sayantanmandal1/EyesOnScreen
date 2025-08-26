/**
 * Tests for QuizInterface component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizInterface } from '../QuizInterface';
import { useAppStore } from '../../../store/appStore';

// Mock the store
jest.mock('../../../store/appStore');
const mockUseAppStore = useAppStore;

// Mock hooks
jest.mock('../../../hooks/useQuizTimer', () => ({
  useQuizTimer: () => ({
    startQuestionTimer: jest.fn(),
    pauseTimer: jest.fn(),
    resumeTimer: jest.fn(),
    getTimeRemaining: () => ({ question: 30, total: 300 })
  })
}));

jest.mock('../../../hooks/useIntegrityEnforcer', () => ({
  useIntegrityEnforcer: () => ({
    isFullscreenRequired: false,
    isFullscreen: true,
    violations: [],
    requestFullscreen: jest.fn(),
    acknowledgeViolation: jest.fn()
  })
}));

// Mock child components
jest.mock('../QuestionRenderer', () => ({
  QuestionRenderer: ({ question, onAnswerChange }) => (
    <div data-testid="question-renderer">
      <div>{question.text}</div>
      <input
        data-testid="answer-input"
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder="Answer"
      />
    </div>
  )
}));

jest.mock('../CountdownDisplay', () => ({
  CountdownDisplay: () => <div data-testid="countdown-display">Timer</div>,
  useCountdownDisplay: () => ({
    questionTime: '00:30',
    totalTime: '05:00',
    questionStatus: 'normal',
    totalStatus: 'normal',
    questionProgress: 50,
    totalProgress: 20
  })
}));

jest.mock('../NavigationControls', () => ({
  NavigationControls: ({ onNext, onSubmit, isLastQuestion }) => (
    <div data-testid="navigation-controls">
      {!isLastQuestion && (
        <button onClick={onNext} data-testid="next-button">
          Next
        </button>
      )}
      {isLastQuestion && (
        <button onClick={onSubmit} data-testid="submit-button">
          Submit
        </button>
      )}
    </div>
  ),
  AutoProgressNotification: ({ show }) =>
    show ? <div data-testid="auto-progress">Auto Progress</div> : null
}));

describe('QuizInterface', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();
  const mockSetSession = jest.fn();
  const mockShowAlert = jest.fn();
  const mockHideAlert = jest.fn();

  const mockQuestions = [
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
  ];

  const defaultStoreState = {
    session: null,
    setSession: mockSetSession,
    showAlert: mockShowAlert,
    hideAlert: mockHideAlert
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppStore.mockReturnValue(defaultStoreState);
  });

  it('renders quiz interface with first question', () => {
    render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Eyes-On-Screen Proctored Quiz')).toBeInTheDocument();
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    expect(screen.getByTestId('countdown-display')).toBeInTheDocument();
    expect(screen.getByTestId('navigation-controls')).toBeInTheDocument();
  });

  it('initializes quiz session on mount', async () => {
    render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          questions: mockQuestions,
          startTime: expect.any(Number),
          status: 'in-progress'
        })
      );
    });
  });

  it('handles answer changes', () => {
    render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const answerInput = screen.getByTestId('answer-input');
    fireEvent.change(answerInput, { target: { value: '4' } });

    expect(answerInput).toBeInTheDocument();
  });

  it('navigates to next question', async () => {
    render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const answerInput = screen.getByTestId('answer-input');
    fireEvent.change(answerInput, { target: { value: '4' } });

    const nextButton = screen.getByTestId('next-button');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Explain photosynthesis.')).toBeInTheDocument();
    });
  });

  it('shows submit button on last question', async () => {
    render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const answerInput = screen.getByTestId('answer-input');
    fireEvent.change(answerInput, { target: { value: '4' } });

    const nextButton = screen.getByTestId('next-button');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });
  });

  it('submits quiz when submit button is clicked', async () => {
    render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const answerInput = screen.getByTestId('answer-input');
    fireEvent.change(answerInput, { target: { value: '4' } });

    const nextButton = screen.getByTestId('next-button');
    fireEvent.click(nextButton);

    await waitFor(() => {
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          answers: expect.any(Object),
          endTime: expect.any(Number)
        })
      );
    });
  });

  it('calls onCancel when exit button is clicked', () => {
    render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const exitButton = screen.getByText('Exit Quiz');
    fireEvent.click(exitButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when no questions', () => {
    render(
      <QuizInterface
        questions={[]}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Loading quiz...')).toBeInTheDocument();
  });

  it('displays quiz status information', () => {
    render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('0 of 2 answered')).toBeInTheDocument();
  });

  it('shows submission overlay when submitting', async () => {
    render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const answerInput = screen.getByTestId('answer-input');
    fireEvent.change(answerInput, { target: { value: '4' } });

    const nextButton = screen.getByTestId('next-button');
    fireEvent.click(nextButton);

    await waitFor(() => {
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);
    });

    expect(screen.getByText('Submitting Quiz')).toBeInTheDocument();
    expect(screen.getByText('Please wait while we process your answers...')).toBeInTheDocument();
  });

  it('has accessibility announcements region', () => {
    render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const announcementsRegion = screen.getByLabelText('', { selector: '#quiz-announcements' });
    expect(announcementsRegion).toBeInTheDocument();
    expect(announcementsRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('applies custom className', () => {
    const { container } = render(
      <QuizInterface
        questions={mockQuestions}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        className="custom-quiz-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-quiz-class');
  });
});
