/**
 * Audit log storage implementation
 */

import { SyncBatch } from '../../data/ServerSync';

export interface StorageContext {
  userId: string;
  timestamp: number;
  ipAddress: string;
  userAgent: string;
}

export interface StorageResult {
  success: boolean;
  errors?: string[];
  nextSyncToken?: string;
  storedCount?: number;
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  sessionId: string;
  batchId: string;
  timestamp: number;
  logEntry?: any;
  flagEvent?: any;
  metadata: {
    ipAddress: string;
    userAgent: string;
    uploadTimestamp: number;
  };
}

// In-memory storage for development (in production, use a proper database)
const auditLogStorage = new Map<string, AuditLogRecord>();
let recordCounter = 0;

export async function storeAuditLogs(
  batches: SyncBatch[],
  context: StorageContext
): Promise<StorageResult> {
  const errors: string[] = [];
  let storedCount = 0;

  try {
    for (const batch of batches) {
      // Store log entries
      for (const logEntry of batch.logEntries) {
        try {
          const record: AuditLogRecord = {
            id: generateRecordId(),
            userId: context.userId,
            sessionId: batch.sessionId,
            batchId: batch.id,
            timestamp: logEntry.timestamp,
            logEntry: {
              ...logEntry,
              batchMetadata: batch.metadata,
            },
            metadata: {
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
              uploadTimestamp: context.timestamp,
            },
          };

          auditLogStorage.set(record.id, record);
          storedCount++;
        } catch (error) {
          errors.push(`Failed to store log entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Store flag events
      for (const flagEvent of batch.flags) {
        try {
          const record: AuditLogRecord = {
            id: generateRecordId(),
            userId: context.userId,
            sessionId: batch.sessionId,
            batchId: batch.id,
            timestamp: flagEvent.timestamp,
            flagEvent: {
              ...flagEvent,
              batchMetadata: batch.metadata,
            },
            metadata: {
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
              uploadTimestamp: context.timestamp,
            },
          };

          auditLogStorage.set(record.id, record);
          storedCount++;
        } catch (error) {
          errors.push(`Failed to store flag event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Generate next sync token for pagination
    const nextSyncToken = generateSyncToken(context.timestamp);

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      nextSyncToken,
      storedCount,
    };

  } catch (error) {
    console.error('Storage error:', error);
    return {
      success: false,
      errors: [`Storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

export async function getAuditLogs(options: {
  userId?: string;
  sessionId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
  syncToken?: string;
}): Promise<{
  records: AuditLogRecord[];
  total: number;
  hasMore: boolean;
  nextSyncToken?: string;
}> {
  const {
    userId,
    sessionId,
    startTime,
    endTime,
    limit = 100,
    offset = 0,
    syncToken,
  } = options;

  // Filter records
  let filteredRecords = Array.from(auditLogStorage.values());

  if (userId) {
    filteredRecords = filteredRecords.filter(record => record.userId === userId);
  }

  if (sessionId) {
    filteredRecords = filteredRecords.filter(record => record.sessionId === sessionId);
  }

  if (startTime) {
    filteredRecords = filteredRecords.filter(record => record.timestamp >= startTime);
  }

  if (endTime) {
    filteredRecords = filteredRecords.filter(record => record.timestamp <= endTime);
  }

  if (syncToken) {
    const tokenTimestamp = parseSyncToken(syncToken);
    if (tokenTimestamp) {
      filteredRecords = filteredRecords.filter(record => 
        record.metadata.uploadTimestamp > tokenTimestamp
      );
    }
  }

  // Sort by timestamp
  filteredRecords.sort((a, b) => a.timestamp - b.timestamp);

  const total = filteredRecords.length;
  const paginatedRecords = filteredRecords.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return {
    records: paginatedRecords,
    total,
    hasMore,
    nextSyncToken: hasMore ? generateSyncToken(Date.now()) : undefined,
  };
}

export async function deleteAuditLogs(options: {
  userId?: string;
  sessionId?: string;
  olderThan?: number;
}): Promise<{ deletedCount: number }> {
  const { userId, sessionId, olderThan } = options;
  let deletedCount = 0;

  for (const [id, record] of auditLogStorage.entries()) {
    let shouldDelete = false;

    if (userId && record.userId === userId) {
      shouldDelete = true;
    }

    if (sessionId && record.sessionId === sessionId) {
      shouldDelete = true;
    }

    if (olderThan && record.timestamp < olderThan) {
      shouldDelete = true;
    }

    if (shouldDelete) {
      auditLogStorage.delete(id);
      deletedCount++;
    }
  }

  return { deletedCount };
}

export async function getStorageStats(): Promise<{
  totalRecords: number;
  totalUsers: number;
  totalSessions: number;
  oldestRecord?: number;
  newestRecord?: number;
}> {
  const records = Array.from(auditLogStorage.values());
  const users = new Set(records.map(r => r.userId));
  const sessions = new Set(records.map(r => r.sessionId));
  const timestamps = records.map(r => r.timestamp);

  return {
    totalRecords: records.length,
    totalUsers: users.size,
    totalSessions: sessions.size,
    oldestRecord: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
    newestRecord: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
  };
}

// Helper functions

function generateRecordId(): string {
  recordCounter++;
  return `audit_${Date.now()}_${recordCounter.toString().padStart(6, '0')}`;
}

function generateSyncToken(timestamp: number): string {
  return Buffer.from(`sync_${timestamp}`).toString('base64');
}

function parseSyncToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const match = decoded.match(/^sync_(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

// Database schema for production implementation
export const auditLogSchema = `
CREATE TABLE audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  batch_id VARCHAR(255) NOT NULL,
  timestamp BIGINT NOT NULL,
  log_entry JSON,
  flag_event JSON,
  metadata JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_created_at (created_at)
);

CREATE TABLE audit_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT,
  total_logs INT DEFAULT 0,
  total_flags INT DEFAULT 0,
  risk_score FLOAT DEFAULT 0,
  status ENUM('active', 'completed', 'under_review') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_start_time (start_time),
  INDEX idx_status (status)
);
`;