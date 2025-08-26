/**
 * Tests for LocalStorage class
 */

import { LocalStorage } from '../LocalStorage';
import { LogEntry, SessionData } from '../types';
import { CalibrationProfile } from '../../vision/types';
import { FlagEvent } from '../../proctoring/types';

// Mock IndexedDB
const mockIDBDatabase = {
  transaction: jest.fn(),
  createObjectStore: jest.fn(),
  objectStoreNames: { contains: jest.fn() },
  close: jest.fn(),
};

const mockIDBTransaction = {
  objectStore: jest.fn(),
  oncomplete: null,
  onerror: null,
  onabort: null,
  abort: jest.fn(),
};

const mockIDBObjectStore = {
  put: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  count: jest.fn(),
  createIndex: jest.fn(),
  index: jest.fn(),
  openCursor: jest.fn(),
};

const mockIDBRequest = {
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
};

const mockIDBIndex = {
  getAll: jest.fn(),
  openCursor: jest.fn(),
};

// Mock global IndexedDB
Object.defineProperty(global, 'indexedDB', {
  value: {
    open: jest.fn(),
  },
  writable: true,
});

// Mock CompressionStream and DecompressionStream
Object.defineProperty(global, 'CompressionStream', {
  value: class MockCompressionStream {
    readable = {
      getReader: () => ({
        read: async () => ({ value: new Uint8Array([1, 2, 3]), done: true }),
      }),
    };
    writable = {
      getWriter: () => ({
        write: jest.fn(),
        close: jest.fn(),
      }),
    };
  },
  writable: true,
});

Object.defineProperty(global, 'DecompressionStream', {
  value: class MockDecompressionStream {
    readable = {
      getReader: () => ({
        read: async () => ({ value: new Uint8Array([1, 2, 3]), done: true }),
      }),
    };
    writable = {
      getWriter: () => ({
        write: jest.fn(),
        close: jest.fn(),
      }),
    };
  },
  writable: true,
});

describe('LocalStorage', () => {
  let localStorage: LocalStorage;

  beforeEach(() => {
    localStorage = new LocalStorage({
      maxLogEntries: 1000,
      maxSessionHistory: 10,
      compressionEnabled: false, // Disable for simpler testing
      encryptionEnabled: false,
      retentionDays: 7,
    });

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    (global.indexedDB.open as jest.Mock).mockReturnValue({
      result: mockIDBDatabase,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    });

    mockIDBDatabase.transaction.mockReturnValue(mockIDBTransaction);
    mockIDBTransaction.objectStore.mockReturnValue(mockIDBObjectStore);
    mockIDBObjectStore.index.mockReturnValue(mockIDBIndex);
  });

  describe('initialization', () => {
    it('should initialize database successfully', async () => {
      const openRequest = {
        result: mockIDBDatabase,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };

      (global.indexedDB.open as jest.Mock).mockReturnValue(openRequest);

      const initPromise = localStorage.initialize();
      
      // Simulate successful open
      setTimeout(() => {
        if (openRequest.onsuccess) {
          openRequest.onsuccess();
        }
      }, 0);

      await expect(initPromise).resolves.toBeUndefined();
    });

    it('should handle database open errors', async () => {
      const openRequest = {
        result: null,
        error: new Error('Database error'),
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };

      (global.indexedDB.open as jest.Mock).mockReturnValue(openRequest);

      const initPromise = localStorage.initialize();
      
      // Simulate error
      setTimeout(() => {
        if (openRequest.onerror) {
          openRequest.onerror();
        }
      }, 0);

      await expect(initPromise).rejects.toThrow('Failed to open database');
    });
  });

  describe('calibration profile storage', () => {
    const mockProfile: CalibrationProfile = {
      id: 'test-profile',
      ipd: 65,
      earBaseline: 0.3,
      gazeMapping: {
        homography: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        bias: [0, 0],
      },
      headPoseBounds: {
        yawRange: [-20, 20],
        pitchRange: [-15, 15],
      },
      lightingBaseline: {
        histogram: [1, 2, 3],
        mean: 128,
        variance: 10,
      },
      quality: 0.9,
      timestamp: Date.now(),
    };

    beforeEach(() => {
      // Mock successful database initialization
      (localStorage as any).db = mockIDBDatabase;
    });

    it('should store calibration profile', async () => {
      const putRequest = { ...mockIDBRequest };
      mockIDBObjectStore.put.mockReturnValue(putRequest);

      const storePromise = localStorage.storeCalibrationProfile(mockProfile);
      
      // Simulate successful put
      setTimeout(() => {
        mockIDBTransaction.oncomplete?.();
      }, 0);

      await expect(storePromise).resolves.toBeUndefined();
      expect(mockIDBObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockProfile,
          timestamp: expect.any(Number),
          compressed: false,
        })
      );
    });

    it('should retrieve calibration profile by ID', async () => {
      const getRequest = { ...mockIDBRequest, result: mockProfile };
      mockIDBObjectStore.get.mockReturnValue(getRequest);

      const getPromise = localStorage.getCalibrationProfile('test-profile');
      
      // Simulate successful get
      setTimeout(() => {
        mockIDBTransaction.oncomplete?.();
      }, 0);

      const result = await getPromise;
      expect(result).toEqual(mockProfile);
      expect(mockIDBObjectStore.get).toHaveBeenCalledWith('test-profile');
    });

    it('should return null for non-existent profile', async () => {
      const getRequest = { ...mockIDBRequest, result: undefined };
      mockIDBObjectStore.get.mockReturnValue(getRequest);

      const getPromise = localStorage.getCalibrationProfile('non-existent');
      
      setTimeout(() => {
        mockIDBTransaction.oncomplete?.();
      }, 0);

      const result = await getPromise;
      expect(result).toBeNull();
    });
  });

  describe('session data storage', () => {
    const mockLogEntry: LogEntry = {
      timestamp: Date.now(),
      questionId: 'q1',
      eyesOn: true,
      gazeConfidence: 0.8,
      headPose: { yaw: 0, pitch: 0, roll: 0 },
      shadowScore: 0.1,
      secondaryFace: false,
      deviceLike: false,
      tabHidden: false,
      facePresent: true,
      flagType: null,
      riskScore: 0,
    };

    const mockFlag: FlagEvent = {
      id: 'flag1',
      timestamp: Date.now(),
      type: 'EYES_OFF',
      severity: 'soft',
      confidence: 0.7,
      details: {},
    };

    const mockSessionData: SessionData = {
      sessionId: 'session1',
      startTime: Date.now(),
      calibrationProfile: {
        id: 'profile1',
        ipd: 65,
        earBaseline: 0.3,
        gazeMapping: { homography: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], bias: [0, 0] },
        headPoseBounds: { yawRange: [-20, 20], pitchRange: [-15, 15] },
        lightingBaseline: { histogram: [1, 2, 3], mean: 128, variance: 10 },
        quality: 0.9,
        timestamp: Date.now(),
      },
      quizSession: {
        id: 'quiz1',
        questions: [],
        answers: {},
        startTime: Date.now(),
        currentQuestionIndex: 0,
        flags: [],
        riskScore: 0,
        status: 'in-progress',
      },
      logEntries: [mockLogEntry],
      flags: [mockFlag],
      performanceMetrics: {
        averageFps: 30,
        averageLatency: 50,
        peakMemoryUsage: 100,
        droppedFrames: 0,
      },
    };

    beforeEach(() => {
      (localStorage as any).db = mockIDBDatabase;
    });

    it('should store session data with log entries and flags', async () => {
      const putRequest = { ...mockIDBRequest };
      mockIDBObjectStore.put.mockReturnValue(putRequest);

      const storePromise = localStorage.storeSessionData(mockSessionData);
      
      setTimeout(() => {
        mockIDBTransaction.oncomplete?.();
      }, 0);

      await expect(storePromise).resolves.toBeUndefined();
      
      // Verify session was stored
      expect(mockIDBObjectStore.put).toHaveBeenCalledWith(mockSessionData);
      
      // Verify log entries were stored with session ID
      expect(mockIDBObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockLogEntry,
          sessionId: 'session1',
          id: expect.stringContaining('session1_'),
        })
      );
      
      // Verify flags were stored with session ID
      expect(mockIDBObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockFlag,
          sessionId: 'session1',
        })
      );
    });
  });

  describe('data cleanup', () => {
    beforeEach(() => {
      (localStorage as any).db = mockIDBDatabase;
    });

    it('should clean up old data based on retention policy', async () => {
      const cursorRequest = {
        result: {
          value: { id: 'old-item', timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000 },
          delete: jest.fn(),
          continue: jest.fn(),
        },
        onsuccess: null,
        onerror: null,
      };

      mockIDBIndex.openCursor.mockReturnValue(cursorRequest);

      const cleanupPromise = localStorage.cleanupOldData();
      
      // Simulate cursor iteration
      setTimeout(() => {
        if (cursorRequest.onsuccess) {
          cursorRequest.onsuccess();
          // Simulate end of cursor
          cursorRequest.result = null;
          cursorRequest.onsuccess();
        }
        mockIDBTransaction.oncomplete?.();
      }, 0);

      await expect(cleanupPromise).resolves.toBeUndefined();
    });
  });

  describe('storage statistics', () => {
    beforeEach(() => {
      (localStorage as any).db = mockIDBDatabase;
    });

    it('should return storage statistics', async () => {
      const countRequest = { ...mockIDBRequest, result: 10 };
      mockIDBObjectStore.count.mockReturnValue(countRequest);

      const statsPromise = localStorage.getStorageStats();
      
      setTimeout(() => {
        mockIDBTransaction.oncomplete?.();
      }, 0);

      const stats = await statsPromise;
      
      expect(stats).toEqual({
        totalSessions: 10,
        totalLogEntries: 10,
        totalFlags: 10,
        totalProfiles: 10,
        estimatedSize: expect.any(Number),
      });
    });
  });

  describe('data clearing', () => {
    beforeEach(() => {
      (localStorage as any).db = mockIDBDatabase;
    });

    it('should clear all data', async () => {
      const clearRequest = { ...mockIDBRequest };
      mockIDBObjectStore.clear.mockReturnValue(clearRequest);

      const clearPromise = localStorage.clearAllData();
      
      setTimeout(() => {
        mockIDBTransaction.oncomplete?.();
      }, 0);

      await expect(clearPromise).resolves.toBeUndefined();
      expect(mockIDBObjectStore.clear).toHaveBeenCalledTimes(5); // 5 stores
    });
  });

  describe('error handling', () => {
    it('should throw error when database not initialized', async () => {
      const uninitializedStorage = new LocalStorage();
      
      await expect(uninitializedStorage.storeCalibrationProfile({} as CalibrationProfile))
        .rejects.toThrow('Database not initialized');
    });

    it('should handle transaction errors', async () => {
      (localStorage as any).db = mockIDBDatabase;
      
      const putRequest = { ...mockIDBRequest, error: new Error('Put failed') };
      mockIDBObjectStore.put.mockReturnValue(putRequest);

      const storePromise = localStorage.storeCalibrationProfile({} as CalibrationProfile);
      
      setTimeout(() => {
        mockIDBTransaction.onerror?.();
      }, 0);

      await expect(storePromise).rejects.toBeDefined();
    });
  });

  afterEach(() => {
    localStorage.close();
  });
});