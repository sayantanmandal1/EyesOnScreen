/**
 * Administrative session review endpoint
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { authenticateRequest, requireScope } from '../../../lib/server/middleware/auth';
import { rateLimit } from '../../../lib/server/middleware/rateLimit';
import { getAuditLogs } from '../../../lib/server/storage/auditStorage';

const querySchema = z.object({
  sessionId: z.string(),
  includeDetails: z.string().transform(val => val === 'true').optional(),
});

interface SessionReviewResponse {
  success: boolean;
  data?: {
    sessionId: string;
    userId: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    totalLogs: number;
    totalFlags: number;
    riskScore: number;
    flagSummary: Record<string, number>;
    timeline?: any[];
    details?: any[];
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionReviewResponse>
) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(req, res, {
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute
  });

  if (!rateLimitResult.success) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  // Authenticate request
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  // Check permissions (allow both admin and read access)
  const hasPermission = requireScope('audit:admin')(authResult.user!) || 
                       requireScope('audit:read')(authResult.user!);
  
  if (!hasPermission) {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
    });
  }

  try {
    // Parse query parameters
    const { sessionId, includeDetails } = querySchema.parse(req.query);

    // Get all records for the session
    const logsResult = await getAuditLogs({
      sessionId,
      limit: 10000, // Get all records for the session
    });

    if (logsResult.records.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    // Analyze session data
    const sessionAnalysis = analyzeSession(logsResult.records);

    // Build response
    const response: SessionReviewResponse = {
      success: true,
      data: {
        sessionId,
        userId: logsResult.records[0].userId,
        ...sessionAnalysis,
        details: includeDetails ? logsResult.records : undefined,
      },
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Session review error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session data',
    });
  }
}

function analyzeSession(records: any[]) {
  const logEntries = records.filter(r => r.logEntry);
  const flagEvents = records.filter(r => r.flagEvent);

  // Calculate session timing
  const timestamps = records.map(r => r.timestamp);
  const startTime = Math.min(...timestamps);
  const endTime = Math.max(...timestamps);
  const duration = endTime - startTime;

  // Calculate risk score (average of all log entries)
  const riskScores = logEntries
    .map(r => r.logEntry?.riskScore)
    .filter(score => typeof score === 'number');
  const avgRiskScore = riskScores.length > 0 
    ? riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length 
    : 0;

  // Summarize flags by type
  const flagSummary: Record<string, number> = {};
  flagEvents.forEach(record => {
    const flagType = record.flagEvent?.type;
    if (flagType) {
      flagSummary[flagType] = (flagSummary[flagType] || 0) + 1;
    }
  });

  // Create timeline of significant events
  const timeline = createTimeline(records);

  return {
    startTime,
    endTime,
    duration,
    totalLogs: logEntries.length,
    totalFlags: flagEvents.length,
    riskScore: Math.round(avgRiskScore * 100) / 100,
    flagSummary,
    timeline,
  };
}

function createTimeline(records: any[]) {
  const timeline: any[] = [];

  // Add flag events to timeline
  records
    .filter(r => r.flagEvent)
    .forEach(record => {
      timeline.push({
        timestamp: record.timestamp,
        type: 'flag',
        event: record.flagEvent.type,
        severity: record.flagEvent.severity,
        confidence: record.flagEvent.confidence,
        details: record.flagEvent.details,
      });
    });

  // Add significant log events (high risk scores, eyes off screen, etc.)
  records
    .filter(r => r.logEntry)
    .forEach(record => {
      const entry = record.logEntry;
      
      // Add high risk score events
      if (entry.riskScore > 50) {
        timeline.push({
          timestamp: record.timestamp,
          type: 'high_risk',
          riskScore: entry.riskScore,
          eyesOn: entry.eyesOn,
          gazeConfidence: entry.gazeConfidence,
        });
      }

      // Add eyes off screen events
      if (!entry.eyesOn && entry.gazeConfidence > 0.7) {
        timeline.push({
          timestamp: record.timestamp,
          type: 'eyes_off',
          gazeConfidence: entry.gazeConfidence,
          headPose: entry.headPose,
        });
      }

      // Add tab hidden events
      if (entry.tabHidden) {
        timeline.push({
          timestamp: record.timestamp,
          type: 'tab_hidden',
        });
      }
    });

  // Sort timeline by timestamp
  timeline.sort((a, b) => a.timestamp - b.timestamp);

  return timeline;
}