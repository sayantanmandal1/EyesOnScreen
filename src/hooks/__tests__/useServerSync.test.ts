import { renderHook, act } from '@testing-library/react';
import { useServerSync } from '../useServerSync';

// Mock ServerSync class
const mockServerSync = {
  uploadLogs: jest.fn(),
  authenticate: jest.fn(),
  getUploadStatus: jest.fn(),
  retryFailedUploads: jest.fn(),
  clearQueue: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

jest.mock('../../lib/data/ServerSync', () => ({
  ServerSync: jest.fn().mockImplementation(() => mockServerSync)
}));

// Mock app store
const mockStore = {
  privacySettings: {
    serverSyncEnabled: false
  },
  setServerSyncEnabled: jest.fn()
};

jest.mock('../../store/appStore', () => ({
  useAppStore: () => mockStore
}));

describe('useServerSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useServerSync());

      expect(result.current.isEnabled).toBe(false);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.uploadProgress).toBe(0);
      expect(result.current.lastUploadTime).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should respect store sync setting', () => {
      mockStore.privacySettings.serverSyncEnabled = true;
      
      const { result } = renderHook(() => useServerSync());

      expect(result.current.isEnabled).toBe(true);
    });
  });

  describe('sync control', () => {
    it('should enable sync', () => {
      const { result } = renderHook(() => useServerSync());

      act(() => {
        result.current.enableSync();
      });

      expect(mockStore.setServerSyncEnabled).toHaveBeenCalledWith(true);
      expect(result.current.isEnabled).toBe(true);
    });

    it('should disable sync', () => {
      mockStore.privacySettings.serverSyncEnabled = true;
      const { result } = renderHook(() => useServerSync());

      act(() => {
        result.current.disableSync();
      });

      expect(mockStore.setServerSyncEnabled).toHaveBeenCalledWith(false);
      expect(result.current.isEnabled).toBe(false);
    });

    it('should toggle sync', () => {
      const { result } = renderHook(() => useServerSync());

      act(() => {
        result.current.toggleSync();
      });

      expect(mockStore.setServerSyncEnabled).toHaveBeenCalledWith(true);

      act(() => {
        result.current.toggleSync();
      });

      expect(mockStore.setServerSyncEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('authentication', () => {
    it('should authenticate successfully', async () => {
      mockServerSync.authenticate.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useServerSync());

      await act(async () => {
        const authResult = await result.current.authenticate('test-token');
        expect(authResult.success).toBe(true);
      });

      expect(mockServerSync.authenticate).toHaveBeenCalledWith('test-token');
    });

    it('should handle authentication failure', async () => {
      const error = new Error('Auth failed');
      mockServerSync.authenticate.mockRejectedValue(error);
      const { result } = renderHook(() => useServerSync());

      await act(async () => {
        const authResult = await result.current.authenticate('invalid-token');
        expect(authResult.success).toBe(false);
        expect(authResult.error).toBe('Auth failed');
      });

      expect(result.current.error).toBe('Auth failed');
    });
  });

  describe('log upload', () => {
    it('should upload logs successfully', async () => {
      mockServerSync.uploadLogs.mockResolvedValue({ 
        success: true, 
        uploadedCount: 5 
      });
      
      const { result } = renderHook(() => useServerSync());
      const mockLogs = [
        { timestamp: Date.now(), type: 'info', message: 'Test log' }
      ];

      await act(async () => {
        const uploadResult = await result.current.uploadLogs(mockLogs);
        expect(uploadResult.success).toBe(true);
        expect(uploadResult.uploadedCount).toBe(5);
      });

      expect(mockServerSync.uploadLogs).toHaveBeenCalledWith(mockLogs);
      expect(result.current.lastUploadTime).toBeInstanceOf(Date);
    });

    it('should handle upload failure', async () => {
      const error = new Error('Upload failed');
      mockServerSync.uploadLogs.mockRejectedValue(error);
      
      const { result } = renderHook(() => useServerSync());
      const mockLogs = [{ timestamp: Date.now(), type: 'error', message: 'Test' }];

      await act(async () => {
        const uploadResult = await result.current.uploadLogs(mockLogs);
        expect(uploadResult.success).toBe(false);
        expect(uploadResult.error).toBe('Upload failed');
      });

      expect(result.current.error).toBe('Upload failed');
    });

    it('should not upload when sync is disabled', async () => {
      const { result } = renderHook(() => useServerSync());
      const mockLogs = [{ timestamp: Date.now(), type: 'info', message: 'Test' }];

      await act(async () => {
        const uploadResult = await result.current.uploadLogs(mockLogs);
        expect(uploadResult.success).toBe(false);
        expect(uploadResult.error).toBe('Server sync is disabled');
      });

      expect(mockServerSync.uploadLogs).not.toHaveBeenCalled();
    });

    it('should track upload progress', async () => {
      const { result } = renderHook(() => useServerSync());
      
      // Mock progress events
      let progressCallback: (progress: number) => void;
      mockServerSync.on.mockImplementation((event, callback) => {
        if (event === 'uploadProgress') {
          progressCallback = callback;
        }
      });

      mockServerSync.uploadLogs.mockImplementation(() => {
        // Simulate progress updates
        setTimeout(() => progressCallback(25), 10);
        setTimeout(() => progressCallback(50), 20);
        setTimeout(() => progressCallback(100), 30);
        
        return Promise.resolve({ success: true, uploadedCount: 3 });
      });

      mockStore.privacySettings.serverSyncEnabled = true;
      const mockLogs = [{ timestamp: Date.now(), type: 'info', message: 'Test' }];

      await act(async () => {
        await result.current.uploadLogs(mockLogs);
      });

      // Progress should be reset after completion
      expect(result.current.uploadProgress).toBe(0);
    });
  });

  describe('upload status', () => {
    it('should get upload status', () => {
      mockServerSync.getUploadStatus.mockReturnValue({
        pending: 5,
        failed: 2,
        completed: 10
      });

      const { result } = renderHook(() => useServerSync());
      const status = result.current.getUploadStatus();

      expect(status).toEqual({
        pending: 5,
        failed: 2,
        completed: 10
      });
    });

    it('should retry failed uploads', async () => {
      mockServerSync.retryFailedUploads.mockResolvedValue({
        success: true,
        retriedCount: 3
      });

      const { result } = renderHook(() => useServerSync());

      await act(async () => {
        const retryResult = await result.current.retryFailedUploads();
        expect(retryResult.success).toBe(true);
        expect(retryResult.retriedCount).toBe(3);
      });

      expect(mockServerSync.retryFailedUploads).toHaveBeenCalled();
    });

    it('should clear upload queue', () => {
      const { result } = renderHook(() => useServerSync());

      act(() => {
        result.current.clearQueue();
      });

      expect(mockServerSync.clearQueue).toHaveBeenCalled();
    });
  });

  describe('auto-sync', () => {
    it('should enable auto-sync', () => {
      const { result } = renderHook(() => useServerSync());

      act(() => {
        result.current.enableAutoSync(30000); // 30 seconds
      });

      expect(result.current.autoSyncEnabled).toBe(true);
      expect(result.current.autoSyncInterval).toBe(30000);
    });

    it('should disable auto-sync', () => {
      const { result } = renderHook(() => useServerSync());

      act(() => {
        result.current.enableAutoSync(30000);
        result.current.disableAutoSync();
      });

      expect(result.current.autoSyncEnabled).toBe(false);
    });

    it('should cleanup auto-sync on unmount', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const { result, unmount } = renderHook(() => useServerSync());

      act(() => {
        result.current.enableAutoSync(30000);
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => useServerSync());

      // Set an error
      act(() => {
        (result.current as any).setError('Test error');
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network unavailable');
      networkError.name = 'NetworkError';
      mockServerSync.uploadLogs.mockRejectedValue(networkError);

      const { result } = renderHook(() => useServerSync());
      mockStore.privacySettings.serverSyncEnabled = true;

      await act(async () => {
        const uploadResult = await result.current.uploadLogs([]);
        expect(uploadResult.success).toBe(false);
        expect(uploadResult.error).toBe('Network unavailable');
      });

      expect(result.current.error).toBe('Network unavailable');
    });
  });

  describe('event handling', () => {
    it('should handle server sync events', () => {
      const { result } = renderHook(() => useServerSync());

      // Verify event listeners are set up
      expect(mockServerSync.on).toHaveBeenCalledWith('uploadProgress', expect.any(Function));
      expect(mockServerSync.on).toHaveBeenCalledWith('uploadComplete', expect.any(Function));
      expect(mockServerSync.on).toHaveBeenCalledWith('uploadError', expect.any(Function));
    });

    it('should cleanup event listeners on unmount', () => {
      const { unmount } = renderHook(() => useServerSync());

      unmount();

      expect(mockServerSync.off).toHaveBeenCalledWith('uploadProgress', expect.any(Function));
      expect(mockServerSync.off).toHaveBeenCalledWith('uploadComplete', expect.any(Function));
      expect(mockServerSync.off).toHaveBeenCalledWith('uploadError', expect.any(Function));
    });
  });

  describe('connection status', () => {
    it('should track connection status', () => {
      const { result } = renderHook(() => useServerSync());

      expect(result.current.connectionStatus).toBe('disconnected');

      act(() => {
        (result.current as any).setConnectionStatus('connected');
      });

      expect(result.current.connectionStatus).toBe('connected');
    });

    it('should test connection', async () => {
      mockServerSync.authenticate.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useServerSync());

      await act(async () => {
        const isConnected = await result.current.testConnection();
        expect(isConnected).toBe(true);
      });

      expect(result.current.connectionStatus).toBe('connected');
    });

    it('should handle connection test failure', async () => {
      mockServerSync.authenticate.mockRejectedValue(new Error('Connection failed'));
      const { result } = renderHook(() => useServerSync());

      await act(async () => {
        const isConnected = await result.current.testConnection();
        expect(isConnected).toBe(false);
      });

      expect(result.current.connectionStatus).toBe('disconnected');
    });
  });
});