import { CameraPermissionManager } from '../CameraPermissionManager';

// Mock getUserMedia
const mockGetUserMedia = jest.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

describe('CameraPermissionManager', () => {
  let manager: CameraPermissionManager;

  beforeEach(() => {
    manager = new CameraPermissionManager();
    jest.clearAllMocks();
  });

  describe('requestPermission', () => {
    it('should request camera permission successfully', async () => {
      const mockStream = {
        getTracks: jest.fn().mockReturnValue([
          { stop: jest.fn() }
        ])
      };
      mockGetUserMedia.mockResolvedValue(mockStream);

      const result = await manager.requestPermission();

      expect(result.granted).toBe(true);
      expect(result.error).toBeNull();
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      });
    });

    it('should handle permission denied error', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValue(error);

      const result = await manager.requestPermission();

      expect(result.granted).toBe(false);
      expect(result.error).toBe('Permission denied by user');
    });

    it('should handle device not found error', async () => {
      const error = new Error('Device not found');
      error.name = 'NotFoundError';
      mockGetUserMedia.mockRejectedValue(error);

      const result = await manager.requestPermission();

      expect(result.granted).toBe(false);
      expect(result.error).toBe('No camera device found');
    });

    it('should handle device busy error', async () => {
      const error = new Error('Device busy');
      error.name = 'NotReadableError';
      mockGetUserMedia.mockRejectedValue(error);

      const result = await manager.requestPermission();

      expect(result.granted).toBe(false);
      expect(result.error).toBe('Camera is being used by another application');
    });

    it('should handle overconstrained error', async () => {
      const error = new Error('Overconstrained');
      error.name = 'OverconstrainedError';
      mockGetUserMedia.mockRejectedValue(error);

      const result = await manager.requestPermission();

      expect(result.granted).toBe(false);
      expect(result.error).toBe('Camera constraints cannot be satisfied');
    });

    it('should handle generic errors', async () => {
      const error = new Error('Generic error');
      mockGetUserMedia.mockRejectedValue(error);

      const result = await manager.requestPermission();

      expect(result.granted).toBe(false);
      expect(result.error).toBe('Failed to access camera: Generic error');
    });
  });

  describe('checkPermissionStatus', () => {
    it('should return granted status when permission is granted', async () => {
      // Mock permissions API
      Object.defineProperty(global.navigator, 'permissions', {
        value: {
          query: jest.fn().mockResolvedValue({ state: 'granted' })
        },
        writable: true,
      });

      const status = await manager.checkPermissionStatus();
      expect(status).toBe('granted');
    });

    it('should return denied status when permission is denied', async () => {
      Object.defineProperty(global.navigator, 'permissions', {
        value: {
          query: jest.fn().mockResolvedValue({ state: 'denied' })
        },
        writable: true,
      });

      const status = await manager.checkPermissionStatus();
      expect(status).toBe('denied');
    });

    it('should return prompt status when permission is not determined', async () => {
      Object.defineProperty(global.navigator, 'permissions', {
        value: {
          query: jest.fn().mockResolvedValue({ state: 'prompt' })
        },
        writable: true,
      });

      const status = await manager.checkPermissionStatus();
      expect(status).toBe('prompt');
    });

    it('should return unknown when permissions API is not available', async () => {
      Object.defineProperty(global.navigator, 'permissions', {
        value: undefined,
        writable: true,
      });

      const status = await manager.checkPermissionStatus();
      expect(status).toBe('unknown');
    });

    it('should handle permissions API errors', async () => {
      Object.defineProperty(global.navigator, 'permissions', {
        value: {
          query: jest.fn().mockRejectedValue(new Error('API error'))
        },
        writable: true,
      });

      const status = await manager.checkPermissionStatus();
      expect(status).toBe('unknown');
    });
  });

  describe('retry functionality', () => {
    it('should retry permission request with exponential backoff', async () => {
      const error = new Error('Temporary error');
      mockGetUserMedia
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue({
          getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
        });

      const result = await manager.requestPermission({ maxRetries: 3, retryDelay: 10 });

      expect(result.granted).toBe(true);
      expect(mockGetUserMedia).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const error = new Error('Persistent error');
      mockGetUserMedia.mockRejectedValue(error);

      const result = await manager.requestPermission({ maxRetries: 2, retryDelay: 10 });

      expect(result.granted).toBe(false);
      expect(mockGetUserMedia).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('permission state tracking', () => {
    it('should track permission state changes', () => {
      const callback = jest.fn();
      manager.onPermissionChange(callback);

      // Simulate permission change
      manager['notifyPermissionChange']('granted');

      expect(callback).toHaveBeenCalledWith('granted');
    });

    it('should remove permission change listeners', () => {
      const callback = jest.fn();
      const unsubscribe = manager.onPermissionChange(callback);

      unsubscribe();
      manager['notifyPermissionChange']('granted');

      expect(callback).not.toHaveBeenCalled();
    });
  });
});