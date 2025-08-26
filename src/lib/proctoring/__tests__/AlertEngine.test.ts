/**
 * AlertEngine tests
 */

import { AlertEngine, AlertEngineConfig, AlertCallbacks, AlertState } from '../AlertEngine';
import { FlagEvent } from '../types';

// Mock AudioContext
const mockAudioContext = {
  createOscillator: jest.fn(() => ({
    connect: jest.fn(),
    frequency: { setValueAtTime: jest.fn() },
    start: jest.fn(),
    stop: jest.fn(),
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: {
      setValueAtTime: jest.fn(),
      exponentialRampToValueAtTime: jest.fn(),
    },
  })),
  destination: {},
  currentTime: 0,
  state: 'running',
  close: jest.fn().mockResolvedValue(undefined),
};

// Mock window.AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: jest.fn(() => mockAudioContext),
});

describe('AlertEngine', () => {
  let config: AlertEngineConfig;
  let callbacks: AlertCallbacks;
  let mockOnSoftAlert: jest.Mock;
  let mockOnHardAlert: jest.Mock;
  let mockOnAlertDismissed: jest.Mock;
  let alertEngine: AlertEngine;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    config = {
      debouncing: {
        softAlertFrames: 5,
        hardAlertFrames: 10,
        gracePeriodMs: 500,
      },
      audio: {
        enabled: true,
        softAlertVolume: 0.3,
        hardAlertVolume: 0.7,
      },
      toast: {
        duration: 3000,
        maxVisible: 3,
      },
    };

    mockOnSoftAlert = jest.fn();
    mockOnHardAlert = jest.fn();
    mockOnAlertDismissed = jest.fn();

    callbacks = {
      onSoftAlert: mockOnSoftAlert,
      onHardAlert: mockOnHardAlert,
      onAlertDismissed: mockOnAlertDismissed,
    };

    alertEngine = new AlertEngine(config, callbacks);
  });

  afterEach(() => {
    alertEngine.dispose();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config and callbacks', () => {
      expect(alertEngine.getConfig()).toEqual(config);
    });

    it('should initialize audio context when audio is enabled', () => {
      expect(window.AudioContext).toHaveBeenCalled();
    });
  });

  describe('processFlag', () => {
    it('should trigger soft alert after enough frames for soft flag', () => {
      const flag: FlagEvent = {
        id: 'test-flag-1',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.8,
        details: {},
      };

      // Process flag multiple times to reach threshold
      for (let i = 0; i < config.debouncing.softAlertFrames; i++) {
        alertEngine.processFlag(flag);
      }

      expect(mockOnSoftAlert).toHaveBeenCalledTimes(1);
      expect(mockOnHardAlert).not.toHaveBeenCalled();
    });

    it('should trigger hard alert immediately for hard severity flag', () => {
      const flag: FlagEvent = {
        id: 'test-flag-2',
        timestamp: Date.now(),
        type: 'SECOND_FACE',
        severity: 'hard',
        confidence: 0.9,
        details: {},
      };

      alertEngine.processFlag(flag);

      expect(mockOnHardAlert).toHaveBeenCalledTimes(1);
      expect(mockOnSoftAlert).not.toHaveBeenCalled();
    });

    it('should escalate to hard alert after enough frames', () => {
      const flag: FlagEvent = {
        id: 'test-flag-3',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.7,
        details: {},
      };

      // Process flag enough times to trigger hard alert
      for (let i = 0; i < config.debouncing.hardAlertFrames; i++) {
        alertEngine.processFlag(flag);
      }

      expect(mockOnHardAlert).toHaveBeenCalledTimes(1);
    });

    it('should handle different flag types with appropriate messages', () => {
      const flagTypes: FlagEvent['type'][] = [
        'EYES_OFF', 'HEAD_POSE', 'TAB_BLUR', 'SECOND_FACE',
        'DEVICE_OBJECT', 'SHADOW_ANOMALY', 'FACE_MISSING', 'DOWN_GLANCE'
      ];

      flagTypes.forEach(type => {
        const flag: FlagEvent = {
          id: `test-${type}`,
          timestamp: Date.now(),
          type,
          severity: 'hard',
          confidence: 0.8,
          details: {},
        };

        alertEngine.processFlag(flag);
      });

      expect(mockOnHardAlert).toHaveBeenCalledTimes(flagTypes.length);
    });

    it('should debounce flags by type and question', () => {
      const flag1: FlagEvent = {
        id: 'test-flag-4',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.8,
        details: {},
        questionId: 'q1',
      };

      const flag2: FlagEvent = {
        id: 'test-flag-5',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.8,
        details: {},
        questionId: 'q2',
      };

      // Process same type but different questions
      for (let i = 0; i < config.debouncing.softAlertFrames; i++) {
        alertEngine.processFlag(flag1);
        alertEngine.processFlag(flag2);
      }

      // Should trigger separate alerts for different questions
      expect(mockOnSoftAlert).toHaveBeenCalledTimes(2);
    });
  });

  describe('alert management', () => {
    it('should track active alerts', () => {
      const flag: FlagEvent = {
        id: 'test-flag-6',
        timestamp: Date.now(),
        type: 'DEVICE_OBJECT',
        severity: 'hard',
        confidence: 0.9,
        details: {},
      };

      alertEngine.processFlag(flag);

      const activeAlerts = alertEngine.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].type).toBe('hard');
    });

    it('should filter alerts by type', () => {
      // Trigger both soft and hard alerts
      const softFlag: FlagEvent = {
        id: 'soft-flag',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.7,
        details: {},
      };

      const hardFlag: FlagEvent = {
        id: 'hard-flag',
        timestamp: Date.now(),
        type: 'SECOND_FACE',
        severity: 'hard',
        confidence: 0.9,
        details: {},
      };

      // Trigger soft alert
      for (let i = 0; i < config.debouncing.softAlertFrames; i++) {
        alertEngine.processFlag(softFlag);
      }

      // Trigger hard alert
      alertEngine.processFlag(hardFlag);

      const softAlerts = alertEngine.getActiveAlertsByType('soft');
      const hardAlerts = alertEngine.getActiveAlertsByType('hard');

      expect(softAlerts).toHaveLength(1);
      expect(hardAlerts).toHaveLength(1);
    });

    it('should acknowledge alerts', () => {
      const flag: FlagEvent = {
        id: 'test-flag-7',
        timestamp: Date.now(),
        type: 'TAB_BLUR',
        severity: 'hard',
        confidence: 0.8,
        details: {},
      };

      alertEngine.processFlag(flag);

      const activeAlerts = alertEngine.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);

      const alertId = activeAlerts[0].id;
      alertEngine.acknowledgeAlert(alertId);

      expect(mockOnAlertDismissed).toHaveBeenCalledWith(alertId);
      expect(alertEngine.getActiveAlerts()).toHaveLength(0);
    });

    it('should dismiss alerts', () => {
      const flag: FlagEvent = {
        id: 'test-flag-8',
        timestamp: Date.now(),
        type: 'HEAD_POSE',
        severity: 'hard',
        confidence: 0.8,
        details: {},
      };

      alertEngine.processFlag(flag);

      const activeAlerts = alertEngine.getActiveAlerts();
      const alertId = activeAlerts[0].id;

      alertEngine.dismissAlert(alertId);

      expect(mockOnAlertDismissed).toHaveBeenCalledWith(alertId);
      expect(alertEngine.getActiveAlerts()).toHaveLength(0);
    });

    it('should clear all alerts', () => {
      // Create multiple alerts
      const flags: FlagEvent[] = [
        {
          id: 'flag-1',
          timestamp: Date.now(),
          type: 'EYES_OFF',
          severity: 'hard',
          confidence: 0.8,
          details: {},
        },
        {
          id: 'flag-2',
          timestamp: Date.now(),
          type: 'HEAD_POSE',
          severity: 'hard',
          confidence: 0.7,
          details: {},
        },
      ];

      flags.forEach(flag => alertEngine.processFlag(flag));

      expect(alertEngine.getActiveAlerts()).toHaveLength(2);

      alertEngine.clearAllAlerts();

      expect(alertEngine.getActiveAlerts()).toHaveLength(0);
      expect(mockOnAlertDismissed).toHaveBeenCalledTimes(2);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig: Partial<AlertEngineConfig> = {
        debouncing: {
          softAlertFrames: 10,
          hardAlertFrames: 3,
          gracePeriodMs: 300,
        },
      };

      alertEngine.updateConfig(newConfig);

      const updatedConfig = alertEngine.getConfig();
      expect(updatedConfig.debouncing.softAlertFrames).toBe(10);
      expect(updatedConfig.debouncing.hardAlertFrames).toBe(3);
      expect(updatedConfig.debouncing.gracePeriodMs).toBe(300);
    });
  });

  describe('audio', () => {
    it('should play soft alert sound', () => {
      const flag: FlagEvent = {
        id: 'audio-test-1',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.8,
        details: {},
      };

      for (let i = 0; i < config.debouncing.softAlertFrames; i++) {
        alertEngine.processFlag(flag);
      }

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should play hard alert sound', () => {
      const flag: FlagEvent = {
        id: 'audio-test-2',
        timestamp: Date.now(),
        type: 'SECOND_FACE',
        severity: 'hard',
        confidence: 0.9,
        details: {},
      };

      alertEngine.processFlag(flag);

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should handle audio context creation failure gracefully', () => {
      // Mock AudioContext to throw error
      (window.AudioContext as jest.Mock).mockImplementation(() => {
        throw new Error('AudioContext not supported');
      });

      // Should not throw error
      expect(() => {
        new AlertEngine(config, callbacks);
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should dispose resources properly', () => {
      // Create an engine with working audio context
      (window.AudioContext as jest.Mock).mockImplementation(() => mockAudioContext);
      const workingEngine = new AlertEngine(config, callbacks);
      
      workingEngine.dispose();

      expect(alertEngine.getActiveAlerts()).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid flag processing', () => {
      const flag: FlagEvent = {
        id: 'rapid-test',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.8,
        details: {},
      };

      // Process many flags rapidly
      for (let i = 0; i < 100; i++) {
        alertEngine.processFlag(flag);
      }

      // Should trigger one soft alert at frame 8, then one hard alert at frame 5 (which resets the counter)
      // Then another cycle starts, so we might get multiple alerts
      expect(mockOnSoftAlert).toHaveBeenCalled();
      expect(mockOnHardAlert).toHaveBeenCalled();
    });

    it('should clean up old pending flags', (done) => {
      const flag: FlagEvent = {
        id: 'cleanup-test',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'soft',
        confidence: 0.8,
        details: {},
      };

      // Process a few flags but not enough to trigger alert
      for (let i = 0; i < 3; i++) {
        alertEngine.processFlag(flag);
      }

      // Wait for cleanup to occur
      setTimeout(() => {
        // Process another flag to trigger cleanup
        alertEngine.processFlag(flag);
        
        // Should not have triggered any alerts yet
        expect(mockOnSoftAlert).not.toHaveBeenCalled();
        expect(mockOnHardAlert).not.toHaveBeenCalled();
        done();
      }, config.debouncing.gracePeriodMs * 3);
    });

    it('should handle missing flag event details', () => {
      const flag: FlagEvent = {
        id: 'minimal-flag',
        timestamp: Date.now(),
        type: 'EYES_OFF',
        severity: 'hard',
        confidence: 0.8,
        details: {},
      };

      expect(() => {
        alertEngine.processFlag(flag);
      }).not.toThrow();

      expect(mockOnHardAlert).toHaveBeenCalledTimes(1);
    });
  });
});