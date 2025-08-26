/**
 * API Key validation utilities
 */

export interface ApiKeyValidation {
  isValid: boolean;
  userId?: string;
  keyId?: string;
  permissions?: string[];
  error?: string;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  keyHash: string;
  permissions: string[];
  isActive: boolean;
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
}

// In-memory store for development (use database in production)
const apiKeyStore = new Map<string, ApiKeyRecord>();

// Initialize with some test keys for development
if (process.env.NODE_ENV === 'development') {
  const testKey = 'test-api-key-12345';
  const testKeyHash = hashApiKey(testKey);
  
  apiKeyStore.set(testKeyHash, {
    id: 'key_1',
    userId: 'user_test',
    keyHash: testKeyHash,
    permissions: ['audit:read', 'audit:write'],
    isActive: true,
    createdAt: Date.now(),
  });
}

export async function validateApiKey(apiKey: string): Promise<ApiKeyValidation> {
  try {
    if (!apiKey || typeof apiKey !== 'string') {
      return {
        isValid: false,
        error: 'Invalid API key format',
      };
    }

    // Hash the provided key
    const keyHash = hashApiKey(apiKey);
    
    // Look up the key in the store
    const keyRecord = apiKeyStore.get(keyHash);
    
    if (!keyRecord) {
      return {
        isValid: false,
        error: 'API key not found',
      };
    }

    // Check if key is active
    if (!keyRecord.isActive) {
      return {
        isValid: false,
        error: 'API key is disabled',
      };
    }

    // Check if key is expired
    if (keyRecord.expiresAt && Date.now() > keyRecord.expiresAt) {
      return {
        isValid: false,
        error: 'API key has expired',
      };
    }

    // Update last used timestamp
    keyRecord.lastUsedAt = Date.now();
    apiKeyStore.set(keyHash, keyRecord);

    return {
      isValid: true,
      userId: keyRecord.userId,
      keyId: keyRecord.id,
      permissions: keyRecord.permissions,
    };

  } catch (error) {
    console.error('API key validation error:', error);
    return {
      isValid: false,
      error: 'Validation failed',
    };
  }
}

export async function createApiKey(options: {
  userId: string;
  permissions: string[];
  expiresAt?: number;
}): Promise<{ apiKey: string; keyId: string }> {
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const keyRecord: ApiKeyRecord = {
    id: keyId,
    userId: options.userId,
    keyHash,
    permissions: options.permissions,
    isActive: true,
    createdAt: Date.now(),
    expiresAt: options.expiresAt,
  };

  apiKeyStore.set(keyHash, keyRecord);

  return { apiKey, keyId };
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  for (const [hash, record] of apiKeyStore.entries()) {
    if (record.id === keyId) {
      record.isActive = false;
      apiKeyStore.set(hash, record);
      return true;
    }
  }
  return false;
}

export async function listApiKeys(userId: string): Promise<Omit<ApiKeyRecord, 'keyHash'>[]> {
  const userKeys: Omit<ApiKeyRecord, 'keyHash'>[] = [];
  
  for (const record of apiKeyStore.values()) {
    if (record.userId === userId) {
      const { keyHash, ...publicRecord } = record;
      userKeys.push(publicRecord);
    }
  }

  return userKeys;
}

// Helper functions

function generateApiKey(): string {
  const prefix = 'eos_';
  const randomPart = Array.from({ length: 32 }, () => 
    Math.random().toString(36).charAt(2)
  ).join('');
  
  return prefix + randomPart;
}

function hashApiKey(apiKey: string): string {
  // Simple hash for development - use proper hashing in production
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// Database schema for production
export const apiKeySchema = `
CREATE TABLE api_keys (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  permissions JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_key_hash (key_hash),
  INDEX idx_is_active (is_active)
);
`;