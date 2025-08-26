/**
 * Administrative audit log review endpoint
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { authenticateRequest, requireScope } from '../../../lib/server/middleware/auth';
import { rateLimit } from '../../../lib/server/middleware/rateLimit';
import { getAuditLogs, getStorageStats, deleteAuditLogs } from '../../../lib/server/storage/auditStorage';

const querySchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  startTime: z.string().transform(val => parseInt(val, 10)).optional(),
  endTime: z.string().transform(val => parseInt(val, 10)).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val, 10), 1000)).optional(),
  offset: z.string().transform(val => parseInt(val, 10)).optional(),
  syncToken: z.string().optional(),
});

const deleteSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  olderThan: z.number().optional(),
});

interface AuditLogsResponse {
  success: boolean;
  data?: {
    records: any[];
    total: number;
    hasMore: boolean;
    nextSyncToken?: string;
  };
  stats?: {
    totalRecords: number;
    totalUsers: number;
    totalSessions: number;
    oldestRecord?: number;
    newestRecord?: number;
  };
  error?: string;
}

interface DeleteResponse {
  success: boolean;
  deletedCount?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuditLogsResponse | DeleteResponse>
) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(req, res, {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
  });

  if (!rateLimitResult.success) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
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

  // Check admin permissions
  if (!requireScope('audit:admin')(authResult.user!)) {
    return res.status(403).json({
      success: false,
      error: 'Admin permissions required',
    });
  }

  try {
    switch (req.method) {
      case 'GET':
        return handleGetAuditLogs(req, res);
      case 'DELETE':
        return handleDeleteAuditLogs(req, res);
      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
        });
    }
  } catch (error) {
    console.error('Admin audit logs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

async function handleGetAuditLogs(
  req: NextApiRequest,
  res: NextApiResponse<AuditLogsResponse>
) {
  try {
    // Parse query parameters
    const query = querySchema.parse(req.query);

    // Get audit logs
    const logsResult = await getAuditLogs({
      userId: query.userId,
      sessionId: query.sessionId,
      startTime: query.startTime,
      endTime: query.endTime,
      limit: query.limit || 100,
      offset: query.offset || 0,
      syncToken: query.syncToken,
    });

    // Get storage statistics
    const stats = await getStorageStats();

    res.status(200).json({
      success: true,
      data: logsResult,
      stats,
    });

  } catch (error) {
    console.error('Get audit logs error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit logs',
    });
  }
}

async function handleDeleteAuditLogs(
  req: NextApiRequest,
  res: NextApiResponse<DeleteResponse>
) {
  try {
    // Parse request body
    const { userId, sessionId, olderThan } = deleteSchema.parse(req.body);

    // Delete audit logs
    const deleteResult = await deleteAuditLogs({
      userId,
      sessionId,
      olderThan,
    });

    res.status(200).json({
      success: true,
      deletedCount: deleteResult.deletedCount,
    });

  } catch (error) {
    console.error('Delete audit logs error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete audit logs',
    });
  }
}