/**
 * Rate limiting middleware for API endpoints
 */

import { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  keyGenerator?: (req: NextApiRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
}

// In-memory store for rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

export async function rateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const key = config.keyGenerator ? config.keyGenerator(req) : getDefaultKey(req);
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  // Check if limit exceeded
  if (entry.count >= config.max) {
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));
    res.setHeader('Retry-After', Math.ceil((entry.resetTime - now) / 1000));

    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  // Set rate limit headers
  const remaining = config.max - entry.count;
  res.setHeader('X-RateLimit-Limit', config.max);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

  return {
    success: true,
    remaining,
    resetTime: entry.resetTime,
  };
}

function getDefaultKey(req: NextApiRequest): string {
  // Use IP address as default key
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
    : req.socket.remoteAddress;
  
  return `ip:${ip || 'unknown'}`;
}

export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<RateLimitResult> => {
    return rateLimit(req, res, config);
  };
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
  },
  upload: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 uploads per minute
  },
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
  },
};