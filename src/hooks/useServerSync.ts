/**
 * useServerSync - Hook for managing server synchronization
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ServerSync, SyncStatus } from '../lib/data/ServerSync';
import { ServerSyncConfig, SessionData, LogEntry } from '../lib/data/types';
import { FlagEvent } from '../lib/proctoring/types';
import { useAppStore } from '../store/appStore';

interface UseServerSyncOptions {
  config: ServerSyncConfig;
  autoSync?: boolean;
  syncInterval?: number;
}

interface UseServerSyncReturn {
  serverSync: ServerSync;
  syncStatus: SyncStatus;
  isInitialized: boolean;
  queueSessionData: (sessionData: SessionData) => Promise<void>;
  queueLogEntries: (sessionId: string, logEntries: LogEntry[], flags?: FlagEvent[]) => Promise<void>;
  syncNow: () => Promise<void>;
  updateConfig: (config: Partial<ServerSyncConfig>) => void;
  authenticate: (credentials: { apiKey?: string; authCode?: string }) => Promise<boolean>;
  disable: () => void;
  clearPendingData: () => void;
}

export const useServerSync = (options: UseServerSyncOptions): UseServerSyncReturn => {
  const { privacySettings } = useAppStore();
  const [serverSync] = useState(() => new ServerSync(options.config));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(serverSync.getSyncStatus());
  const [isInitialized, setIsInitialized] = useState(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize server sync based on privacy settings
  useEffect(() => {
    const initializeSync = async () => {
      try {
        await serverSync.initialize(privacySettings.serverSyncEnabled);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize server sync:', error);
        setIsInitialized(false);
      }
    };

    initializeSync();
  }, [serverSync, privacySettings.serverSyncEnabled]);

  // Set up automatic sync interval
  useEffect(() => {
    if (options.autoSync && privacySettings.serverSyncEnabled && isInitialized) {
      const interval = options.syncInterval || options.config.syncInterval || 30000; // 30 seconds default
      
      syncIntervalRef.current = setInterval(async () => {
        try {
          await serverSync.syncPendingBatches();
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      }, interval);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [serverSync, options.autoSync, options.syncInterval, options.config.syncInterval, privacySettings.serverSyncEnabled, isInitialized]);

  // Set up status update interval
  useEffect(() => {
    statusUpdateIntervalRef.current = setInterval(() => {
      setSyncStatus(serverSync.getSyncStatus());
    }, 1000);

    return () => {
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
        statusUpdateIntervalRef.current = null;
      }
    };
  }, [serverSync]);

  // Queue session data for upload
  const queueSessionData = useCallback(async (sessionData: SessionData) => {
    if (!privacySettings.serverSyncEnabled || !isInitialized) {
      return;
    }

    try {
      await serverSync.queueSessionData(sessionData);
      setSyncStatus(serverSync.getSyncStatus());
    } catch (error) {
      console.error('Failed to queue session data:', error);
    }
  }, [serverSync, privacySettings.serverSyncEnabled, isInitialized]);

  // Queue log entries for upload
  const queueLogEntries = useCallback(async (
    sessionId: string, 
    logEntries: LogEntry[], 
    flags: FlagEvent[] = []
  ) => {
    if (!privacySettings.serverSyncEnabled || !isInitialized) {
      return;
    }

    try {
      await serverSync.queueLogEntries(sessionId, logEntries, flags);
      setSyncStatus(serverSync.getSyncStatus());
    } catch (error) {
      console.error('Failed to queue log entries:', error);
    }
  }, [serverSync, privacySettings.serverSyncEnabled, isInitialized]);

  // Manually trigger sync
  const syncNow = useCallback(async () => {
    if (!privacySettings.serverSyncEnabled || !isInitialized) {
      return;
    }

    try {
      await serverSync.syncPendingBatches();
      setSyncStatus(serverSync.getSyncStatus());
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  }, [serverSync, privacySettings.serverSyncEnabled, isInitialized]);

  // Update server sync configuration
  const updateConfig = useCallback((config: Partial<ServerSyncConfig>) => {
    serverSync.updateConfig(config);
    setSyncStatus(serverSync.getSyncStatus());
  }, [serverSync]);

  // Authenticate with server
  const authenticate = useCallback(async (credentials: { apiKey?: string; authCode?: string }) => {
    try {
      let success = false;
      
      if (credentials.apiKey) {
        success = await serverSync.authenticateWithApiKey(credentials.apiKey);
      } else if (credentials.authCode) {
        success = await serverSync.authenticateWithOAuth(credentials.authCode);
      }

      setSyncStatus(serverSync.getSyncStatus());
      return success;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }, [serverSync]);

  // Disable server sync
  const disable = useCallback(() => {
    serverSync.disable();
    setIsInitialized(false);
    setSyncStatus(serverSync.getSyncStatus());
    
    // Clear intervals
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, [serverSync]);

  // Clear pending data
  const clearPendingData = useCallback(() => {
    serverSync.clearPendingData();
    setSyncStatus(serverSync.getSyncStatus());
  }, [serverSync]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
      }
      serverSync.cancelSync();
    };
  }, [serverSync]);

  return {
    serverSync,
    syncStatus,
    isInitialized,
    queueSessionData,
    queueLogEntries,
    syncNow,
    updateConfig,
    authenticate,
    disable,
    clearPendingData,
  };
};

export default useServerSync;