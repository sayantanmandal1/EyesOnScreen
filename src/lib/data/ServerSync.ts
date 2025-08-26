/**
 * ServerSync - Optional server synchronization for audit logs
 * Handles authentication, batch uploads, and user consent management
 */

import { LogEntry, SessionData, NetworkError, ServerSyncConfig } from './types';
import { FlagEvent } from '../proctoring/types';

export interface AuthCredentials {
  apiKey?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface SyncBatch {
  id: string;
  sessionId: string;
  timestamp: number;
  logEntries: LogEntry[];
  flags: FlagEvent[];
  metadata: {
    userAgent: string;
    screenResolution: string;
    timezone: string;
  };
}

export interface SyncResponse {
  success: boolean;
  batchId: string;
  processedCount: number;
  errors?: string[];
  nextSyncToken?: string;
}

export interface SyncStatus {
  isEnabled: boolean;
  isAuthenticated: boolean;
  lastSyncTime: number | null;
  pendingBatches: number;
  failedBatches: number;
  totalSynced: number;
}

export class ServerSync {
  private config: ServerSyncConfig;
  private credentials: AuthCredentials | null = null;
  private pendingBatches: Map<string, SyncBatch> = new Map();
  private retryQueue: Map<string, { batch: SyncBatch; attempts: number }> = new Map();
  private syncInProgress = false;
  private abortController: AbortController | null = null;

  constructor(config: ServerSyncConfig) {
    this.config = config;
    this.loadCredentials();
  }

  /**
   * Initialize server sync with user consent
   */
  async initialize(userConsent: boolean): Promise<void> {
    if (!userConsent) {
      this.config.enabled = false;
      this.clearCredentials();
      return;
    }

    this.config.enabled = true;
    
    if (this.config.apiKey) {
      await this.authenticateWithApiKey(this.config.apiKey);
    }
  }

  /**
   * Authenticate using API key
   */
  async authenticateWithApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await this.makeRequest('/auth/api-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      });

      if (response.ok) {
        const data = await response.json();
        this.credentials = {
          apiKey,
          token: data.token,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + (data.expiresIn * 1000),
        };
        this.saveCredentials();
        return true;
      }

      throw new Error(`Authentication failed: ${response.status}`);
    } catch (error) {
      console.error('API key authentication failed:', error);
      return false;
    }
  }

  /**
   * Authenticate using OAuth flow
   */
  async authenticateWithOAuth(authCode: string): Promise<boolean> {
    try {
      const response = await this.makeRequest('/auth/oauth', {
        method: 'POST',
        body: JSON.stringify({ code: authCode }),
      });

      if (response.ok) {
        const data = await response.json();
        this.credentials = {
          token: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + (data.expiresIn * 1000),
        };
        this.saveCredentials();
        return true;
      }

      throw new Error(`OAuth authentication failed: ${response.status}`);
    } catch (error) {
      console.error('OAuth authentication failed:', error);
      return false;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshAuthentication(): Promise<boolean> {
    if (!this.credentials?.refreshToken) {
      return false;
    }

    try {
      const response = await this.makeRequest('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.credentials.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.credentials = {
          ...this.credentials,
          token: data.accessToken,
          expiresAt: Date.now() + (data.expiresIn * 1000),
        };
        this.saveCredentials();
        return true;
      }

      // Refresh failed, clear credentials
      this.clearCredentials();
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearCredentials();
      return false;
    }
  }

  /**
   * Queue session data for batch upload
   */
  async queueSessionData(sessionData: SessionData): Promise<void> {
    if (!this.config.enabled || !this.isAuthenticated()) {
      return;
    }

    const batch: SyncBatch = {
      id: this.generateBatchId(),
      sessionId: sessionData.sessionId,
      timestamp: Date.now(),
      logEntries: sessionData.logEntries,
      flags: sessionData.flags,
      metadata: {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    this.pendingBatches.set(batch.id, batch);
    
    // Trigger sync if we have enough batches or it's been a while
    if (this.pendingBatches.size >= this.config.batchSize) {
      await this.syncPendingBatches();
    }
  }

  /**
   * Queue individual log entries for batch upload
   */
  async queueLogEntries(sessionId: string, logEntries: LogEntry[], flags: FlagEvent[] = []): Promise<void> {
    if (!this.config.enabled || !this.isAuthenticated()) {
      return;
    }

    const batch: SyncBatch = {
      id: this.generateBatchId(),
      sessionId,
      timestamp: Date.now(),
      logEntries,
      flags,
      metadata: {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    this.pendingBatches.set(batch.id, batch);
  }

  /**
   * Sync all pending batches to server
   */
  async syncPendingBatches(): Promise<SyncResponse[]> {
    if (!this.config.enabled || !this.isAuthenticated() || this.syncInProgress) {
      return [];
    }

    this.syncInProgress = true;
    this.abortController = new AbortController();
    const results: SyncResponse[] = [];

    try {
      // Process batches in chunks
      const batches = Array.from(this.pendingBatches.values());
      const chunks = this.chunkArray(batches, this.config.batchSize);

      for (const chunk of chunks) {
        try {
          const response = await this.uploadBatch(chunk);
          results.push(response);

          // Remove successfully uploaded batches
          if (response.success) {
            chunk.forEach(batch => {
              this.pendingBatches.delete(batch.id);
              this.retryQueue.delete(batch.id);
            });
          } else {
            // Queue failed batches for retry
            chunk.forEach(batch => {
              const existing = this.retryQueue.get(batch.id);
              const attempts = existing ? existing.attempts + 1 : 1;
              
              if (attempts <= this.config.retryAttempts) {
                this.retryQueue.set(batch.id, { batch, attempts });
              } else {
                // Max retries exceeded, remove from queue
                this.pendingBatches.delete(batch.id);
                this.retryQueue.delete(batch.id);
              }
            });
          }
        } catch (error) {
          console.error('Batch upload failed:', error);
          
          // Handle network errors with retry logic
          chunk.forEach(batch => {
            const existing = this.retryQueue.get(batch.id);
            const attempts = existing ? existing.attempts + 1 : 1;
            
            if (attempts <= this.config.retryAttempts) {
              this.retryQueue.set(batch.id, { batch, attempts });
            }
          });
        }
      }

      // Process retry queue
      await this.processRetryQueue();

    } finally {
      this.syncInProgress = false;
      this.abortController = null;
    }

    return results;
  }

  /**
   * Upload a batch of data to the server
   */
  private async uploadBatch(batches: SyncBatch[]): Promise<SyncResponse> {
    if (!this.isAuthenticated()) {
      throw this.createNetworkError('AUTH_ERROR', 'Not authenticated');
    }

    // Check if token needs refresh
    if (this.credentials && this.credentials.expiresAt && Date.now() >= this.credentials.expiresAt) {
      const refreshed = await this.refreshAuthentication();
      if (!refreshed) {
        throw this.createNetworkError('AUTH_ERROR', 'Token refresh failed');
      }
    }

    try {
      const response = await this.makeRequest('/sync/upload', {
        method: 'POST',
        body: JSON.stringify({
          batches,
          timestamp: Date.now(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          batchId: data.batchId,
          processedCount: data.processedCount,
          nextSyncToken: data.nextSyncToken,
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        batchId: '',
        processedCount: 0,
        errors: errorData.errors || [`HTTP ${response.status}: ${response.statusText}`],
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createNetworkError('TIMEOUT_ERROR', 'Request aborted');
      }
      
      throw this.createNetworkError('NETWORK_ERROR', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Process retry queue with exponential backoff
   */
  private async processRetryQueue(): Promise<void> {
    const retryEntries = Array.from(this.retryQueue.entries());
    
    for (const [batchId, { batch, attempts }] of retryEntries) {
      // Exponential backoff: 2^attempts seconds
      const backoffMs = Math.pow(2, attempts) * 1000;
      const lastAttempt = batch.timestamp;
      
      if (Date.now() - lastAttempt < backoffMs) {
        continue; // Not ready for retry yet
      }

      try {
        const response = await this.uploadBatch([batch]);
        
        if (response.success) {
          this.pendingBatches.delete(batchId);
          this.retryQueue.delete(batchId);
        } else {
          // Update attempt count
          this.retryQueue.set(batchId, { batch, attempts: attempts + 1 });
        }
      } catch (error) {
        console.error(`Retry attempt ${attempts} failed for batch ${batchId}:`, error);
        this.retryQueue.set(batchId, { batch, attempts: attempts + 1 });
      }
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      isEnabled: this.config.enabled,
      isAuthenticated: this.isAuthenticated(),
      lastSyncTime: this.getLastSyncTime(),
      pendingBatches: this.pendingBatches.size,
      failedBatches: this.retryQueue.size,
      totalSynced: this.getTotalSynced(),
    };
  }

  /**
   * Cancel all pending sync operations
   */
  cancelSync(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.syncInProgress = false;
  }

  /**
   * Clear all pending batches and retry queue
   */
  clearPendingData(): void {
    this.pendingBatches.clear();
    this.retryQueue.clear();
  }

  /**
   * Update server sync configuration
   */
  updateConfig(config: Partial<ServerSyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Disable server sync and clear all data
   */
  disable(): void {
    this.config.enabled = false;
    this.cancelSync();
    this.clearPendingData();
    this.clearCredentials();
  }

  // Private helper methods

  private isAuthenticated(): boolean {
    return !!(this.credentials?.token || this.credentials?.apiKey);
  }

  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.config.endpoint}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.credentials?.token) {
      headers.Authorization = `Bearer ${this.credentials.token}`;
    } else if (this.credentials?.apiKey) {
      headers['X-API-Key'] = this.credentials.apiKey;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: this.abortController?.signal,
    };

    return fetch(url, requestOptions);
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private createNetworkError(code: NetworkError['code'], message: string, status?: number): NetworkError {
    const error = new Error(message) as NetworkError;
    error.code = code;
    error.status = status;
    return error;
  }

  private saveCredentials(): void {
    if (this.credentials) {
      localStorage.setItem('serverSync_credentials', JSON.stringify(this.credentials));
    }
  }

  private loadCredentials(): void {
    try {
      const stored = localStorage.getItem('serverSync_credentials');
      if (stored) {
        this.credentials = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load stored credentials:', error);
      this.clearCredentials();
    }
  }

  private clearCredentials(): void {
    this.credentials = null;
    localStorage.removeItem('serverSync_credentials');
  }

  private getLastSyncTime(): number | null {
    const stored = localStorage.getItem('serverSync_lastSyncTime');
    return stored ? parseInt(stored, 10) : null;
  }

  private getTotalSynced(): number {
    const stored = localStorage.getItem('serverSync_totalSynced');
    return stored ? parseInt(stored, 10) : 0;
  }
}