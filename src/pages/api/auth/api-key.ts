/**
 * API Key Authentication endpoint
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { rateLimit } from '../../../lib/server/middleware/rateLimit';
import { validateApiKey } from '../../../lib/server/auth/apiKeyValidator';

const requestSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
});

interface AuthResponse {
  token: string;
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
    max: 10, // 10 attempts per window
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
    const { apiKey } = requestSchema.parse(req.body);

    // Validate API key
    const keyValidation = await validateApiKey(apiKey);
    if (!keyValidation.isValid) {
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
    }

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const payload = {
      sub: keyValidation.userId,
      iat: Math.floor(Date.now() / 1000),
      scope: keyValidation.permissions,
      keyId: keyValidation.keyId,
    };

    const token = jwt.sign(payload, jwtSecret, {
      expiresIn: '1h',
      issuer: 'eyes-on-screen-quiz',
      audience: 'api',
    });

    const refreshToken = jwt.sign(
      { sub: keyValidation.userId, keyId: keyValidation.keyId },
      jwtSecret,
      {
        expiresIn: '7d',
        issuer: 'eyes-on-screen-quiz',
        audience: 'refresh',
      }
    );

    res.status(200).json({
      token,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    });

  } catch (error) {
    console.error('API key authentication error:', error);

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