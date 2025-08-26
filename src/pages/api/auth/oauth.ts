/**
 * OAuth Authentication endpoint
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { rateLimit } from '../../../lib/server/middleware/rateLimit';
import { exchangeOAuthCode } from '../../../lib/server/auth/oauthProvider';

const requestSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  redirectUri: z.string().url().optional(),
});

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface ErrorResponse {
  error: string;
  code: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuthResponse | ErrorResponse>
) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(req, res, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per window
  });

  if (!rateLimitResult.success) {
    return res.status(429).json({
      error: 'Too many authentication attempts',
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
    const { code, redirectUri } = requestSchema.parse(req.body);

    // Exchange OAuth code for user info
    const oauthResult = await exchangeOAuthCode(code, redirectUri);
    if (!oauthResult.success) {
      return res.status(401).json({
        error: 'Invalid authorization code',
        code: 'INVALID_OAUTH_CODE',
      });
    }

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const payload = {
      sub: oauthResult.userId,
      email: oauthResult.email,
      name: oauthResult.name,
      iat: Math.floor(Date.now() / 1000),
      scope: ['audit:read', 'audit:write'],
    };

    const accessToken = jwt.sign(payload, jwtSecret, {
      expiresIn: '1h',
      issuer: 'eyes-on-screen-quiz',
      audience: 'api',
    });

    const refreshToken = jwt.sign(
      { sub: oauthResult.userId },
      jwtSecret,
      {
        expiresIn: '7d',
        issuer: 'eyes-on-screen-quiz',
        audience: 'refresh',
      }
    );

    res.status(200).json({
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    });

  } catch (error) {
    console.error('OAuth authentication error:', error);

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