# Server Integration Documentation

This document describes the optional server integration features implemented for the Eyes-On-Screen Proctored Quiz application.

## Overview

The server integration provides optional audit log synchronization capabilities while maintaining privacy-by-design principles. All video processing remains client-side, and only anonymized monitoring data is transmitted to servers with explicit user consent.

## Features Implemented

### 1. Client-Side Server Sync (`ServerSync` class)

**Location:** `src/lib/data/ServerSync.ts`

**Features:**
- Optional log upload with user consent management
- Authentication via API keys or OAuth
- Batch upload with retry logic and exponential backoff
- Automatic token refresh
- Network error handling and recovery
- Local queue management for offline scenarios

**Usage:**
```typescript
import { ServerSync } from '../lib/data/ServerSync';

const serverSync = new ServerSync({
  enabled: true,
  endpoint: 'https://api.example.com',
  apiKey: 'your-api-key',
  batchSize: 10,
  retryAttempts: 3,
  syncInterval: 30000,
});

// Initialize with user consent
await serverSync.initialize(userConsent);

// Queue session data for upload
await serverSync.queueSessionData(sessionData);

// Manual sync
await serverSync.syncPendingBatches();
```

### 2. User Consent Management

**Location:** `src/components/ui/ServerSyncConsent.tsx`

**Features:**
- Clear privacy explanations
- Granular consent controls
- Real-time sync status display
- Data usage transparency
- Easy opt-out mechanisms

### 3. React Hook for Server Sync

**Location:** `src/hooks/useServerSync.ts`

**Features:**
- Automatic sync management
- Status monitoring
- Configuration updates
- Authentication handling
- Cleanup on unmount

### 4. Server-Side API Endpoints

#### Authentication Endpoints

**API Key Authentication:** `POST /api/auth/api-key`
- Validates API keys
- Issues JWT tokens
- Rate limited (10 attempts per 15 minutes)

**OAuth Authentication:** `POST /api/auth/oauth`
- Exchanges OAuth codes for tokens
- Supports Google, Microsoft, GitHub providers
- Rate limited (20 attempts per 15 minutes)

**Token Refresh:** `POST /api/auth/refresh`
- Refreshes expired access tokens
- Validates refresh tokens
- Rate limited (50 attempts per 15 minutes)

#### Data Upload Endpoint

**Audit Log Upload:** `POST /api/sync/upload`
- Accepts batch uploads of audit logs
- Validates and sanitizes data
- Requires authentication
- Rate limited (100 uploads per minute)
- Supports up to 10MB payloads

#### Administrative Endpoints

**Audit Log Review:** `GET /api/admin/audit-logs`
- Retrieves audit logs with filtering
- Supports pagination and search
- Requires admin permissions
- Provides storage statistics

**Session Review:** `GET /api/admin/sessions/{sessionId}`
- Detailed session analysis
- Timeline generation
- Risk score calculation
- Flag summarization

### 5. Data Validation and Security

**Location:** `src/lib/server/validation/batchValidator.ts`

**Features:**
- Comprehensive data validation
- Input sanitization
- Timestamp validation
- Size limits and constraints
- XSS protection

### 6. Storage System

**Location:** `src/lib/server/storage/auditStorage.ts`

**Features:**
- In-memory storage for development
- Database schema for production
- Data retention management
- Query and filtering capabilities
- Storage statistics

### 7. Security Middleware

**Authentication Middleware:** `src/lib/server/middleware/auth.ts`
- JWT token validation
- API key authentication
- Scope-based permissions
- Error handling

**Rate Limiting:** `src/lib/server/middleware/rateLimit.ts`
- Configurable rate limits
- IP-based tracking
- Automatic cleanup
- Header responses

## Data Privacy and Security

### What Data is Synchronized

✅ **Transmitted to Server:**
- Quiz session timestamps and duration
- Anonymized monitoring signals (gaze confidence, head pose angles)
- Flag events and risk scores
- Performance metrics (FPS, latency)
- Browser and system information (user agent, screen resolution)

❌ **NOT Transmitted:**
- Raw video frames or camera data
- Personal identifying information
- Quiz answers or content
- Facial landmarks or biometric data

### Security Measures

- **Encryption in Transit:** All data encrypted using HTTPS
- **Authentication:** JWT tokens with configurable expiration
- **Rate Limiting:** Protection against abuse and DoS attacks
- **Input Validation:** Comprehensive sanitization of all inputs
- **Access Controls:** Role-based permissions for admin functions
- **Data Retention:** Configurable retention policies

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-jwt-secret-key

# OAuth Configuration (optional)
OAUTH_CLIENT_ID=your-oauth-client-id
OAUTH_CLIENT_SECRET=your-oauth-client-secret
OAUTH_REDIRECT_URI=https://your-app.com/auth/callback
OAUTH_PROVIDER=google|microsoft|github

# API Keys (development)
VALID_API_KEYS=key1,key2,key3
```

### Client Configuration

```typescript
const serverSyncConfig = {
  enabled: true,
  endpoint: process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://api.example.com',
  batchSize: 10,
  retryAttempts: 3,
  syncInterval: 30000, // 30 seconds
};
```

## Production Deployment

### Database Setup

The system includes SQL schemas for production deployment:

```sql
-- Audit logs table
CREATE TABLE audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  batch_id VARCHAR(255) NOT NULL,
  timestamp BIGINT NOT NULL,
  log_entry JSON,
  flag_event JSON,
  metadata JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id),
  INDEX idx_timestamp (timestamp)
);

-- API keys table
CREATE TABLE api_keys (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  permissions JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL
);
```

### Scaling Considerations

- **Redis:** Use Redis for rate limiting and session storage in production
- **Database:** Replace in-memory storage with PostgreSQL or MySQL
- **Load Balancing:** Distribute API requests across multiple instances
- **Monitoring:** Implement logging and monitoring for API endpoints
- **Backup:** Regular backups of audit log data

## Testing

Unit tests are provided for:
- ServerSync class functionality
- Authentication flows
- Data validation
- API endpoint behavior

Run tests with:
```bash
npm test -- --testPathPatterns=ServerSync.test.ts
```

## Integration Examples

### Basic Setup

```typescript
import { useServerSync } from '../hooks/useServerSync';
import { ServerSyncConsent } from '../components/ui/ServerSyncConsent';

function App() {
  const serverSync = useServerSync({
    config: serverSyncConfig,
    autoSync: true,
    syncInterval: 30000,
  });

  return (
    <div>
      <ServerSyncConsent
        serverSync={serverSync.serverSync}
        onConsentChange={(consent) => {
          // Handle consent changes
        }}
      />
      {/* Rest of your app */}
    </div>
  );
}
```

### Manual Data Upload

```typescript
// Queue session data
await serverSync.queueSessionData({
  sessionId: 'session_123',
  startTime: Date.now(),
  logEntries: [...],
  flags: [...],
  // ... other session data
});

// Trigger immediate sync
await serverSync.syncNow();
```

This implementation provides a complete, secure, and privacy-focused server integration system that can be easily deployed and scaled according to institutional needs.