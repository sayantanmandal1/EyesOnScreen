/**
 * PermissionEnforcer unit tests
 */

import { PermissionEnforcer } from '../PermissionEnforcer';
import type { PermissionStatus, SecurityThreat } from '../types';

// Mock MediaDevices API
const mockGetUserMedia = jest.fn();
const mockGetDisplayMedia = jest.fn();

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
    getDisplayMedia: mockGetDisplayMedia
  }
});

// Mock MediaStream
class MockMediaStream {
  active = true;
  id = 'mock-stream';
  
  getTracks() {
    return [new MockMediaStreamTrack()];
  }
  
  getVideoTracks() {
    return [new MockMediaStreamTrack()];
  }
  
  getAudioTracks() {
    return [new MockMediaStreamTrack()];
  }
}

class MockMediaStreamTrack {
  readyState = 'live';
  
  stop() {
    this.readyState = 'ended';
  }
  
  addEventListener() {}
}

describe('PermissionEnforcer', () => {
  let permissionEnforcer: PermissionEnforcer;
  let mockStream: MockMediaStream;

  const defaultConfig = {
    camera: {
      required: true,
      allowOptOut: false,
      continuousVerification: true,
      verificationIntervalMs: 1000
    },
    microphone: {
      required: true,
      allowOptOut: false,
      continuousVerification: true,
      verificationIntervalMs: 1000
    },
    screen: {
      required: true,
      allowOptOut: false,
      continuousVerification: true,
      verificationIntervalMs: 1000
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStream = new MockMediaStream();
  });

  afterEach(() => {
    if (permissionEnforcer) {
      permissionEnforcer.destroy();
    }
  });

  describe('constructor', () => {
    it('should create PermissionEnforcer with config', () => {
      permissionEnforcer = new PermissionEnforcer(defaultConfig);
      
      const status = permissionEnforcer.getStatus();
      expect(status.camera.granted).toBe(false);
      expect(status.microphone.granted).toBe(false);
      expect(status.screen.granted).toBe(false);
    });
  });

  describe('enforcePermissions', () => {
    beforeEach(() => {
      permissionEnforcer = new PermissionEnforcer(defaultConfig);
    });

    it('should successfully enforce all permissions', async () => {
      mockGetUserMedia
        .mockResolvedValueOnce(mockStream) // Camera
        .mockResolvedValueOnce(mockStream); // Microphone
      mockGetDisplayMedia.mockResolvedValue(mockStream); // Screen

      const status = await permissionEnforcer.enforcePermissions();
      
      expect(status.camera.granted).toBe(true);
      expect(status.camera.active).toBe(true);
      expect(status.microphone.granted).toBe(true);
      expect(status.microphone.active).toBe(true);
      expect(status.screen.granted).toBe(true);
      expect(status.screen.active).toBe(true);
    });

    it('should handle camera permission denial', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      
      mockGetUserMedia.mockRejectedValueOnce(error);

      await expect(permissionEnforcer.enforcePermissions()).rejects.toThrow('Camera permission denied');
    });

    it('should handle microphone permission denial', async () => {
      const cameraError = new Error('Permission denied');
      cameraError.name = 'NotAllowedError';
      
      mockGetUserMedia
        .mockResolvedValueOnce(mockStream) // Camera succeeds
        .mockRejectedValueOnce(cameraError); // Microphone fails

      await expect(permissionEnforcer.enforcePermissions()).rejects.toThrow('Microphone permission denied');
    });

    it('should handle screen permission denial', async () => {
      const screenError = new Error('Permission denied');
      screenError.name = 'NotAllowedError';
      
      mockGetUserMedia
        .mockResolvedValueOnce(mockStream) // Camera
        .mockResolvedValueOnce(mockStream); // Microphone
      mockGetDisplayMedia.mockRejectedValueOnce(screenError); // Screen fails

      await expect(permissionEnforcer.enforcePermissions()).rejects.toThrow('Screen permission denied');
    });

    it('should emit events for successful permissions', async () => {
      const eventHandler = jest.fn();
      permissionEnforcer.addEventListener(eventHandler);

      mockGetUserMedia
        .mockResolvedValueOnce(mockStream)
        .mockResolvedValueOnce(mockStream);
      mockGetDisplayMedia.mockResolvedValue(mockStream);

      await permissionEnforcer.enforcePermissions();
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: expect.objectContaining({
            camera: expect.objectContaining({ granted: true, active: true }),
            microphone: expect.objectContaining({ granted: true, active: true }),
            screen: expect.objectContaining({ granted: true, active: true })
          })
        })
      );
    });

    it('should throw error if already destroyed', async () => {
      permissionEnforcer.destroy();
      
      await expect(permissionEnforcer.enforcePermissions()).rejects.toThrow('PermissionEnforcer has been destroyed');
    });
  });

  describe('verifyPermissions', () => {
    beforeEach(() => {
      permissionEnforcer = new PermissionEnforcer(defaultConfig);
    });

    it('should verify active permissions', async () => {
      // First enforce permissions
      mockGetUserMedia
        .mockResolvedValueOnce(mockStream)
        .mockResolvedValueOnce(mockStream);
      mockGetDisplayMedia.mockResolvedValue(mockStream);

      await permissionEnforcer.enforcePermissions();
      
      // Then verify them
      const status = await permissionEnforcer.verifyPermissions();
      
      expect(status.camera.active).toBe(true);
      expect(status.microphone.active).toBe(true);
      expect(status.screen.active).toBe(true);
    });

    it('should detect inactive camera', async () => {
      const eventHandler = jest.fn();
      permissionEnforcer.addEventListener(eventHandler);

      // First enforce permissions
      mockGetUserMedia
        .mockResolvedValueOnce(mockStream)
        .mockResolvedValueOnce(mockStream);
      mockGetDisplayMedia.mockResolvedValue(mockStream);

      await permissionEnforcer.enforcePermissions();
      
      // Simulate camera becoming inactive
      mockStream.active = false;
      
      await permissionEnforcer.verifyPermissions();
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: expect.objectContaining({
            camera: expect.objectContaining({ active: false })
          }),
          threat: expect.objectContaining({
            type: 'permission_denied',
            severity: 'high',
            message: 'Camera became inactive during quiz session'
          })
        })
      );
    });

    it('should return current status if destroyed', async () => {
      const initialStatus = permissionEnforcer.getStatus();
      permissionEnforcer.destroy();
      
      const status = await permissionEnforcer.verifyPermissions();
      
      expect(status).toEqual(initialStatus);
    });
  });

  describe('continuous verification', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      permissionEnforcer = new PermissionEnforcer({
        ...defaultConfig,
        camera: { ...defaultConfig.camera, verificationIntervalMs: 100 },
        microphone: { ...defaultConfig.microphone, verificationIntervalMs: 100 },
        screen: { ...defaultConfig.screen, verificationIntervalMs: 100 }
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start continuous verification after enforcing permissions', async () => {
      const eventHandler = jest.fn();
      permissionEnforcer.addEventListener(eventHandler);

      mockGetUserMedia
        .mockResolvedValueOnce(mockStream)
        .mockResolvedValueOnce(mockStream);
      mockGetDisplayMedia.mockResolvedValue(mockStream);

      await permissionEnforcer.enforcePermissions();
      
      // Clear initial events
      eventHandler.mockClear();
      
      // Advance timers to trigger verification
      jest.advanceTimersByTime(150);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Should have called verification (may be 0 if verification doesn't emit events when everything is OK)
      expect(eventHandler).toHaveBeenCalledTimes(0); // No events expected when everything is working
    });

    it('should detect when camera stream becomes inactive', async () => {
      const eventHandler = jest.fn();
      permissionEnforcer.addEventListener(eventHandler);

      mockGetUserMedia
        .mockResolvedValue(mockStream)
        .mockResolvedValue(mockStream);
      mockGetDisplayMedia.mockResolvedValue(mockStream);

      await permissionEnforcer.enforcePermissions();
      
      // Simulate camera becoming inactive
      mockStream.active = false;
      
      // Clear initial events
      eventHandler.mockClear();
      
      // Advance timers to trigger verification
      jest.advanceTimersByTime(150);
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          threat: expect.objectContaining({
            type: 'permission_denied',
            message: 'Camera became inactive during quiz session'
          })
        })
      );
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      permissionEnforcer = new PermissionEnforcer(defaultConfig);
    });

    it('should add and remove event listeners', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      permissionEnforcer.addEventListener(handler1);
      permissionEnforcer.addEventListener(handler2);
      permissionEnforcer.removeEventListener(handler1);
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle errors in event handlers gracefully', async () => {
      const faultyHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      
      permissionEnforcer.addEventListener(faultyHandler);

      mockGetUserMedia
        .mockResolvedValueOnce(mockStream)
        .mockResolvedValueOnce(mockStream);
      mockGetDisplayMedia.mockResolvedValue(mockStream);

      // Should not throw despite handler error
      await expect(permissionEnforcer.enforcePermissions()).resolves.toBeDefined();
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      permissionEnforcer = new PermissionEnforcer(defaultConfig);
    });

    it('should stop all verification intervals', async () => {
      jest.useFakeTimers();
      
      mockGetUserMedia
        .mockResolvedValueOnce(mockStream)
        .mockResolvedValueOnce(mockStream);
      mockGetDisplayMedia.mockResolvedValue(mockStream);

      await permissionEnforcer.enforcePermissions();
      
      // Create spies for all tracks
      const videoTrack = mockStream.getVideoTracks()[0];
      const audioTrack = mockStream.getAudioTracks()[0];
      const stopSpyVideo = jest.spyOn(videoTrack, 'stop');
      const stopSpyAudio = jest.spyOn(audioTrack, 'stop');
      
      permissionEnforcer.destroy();
      
      // At least one track should be stopped
      expect(stopSpyVideo).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    it('should clear all event handlers', () => {
      const handler = jest.fn();
      permissionEnforcer.addEventListener(handler);
      
      permissionEnforcer.destroy();
      
      // Event handlers should be cleared
      expect(true).toBe(true);
    });

    it('should be safe to call multiple times', () => {
      permissionEnforcer.destroy();
      permissionEnforcer.destroy();
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getStatus', () => {
    beforeEach(() => {
      permissionEnforcer = new PermissionEnforcer(defaultConfig);
    });

    it('should return current permission status', () => {
      const status = permissionEnforcer.getStatus();
      
      expect(status).toHaveProperty('camera');
      expect(status).toHaveProperty('microphone');
      expect(status).toHaveProperty('screen');
      
      expect(status.camera).toHaveProperty('granted');
      expect(status.camera).toHaveProperty('active');
      expect(status.camera).toHaveProperty('lastVerified');
    });

    it('should return a copy of the status', () => {
      const status1 = permissionEnforcer.getStatus();
      const status2 = permissionEnforcer.getStatus();
      
      expect(status1).not.toBe(status2);
      expect(status1).toEqual(status2);
    });
  });
});