/**
 * Tests for DataCollector class
 */

import { DataCollector } from '../DataCollector';
import { LocalStorage } from '../LocalStorage';
import { VisionSignals } from '../../vision/types';
import { FlagEvent } from '../../proctoring/types';

// Mock LocalStorage
const mockLocalStorage = {
  initialize: jest.fn(),
  storeSessionData: jest.fn(),
  close: jest.fn(),
} as unknown as LocalStorage;

// Mock performance.now
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    },
  },
  writable: true,
});

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'test-agent',
  },
  writable: true,
});

// Mock screen
Object.defineProperty(global, 'screen', {
  value: {
    width: 1920,
    height: 1080,
  },
  writable: true,
});

// Mock window
if (!global.window) {
  Object.defineProperty(global, 'window', {
    value: {
      devicePixelRatio: 1,
    },
    writable: true,
  });
}

describe('DataCollector', () => {
  let dataCollector: DataCollector;
  let mockVisionSignals: VisionSignals;
  let mockFlag: FlagEvent;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    dataCollector = new DataCollector(mockLocalStorage, {
      batchSize: 10,
      flushInterval: 1000,
      maxBufferSize: 50,
      enablePerformanceMetrics: true,
      enableDetailedLogging: true,
    });

    mockVisionSignals = {
      timestamp: Date.now(),
      faceDetected: true,
      landmarks: new Float32Array([1, 2, 3]),
      headPose: {
        yaw: 5,
        pitch: -2,
        roll: 1,
        confidence: 0.9,
      },
      gazeVector: {
        x: 0.1,
        y: 0.2,
        z: 0.8,
        confidence: 0.85,
      },
      eyesOnScreen: true,
      environmentScore: {
        lighting: 0.8,
        shadowStability: 0.1,
        secondaryFaces: 0,
        deviceLikeObjects: 0,
      },
    };

    mockFlag = {
      id: 'flag-1',
      timestamp: Date.now(),
      type: 'EYES_OFF',
      severity: 'soft',
      confidence: 0.7,
      details: {},
    };
  });

  afterEach(() => {
    dataCollector.destroy();
    jest.useRealTimers();
  });

  describe('session management', () => {
    it('should start a new session', () => {
      const sessionId = 'test-session-1';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      dataCollector.startSession(sessionId);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Session Event [SESSION_START]:',
        expect.objectContaining({
          type: 'SESSION_START',
          sessionId,
          userAgent: 'test-agent',
          screenResolution: '1920x1080',
        })
      );

      consoleSpy.mockRestore();
    });

    it('should end a session and flush data', async () => {
      const sessionId = 'test-session-1';
      dataCollector.startSession(sessionId);
      
      // Add some data
      dataCollector.logFrame(mockVisionSignals, 25);
      dataCollector.logFlag(mockFlag);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await dataCollector.endSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Session Event [SESSION_END]:',
        expect.objectContaining({
          type: 'SESSION_END',
          sessionId,
          totalFrames: 1,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should set current question ID', () => {
      const sessionId = 'test-session-1';
      const questionId = 'question-1';
      
      dataCollector.startSession(sessionId);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      dataCollector.setCurrentQuestion(questionId);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Session Event [QUESTION_START]:',
        expect.objectContaining({
          type: 'QUESTION_START',
          questionId,
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('frame logging', () => {
    beforeEach(() => {
      dataCollector.startSession('test-session');
    });

    it('should log frame data correctly', () => {
      const processingLatency = 25;
      
      dataCollector.logFrame(mockVisionSignals, processingLatency);

      const bufferedData = dataCollector.getBufferedData();
      expect(bufferedData.entries).toHaveLength(1);

      const logEntry = bufferedData.entries[0];
      expect(logEntry).toMatchObject({
        timestamp: mockVisionSignals.timestamp,
        questionId: null,
        eyesOn: true,
        gazeConfidence: 0.85,
        headPose: {
          yaw: 5,
          pitch: -2,
          roll: 1,
        },
        shadowScore: 0.1,
        secondaryFace: false,
        deviceLike: false,
        facePresent: true,
        flagType: null,
        riskScore: 0,
      });
    });

    it('should track dropped frames for high latency', () => {
      const highLatency = 75; // Above 50ms threshold
      
      dataCollector.logFrame(mockVisionSignals, highLatency);

      const stats = dataCollector.getSessionStats();
      expect(stats.droppedFrames).toBe(1);
    });

    it('should not log frames without active session', () => {
      const newCollector = new DataCollector(mockLocalStorage);
      
      newCollector.logFrame(mockVisionSignals, 25);

      const bufferedData = newCollector.getBufferedData();
      expect(bufferedData.entries).toHaveLength(0);

      newCollector.destroy();
    });
  });

  describe('flag logging', () => {
    beforeEach(() => {
      dataCollector.startSession('test-session');
    });

    it('should log flag events with context', () => {
      const additionalContext = { customData: 'test' };
      
      dataCollector.logFlag(mockFlag, additionalContext);

      const bufferedData = dataCollector.getBufferedData();
      expect(bufferedData.flags).toHaveLength(1);

      const loggedFlag = bufferedData.flags[0];
      expect(loggedFlag.details).toMatchObject({
        sessionId: 'test-session',
        questionId: null,
        customData: 'test',
      });
    });

    it('should log critical flags immediately', () => {
      const criticalFlag: FlagEvent = {
        ...mockFlag,
        severity: 'hard',
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      dataCollector.logFlag(criticalFlag);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Session Event [CRITICAL_FLAG]:',
        expect.objectContaining({
          type: 'CRITICAL_FLAG',
          flagType: 'EYES_OFF',
          confidence: 0.7,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should update recent log entries with flag type', () => {
      // Log a frame first
      dataCollector.logFrame(mockVisionSignals, 25);
      
      // Then log a flag
      dataCollector.logFlag(mockFlag);

      const bufferedData = dataCollector.getBufferedData();
      const lastEntry = bufferedData.entries[bufferedData.entries.length - 1];
      
      expect(lastEntry.flagType).toBe('EYES_OFF');
    });
  });

  describe('browser event logging', () => {
    beforeEach(() => {
      dataCollector.startSession('test-session');
    });

    it('should log browser events', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      dataCollector.logBrowserEvent('visibilitychange', { hidden: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Session Event [BROWSER_EVENT]:',
        expect.objectContaining({
          type: 'BROWSER_EVENT',
          eventType: 'visibilitychange',
          hidden: true,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should update recent entries for tab visibility changes', () => {
      // Log some frames first
      dataCollector.logFrame(mockVisionSignals, 25);
      dataCollector.logFrame(mockVisionSignals, 30);
      
      // Log visibility change
      dataCollector.logBrowserEvent('visibilitychange', { hidden: true });

      const bufferedData = dataCollector.getBufferedData();
      const recentEntries = bufferedData.entries.slice(-2);
      
      recentEntries.forEach(entry => {
        expect(entry.tabHidden).toBe(true);
      });
    });
  });

  describe('risk score updates', () => {
    beforeEach(() => {
      dataCollector.startSession('test-session');
    });

    it('should update risk score in recent entries', () => {
      // Log some frames
      for (let i = 0; i < 3; i++) {
        dataCollector.logFrame(mockVisionSignals, 25);
      }

      dataCollector.updateRiskScore(75);

      const bufferedData = dataCollector.getBufferedData();
      const recentEntries = bufferedData.entries.slice(-3);
      
      recentEntries.forEach(entry => {
        expect(entry.riskScore).toBe(75);
      });
    });
  });

  describe('performance metrics', () => {
    beforeEach(() => {
      dataCollector.startSession('test-session');
    });

    it('should log performance snapshots', () => {
      const performanceMetrics = {
        fps: 30,
        processingLatency: 25,
        memoryUsage: 100,
        cpuUsage: 45,
        droppedFrames: 0,
        timestamp: Date.now(),
      };

      dataCollector.logPerformanceSnapshot(performanceMetrics);

      const bufferedData = dataCollector.getBufferedData();
      expect(bufferedData.performanceSnapshots).toHaveLength(1);
      expect(bufferedData.performanceSnapshots[0]).toMatchObject(performanceMetrics);
    });

    it('should log performance warnings for low FPS', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const lowFpsMetrics = {
        fps: 10, // Below 15 FPS threshold
        processingLatency: 25,
        memoryUsage: 100,
        cpuUsage: 45,
        droppedFrames: 0,
        timestamp: Date.now(),
      };

      dataCollector.logPerformanceSnapshot(lowFpsMetrics);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Session Event [PERFORMANCE_WARNING]:',
        expect.objectContaining({
          type: 'LOW_FPS',
          fps: 10,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log performance warnings for high memory usage', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const highMemoryMetrics = {
        fps: 30,
        processingLatency: 25,
        memoryUsage: 600, // Above 500MB threshold
        cpuUsage: 45,
        droppedFrames: 0,
        timestamp: Date.now(),
      };

      dataCollector.logPerformanceSnapshot(highMemoryMetrics);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Session Event [PERFORMANCE_WARNING]:',
        expect.objectContaining({
          type: 'HIGH_MEMORY',
          memoryUsage: 600,
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('session statistics', () => {
    beforeEach(() => {
      dataCollector.startSession('test-session');
    });

    it('should calculate session statistics correctly', () => {
      // Log some frames and flags
      dataCollector.logFrame(mockVisionSignals, 25);
      dataCollector.logFrame(mockVisionSignals, 30);
      dataCollector.logFlag(mockFlag);
      dataCollector.logFlag({ ...mockFlag, type: 'HEAD_POSE' });

      const stats = dataCollector.getSessionStats();

      expect(stats).toMatchObject({
        totalFrames: 2,
        totalFlags: 2,
        flagsByType: {
          'EYES_OFF': 1,
          'HEAD_POSE': 1,
        },
        droppedFrames: 0,
      });

      expect(stats.averageFps).toBeGreaterThan(0);
      expect(stats.averageLatency).toBe(27.5); // (25 + 30) / 2
      expect(stats.sessionDuration).toBeGreaterThan(0);
    });
  });

  describe('buffer management', () => {
    it('should flush data when buffer size limit is reached', async () => {
      const smallBufferCollector = new DataCollector(mockLocalStorage, {
        maxBufferSize: 2,
        flushInterval: 10000, // Long interval to test size-based flushing
      });

      smallBufferCollector.startSession('test-session');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const flushSpy = jest.spyOn(smallBufferCollector, 'flush').mockResolvedValue();

      // Add entries to exceed buffer size
      smallBufferCollector.logFrame(mockVisionSignals, 25);
      smallBufferCollector.logFrame(mockVisionSignals, 30);
      smallBufferCollector.logFrame(mockVisionSignals, 35); // This should trigger flush

      expect(consoleSpy).toHaveBeenCalledWith('Buffer size limit reached, forcing flush');
      
      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(flushSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      flushSpy.mockRestore();
      smallBufferCollector.destroy();
    });

    it('should auto-flush data at regular intervals', async () => {
      const flushSpy = jest.spyOn(dataCollector, 'flush').mockResolvedValue();

      dataCollector.startSession('test-session');
      dataCollector.logFrame(mockVisionSignals, 25);

      // Advance time to trigger auto-flush
      jest.advanceTimersByTime(1000);

      expect(flushSpy).toHaveBeenCalled();

      flushSpy.mockRestore();
    });
  });

  describe('data retrieval', () => {
    beforeEach(() => {
      dataCollector.startSession('test-session');
    });

    it('should return buffered data', () => {
      dataCollector.logFrame(mockVisionSignals, 25);
      dataCollector.logFlag(mockFlag);

      const bufferedData = dataCollector.getBufferedData();

      expect(bufferedData.entries).toHaveLength(1);
      expect(bufferedData.flags).toHaveLength(1);
      expect(bufferedData.performanceSnapshots).toHaveLength(0);
    });
  });
});