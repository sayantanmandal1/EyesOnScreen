/**
 * API endpoints integration tests
 */

import { createMocks } from 'node-mocks-http';
import authApiKeyHandler from '../../../pages/api/auth/api-key';
import authRefreshHandler from '../../../pages/api/auth/refresh';
import syncUploadHandler from '../../../pages/api/sync/upload';

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.NODE_ENV = 'test';

describe('API Endpoints', () => {
  describe('/api/auth/api-key', () => {
    it('should authenticate with valid API key', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      });

      // Manually set the body since createMocks doesn't handle it properly
      req.body = {
        apiKey: 'test-api-key-12345',
      };

      await authApiKeyHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.token).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      expect(data.expiresIn).toBe(3600);
    });

    it('should reject invalid API key', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          apiKey: 'invalid-key',
        },
      });

      await authApiKeyHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Invalid API key');
      expect(data.code).toBe('INVALID_API_KEY');
    });

    it('should reject non-POST requests', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      });

      await authApiKeyHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Method not allowed');
    });

    it('should validate request body', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      });

      // Set empty body
      req.body = {};

      await authApiKeyHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Invalid request format');
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('/api/auth/refresh', () => {
    it('should refresh valid token', async () => {
      // First get a token
      const { req: authReq, res: authRes } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      });

      authReq.body = {
        apiKey: 'test-api-key-12345',
      };

      await authApiKeyHandler(authReq, authRes);
      const authData = JSON.parse(authRes._getData());

      // Then refresh it
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      });

      req.body = {
        refreshToken: authData.refreshToken,
      };

      await authRefreshHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.accessToken).toBeDefined();
      expect(data.expiresIn).toBe(3600);
    });

    it('should reject invalid refresh token', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      });

      req.body = {
        refreshToken: 'invalid-token',
      };

      await authRefreshHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Invalid refresh token');
    });
  });

  describe('/api/sync/upload', () => {
    let authToken: string;

    beforeEach(async () => {
      // Get auth token for upload tests
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      });

      req.body = {
        apiKey: 'test-api-key-12345',
      };

      await authApiKeyHandler(req, res);
      const data = JSON.parse(res._getData());
      authToken = data.token;
    });

    it('should upload valid batch data', async () => {
      const batchData = {
        batches: [
          {
            id: 'batch_test_1',
            sessionId: 'session_test_1',
            timestamp: Date.now(),
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
                riskScore: 10,
              },
            ],
            flags: [
              {
                id: 'flag_test_1',
                timestamp: Date.now(),
                type: 'EYES_OFF',
                severity: 'soft',
                confidence: 0.7,
                details: {},
              },
            ],
            metadata: {
              userAgent: 'test-agent',
              screenResolution: '1920x1080',
              timezone: 'UTC',
            },
          },
        ],
        timestamp: Date.now(),
      };

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json',
        },
      });

      req.body = batchData;

      await syncUploadHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.batchId).toBeDefined();
      expect(data.processedCount).toBe(1);
    });

    it('should reject unauthenticated requests', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      });

      req.body = {
        batches: [],
        timestamp: Date.now(),
      };

      await syncUploadHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication required');
    });

    it('should validate batch data structure', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json',
        },
      });

      req.body = {
        batches: [
          {
            // Invalid batch - missing required fields
            id: 'test',
          },
        ],
        timestamp: Date.now(),
      };

      await syncUploadHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });
});