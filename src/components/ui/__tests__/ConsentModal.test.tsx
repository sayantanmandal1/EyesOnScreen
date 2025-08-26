/**
 * Tests for ConsentModal component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConsentModal } from '../ConsentModal';
import { useAppStore } from '../../../store/appStore';

// Mock the store
jest.mock('../../../store/appStore');
const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

describe('ConsentModal', () => {
  const mockOnAccept = jest.fn();
  const mockOnDecline = jest.fn();
  const mockUpdatePrivacySettings = jest.fn();

  const defaultStoreState = {
    privacySettings: {
      videoPreviewEnabled: true,
      serverSyncEnabled: false,
      audioAlertsEnabled: true,
      dataRetentionDays: 30,
    },
    updatePrivacySettings: mockUpdatePrivacySettings,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppStore.mockReturnValue(defaultStoreState as any);
  });

  it('renders when open', () => {
    render(
      <ConsentModal
        isOpen={true}
        onAccept={mockOnAccept}
        onDecline={mockOnDecline}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Eyes-On-Screen Proctored Quiz')).toBeInTheDocument();
    expect(screen.getByText('Informed Consent and Privacy Agreement')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <ConsentModal
        isOpen={false}
        onAccept={mockOnAccept}
        onDecline={mockOnDecline}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays all required sections', () => {
    render(
      <ConsentModal
        isOpen={true}
        onAccept={mockOnAccept}
        onDecline={mockOnDecline}
      />
    );

    expect(screen.getByText('Privacy and Data Processing')).toBeInTheDocument();
    expect(screen.getByText('Data Usage and Retention')).toBeInTheDocument();
    expect(screen.getByText('Camera and Monitoring Requirements')).toBeInTheDocument();
    expect(screen.getByText('Privacy Settings')).toBeInTheDocument();
  });

  it('disables accept button until all sections are acknowledged', () => {
    render(
      <ConsentModal
        isOpen={true}
        onAccept={mockOnAccept}
        onDecline={mockOnDecline}
      />
    );

    const acceptButton = screen.getByText('I Consent - Begin Quiz');
    expect(acceptButton).toBeDisabled();

    // Check first acknowledgment
    const privacyCheckbox = screen.getByLabelText(/I have read and understand the privacy and data processing information/);
    fireEvent.click(privacyCheckbox);

    expect(acceptButton).toBeDisabled(); // Still disabled

    // Check second acknowledgment
    const dataUsageCheckbox = screen.getByLabelText(/I have read and understand the data usage and retention policies/);
    fireEvent.click(dataUsageCheckbox);

    expect(acceptButton).not.toBeDisabled(); // Now enabled
  });

  it('calls onAccept when accept button is clicked and all requirements met', async () => {
    render(
      <ConsentModal
        isOpen={true}
        onAccept={mockOnAccept}
        onDecline={mockOnDecline}
      />
    );

    // Acknowledge both sections
    const privacyCheckbox = screen.getByLabelText(/I have read and understand the privacy and data processing information/);
    const dataUsageCheckbox = screen.getByLabelText(/I have read and understand the data usage and retention policies/);
    
    fireEvent.click(privacyCheckbox);
    fireEvent.click(dataUsageCheckbox);

    const acceptButton = screen.getByText('I Consent - Begin Quiz');
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mockOnAccept).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onDecline when decline button is clicked', () => {
    render(
      <ConsentModal
        isOpen={true}
        onAccept={mockOnAccept}
        onDecline={mockOnDecline}
      />
    );

    const declineButton = screen.getByText('Decline and Exit');
    fireEvent.click(declineButton);

    expect(mockOnDecline).toHaveBeenCalledTimes(1);
  });

  it('updates privacy settings when toggles are changed', () => {
    render(
      <ConsentModal
        isOpen={true}
        onAccept={mockOnAccept}
        onDecline={mockOnDecline}
      />
    );

    const videoPreviewToggle = screen.getByLabelText(/Video Preview/);
    fireEvent.click(videoPreviewToggle);

    expect(mockUpdatePrivacySettings).toHaveBeenCalledWith({
      videoPreviewEnabled: false,
    });

    const audioAlertsToggle = screen.getByLabelText(/Audio Alerts/);
    fireEvent.click(audioAlertsToggle);

    expect(mockUpdatePrivacySettings).toHaveBeenCalledWith({
      audioAlertsEnabled: false,
    });

    const serverSyncToggle = screen.getByLabelText(/Server Sync \(Optional\)/);
    fireEvent.click(serverSyncToggle);

    expect(mockUpdatePrivacySettings).toHaveBeenCalledWith({
      serverSyncEnabled: true,
    });
  });

  it('displays current privacy settings correctly', () => {
    const customStoreState = {
      ...defaultStoreState,
      privacySettings: {
        videoPreviewEnabled: false,
        serverSyncEnabled: true,
        audioAlertsEnabled: false,
        dataRetentionDays: 60,
      },
    };

    mockUseAppStore.mockReturnValue(customStoreState as any);

    render(
      <ConsentModal
        isOpen={true}
        onAccept={mockOnAccept}
        onDecline={mockOnDecline}
      />
    );

    const videoPreviewToggle = screen.getByLabelText(/Video Preview/) as HTMLInputElement;
    const audioAlertsToggle = screen.getByLabelText(/Audio Alerts/) as HTMLInputElement;
    const serverSyncToggle = screen.getByLabelText(/Server Sync \(Optional\)/) as HTMLInputElement;

    expect(videoPreviewToggle.checked).toBe(false);
    expect(audioAlertsToggle.checked).toBe(false);
    expect(serverSyncToggle.checked).toBe(true);
  });

  it('has proper accessibility attributes', () => {
    render(
      <ConsentModal
        isOpen={true}
        onAccept={mockOnAccept}
        onDecline={mockOnDecline}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'consent-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'consent-description');

    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('id', 'consent-title');
  });

  it('shows requirement message when accept button is disabled', () => {
    render(
      <ConsentModal
        isOpen={true}
        onAccept={mockOnAccept}
        onDecline={mockOnDecline}
      />
    );

    expect(screen.getByText('Please read and acknowledge all sections above to continue')).toBeInTheDocument();

    // Acknowledge both sections
    const privacyCheckbox = screen.getByLabelText(/I have read and understand the privacy and data processing information/);
    const dataUsageCheckbox = screen.getByLabelText(/I have read and understand the data usage and retention policies/);
    
    fireEvent.click(privacyCheckbox);
    fireEvent.click(dataUsageCheckbox);

    expect(screen.queryByText('Please read and acknowledge all sections above to continue')).not.toBeInTheDocument();
  });
});