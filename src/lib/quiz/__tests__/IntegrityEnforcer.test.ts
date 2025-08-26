/**
 * IntegrityEnforcer tests
 */

import { IntegrityEnforcer, IntegrityConfig } from '../IntegrityEnforcer';
import { IntegrityViolation } from '../types';
import { FlagEvent } from '../../proctoring/types';

// Mock ClipboardEvent for Node.js environment
global.ClipboardEvent = class ClipboardEvent extends Event {
  constructor(type: string, eventInitDict?: ClipboardEventInit) {
    super(type, eventInitDict);
  }
} as any;

// Mock DOM APIs
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
const mockRequestFullscreen = jest.fn();
const mockExitFullscreen = jest.fn();

// Store event listeners for simulation
const eventListeners: { [key: string]: EventListener[] } = {};

// Mock addEventListener to store listeners
const addEventListenerMock = (type: string, listener: EventListener) => {
  if (!eventListeners[type]) {
    eventListeners[type] = [];
  }
  eventListeners[type].push(listener);
  mockAddEventListener(type, listener);
};

// Mock removeEventListener to remove listeners
const removeEventListenerMock = (type: string, listener: EventListener) => {
  if (eventListeners[type]) {
    const index = eventListeners[type].indexOf(listener);
    if (index > -1) {
      eventListeners[type].splice(index, 1);
    }
  }
  mockRemoveEventListener(type, listener);
};

// Mock document and window
Object.defineProperty(document, 'addEventListener', {
  value: addEventListenerMock,
  writable: true
});

Object.defineProperty(document, 'removeEventListener', {
  value: removeEventListenerMock,
  writable: true
});

Object.defineProperty(window, 'addEventListener', {
  value: addEventListenerMock,
  writable: true
});

Object.defineProperty(window, 'removeEventListener', {
  value: removeEventListenerMock,
  writable: true
});

Object.defineProperty(document.documentElement, 'requestFullscreen', {
  value: mockRequestFullscreen,
  writable: true
});

Object.defineProperty(document, 'exitFullscreen', {
  value: mockExitFullscreen,
  writable: true
});

// Mock fullscreen properties
Object.defineProperty(document, 'fullscreenElement', {
  value: null,
  writable: true,
  configurable: true
});

// Helper function to simulate events
const simulateEvent = (target: EventTarget, event: Event) => {
  const eventType = event.type;
  if (eventListeners[eventType]) {
    eventListeners[eventType].forEach(listener => {
      listener(event);
    });
  }
};

describe('IntegrityEnforcer', () => {
  let enforcer: IntegrityEnforcer;
  let config: IntegrityConfig;
  let violations: IntegrityViolation[];
  let flags: FlagEvent[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Clear event listeners
    Object.keys(eventListeners).forEach(key => {
      eventListeners[key] = [];
    });
    
    violations = [];
    flags = [];

    config = {
      preventCopyPaste: true,
      blockRightClick: true,
      blockDevTools: true,
      enforceFullscreen: true,
      monitorPageVisibility: true,
      flagOnViolation: true,
      gracePeriodMs: 100
    };

    enforcer = new IntegrityEnforcer(config, {
      onViolation: (violation) => violations.push(violation),
      onFlag: (flag) => flags.push(flag)
    });
  });

  afterEach(() => {
    enforcer.destroy();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should create enforcer with config', () => {
      expect(enforcer).toBeDefined();
      expect(enforcer.getViolations()).toEqual([]);
    });

    it('should not be active initially', () => {
      expect(mockAddEventListener).not.toHaveBeenCalled();
    });
  });

  describe('Start/Stop', () => {
    it('should start enforcement and add event listeners', () => {
      enforcer.start();
      
      expect(mockAddEventListener).toHaveBeenCalledWith('copy', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('paste', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('cut', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });

    it('should stop enforcement and remove event listeners', () => {
      enforcer.start();
      enforcer.stop();
      
      expect(mockRemoveEventListener).toHaveBeenCalled();
    });

    it('should not start twice', () => {
      enforcer.start();
      const callCount = mockAddEventListener.mock.calls.length;
      
      enforcer.start();
      expect(mockAddEventListener.mock.calls.length).toBe(callCount);
    });
  });

  describe('Copy/Paste Prevention', () => {
    beforeEach(() => {
      enforcer.start();
      // Wait for grace period
      jest.advanceTimersByTime(200);
    });

    it('should prevent copy events', () => {
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      const preventDefaultSpy = jest.spyOn(copyEvent, 'preventDefault');
      
      simulateEvent(document, copyEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('copy-paste');
    });

    it('should prevent paste events', () => {
      const pasteEvent = new ClipboardEvent('paste', { bubbles: true });
      const preventDefaultSpy = jest.spyOn(pasteEvent, 'preventDefault');
      
      simulateEvent(document, pasteEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('copy-paste');
    });

    it('should prevent keyboard shortcuts', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true
      });
      const preventDefaultSpy = jest.spyOn(keyEvent, 'preventDefault');
      
      simulateEvent(document, keyEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('copy-paste');
    });
  });

  describe('Right-Click Prevention', () => {
    beforeEach(() => {
      enforcer.start();
      jest.advanceTimersByTime(200);
    });

    it('should prevent right-click events', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        button: 2,
        bubbles: true
      });
      const preventDefaultSpy = jest.spyOn(mouseEvent, 'preventDefault');
      
      simulateEvent(document, mouseEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('right-click');
    });

    it('should prevent context menu', () => {
      const contextEvent = new Event('contextmenu', { bubbles: true });
      const preventDefaultSpy = jest.spyOn(contextEvent, 'preventDefault');
      
      simulateEvent(document, contextEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not prevent left-click', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        button: 0,
        bubbles: true
      });
      const preventDefaultSpy = jest.spyOn(mouseEvent, 'preventDefault');
      
      simulateEvent(document, mouseEvent);
      
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(violations).toHaveLength(0);
    });
  });

  describe('Developer Tools Prevention', () => {
    beforeEach(() => {
      enforcer.start();
      jest.advanceTimersByTime(200);
    });

    it('should prevent F12 key', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'F12',
        bubbles: true
      });
      const preventDefaultSpy = jest.spyOn(keyEvent, 'preventDefault');
      
      simulateEvent(document, keyEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('dev-tools');
    });

    it('should prevent Ctrl+Shift+I', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'I',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true
      });
      const preventDefaultSpy = jest.spyOn(keyEvent, 'preventDefault');
      
      simulateEvent(document, keyEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('dev-tools');
    });

    it('should prevent Ctrl+U', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'u',
        ctrlKey: true,
        bubbles: true
      });
      const preventDefaultSpy = jest.spyOn(keyEvent, 'preventDefault');
      
      simulateEvent(document, keyEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('dev-tools');
    });
  });

  describe('Fullscreen Enforcement', () => {
    beforeEach(() => {
      enforcer.start();
      jest.advanceTimersByTime(200);
    });

    it('should detect fullscreen exit', () => {
      // Mock fullscreen element as null (not in fullscreen)
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true
      });

      const fullscreenEvent = new Event('fullscreenchange');
      simulateEvent(document, fullscreenEvent);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('fullscreen-exit');
    });

    it('should request fullscreen successfully', async () => {
      mockRequestFullscreen.mockResolvedValue(undefined);
      
      const result = await enforcer.requestFullscreen();
      
      expect(result).toBe(true);
      expect(mockRequestFullscreen).toHaveBeenCalled();
    });

    it('should handle fullscreen request failure', async () => {
      mockRequestFullscreen.mockRejectedValue(new Error('Not allowed'));
      
      const result = await enforcer.requestFullscreen();
      
      expect(result).toBe(false);
    });

    it('should detect fullscreen status correctly', () => {
      // Mock fullscreen element
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.documentElement,
        configurable: true
      });

      expect(enforcer.isFullscreen()).toBe(true);

      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true
      });

      expect(enforcer.isFullscreen()).toBe(false);
    });
  });

  describe('Page Visibility Monitoring', () => {
    beforeEach(() => {
      enforcer.start();
      jest.advanceTimersByTime(200);
    });

    it('should detect tab blur via visibility change', () => {
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true
      });

      const visibilityEvent = new Event('visibilitychange');
      simulateEvent(document, visibilityEvent);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('tab-blur');
    });

    it('should detect window blur', () => {
      const blurEvent = new Event('blur');
      simulateEvent(window, blurEvent);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('tab-blur');
    });

    it('should not detect violations when page is visible', () => {
      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true
      });

      const visibilityEvent = new Event('visibilitychange');
      simulateEvent(document, visibilityEvent);
      
      expect(violations).toHaveLength(0);
    });
  });

  describe('Grace Period', () => {
    it('should not record violations during grace period', () => {
      enforcer.start();
      
      // Immediately trigger violation (should be within grace period)
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      simulateEvent(document, copyEvent);
      
      // Should not record violation during grace period
      expect(violations).toHaveLength(0);
      
      // Advance time past grace period
      jest.advanceTimersByTime(150); // Past the 100ms grace period
      
      // Trigger another violation after grace period
      const copyEvent2 = new ClipboardEvent('copy', { bubbles: true });
      simulateEvent(document, copyEvent2);
      
      // Should now record the violation
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('copy-paste');
    });
  });

  describe('Flag Generation', () => {
    beforeEach(() => {
      enforcer.start();
      jest.advanceTimersByTime(200);
    });

    it('should generate flags for violations when enabled', () => {
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      simulateEvent(document, copyEvent);
      
      expect(flags).toHaveLength(1);
      expect(flags[0].type).toBe('INTEGRITY_VIOLATION');
      expect(flags[0].severity).toBe('hard');
      expect(flags[0].confidence).toBe(1.0);
    });

    it('should not generate flags when disabled', () => {
      enforcer.destroy();
      
      const configNoFlags = { ...config, flagOnViolation: false };
      const enforcerNoFlags = new IntegrityEnforcer(configNoFlags, {
        onViolation: (violation) => violations.push(violation),
        onFlag: (flag) => flags.push(flag)
      });
      
      enforcerNoFlags.start();
      jest.advanceTimersByTime(200);
      
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      simulateEvent(document, copyEvent);
      
      expect(violations).toHaveLength(1);
      expect(flags).toHaveLength(0);
      
      enforcerNoFlags.destroy();
    });
  });

  describe('Violation Management', () => {
    beforeEach(() => {
      enforcer.start();
      jest.advanceTimersByTime(200);
    });

    it('should track multiple violations', () => {
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      const pasteEvent = new ClipboardEvent('paste', { bubbles: true });
      
      simulateEvent(document, copyEvent);
      simulateEvent(document, pasteEvent);
      
      expect(violations).toHaveLength(2);
      expect(enforcer.getViolations()).toHaveLength(2);
    });

    it('should clear violations', () => {
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      simulateEvent(document, copyEvent);
      
      expect(violations).toHaveLength(1);
      
      enforcer.clearViolations();
      
      expect(enforcer.getViolations()).toHaveLength(0);
    });
  });

  describe('Selective Enforcement', () => {
    it('should only enforce enabled features', () => {
      const selectiveConfig: IntegrityConfig = {
        preventCopyPaste: true,
        blockRightClick: false,
        blockDevTools: false,
        enforceFullscreen: false,
        monitorPageVisibility: false,
        flagOnViolation: true,
        gracePeriodMs: 100
      };

      const selectiveEnforcer = new IntegrityEnforcer(selectiveConfig, {
        onViolation: (violation) => violations.push(violation)
      });

      selectiveEnforcer.start();
      jest.advanceTimersByTime(200);

      // Should prevent copy/paste
      const copyEvent = new ClipboardEvent('copy', { bubbles: true });
      simulateEvent(document, copyEvent);
      expect(violations).toHaveLength(1);

      // Should not prevent right-click
      const mouseEvent = new MouseEvent('mousedown', {
        button: 2,
        bubbles: true
      });
      simulateEvent(document, mouseEvent);
      expect(violations).toHaveLength(1); // Still only 1 violation

      selectiveEnforcer.destroy();
    });
  });
});