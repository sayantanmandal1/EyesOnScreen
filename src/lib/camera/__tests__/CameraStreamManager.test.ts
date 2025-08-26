import { CameraStreamManager } from '../CameraStreamManager';

// Mock MediaStream and related APIs
const mockTrack = {
  stop: jest.fn(),
  enabled: true,
  readyState: 'live',
  kind: 'video',
  label: 'Mock Camera',
  getSettings: jest.fn().mockReturnValue({
    width: 640,
    height: 480,
    frameRate: 30
  })
};

const mockStream = {
  getTracks: jest.fn().mockReturnValue([mockTrack]),
  getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
  active: true,
  id: 'mock-stream-id'
};

const mockGetUserMedia = jest.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

describe('CameraStreamManager', () => {
  let manager: CameraStreamManager;

  beforeEach(() => {
    manager = new CameraStreamManager();
    jest.clearAllMocks();
    mockTrack.stop.mockClear();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const result = await manager.initialize();

      expect(result.success).toBe(true);
      expect(result.stream).toBe(mockStream);
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      });
    });

    it('should initialize with custom configuration', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const config = {
        width: 1280,
        height: 720,
        frameRate: 60
      };

      const result = await manager.initialize(config);

      expect(result.success).toBe(true);
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60 }
        }
      });
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Camera error');
      mockGetUserMedia.mockRejectedValue(error);

      const result = await manager.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Camera error');
    });

    it('should not reinitialize if already active', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      await manager.initialize();
      const result = await manager.initialize();

      expect(result.success).toBe(true);
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    });
  });

  describe('stream management', () => {
    beforeEach(async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);
      await manager.initialize();
    });

    it('should get current stream', () => {
      const stream = manager.getStream();
      expect(stream).toBe(mockStream);
    });

    it('should check if stream is active', () => {
      expect(manager.isActive()).toBe(true);
    });

    it('should stop stream', () => {
      manager.stop();

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(manager.isActive()).toBe(false);
      expect(manager.getStream()).toBeNull();
    });

    it('should restart stream', async () => {
      manager.stop();
      mockGetUserMedia.mockResolvedValue(mockStream);

      const result = await manager.restart();

      expect(result.success).toBe(true);
      expect(manager.isActive()).toBe(true);
    });

    it('should handle restart errors', async () => {
      manager.stop();
      const error = new Error('Restart error');
      mockGetUserMedia.mockRejectedValue(error);

      const result = await manager.restart();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Restart error');
    });
  });

  describe('stream quality management', () => {
    beforeEach(async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);
      await manager.initialize();
    });

    it('should get stream settings', () => {
      const settings = manager.getStreamSettings();

      expect(settings).toEqual({
        width: 640,
        height: 480,
        frameRate: 30
      });
    });

    it('should switch quality', async () => {
      const newStream = { ...mockStream };
      mockGetUserMedia.mockResolvedValue(newStream);

      const result = await manager.switchQuality({
        width: 1280,
        height: 720,
        frameRate: 60
      });

      expect(result.success).toBe(true);
      expect(mockTrack.stop).toHaveBeenCalled(); // Old stream stopped
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60 }
        }
      });
    });

    it('should handle quality switch errors', async () => {
      const error = new Error('Quality switch error');
      mockGetUserMedia.mockRejectedValue(error);

      const result = await manager.switchQuality({
        width: 1280,
        height: 720,
        frameRate: 60
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Quality switch error');
    });
  });

  describe('event handling', () => {
    it('should handle stream events', async () => {
      const onStreamStart = jest.fn();
      const onStreamEnd = jest.fn();
      const onError = jest.fn();

      manager.on('streamStart', onStreamStart);
      manager.on('streamEnd', onStreamEnd);
      manager.on('error', onError);

      mockGetUserMedia.mockResolvedValue(mockStream);
      await manager.initialize();

      expect(onStreamStart).toHaveBeenCalledWith(mockStream);

      manager.stop();
      expect(onStreamEnd).toHaveBeenCalled();
    });

    it('should handle stream errors', async () => {
      const onError = jest.fn();
      manager.on('error', onError);

      const error = new Error('Stream error');
      mockGetUserMedia.mkRejectedValue(error);

      await manager.initialize();
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should remove event listeners', async () => {
      const onStreamStart = jest.fn();
      const unsubscribe = manager.on('streamStart', onStreamStart);

      unsubscribe();

      mockGetUserMedia.mockResolvedValue(mockStream);
      await manager.initialize();

      expect(onStreamStart).not.toHaveBeenCalled();
    });
  });

  describe('stream health monitoring', () => {
    beforeEach(async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);
      await manager.initialize();
    });

    it('should monitor stream health', () => {
      const health = manager.getStreamHealth();

      expect(health).toEqual({
        active: true,
        trackCount: 1,
        videoTrackCount: 1,
        readyState: 'live'
      });
    });

    it('should detect inactive stream', () => {
      mockStream.active = false;
      mockTrack.readyState = 'ended';

      const health = manager.getStreamHealth();

      expect(health.active).toBe(false);
      expect(health.readyState).toBe('ended');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);
      await manager.initialize();

      manager.destroy();

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(manager.isActive()).toBe(false);
    });

    it('should handle cleanup when no stream exists', () => {
      expect(() => manager.destroy()).not.toThrow();
    });
  });
});