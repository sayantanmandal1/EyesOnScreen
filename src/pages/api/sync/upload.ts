/**
 * Audit Log Upload endpoint
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { authenticateRequest } from '../../../lib/server/middleware/auth';
import { rateLimit } from '../../../lib/server/middleware/rateLimit';
import { validateAndSanitizeBatch } from '../../../lib/server/validation/batchValidator';
import { storeAuditLogs } from '../../../lib/server/storage/auditStorage';
import { SyncBatch } from '../../../lib/data/ServerSync';

const batchSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  timestamp: z.number(),
  logEntries: z.array(z.object({
    timestamp: z.number(),
    questionId: z.string().nullable(),
    eyesOn: z.boolean(),
    gazeConfidence: z.number().min(0).max(1),
    headPose: z.object({
      yaw: z.number(),
      pitch: z.number(),
      roll: z.number(),
    }),
    shadowScore: z.number().min(0).max(1),
    secondaryFace: z.boolean(),
    deviceLike: z.boolean(),
    tabHidden: z.boolean(),
    facePresent: z.boolean(),
    flagType: z.string().nullable(),
    riskScore: z.number().min(0).max(100),
  })),
  flags: z.array(z.object({
    id: z.string(),
    timestamp: z.number(),
    endTimestamp: z.number().optional(),
    type: z.enum([
      'EYES_OFF',
      'HEAD_POSE',
      'TAB_BLUR',
      'SECOND_FACE',
      'DEVICE_OBJECT',
      'SHADOW_ANOMALY',
      'FACE_MISSING',
      'DOWN_GLANCE',
    ]),
    severity: z.enum(['soft', 'hard']),
    confidence: z.number().min(0).max(1),
    details: z.record(z.unknown()),
    questionId: z.string().optional(),
  })),
  metadata: z.object({
    userAgent: z.string(),
    screenResolution: z.string(),
    timezone: z.string(),
  }),
});

const requestSchema = z.object({
  batches: z.array(batchSchema).min(1).max(50), // Limit batch size
  timestamp: z.number(),
});

interface UploadResponse {
  success: boolean;
  batchId: string;
  processedCount: number;
  nextSyncToken?: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  errors?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | ErrorResponse>
) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(req, res, {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 uploads per minute per IP
  });

  if (!rateLimitResult.success) {
    return res.status(429).json({
      success: false,
      error: 'Too many upload requests',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    // Authenticate request
    const authResult = await authenticateRequest(req);
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    // Check permissions
    if (!authResult.user.scope.includes('audit:write')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    // Validate request body
    const { batches, timestamp } = requestSchema.parse(req.body);

    // Validate and sanitize each batch
    const validationErrors: string[] = [];
    const sanitizedBatches: SyncBatch[] = [];

    for (const batch of batches) {
      try {
        const sanitized = await validateAndSanitizeBatch(batch);
        sanitizedBatches.push(sanitized);
      } catch (error) {
        validationErrors.push(`Batch ${batch.id}: ${error instanceof Error ? error.message : 'Validation failed'}`);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Batch validation failed',
        code: 'VALIDATION_ERROR',
        errors: validationErrors,
      });
    }

    // Store audit logs
    const storageResult = await storeAuditLogs(sanitizedBatches, {
      userId: authResult.user.sub,
      timestamp,
      ipAddress: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    if (!storageResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to store audit logs',
        code: 'STORAGE_ERROR',
        errors: storageResult.errors,
      });
    }

    // Generate response
    const batchId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const processedCount = sanitizedBatches.reduce((sum, batch) => sum + batch.logEntries.length, 0);

    res.status(200).json({
      success: true,
      batchId,
      processedCount,
      nextSyncToken: storageResult.nextSyncToken,
    });

  } catch (error) {
    console.error('Upload error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        code: 'VALIDATION_ERROR',
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

// Increase body size limit for batch uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};