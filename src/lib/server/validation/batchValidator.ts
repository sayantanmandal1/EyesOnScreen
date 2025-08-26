/**
 * Batch validation and sanitization for audit logs
 */

import { SyncBatch } from '../../data/ServerSync';
import { LogEntry } from '../../data/types';
import { FlagEvent } from '../../proctoring/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedBatch?: SyncBatch;
}

export async function validateAndSanitizeBatch(batch: SyncBatch): Promise<SyncBatch> {
  const errors: string[] = [];

  // Validate batch structure
  if (!batch.id || typeof batch.id !== 'string') {
    errors.push('Invalid batch ID');
  }

  if (!batch.sessionId || typeof batch.sessionId !== 'string') {
    errors.push('Invalid session ID');
  }

  if (!batch.timestamp || typeof batch.timestamp !== 'number') {
    errors.push('Invalid timestamp');
  }

  // Validate timestamp is not too old or in the future
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  const maxFuture = 5 * 60 * 1000; // 5 minutes

  if (batch.timestamp < now - maxAge) {
    errors.push('Batch timestamp is too old');
  }

  if (batch.timestamp > now + maxFuture) {
    errors.push('Batch timestamp is in the future');
  }

  // Validate log entries
  if (!Array.isArray(batch.logEntries)) {
    errors.push('Log entries must be an array');
  } else {
    batch.logEntries.forEach((entry, index) => {
      const entryErrors = validateLogEntry(entry, index);
      errors.push(...entryErrors);
    });
  }

  // Validate flags
  if (!Array.isArray(batch.flags)) {
    errors.push('Flags must be an array');
  } else {
    batch.flags.forEach((flag, index) => {
      const flagErrors = validateFlagEvent(flag, index);
      errors.push(...flagErrors);
    });
  }

  // Validate metadata
  if (!batch.metadata || typeof batch.metadata !== 'object') {
    errors.push('Invalid metadata');
  } else {
    if (!batch.metadata.userAgent || typeof batch.metadata.userAgent !== 'string') {
      errors.push('Invalid user agent in metadata');
    }
    if (!batch.metadata.screenResolution || typeof batch.metadata.screenResolution !== 'string') {
      errors.push('Invalid screen resolution in metadata');
    }
    if (!batch.metadata.timezone || typeof batch.metadata.timezone !== 'string') {
      errors.push('Invalid timezone in metadata');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  // Sanitize the batch
  return sanitizeBatch(batch);
}

function validateLogEntry(entry: LogEntry, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Log entry ${index}:`;

  if (typeof entry.timestamp !== 'number') {
    errors.push(`${prefix} Invalid timestamp`);
  }

  if (entry.questionId !== null && typeof entry.questionId !== 'string') {
    errors.push(`${prefix} Invalid question ID`);
  }

  if (typeof entry.eyesOn !== 'boolean') {
    errors.push(`${prefix} Invalid eyesOn value`);
  }

  if (typeof entry.gazeConfidence !== 'number' || entry.gazeConfidence < 0 || entry.gazeConfidence > 1) {
    errors.push(`${prefix} Invalid gaze confidence`);
  }

  if (!entry.headPose || typeof entry.headPose !== 'object') {
    errors.push(`${prefix} Invalid head pose`);
  } else {
    if (typeof entry.headPose.yaw !== 'number') {
      errors.push(`${prefix} Invalid head pose yaw`);
    }
    if (typeof entry.headPose.pitch !== 'number') {
      errors.push(`${prefix} Invalid head pose pitch`);
    }
    if (typeof entry.headPose.roll !== 'number') {
      errors.push(`${prefix} Invalid head pose roll`);
    }
  }

  if (typeof entry.shadowScore !== 'number' || entry.shadowScore < 0 || entry.shadowScore > 1) {
    errors.push(`${prefix} Invalid shadow score`);
  }

  if (typeof entry.secondaryFace !== 'boolean') {
    errors.push(`${prefix} Invalid secondary face value`);
  }

  if (typeof entry.deviceLike !== 'boolean') {
    errors.push(`${prefix} Invalid device like value`);
  }

  if (typeof entry.tabHidden !== 'boolean') {
    errors.push(`${prefix} Invalid tab hidden value`);
  }

  if (typeof entry.facePresent !== 'boolean') {
    errors.push(`${prefix} Invalid face present value`);
  }

  if (entry.flagType !== null && typeof entry.flagType !== 'string') {
    errors.push(`${prefix} Invalid flag type`);
  }

  if (typeof entry.riskScore !== 'number' || entry.riskScore < 0 || entry.riskScore > 100) {
    errors.push(`${prefix} Invalid risk score`);
  }

  return errors;
}

function validateFlagEvent(flag: FlagEvent, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Flag ${index}:`;

  if (!flag.id || typeof flag.id !== 'string') {
    errors.push(`${prefix} Invalid flag ID`);
  }

  if (typeof flag.timestamp !== 'number') {
    errors.push(`${prefix} Invalid timestamp`);
  }

  if (flag.endTimestamp !== undefined && typeof flag.endTimestamp !== 'number') {
    errors.push(`${prefix} Invalid end timestamp`);
  }

  const validTypes = [
    'EYES_OFF',
    'HEAD_POSE',
    'TAB_BLUR',
    'SECOND_FACE',
    'DEVICE_OBJECT',
    'SHADOW_ANOMALY',
    'FACE_MISSING',
    'DOWN_GLANCE',
  ];

  if (!validTypes.includes(flag.type)) {
    errors.push(`${prefix} Invalid flag type`);
  }

  if (!['soft', 'hard'].includes(flag.severity)) {
    errors.push(`${prefix} Invalid severity`);
  }

  if (typeof flag.confidence !== 'number' || flag.confidence < 0 || flag.confidence > 1) {
    errors.push(`${prefix} Invalid confidence`);
  }

  if (!flag.details || typeof flag.details !== 'object') {
    errors.push(`${prefix} Invalid details`);
  }

  if (flag.questionId !== undefined && typeof flag.questionId !== 'string') {
    errors.push(`${prefix} Invalid question ID`);
  }

  return errors;
}

function sanitizeBatch(batch: SyncBatch): SyncBatch {
  return {
    id: sanitizeString(batch.id),
    sessionId: sanitizeString(batch.sessionId),
    timestamp: Math.floor(batch.timestamp),
    logEntries: batch.logEntries.map(sanitizeLogEntry),
    flags: batch.flags.map(sanitizeFlagEvent),
    metadata: {
      userAgent: sanitizeString(batch.metadata.userAgent, 500),
      screenResolution: sanitizeString(batch.metadata.screenResolution, 50),
      timezone: sanitizeString(batch.metadata.timezone, 100),
    },
  };
}

function sanitizeLogEntry(entry: LogEntry): LogEntry {
  return {
    timestamp: Math.floor(entry.timestamp),
    questionId: entry.questionId ? sanitizeString(entry.questionId, 100) : null,
    eyesOn: Boolean(entry.eyesOn),
    gazeConfidence: Math.max(0, Math.min(1, Number(entry.gazeConfidence))),
    headPose: {
      yaw: Number(entry.headPose.yaw),
      pitch: Number(entry.headPose.pitch),
      roll: Number(entry.headPose.roll),
    },
    shadowScore: Math.max(0, Math.min(1, Number(entry.shadowScore))),
    secondaryFace: Boolean(entry.secondaryFace),
    deviceLike: Boolean(entry.deviceLike),
    tabHidden: Boolean(entry.tabHidden),
    facePresent: Boolean(entry.facePresent),
    flagType: entry.flagType ? sanitizeString(entry.flagType, 50) : null,
    riskScore: Math.max(0, Math.min(100, Number(entry.riskScore))),
  };
}

function sanitizeFlagEvent(flag: FlagEvent): FlagEvent {
  return {
    id: sanitizeString(flag.id),
    timestamp: Math.floor(flag.timestamp),
    endTimestamp: flag.endTimestamp ? Math.floor(flag.endTimestamp) : undefined,
    type: flag.type,
    severity: flag.severity,
    confidence: Math.max(0, Math.min(1, Number(flag.confidence))),
    details: sanitizeObject(flag.details),
    questionId: flag.questionId ? sanitizeString(flag.questionId, 100) : undefined,
  };
}

function sanitizeString(str: string, maxLength = 255): string {
  if (typeof str !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters
  const sanitized = str
    .replace(/[<>\"'&]/g, '') // Remove HTML/XML characters
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
    .trim();
  
  return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key, 50);
    
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value, 1000);
    } else if (typeof value === 'number') {
      sanitized[sanitizedKey] = Number(value);
    } else if (typeof value === 'boolean') {
      sanitized[sanitizedKey] = Boolean(value);
    } else if (value === null) {
      sanitized[sanitizedKey] = null;
    }
    // Skip other types for security
  }
  
  return sanitized;
}