/**
 * Tests for MonitoringStatusDisplay component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MonitoringStatusDisplay } from '../MonitoringStatusDisplay';
import { useAppStore } from '../../../store/appStore';

// Mock the store
jest.mock('../../../store/appStore');
const mockUseAppStore = useAppStore;

/** @type {import('../../../lib/vision/types').VisionSignals} */
const mockVisionSignals = {
  timestamp: Date.now(),
  faceDetected: true,
  landmarks: new Float32Array(468 * 3),
  headPose: {
    yaw: 5,
    pitch: -2,
    roll: 1,
    confidence: 0.9
  },
  gazeVector: {
    x: 0.1,
    y: -0.05,
    z: 1.0,
    confidence: 0.85
  },
  eyesOnScreen: true,
  environmentScore: {
    lighting: 0.8,
    shadowStability: 0.9,
    secondaryFaces: 0,
    deviceLikeObjects: 0
  }
};

const defaultStoreState = {
  currentSignals: mockVisionSignals,
  monitoring: {
    isActive: true,
    performanceMetrics: {
      fps: 30,
      latency: 25,
      memoryUsage: 150
    }
  },
  privacySettings: {
    videoPreviewEnabled: true
  }
};

describe('MonitoringStatusDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppStore.mockReturnValue(defaultStoreState);
  });

  it('renders monitoring status display', () => {
    render(<MonitoringStatusDisplay />);

    expect(screen.getByText('Monitoring Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows compact view when compact prop is true', () => {
    render(<MonitoringStatusDisplay compact={true} />);

    expect(screen.queryByText('Monitoring Status')).not.toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
  });

  it('displays eyes status correctly', () => {
    render(<MonitoringStatusDisplay />);

    expect(screen.getByText('Eyes')).toBeInTheDocument();
    expect(screen.getByText('On Screen')).toBeInTheDocument();
    expect(screen.getByText('Confidence: 85%')).toBeInTheDocument();
  });

  it('displays head pose status correctly', () => {
    render(<MonitoringStatusDisplay />);

    expect(screen.getByText('Head Pose')).toBeInTheDocument();
    expect(screen.getByText('Good Position')).toBeInTheDocument();
    expect(screen.getByText('Y: 5° P: -2°')).toBeInTheDocument();
  });

  it('displays environment status correctly', () => {
    render(<MonitoringStatusDisplay />);

    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('Stable')).toBeInTheDocument();
    expect(screen.getByText('Light: 80%')).toBeInTheDocument();
  });

  it('shows detailed metrics when showDetails is true', () => {
    render(<MonitoringStatusDisplay showDetails={true} />);

    expect(screen.getByText('Detailed Metrics')).toBeInTheDocument();
    expect(screen.getByText('Face Detected:')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('hides detailed metrics when showDetails is false', () => {
    render(<MonitoringStatusDisplay showDetails={false} />);

    expect(screen.queryByText('Detailed Metrics')).not.toBeInTheDocument();
  });

  it('shows performance metrics when available', () => {
    render(<MonitoringStatusDisplay showDetails={true} />);

    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument(); // FPS
    expect(screen.getByText('25ms')).toBeInTheDocument(); // Latency
    expect(screen.getByText('150MB')).toBeInTheDocument(); // Memory
  });

  it('displays inactive status when monitoring is not active', () => {
    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      monitoring: {
        ...defaultStoreState.monitoring,
        isActive: false
      }
    });

    render(<MonitoringStatusDisplay />);

    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows stale status when signals are old', () => {
    const oldSignals = {
      ...mockVisionSignals,
      timestamp: Date.now() - 5000 // 5 seconds ago
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      currentSignals: oldSignals
    });

    render(<MonitoringStatusDisplay />);

    expect(screen.getByText('Stale')).toBeInTheDocument();
  });

  it('handles missing signals gracefully', () => {
    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      currentSignals: null
    });

    render(<MonitoringStatusDisplay />);

    expect(screen.getByText('Off Screen')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows eyes off screen status correctly', () => {
    const offScreenSignals = {
      ...mockVisionSignals,
      eyesOnScreen: false,
      gazeVector: {
        ...mockVisionSignals.gazeVector,
        confidence: 0.3
      }
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      currentSignals: offScreenSignals
    });

    render(<MonitoringStatusDisplay />);

    expect(screen.getByText('Off Screen')).toBeInTheDocument();
    expect(screen.getByText('Confidence: 30%')).toBeInTheDocument();
  });

  it('shows poor head pose status when angles are out of range', () => {
    const poorHeadPoseSignals = {
      ...mockVisionSignals,
      headPose: {
        yaw: 25, // Outside acceptable range
        pitch: -20, // Outside acceptable range
        roll: 1,
        confidence: 0.7
      }
    };

    mockUseAppStore.mockReturnValue({
      ...defaultStoreState,
      currentSignals: poorHeadPoseSignals
    });

    render(<MonitoringStatusDisplay />);

    expect(screen.getByText('Y: 25° P: -20°')).toBeInTheDocument();
  });

  it('shows video preview status when enabled', () => {
    render(<MonitoringStatusDisplay showDetails={true} />);

    expect(screen.getByText('Video preview enabled')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<MonitoringStatusDisplay className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
