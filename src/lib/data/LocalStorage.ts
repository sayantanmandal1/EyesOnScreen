/**
 * LocalStorage class wrapping IndexedDB operations
 * Handles calibration profiles, session data, and log entries with compression and cleanup
 */

import { 
  LogEntry, 
  SessionData, 
  StorageConfig, 
  DatabaseSchema,
  NetworkError 
} from './types';
import { CalibrationProfile } from '../vision/types';
import { FlagEvent } from '../proctoring/types';

export class LocalStorage {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'EyesOnScreenQuizDB';
  private readonly dbVersion = 1;
  private readonly config: StorageConfig;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      maxLogEntries: 50000,
      maxSessionHistory: 100,
      compressionEnabled: true,
      encryptionEnabled: false,
      retentionDays: 30,
      ...config,
    };
  }

  /**
   * Initialize the IndexedDB database
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  /**
   * Create object stores for the database schema
   */
  private createObjectStores(db: IDBDatabase): void {
    // Sessions store
    if (!db.objectStoreNames.contains('sessions')) {
      const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
      sessionStore.createIndex('startTime', 'startTime', { unique: false });
      sessionStore.createIndex('endTime', 'endTime', { unique: false });
    }

    // Calibration profiles store
    if (!db.objectStoreNames.contains('calibrationProfiles')) {
      const profileStore = db.createObjectStore('calibrationProfiles', { keyPath: 'id' });
      profileStore.createIndex('timestamp', 'timestamp', { unique: false });
      profileStore.createIndex('quality', 'quality', { unique: false });
    }

    // Log entries store
    if (!db.objectStoreNames.contains('logEntries')) {
      const logStore = db.createObjectStore('logEntries', { keyPath: 'id', autoIncrement: true });
      logStore.createIndex('timestamp', 'timestamp', { unique: false });
      logStore.createIndex('sessionId', 'sessionId', { unique: false });
      logStore.createIndex('questionId', 'questionId', { unique: false });
    }

    // Flags store
    if (!db.objectStoreNames.contains('flags')) {
      const flagStore = db.createObjectStore('flags', { keyPath: 'id' });
      flagStore.createIndex('timestamp', 'timestamp', { unique: false });
      flagStore.createIndex('sessionId', 'sessionId', { unique: false });
      flagStore.createIndex('type', 'type', { unique: false });
    }

    // Settings store
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }
  }

  /**
   * Store calibration profile with compression if enabled
   */
  async storeCalibrationProfile(profile: CalibrationProfile): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const profileWithMetadata = {
      ...profile,
      id: profile.id || `profile_${Date.now()}`,
      timestamp: Date.now(),
      compressed: this.config.compressionEnabled,
    };

    if (this.config.compressionEnabled) {
      profileWithMetadata.gazeMapping = await this.compressData(profile.gazeMapping);
    }

    return this.performTransaction('calibrationProfiles', 'readwrite', (store) => {
      store.put(profileWithMetadata);
    });
  }

  /**
   * Retrieve calibration profile by ID
   */
  async getCalibrationProfile(id: string): Promise<CalibrationProfile | null> {
    if (!this.db) throw new Error('Database not initialized');

    const profile = await this.performTransaction('calibrationProfiles', 'readonly', (store) => {
      return store.get(id);
    });

    if (!profile) return null;

    if (profile.compressed && this.config.compressionEnabled) {
      profile.gazeMapping = await this.decompressData(profile.gazeMapping);
    }

    return profile;
  }

  /**
   * Get the most recent calibration profile
   */
  async getLatestCalibrationProfile(): Promise<CalibrationProfile | null> {
    if (!this.db) throw new Error('Database not initialized');

    return this.performTransaction('calibrationProfiles', 'readonly', (store) => {
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev');
      
      return new Promise((resolve) => {
        request.onsuccess = async () => {
          const cursor = request.result;
          if (cursor) {
            const profile = cursor.value;
            if (profile.compressed && this.config.compressionEnabled) {
              profile.gazeMapping = await this.decompressData(profile.gazeMapping);
            }
            resolve(profile);
          } else {
            resolve(null);
          }
        };
      });
    });
  }

  /**
   * Store session data with batched log entries
   */
  async storeSessionData(sessionData: SessionData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['sessions', 'logEntries', 'flags'], 'readwrite');
    
    try {
      // Store session metadata
      const sessionStore = transaction.objectStore('sessions');
      await this.promisifyRequest(sessionStore.put(sessionData));

      // Batch store log entries
      const logStore = transaction.objectStore('logEntries');
      const batchSize = 1000;
      
      for (let i = 0; i < sessionData.logEntries.length; i += batchSize) {
        const batch = sessionData.logEntries.slice(i, i + batchSize);
        const compressedBatch = this.config.compressionEnabled 
          ? await this.compressLogBatch(batch)
          : batch;

        for (const entry of compressedBatch) {
          const entryWithSession = {
            ...entry,
            sessionId: sessionData.sessionId,
            id: `${sessionData.sessionId}_${entry.timestamp}`,
          };
          await this.promisifyRequest(logStore.put(entryWithSession));
        }
      }

      // Store flags
      const flagStore = transaction.objectStore('flags');
      for (const flag of sessionData.flags) {
        const flagWithSession = {
          ...flag,
          sessionId: sessionData.sessionId,
        };
        await this.promisifyRequest(flagStore.put(flagWithSession));
      }

      await this.promisifyTransaction(transaction);
    } catch (error) {
      transaction.abort();
      throw error;
    }
  }

  /**
   * Retrieve session data by ID
   */
  async getSessionData(sessionId: string): Promise<SessionData | null> {
    if (!this.db) throw new Error('Database not initialized');

    const session = await this.performTransaction('sessions', 'readonly', (store) => {
      return store.get(sessionId);
    });

    if (!session) return null;

    // Load associated log entries
    const logEntries = await this.getLogEntriesBySession(sessionId);
    const flags = await this.getFlagsBySession(sessionId);

    return {
      ...session,
      logEntries,
      flags,
    };
  }

  /**
   * Get log entries for a specific session
   */
  private async getLogEntriesBySession(sessionId: string): Promise<LogEntry[]> {
    if (!this.db) throw new Error('Database not initialized');

    return this.performTransaction('logEntries', 'readonly', (store) => {
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);
      
      return new Promise((resolve) => {
        request.onsuccess = async () => {
          const entries = request.result;
          if (this.config.compressionEnabled) {
            const decompressed = await this.decompressLogBatch(entries);
            resolve(decompressed);
          } else {
            resolve(entries);
          }
        };
      });
    });
  }

  /**
   * Get flags for a specific session
   */
  private async getFlagsBySession(sessionId: string): Promise<FlagEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    return this.performTransaction('flags', 'readonly', (store) => {
      const index = store.index('sessionId');
      return index.getAll(sessionId);
    });
  }

  /**
   * Clean up old data based on retention policy
   */
  async cleanupOldData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    
    const transaction = this.db.transaction(['sessions', 'logEntries', 'flags', 'calibrationProfiles'], 'readwrite');

    try {
      // Clean up old sessions
      await this.cleanupStore(transaction.objectStore('sessions'), 'startTime', cutoffTime);
      
      // Clean up old log entries
      await this.cleanupStore(transaction.objectStore('logEntries'), 'timestamp', cutoffTime);
      
      // Clean up old flags
      await this.cleanupStore(transaction.objectStore('flags'), 'timestamp', cutoffTime);
      
      // Clean up old calibration profiles (keep at least one)
      await this.cleanupCalibrationProfiles(transaction.objectStore('calibrationProfiles'), cutoffTime);

      await this.promisifyTransaction(transaction);
    } catch (error) {
      transaction.abort();
      throw error;
    }
  }

  /**
   * Clean up a specific object store
   */
  private async cleanupStore(store: IDBObjectStore, indexName: string, cutoffTime: number): Promise<void> {
    const index = store.index(indexName);
    const range = IDBKeyRange.upperBound(cutoffTime);
    const request = index.openCursor(range);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clean up calibration profiles while keeping at least one
   */
  private async cleanupCalibrationProfiles(store: IDBObjectStore, cutoffTime: number): Promise<void> {
    const allProfiles = await this.promisifyRequest(store.getAll());
    
    if (allProfiles.length <= 1) return; // Keep at least one profile

    const oldProfiles = allProfiles
      .filter(profile => profile.timestamp < cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first

    // Keep the newest old profile, delete the rest
    for (let i = 1; i < oldProfiles.length; i++) {
      await this.promisifyRequest(store.delete(oldProfiles[i].id));
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    totalSessions: number;
    totalLogEntries: number;
    totalFlags: number;
    totalProfiles: number;
    estimatedSize: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const [sessions, logEntries, flags, profiles] = await Promise.all([
      this.performTransaction('sessions', 'readonly', store => store.count()),
      this.performTransaction('logEntries', 'readonly', store => store.count()),
      this.performTransaction('flags', 'readonly', store => store.count()),
      this.performTransaction('calibrationProfiles', 'readonly', store => store.count()),
    ]);

    // Rough estimation of storage size (in bytes)
    const estimatedSize = (sessions * 1000) + (logEntries * 200) + (flags * 500) + (profiles * 5000);

    return {
      totalSessions: sessions,
      totalLogEntries: logEntries,
      totalFlags: flags,
      totalProfiles: profiles,
      estimatedSize,
    };
  }

  /**
   * Clear all data (for privacy/reset purposes)
   */
  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const storeNames = ['sessions', 'logEntries', 'flags', 'calibrationProfiles', 'settings'];
    const transaction = this.db.transaction(storeNames, 'readwrite');

    try {
      for (const storeName of storeNames) {
        await this.promisifyRequest(transaction.objectStore(storeName).clear());
      }
      await this.promisifyTransaction(transaction);
    } catch (error) {
      transaction.abort();
      throw error;
    }
  }

  /**
   * Compress data using built-in compression
   */
  private async compressData(data: any): Promise<string> {
    if (!this.config.compressionEnabled) return data;
    
    try {
      const jsonString = JSON.stringify(data);
      const compressed = await this.gzipCompress(jsonString);
      return compressed;
    } catch (error) {
      console.warn('Compression failed, storing uncompressed:', error);
      return data;
    }
  }

  /**
   * Decompress data
   */
  private async decompressData(compressedData: string): Promise<any> {
    if (!this.config.compressionEnabled) return compressedData;
    
    try {
      const decompressed = await this.gzipDecompress(compressedData);
      return JSON.parse(decompressed);
    } catch (error) {
      console.warn('Decompression failed, returning as-is:', error);
      return compressedData;
    }
  }

  /**
   * Compress log entry batch
   */
  private async compressLogBatch(entries: LogEntry[]): Promise<LogEntry[]> {
    if (!this.config.compressionEnabled) return entries;
    
    // For log entries, we can compress the entire batch as JSON
    // and store it as a single compressed entry, then expand on retrieval
    return entries; // Simplified for now - could implement batch compression
  }

  /**
   * Decompress log entry batch
   */
  private async decompressLogBatch(entries: LogEntry[]): Promise<LogEntry[]> {
    if (!this.config.compressionEnabled) return entries;
    return entries; // Simplified for now
  }

  /**
   * Simple gzip compression using CompressionStream API
   */
  private async gzipCompress(data: string): Promise<string> {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(new TextEncoder().encode(data));
    writer.close();
    
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }
    
    const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      compressed.set(chunk, offset);
      offset += chunk.length;
    }
    
    return btoa(String.fromCharCode(...compressed));
  }

  /**
   * Simple gzip decompression using DecompressionStream API
   */
  private async gzipDecompress(compressedData: string): Promise<string> {
    const compressed = Uint8Array.from(atob(compressedData), c => c.charCodeAt(0));
    
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(compressed);
    writer.close();
    
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }
    
    const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      decompressed.set(chunk, offset);
      offset += chunk.length;
    }
    
    return new TextDecoder().decode(decompressed);
  }

  /**
   * Helper to perform a transaction and return a promise
   */
  private async performTransaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => T | Promise<T>
  ): Promise<T> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction([storeName], mode);
    const store = transaction.objectStore(storeName);
    
    try {
      const result = await operation(store);
      await this.promisifyTransaction(transaction);
      return result;
    } catch (error) {
      transaction.abort();
      throw error;
    }
  }

  /**
   * Convert IDBRequest to Promise
   */
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Convert IDBTransaction to Promise
   */
  private promisifyTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}