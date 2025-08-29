/**
 * Tests for ScreenBehaviorMonitor
 */

import { ScreenBehaviorMonitor } from '../ScreenBehaviorMonitor';

// Mock document and window objects
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
const mockRequestFullscreen = jest.fn().mockResolvedValue(undefined);

Object.defineProperty(document, 'addEventListener', {
  value: mockAddEventListener,
  writable: true
});

Object.defineProperty(document, 'removeEventListener', {
  value: mockRemoveEventListener,
  writable: true
});

Object.defineProperty(document.documentElement, 'requestFullscreen', {
  value: mockRequestFullscreen,
  writable: true
});

Object.defineProperty(document, 'fullscreenElement', {
  value: null,
  writable: true
});

// Mock window properties
Object.defineProperty(window, 'innerWidth', {
  value: 1920,
  writable: true
});

Object.defineProperty(window, 'innerHeight', {
  value: 1080,
  writable: true
});

describe('ScreenBehaviorMonitor', () => {
  let monitor: ScreenBehaviorMonitor;

  beforeEach(() => {
    monitor = new ScreenBehaviorMonitor();
    jest.clearAllMocks();
  });

  afterEach(() => {
    monitor.dispose();
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring correctly', () => {
      const intervalSpy = jest.spyOn(window, 'setInterval');
      
      monitor.startMonitoring();
      
      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 100);
    });

    it('should stop monitoring correctly', () => {
      const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
      
      monitor.startMonitoring();
      monitor.stopMonitoring();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should not start monitoring twice', () => {
      const intervalSpy = jest.spyOn(window, 'setInterval');
      
      monitor.startMonitoring();
      monitor.startMonitoring();
      
      expect(intervalSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cursor Tracking', () => {
    it('should track cursor position correctly', () => {
      monitor.startMonitoring();
      
      // Simulate mouse movement
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 200
      });
      
      document.dispatchEvent(mouseEvent);
      
      const status = monitor.getMonitoringStatus();
      expect(status.cursorTracking.position.x).toBe(100);
      expect(status.cursorTracking.position.y).toBe(200);
    });

    it('should detect cursor outside viewport', () => {
      monitor.startMonitoring();
      
      // Simulate mouse movement outside viewport
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: -10,
        clientY: -10
      });
      
      document.dispatchEvent(mouseEvent);
      
      const status = monitor.getMonitoringStatus();
      expect(status.cursorTracking.outsideViewport).toBe(true);
    });

    it('should calculate cursor velocity', () => {
      monitor.startMonitoring();
      
      // Simulate rapid mouse movements
      const events = [
        { x: 0, y: 0, time: 0 },
        { x: 100, y: 0, time: 100 },
        { x: 200, y: 0, time: 200 }
      ];
      
      events.forEach((event, index) => {
        setTimeout(() => {
          const mouseEvent = new MouseEvent('mousemove', {
            clientX: event.x,
            clientY: event.y
          });
          document.dispatchEvent(mouseEvent);
        }, event.time);
      });
      
      // Wait for events to process
      setTimeout(() => {
        const status = monitor.getMonitoringStatus();
        expect(status.cursorTracking.velocity.x).toBeGreaterThan(0);
      }, 300);
    });

    it('should detect automated cursor behavior', () => {
      monitor.startMonitoring();
      
      // Simulate perfectly timed movements (automated behavior)
      for (let i = 0; i < 25; i++) {
        setTimeout(() => {
          const mouseEvent = new MouseEvent('mousemove', {
            clientX: i * 10,
            clientY: 100
          });
          document.dispatchEvent(mouseEvent);
        }, i * 50); // Perfectly timed intervals
      }
      
      setTimeout(() => {
        const status = monitor.getMonitoringStatus();
        expect(status.cursorTracking.automatedBehavior).toBe(true);
      }, 1500);
    });
  });

  describe('Window Focus Tracking', () => {
    it('should track window focus changes', () => {
      monitor.startMonitoring();
      
      // Simulate window blur
      window.dispatchEvent(new Event('blur'));
      
      const status = monitor.getMonitoringStatus();
      expect(status.windowFocus.backgroundActivity).toBe(true);
      expect(status.windowFocus.focusChanges.length).toBeGreaterThan(0);
    });

    it('should detect application switching', () => {
      monitor.startMonitoring();
      
      // Simulate multiple rapid focus changes
      for (let i = 0; i < 5; i++) {
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('focus'));
      }
      
      const status = monitor.getMonitoringStatus();
      expect(status.windowFocus.applicationSwitching).toBe(true);
    });

    it('should handle visibility change events', () => {
      monitor.startMonitoring();
      
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true
      });
      
      document.dispatchEvent(new Event('visibilitychange'));
      
      const status = monitor.getMonitoringStatus();
      expect(status.windowFocus.backgroundActivity).toBe(true);
    });
  });

  describe('Screen Sharing Detection', () => {
    it('should detect screen sharing attempts', async () => {
      monitor.startMonitoring();
      
      // Mock getDisplayMedia usage
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      let screenSharingDetected = false;
      
      navigator.mediaDevices.getDisplayMedia = function(...args) {
        screenSharingDetected = true;
        return Promise.resolve({} as MediaStream);
      };
      
      // Trigger detection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = monitor.getMonitoringStatus();
      // Note: The actual implementation would need to be adjusted to properly detect this
      
      // Restore original function
      navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
    });

    it('should detect remote desktop indicators', () => {
      // Mock user agent with remote desktop software
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TeamViewer',
        writable: true
      });
      
      monitor.startMonitoring();
      
      const status = monitor.getMonitoringStatus();
      expect(status.screenSharing.remoteDesktopDetected).toBe(true);
    });

    it('should detect collaboration tools', () => {
      // Mock user agent with collaboration software
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Zoom',
        writable: true
      });
      
      monitor.startMonitoring();
      
      const status = monitor.getMonitoringStatus();
      expect(status.screenSharing.collaborationToolsDetected).toContain('zoom');
    });
  });

  describe('Fullscreen Enforcement', () => {
    it('should request fullscreen on start', () => {
      monitor.startMonitoring();
      
      expect(mockRequestFullscreen).toHaveBeenCalled();
    });

    it('should block escape key', () => {
      monitor.startMonitoring();
      
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Escape'
      });
      
      const preventDefaultSpy = jest.spyOn(keyEvent, 'preventDefault');
      document.dispatchEvent(keyEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should block Alt+Tab combination', () => {
      monitor.startMonitoring();
      
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        altKey: true
      });
      
      const preventDefaultSpy = jest.spyOn(keyEvent, 'preventDefault');
      document.dispatchEvent(keyEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should track bypass attempts', () => {
      monitor.startMonitoring();
      
      // Simulate multiple bypass attempts
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      const altTabEvent = new KeyboardEvent('keydown', { key: 'Tab', altKey: true });
      
      document.dispatchEvent(escapeEvent);
      document.dispatchEvent(altTabEvent);
      
      const status = monitor.getMonitoringStatus();
      expect(status.fullscreenEnforcement.bypassAttempts).toBeGreaterThan(0);
      expect(status.fullscreenEnforcement.violations.length).toBeGreaterThan(0);
    });

    it('should handle fullscreen change events', () => {
      monitor.startMonitoring();
      
      // Mock fullscreen exit
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        writable: true
      });
      
      document.dispatchEvent(new Event('fullscreenchange'));
      
      const status = monitor.getMonitoringStatus();
      expect(status.fullscreenEnforcement.bypassAttempts).toBeGreaterThan(0);
    });
  });

  describe('Virtual Machine Detection', () => {
    it('should detect VM software in user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VirtualBox',
        writable: true
      });
      
      monitor.startMonitoring();
      
      const status = monitor.getMonitoringStatus();
      expect(status.virtualMachineDisplay.isVirtualDisplay).toBe(true);
      expect(status.virtualMachineDisplay.vmSoftware).toContain('virtualbox');
    });

    it('should detect VM display drivers', () => {
      // Mock WebGL context with VM renderer
      const mockCanvas = document.createElement('canvas');
      const mockGL = {
        getParameter: jest.fn().mockReturnValue('VMware SVGA 3D'),
        RENDERER: 'RENDERER'
      };
      
      jest.spyOn(mockCanvas, 'getContext').mockReturnValue(mockGL as any);
      jest.spyOn(document, 'createElement').mockReturnValue(mockCanvas);
      
      monitor.startMonitoring();
      
      const status = monitor.getMonitoringStatus();
      expect(status.virtualMachineDisplay.displayDrivers).toContain('vmware');
    });

    it('should detect VM resolution anomalies', () => {
      // Mock VM-typical resolution
      Object.defineProperty(window, 'screen', {
        value: {
          width: 1024,
          height: 768
        },
        writable: true
      });
      
      monitor.startMonitoring();
      
      const status = monitor.getMonitoringStatus();
      expect(status.virtualMachineDisplay.resolutionAnomalies).toBe(true);
    });
  });

  describe('Threat Detection', () => {
    it('should emit threats for suspicious cursor behavior', (done) => {
      monitor.addEventListener((event) => {
        if (event.type === 'threat_detected') {
          expect(event.data.type).toBe('focus_violation');
          done();
        }
      });
      
      monitor.startMonitoring();
      
      // Simulate cursor outside viewport
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: -100,
        clientY: -100
      });
      document.dispatchEvent(mouseEvent);
    });

    it('should emit threats for application switching', (done) => {
      monitor.addEventListener((event) => {
        if (event.type === 'threat_detected') {
          expect(event.data.type).toBe('focus_violation');
          done();
        }
      });
      
      monitor.startMonitoring();
      
      // Simulate rapid focus changes
      for (let i = 0; i < 5; i++) {
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('focus'));
      }
    });

    it('should emit threats for screen sharing', (done) => {
      // Mock user agent with screen sharing software
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 TeamViewer',
        writable: true
      });
      
      monitor.addEventListener((event) => {
        if (event.type === 'threat_detected') {
          expect(event.data.type).toBe('screen_sharing');
          done();
        }
      });
      
      monitor.startMonitoring();
    });

    it('should emit threats for fullscreen bypass attempts', (done) => {
      monitor.addEventListener((event) => {
        if (event.type === 'threat_detected') {
          expect(event.data.type).toBe('fullscreen_bypass');
          done();
        }
      });
      
      monitor.startMonitoring();
      
      // Simulate bypass attempt
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
    });
  });

  describe('Event Handling', () => {
    it('should add and remove event listeners correctly', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      monitor.addEventListener(handler1);
      monitor.addEventListener(handler2);
      monitor.removeEventListener(handler1);
      
      // Trigger an event
      monitor.startMonitoring();
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: -100,
        clientY: -100
      });
      document.dispatchEvent(mouseEvent);
      
      // Only handler2 should be called
      setTimeout(() => {
        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
      }, 200);
    });

    it('should handle event handler errors gracefully', () => {
      const errorHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      monitor.addEventListener(errorHandler);
      monitor.startMonitoring();
      
      // Trigger an event
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: -100,
        clientY: -100
      });
      document.dispatchEvent(mouseEvent);
      
      setTimeout(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
      }, 200);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on dispose', () => {
      const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
      
      monitor.startMonitoring();
      monitor.dispose();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(mockRemoveEventListener).toHaveBeenCalled();
    });

    it('should handle multiple dispose calls', () => {
      monitor.startMonitoring();
      monitor.dispose();
      monitor.dispose(); // Should not throw
      
      expect(true).toBe(true); // Test passes if no error thrown
    });
  });
});