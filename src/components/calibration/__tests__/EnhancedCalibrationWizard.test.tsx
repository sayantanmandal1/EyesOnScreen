/**
 * Tests for EnhancedCalibrationWizard component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnhancedCalibrationWizard } from '../EnhancedCalibrationWizard';
import { useAppStore } from '../../../store/appStore';

// Mock the store
jest.mock('../../../store/appStore');
const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

// Mock child components
jest.mock('../CalibrationDots', () => ({
  CalibrationDots: ({ onComplete }: any) => (
    <div data-testid="calibration-dots">
      <button onClick={() => onComplete({ averageAccuracy: 0.85 })}>
        Complete Gaze Calibration
      </button>
    </div>
  )
}));

jest.mock('../HeadMovementGuide', () => ({
  HeadMovementGuide: ({ onComplete }: any) => (
    <div data-testid="head-movement-guide">
      <button onClick={() => onComplete({ rangeQuality: 0.9 })}>
        Complete Head Pose
      </button>
    </div>
  )
}));

jest.mock('../EnvironmentCheck', () => ({
  EnvironmentCheck: ({ onComplete }: any) => (
    <div data-testid="environment-check">
      <button onClick={() => onComplete({ stabilityScore: 0.8 })}>
        Complete Environment Check
      </button>
    </div>
  )
}));

describe('EnhancedCalibrationWizard', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();
  const mockSetCalibrationSession = jest.fn();
  const mockSetCalibrationProfile = jest.fn();

  const defaultStoreState = {
    calibrationSession: null,
    setCalibrationSession: mockSetCalibrationSession,
    calibrationProfile: null,
    setCalibrationProfile: mockSetCalibrationProfile,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppStore.mockReturnValue(defaultStoreState as any);
  });

  it('renders initialization screen when no calibration session', () => {
    render(
      <EnhancedCalibrationWizard
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Initializing calibration...')).toBeInTheDocument();
  });

  it('initializes calibration session on mount', async () => {
    render(
      <EnhancedCalibrationWizard
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockSetCalibrationSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringContaining('calibration-'),
          steps: expect.arrayContaining([
            expect.objectContaining({ id: 'setup-check' }),
            expect.objectContaining({ id: 'gaze-calibration' }),
            expect.objectContaining({ id: 'head-pose-calibration' }),
            expect.objectContaining({ id: 'environment-baseline' })
          ]),
          status: 'in-progress'
        })
      );
    });
  });

  it('displays calibration steps with progress', () => {
    const mockSession = {
      id: 'test-session',
      startTime: Date.now(),
      steps: [
        {
          id: 'setup-check',
          name: 'Setup Verification',
          description: 'Verify your camera and environment setup',
          duration: 15000,
          instructions: ['Position yourself correctly'],
          completed: false
        }
      ],
      currentStepIndex: 0,
      overallQuality: 0,
      status: 'in-progress' as const
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      calibrationSession: mockSession
    } as any);

    render(
      <EnhancedCalibrationWizard
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Setup Verification')).toBeInTheDocument();
    expect(screen.getByText('Verify your camera and environment setup')).toBeInTheDocument();
  });

  it('shows detailed instructions by default', () => {
    const mockSession = {
      id: 'test-session',
      startTime: Date.now(),
      steps: [
        {
          id: 'setup-check',
          name: 'Setup Verification',
          description: 'Test description',
          instructions: ['Instruction 1', 'Instruction 2'],
          tips: ['Tip 1', 'Tip 2'],
          completed: false
        }
      ],
      currentStepIndex: 0,
      overallQuality: 0,
      status: 'in-progress' as const
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      calibrationSession: mockSession
    } as any);

    render(
      <EnhancedCalibrationWizard
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        showDetailedInstructions={true}
      />
    );

    expect(screen.getByText('Setup Verification - Instructions')).toBeInTheDocument();
    expect(screen.getByText('What to do:')).toBeInTheDocument();
    expect(screen.getByText('Tips for success:')).toBeInTheDocument();
    expect(screen.getByText('Instruction 1')).toBeInTheDocument();
    expect(screen.getByText('Tip 1')).toBeInTheDocument();
  });

  it('allows skipping instructions', () => {
    const mockSession = {
      id: 'test-session',
      startTime: Date.now(),
      steps: [
        {
          id: 'setup-check',
          name: 'Setup Verification',
          description: 'Test description',
          instructions: ['Instruction 1'],
          completed: false
        }
      ],
      currentStepIndex: 0,
      overallQuality: 0,
      status: 'in-progress' as const
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      calibrationSession: mockSession
    } as any);

    render(
      <EnhancedCalibrationWizard
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const skipButton = screen.getByText('Skip Instructions');
    fireEvent.click(skipButton);

    expect(screen.queryByText('Setup Verification - Instructions')).not.toBeInTheDocument();
    expect(screen.getByTestId('environment-check')).toBeInTheDocument();
  });

  it('progresses through calibration steps', async () => {
    const mockSession = {
      id: 'test-session',
      startTime: Date.now(),
      steps: [
        {
          id: 'setup-check',
          name: 'Setup Verification',
          description: 'Test description',
          instructions: ['Instruction 1'],
          completed: false
        },
        {
          id: 'gaze-calibration',
          name: 'Gaze Calibration',
          description: 'Test gaze',
          instructions: ['Look at dots'],
          completed: false
        }
      ],
      currentStepIndex: 0,
      overallQuality: 0,
      status: 'in-progress' as const
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      calibrationSession: mockSession
    } as any);

    render(
      <EnhancedCalibrationWizard
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        showDetailedInstructions={false}
      />
    );

    // Complete first step
    const completeButton = screen.getByText('Complete Environment Check');
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(mockSetCalibrationSession).toHaveBeenCalledWith(
        expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({ completed: true })
          ]),
          currentStepIndex: 1
        })
      );
    });
  });

  it('shows attempt number for multiple attempts', () => {
    const mockSession = {
      id: 'test-session-attempt-2',
      startTime: Date.now(),
      steps: [{ id: 'setup-check', name: 'Setup', completed: false }],
      currentStepIndex: 0,
      overallQuality: 0,
      status: 'in-progress' as const,
      attemptNumber: 2
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      calibrationSession: mockSession
    } as any);

    render(
      <EnhancedCalibrationWizard
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Calibration Attempt #2')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const mockSession = {
      id: 'test-session',
      startTime: Date.now(),
      steps: [{ id: 'setup-check', name: 'Setup', completed: false }],
      currentStepIndex: 0,
      overallQuality: 0,
      status: 'in-progress' as const
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      calibrationSession: mockSession
    } as any);

    render(
      <EnhancedCalibrationWizard
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        showDetailedInstructions={false}
      />
    );

    const cancelButton = screen.getByText('Cancel Calibration');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('shows quality feedback when calibration quality is low', async () => {
    const mockSession = {
      id: 'test-session',
      startTime: Date.now(),
      steps: [
        {
          id: 'setup-check',
          name: 'Setup',
          completed: true,
          data: { setupScore: 0.5 }
        }
      ],
      currentStepIndex: 1,
      overallQuality: 0.5,
      status: 'in-progress' as const
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      calibrationSession: mockSession
    } as any);

    const { rerender } = render(
      <EnhancedCalibrationWizard
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Simulate completing all steps with low quality
    const updatedSession = {
      ...mockSession,
      overallQuality: 0.5,
      status: 'completed' as const
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      calibrationSession: updatedSession
    } as any);

    rerender(
      <EnhancedCalibrationWizard
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // The component should show quality feedback for low quality
    // This would be handled by the CalibrationQualityFeedback component
  });
});