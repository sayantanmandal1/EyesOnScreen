/**
 * Data module type definitions
 */

import { FlagEvent } from '../proctoring/types';
import { CalibrationProfile } from '../vision/types';
import { QuizSession } from '../quiz/types';

export interface LogEntry {
  timestamp: number;
  questionId: string | null;
  eyesOn: boolean;
  gazeConfidence: number;
  headPose: { yaw: number; pitch: number; roll: number };
  shadowScore: number;
  secondaryFace: boolean;
  deviceLike: boolean;
  tabHidden: boolean;
  facePresent: boolean;
  flagType: string | null;
  riskScore: number;
}

export interface SessionData {
  sessionId: string;
  startTime: number;
  endTime?: number;
  calibrationProfile: CalibrationProfile;
  quizSession: QuizSession;
  logEntries: LogEntry[];
  flags: FlagEvent[];
  performanceMetrics: {
    averageFps: number;
    averageLatency: number;
    peakMemoryUsage: number;
    droppedFrames: number;
  };
}

export interface ExportFormat {
  type: 'json' | 'csv' | 'pdf';
  includeRawData: boolean;
  includeCharts: boolean;
  includeTimeline: boolean;
  dateRange?: {
    start: number;
    end: number;
  };
}

export interface StorageConfig {
  maxLogEntries: number;
  maxSessionHistory: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  retentionDays: number;
}

export interface ServerSyncConfig {
  enabled: boolean;
  endpoint: string;
  apiKey?: string;
  batchSize: number;
  retryAttempts: number;
  syncInterval: number;
}

export interface DatabaseSchema {
  sessions: SessionData;
  calibrationProfiles: CalibrationProfile;
  logEntries: LogEntry;
  flags: FlagEvent;
  settings: Record<string, unknown>;
}

export interface NetworkError extends Error {
  code: 'NETWORK_ERROR' | 'AUTH_ERROR' | 'SERVER_ERROR' | 'TIMEOUT_ERROR';
  status?: number;
  details?: Record<string, unknown>;
}