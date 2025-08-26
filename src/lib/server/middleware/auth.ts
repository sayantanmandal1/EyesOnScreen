/**
 * Authentication middleware for API endpoints
 */

import { NextApiRequest } from 'next';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  sub: string;
  email?: string;
  name?: string;
  scope: string[];
  keyId?: string;
  iat: number;
}

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

export async function authenticateRequest(req: NextApiRequest): Promise<AuthResult> {
  try {
    // Extract token from Authorization header or X-API-Key header
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];

    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      // For API key authentication, we need to validate the key
      // This is a simplified version - in production, you'd validate against a database
      const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
      if (!validApiKeys.includes(apiKeyHeader)) {
        return {
          success: false,
          error: 'Invalid API key',
        };
      }

      // Create a mock user for API key authentication
      return {
        success: true,
        user: {
          sub: `apikey_${apiKeyHeader.substring(0, 8)}`,
          scope: ['audit:read', 'audit:write'],
          keyId: apiKeyHeader,
          iat: Math.floor(Date.now() / 1000),
        },
      };
    }

    if (!token) {
      return {
        success: false,
        error: 'No authentication token provided',
      };
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'eyes-on-screen-quiz',
      audience: 'api',
    }) as AuthenticatedUser;

    return {
      success: true,
      user: decoded,
    };

  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return {
        success: false,
        error: 'Invalid token',
      };
    }

    if (error instanceof jwt.TokenExpiredError) {
      return {
        success: false,
        error: 'Token expired',
      };
    }

    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

export function requireScope(requiredScope: string) {
  return (user: AuthenticatedUser): boolean => {
    return user.scope.includes(requiredScope);
  };
}

export function requireAnyScope(requiredScopes: string[]) {
  return (user: AuthenticatedUser): boolean => {
    return requiredScopes.some(scope => user.scope.includes(scope));
  };
}