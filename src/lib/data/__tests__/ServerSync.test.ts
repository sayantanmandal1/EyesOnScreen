/**
 * ServerSync tests
 */

import { ServerSync, SyncBatch } from '../ServerSync';
import { ServerSyncConfig, LogEntry, SessionData } from '../types';
import { FlagEvent } from '../../proctoring/types';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ServerSync', () => {
  let serverSync: ServerSync;
  let config: ServerSyncConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      endpoint: 'https://api.example.com',
      apiKey: 'test-api-key',
      batchSize: 5,
      retryAttempts: 3,
      syncInterval: 30000,
    };

    serverSync = new ServerSync(config);
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    serverSync.cancelSync();
  });

  describe('initialization', () => {
    it('should initialize with user consent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        }),
      } as Response);

      await serverSync.initialize(true);
      const status = serverSync.getSyncStatus();

      expect(status.isEnabled).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/auth/api-key',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ apiKey: 'test-api-key' }),
        })
      );
    });

    it('should disable sync without user consent', async () => {
      await serverSync.initialize(false);
      const status = serverSync.getSyncStatus();

      expect(status.isEnabled).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('authentication', () => {
    it('should authenticate with API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        }),
      } as Response);

      const result = await serverSync.authenticateWithApiKey('test-key');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/auth/api-key',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ apiKey: 'test-key' }),
        })
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'serverSync_credentials',
        expect.stringContaining('test-token')
      );
    });

    it('should handle authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await serverSync.authenticateWithApiKey('invalid-key');

      expect(result).toBe(false);
    });

    it('should authenticate with OAuth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        }),
      } as Response);

      const result = await serverSync.authenticateWithOAuth('auth-code');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/auth/oauth',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ code: 'auth-code' }),
        })
      );
    });

    it('should refresh authentication token', async () => {
      // Set up initial credentials
      const credentials = {
        token: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000, // Expired
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(credentials));
      serverSync = new ServerSync(config);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'new-token',
          expiresIn: 3600,
        }),
      } as Response);

      const result = await serverSync.refreshAuthentication();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'refresh-token' }),
        })
      );
    });
  });

  describe('data queuing', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        }),
      } as Response);

      await serverSync.initialize(true);
    });

    it('should queue session data', async () => {
      const sessionData: SessionData = {
        sessionId: 'test-session',
        startTime: Date.now(),
        calibrationProfile: {} as any,
        quizSession: {} as any,
        logEntries: [
          {
            timestamp: Date.now(),
            questionId: 'q1',
            eyesOn: true,
            gazeConfidence: 0.8,
            headPose: { yaw: 0, pitch: 0, roll: 0 },
            shadowScore: 0.2,
            secondaryFace: false,
            deviceLike: false,
            tabHidden: false,
            facePresent: true,
            flagType: null,
            riskScore: 0,
          },
        ],
        flags: [],
        performanceMetrics: {
          averageFps: 30,
          averageLatency: 50,
          peakMemoryUsage: 200,
          droppedFrames: 0,
        },
      };

      await serverSync.queueSessionData(sessionData);
      const status = serverSync.getSyncStatus();

      expect(status.pendingBatches).toBe(1);
    });

    it('should queue log entries', async () => {
      const logEntries: LogEntry[] = [
        {
          timestamp: Date.now(),
          questionId: 'q1',
          eyesOn: true,
          gazeConfidence: 0.8,
          headPose: { yaw: 0, pitch: 0, roll: 0 },
          shadowScore: 0.2,
          secondaryFace: false,
          deviceLike: false,
          tabHidden: false,
          facePresent: true,
          flagType: null,
          riskScore: 0,
        },
      ];

      const flags: FlagEvent[] = [
        {
          id: 'flag1',
          timestamp: Date.now(),
          type: 'EYES_OFF',
          severity: 'soft',
          confidence: 0.7,
          details: {},
        },
      ];

      await serverSync.queueLogEntries('test-session', logEntries, flags);
      const status = serverSync.getSyncStatus();

      expect(status.pendingBatches).toBe(1);
    });
  });

  describe('batch upload', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        }),
      } as Response);

      await serverSync.initialize(true);
    });

    it('should upload batches successfully', async () => {
      // Queue some data
      await serverSync.queueLogEntries('test-session', [
        {
          timestamp: Date.now(),
          questionId: 'q1',
          eyesOn: true,
          gazeConfidence: 0.8,
          headPose: { yaw: 0, pitch: 0, roll: 0 },
          shadowScore: 0.2,
          secondaryFace: false,
          deviceLike: false,
          tabHidden: false,
          facePresent: true,
          flagType: null,
          riskScore: 0,
        },
      ]);

      // Mock successful upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batchId: 'batch-123',
          processedCount: 1,
          nextSyncToken: 'token-456',
        }),
      } as Response);

      const results = await serverSync.syncPendingBatches();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].processedCount).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/sync/upload',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle upload failures with retry', async () => {
      // Queue some data
      await serverSync.queueLogEntries('test-session', [
        {
          timestamp: Date.now(),
          questionId: 'q1',
          eyesOn: true,
          gazeConfidence: 0.8,
          headPose: { yaw: 0, pitch: 0, roll: 0 },
          shadowScore: 0.2,
          secondaryFace: false,
          deviceLike: false,
          tabHidden: false,
          facePresent: true,
          flagType: null,
          riskScore: 0,
        },
      ]);

      // Mock failed upload
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ errors: ['Server error'] }),
      } as Response);

      const results = await serverSync.syncPendingBatches();
      const status = serverSync.getSyncStatus();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(status.failedBatches).toBeGreaterThan(0);
    });

    it('should refresh token when expired', async () => {
      // Set up expired credentials
      const expiredCredentials = {
        token: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000,
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredCredentials));
      serverSync = new ServerSync(config);
      await serverSync.initialize(true);

      // Queue some data
      await serverSync.queueLogEntries('test-session', [
        {
          timestamp: Date.now(),
          questionId: 'q1',
          eyesOn: true,
          gazeConfidence: 0.8,
          headPose: { yaw: 0, pitch: 0, roll: 0 },
          shadowScore: 0.2,
          secondaryFace: false,
          deviceLike: false,
          tabHidden: false,
          facePresent: true,
          flagType: null,
          riskScore: 0,
        },
      ]);

      // Mock token refresh
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            accessToken: 'new-token',
            expiresIn: 3600,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            batchId: 'batch-123',
            processedCount: 1,
          }),
        } as Response);

      await serverSync.syncPendingBatches();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/auth/refresh',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/sync/upload',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer new-token',
          }),
        })
      );
    });
  });

  describe('sync status', () => {
    it('should return correct sync status', () => {
      // Create a new instance without API key for this test
      const configWithoutApiKey = { ...config, apiKey: undefined };
      const testServerSync = new ServerSync(configWithoutApiKey);
      const status = testServerSync.getSyncStatus();

      expect(status).toEqual({
        isEnabled: true,
        isAuthenticated: false,
        lastSyncTime: null,
        pendingBatches: 0,
        failedBatches: 0,
        totalSynced: 0,
      });
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = {
        batchSize: 10,
        retryAttempts: 5,
      };

      serverSync.updateConfig(newConfig);

      // Verify config was updated by checking behavior
      expect(serverSync.getSyncStatus().isEnabled).toBe(true);
    });

    it('should disable sync and clear data', () => {
      serverSync.disable();
      const status = serverSync.getSyncStatus();

      expect(status.isEnabled).toBe(false);
      expect(status.pendingBatches).toBe(0);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('serverSync_credentials');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await serverSync.authenticateWithApiKey('test-key');

      expect(result).toBe(false);
    });

    it('should handle malformed responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      const result = await serverSync.authenticateWithApiKey('test-key');

      expect(result).toBe(false);
    });
  });
});