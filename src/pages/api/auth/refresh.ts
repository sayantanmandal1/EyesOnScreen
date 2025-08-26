/**
 * Token Refresh endpoint
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { rateLimit } from '../../../lib/server/middleware/rateLimit';

const requestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

interface ErrorResponse {
  error: string;
  code: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RefreshResponse | ErrorResponse>
) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(req, res, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 refresh attempts per window
  });

  if (!rateLimitResult.success) {
    return res.status(429).json({
      error: 'Too many refresh attempts',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    // Validate request body
    const { refreshToken } = requestSchema.parse(req.body);

    // Verify refresh token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, jwtSecret, {
        issuer: 'eyes-on-screen-quiz',
        audience: 'refresh',
      });
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // Generate new access token
    const payload = {
      sub: decoded.sub,
      iat: Math.floor(Date.now() / 1000),
      scope: decoded.scope || ['audit:read', 'audit:write'],
      keyId: decoded.keyId,
    };

    const accessToken = jwt.sign(payload, jwtSecret, {
      expiresIn: '1h',
      issuer: 'eyes-on-screen-quiz',
      audience: 'api',
    });

    res.status(200).json({
      accessToken,
      expiresIn: 3600, // 1 hour in seconds
    });

  } catch (error) {
    console.error('Token refresh error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request format',
        code: 'VALIDATION_ERROR',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}