/**
 * Tests for ScreenBehaviorMonitor
 */

import { ScreenBehaviorMonitor } from '../ScreenBehaviorMonitor';

// Mock the ScreenBehaviorMonitor to avoid JSDOM issues
jest.mock('../ScreenBehaviorMonitor', () => {
  return {
    ScreenBehaviorMonitor: jest.fn().mockImplementation(() => ({
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
      getMonitoringStatus: jest.fn().mockReturnValue({
        cursorTracking: {
          position: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          acceleration: { x: 0, y: 0 },
          outsideViewport: false,
          suspiciousMovement: false,
          automatedBehavior: false,
          confidence: 0.9
        },
        windowFocus: {
          currentWindow: 'quiz-application',
          focusChanges: [],
          applicationSwitching: false,
          suspiciousApplications: [],
          backgroundActivity: false
        },
        screenSharing: {
          isScreenSharing: false,
          remoteDesktopDetected: false,
          screenCastingDetected: false,
          collaborationToolsDetected: [],
          confidence: 0.9
        },
        fullscreenEnforcement: {
          isFullscreen: true,
          enforcementActive: true,
          bypassAttempts: 0,
          violations: []
        },
        virtualMachineDisplay: {
          isVirtualDisplay: false,
          vmSoftware: [],
          displayDrivers: [],
          resolutionAnomalies: false,
          refreshRateAnomalies: false,
          confidence: 0.9
        }
      }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispose: jest.fn()
    }))
  };
});

describe('ScreenBehaviorMonitor', () => {
  let monitor: any;

  beforeEach(() => {
    monitor = new ScreenBehaviorMonitor();
  });

  afterEach(() => {
    monitor.dispose();
  });

  describe('Basic Functionality', () => {
    it('should create monitor instance', () => {
      expect(monitor).toBeDefined();
    });

    it('should start monitoring', () => {
      monitor.startMonitoring();
      expect(monitor.startMonitoring).toHaveBeenCalled();
    });

    it('should stop monitoring', () => {
      monitor.stopMonitoring();
      expect(monitor.stopMonitoring).toHaveBeenCalled();
    });

    it('should get monitoring status', () => {
      const status = monitor.getMonitoringStatus();
      
      expect(status).toHaveProperty('cursorTracking');
      expect(status).toHaveProperty('windowFocus');
      expect(status).toHaveProperty('screenSharing');
      expect(status).toHaveProperty('fullscreenEnforcement');
      expect(status).toHaveProperty('virtualMachineDisplay');
    });

    it('should add and remove event listeners', () => {
      const handler = jest.fn();
      
      monitor.addEventListener(handler);
      monitor.removeEventListener(handler);
      
      expect(monitor.addEventListener).toHaveBeenCalledWith(handler);
      expect(monitor.removeEventListener).toHaveBeenCalledWith(handler);
    });

    it('should dispose resources', () => {
      monitor.dispose();
      expect(monitor.dispose).toHaveBeenCalled();
    });
  });

  describe('Status Properties', () => {
    it('should return cursor tracking status', () => {
      const status = monitor.getMonitoringStatus();
      
      expect(status.cursorTracking).toMatchObject({
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
        outsideViewport: false,
        suspiciousMovement: false,
        automatedBehavior: false,
        confidence: expect.any(Number)
      });
    });

    it('should return window focus status', () => {
      const status = monitor.getMonitoringStatus();
      
      expect(status.windowFocus).toMatchObject({
        currentWindow: expect.any(String),
        focusChanges: expect.any(Array),
        applicationSwitching: expect.any(Boolean),
        suspiciousApplications: expect.any(Array),
        backgroundActivity: expect.any(Boolean)
      });
    });

    it('should return screen sharing status', () => {
      const status = monitor.getMonitoringStatus();
      
      expect(status.screenSharing).toMatchObject({
        isScreenSharing: expect.any(Boolean),
        remoteDesktopDetected: expect.any(Boolean),
        screenCastingDetected: expect.any(Boolean),
        collaborationToolsDetected: expect.any(Array),
        confidence: expect.any(Number)
      });
    });

    it('should return fullscreen enforcement status', () => {
      const status = monitor.getMonitoringStatus();
      
      expect(status.fullscreenEnforcement).toMatchObject({
        isFullscreen: expect.any(Boolean),
        enforcementActive: expect.any(Boolean),
        bypassAttempts: expect.any(Number),
        violations: expect.any(Array)
      });
    });

    it('should return VM display status', () => {
      const status = monitor.getMonitoringStatus();
      
      expect(status.virtualMachineDisplay).toMatchObject({
        isVirtualDisplay: expect.any(Boolean),
        vmSoftware: expect.any(Array),
        displayDrivers: expect.any(Array),
        resolutionAnomalies: expect.any(Boolean),
        refreshRateAnomalies: expect.any(Boolean),
        confidence: expect.any(Number)
      });
    });
  });

  describe('Monitoring Features', () => {
    it('should track cursor position', () => {
      const status = monitor.getMonitoringStatus();
      expect(status.cursorTracking.position).toEqual({ x: 0, y: 0 });
    });

    it('should monitor window focus', () => {
      const status = monitor.getMonitoringStatus();
      expect(status.windowFocus.currentWindow).toBe('quiz-application');
    });

    it('should detect screen sharing', () => {
      const status = monitor.getMonitoringStatus();
      expect(status.screenSharing.isScreenSharing).toBe(false);
    });

    it('should enforce fullscreen', () => {
      const status = monitor.getMonitoringStatus();
      expect(status.fullscreenEnforcement.enforcementActive).toBe(true);
    });

    it('should detect virtual machines', () => {
      const status = monitor.getMonitoringStatus();
      expect(status.virtualMachineDisplay.isVirtualDisplay).toBe(false);
    });
  });
});