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
   * Create object stores for the database
   */
  private createObjectStores(db: IDBDatabase): void {
    // Sessions store
    if (!db.objectStoreNames.contains('sessions')) {
      const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
      sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
      sessionStore.createIndex('userId', 'userId', { unique: false });
    }

    // Log entries store
    if (!db.objectStoreNames.contains('logEntries')) {
      const logStore = db.createObjectStore('logEntries', { keyPath: 'id' });
      logStore.createIndex('timestamp', 'timestamp', { unique: false });
      logStore.createIndex('sessionId', 'sessionId', { unique: false });
      logStore.createIndex('level', 'level', { unique: false });
    }

    // Flags store
    if (!db.objectStoreNames.contains('flags')) {
      const flagStore = db.createObjectStore('flags', { keyPath: 'id' });
      flagStore.createIndex('timestamp', 'timestamp', { unique: false });
      flagStore.createIndex('sessionId', 'sessionId', { unique: false });
      flagStore.createIndex('type', 'type', { unique: false });
    }

    // Calibration profiles store
    if (!db.objectStoreNames.contains('calibrationProfiles')) {
      const calibrationStore = db.createObjectStore('calibrationProfiles', { keyPath: 'id' });
      calibrationStore.createIndex('userId', 'userId', { unique: false });
      calibrationStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Settings store
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }
  }

  /**
   * Store session data
   */
  async storeSession(sessionData: SessionData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const compressedData = await this.compressData(sessionData);
    const transaction = this.db.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    
    await this.promisifyRequest(store.put({
      ...sessionData,
      data: compressedData,
      compressed: this.config.compressionEnabled,
    }));
  }

  /**
   * Retrieve session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const result = await this.promisifyRequest(store.get(sessionId));

    if (!result) return null;

    if (result.compressed) {
      result.data = await this.decompressData(result.data);
    }

    return result;
  }

  /**
   * Store log entry
   */
  async storeLogEntry(logEntry: LogEntry): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['logEntries'], 'readwrite');
    const store = transaction.objectStore('logEntries');
    
    await this.promisifyRequest(store.put(logEntry));
    await this.cleanupOldLogs();
  }

  /**
   * Retrieve log entries for a session
   */
  async getLogEntries(sessionId: string): Promise<LogEntry[]> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['logEntries'], 'readonly');
    const store = transaction.objectStore('logEntries');
    const index = store.index('sessionId');
    
    const results = await this.promisifyRequest(index.getAll(sessionId));
    return results || [];
  }

  /**
   * Store flag event
   */
  async storeFlag(flagEvent: FlagEvent): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['flags'], 'readwrite');
    const store = transaction.objectStore('flags');
    
    await this.promisifyRequest(store.put(flagEvent));
  }

  /**
   * Retrieve flags for a session
   */
  async getFlags(sessionId: string): Promise<FlagEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['flags'], 'readonly');
    const store = transaction.objectStore('flags');
    const index = store.index('sessionId');
    
    const results = await this.promisifyRequest(index.getAll(sessionId));
    return results || [];
  }

  /**
   * Store calibration profile
   */
  async storeCalibrationProfile(profile: CalibrationProfile): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['calibrationProfiles'], 'readwrite');
    const store = transaction.objectStore('calibrationProfiles');
    
    await this.promisifyRequest(store.put(profile));
  }

  /**
   * Retrieve calibration profile
   */
  async getCalibrationProfile(userId: string): Promise<CalibrationProfile | null> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['calibrationProfiles'], 'readonly');
    const store = transaction.objectStore('calibrationProfiles');
    const index = store.index('userId');
    
    const results = await this.promisifyRequest(index.getAll(userId));
    
    if (!results || results.length === 0) return null;
    
    // Return the most recent profile
    return results.sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  /**
   * Store setting
   */
  async storeSetting(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    
    await this.promisifyRequest(store.put({ key, value }));
  }

  /**
   * Retrieve setting
   */
  async getSetting(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const result = await this.promisifyRequest(store.get(key));
    
    return result?.value;
  }

  /**
   * Clean up old log entries
   */
  private async cleanupOldLogs(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['logEntries'], 'readwrite');
    const store = transaction.objectStore('logEntries');
    const index = store.index('timestamp');
    
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const range = IDBKeyRange.upperBound(cutoffTime);
    
    const cursor = await this.promisifyRequest(index.openCursor(range));
    const deletePromises: Promise<any>[] = [];
    
    if (cursor) {
      cursor.continue();
      deletePromises.push(this.promisifyRequest(cursor.delete()));
    }
    
    await Promise.all(deletePromises);
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{ used: number; available: number; estimatedSize: number }> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return { used: 0, available: 0, estimatedSize: 0 };
    }

    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const available = estimate.quota || 0;
    const estimatedSize = used;

    return {
      used,
      available,
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
  private async decompressData(data: string): Promise<any> {
    if (!this.config.compressionEnabled) return data;
    
    try {
      const decompressed = await this.gzipDecompress(data);
      return JSON.parse(decompressed);
    } catch (error) {
      console.warn('Decompression failed, returning as-is:', error);
      return data;
    }
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