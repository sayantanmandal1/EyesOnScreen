/**
 * OAuth provider integration
 */

export interface OAuthResult {
  success: boolean;
  userId?: string;
  email?: string;
  name?: string;
  error?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export async function exchangeOAuthCode(
  code: string,
  redirectUri?: string
): Promise<OAuthResult> {
  try {
    // This is a simplified OAuth implementation
    // In production, you would integrate with actual OAuth providers like Google, Microsoft, etc.
    
    const oauthConfig = getOAuthConfig();
    if (!oauthConfig) {
      return {
        success: false,
        error: 'OAuth not configured',
      };
    }

    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(code, oauthConfig, redirectUri);
    if (!tokenResponse.success) {
      return {
        success: false,
        error: tokenResponse.error,
      };
    }

    // Get user info using access token
    const userInfo = await getUserInfo(tokenResponse.accessToken!);
    if (!userInfo.success) {
      return {
        success: false,
        error: userInfo.error,
      };
    }

    return {
      success: true,
      userId: userInfo.userId,
      email: userInfo.email,
      name: userInfo.name,
    };

  } catch (error) {
    console.error('OAuth exchange error:', error);
    return {
      success: false,
      error: 'OAuth exchange failed',
    };
  }
}

async function exchangeCodeForToken(
  code: string,
  config: OAuthConfig,
  redirectUri?: string
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}> {
  try {
    // Mock OAuth token exchange for development
    if (process.env.NODE_ENV === 'development' && code === 'test-auth-code') {
      return {
        success: true,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };
    }

    // In production, make actual OAuth token request
    const tokenEndpoint = getTokenEndpoint();
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri || config.redirectUri,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Token exchange failed: ${response.status}`,
      };
    }

    const tokenData = await response.json();
    
    return {
      success: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    };

  } catch (error) {
    console.error('Token exchange error:', error);
    return {
      success: false,
      error: 'Token exchange failed',
    };
  }
}

async function getUserInfo(accessToken: string): Promise<{
  success: boolean;
  userId?: string;
  email?: string;
  name?: string;
  error?: string;
}> {
  try {
    // Mock user info for development
    if (process.env.NODE_ENV === 'development' && accessToken === 'mock-access-token') {
      return {
        success: true,
        userId: 'oauth_user_123',
        email: 'test@example.com',
        name: 'Test User',
      };
    }

    // In production, make actual user info request
    const userInfoEndpoint = getUserInfoEndpoint();
    const response = await fetch(userInfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `User info request failed: ${response.status}`,
      };
    }

    const userData = await response.json();
    
    return {
      success: true,
      userId: userData.sub || userData.id,
      email: userData.email,
      name: userData.name || userData.display_name,
    };

  } catch (error) {
    console.error('User info error:', error);
    return {
      success: false,
      error: 'User info request failed',
    };
  }
}

function getOAuthConfig(): OAuthConfig | null {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scope: ['openid', 'profile', 'email'],
  };
}

function getTokenEndpoint(): string {
  // Configure based on your OAuth provider
  const provider = process.env.OAUTH_PROVIDER || 'google';
  
  switch (provider) {
    case 'google':
      return 'https://oauth2.googleapis.com/token';
    case 'microsoft':
      return 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    case 'github':
      return 'https://github.com/login/oauth/access_token';
    default:
      return process.env.OAUTH_TOKEN_ENDPOINT || '';
  }
}

function getUserInfoEndpoint(): string {
  // Configure based on your OAuth provider
  const provider = process.env.OAUTH_PROVIDER || 'google';
  
  switch (provider) {
    case 'google':
      return 'https://www.googleapis.com/oauth2/v2/userinfo';
    case 'microsoft':
      return 'https://graph.microsoft.com/v1.0/me';
    case 'github':
      return 'https://api.github.com/user';
    default:
      return process.env.OAUTH_USERINFO_ENDPOINT || '';
  }
}

export function getAuthorizationUrl(state?: string): string {
  const config = getOAuthConfig();
  if (!config) {
    throw new Error('OAuth not configured');
  }

  const provider = process.env.OAUTH_PROVIDER || 'google';
  let authEndpoint: string;

  switch (provider) {
    case 'google':
      authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
      break;
    case 'microsoft':
      authEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
      break;
    case 'github':
      authEndpoint = 'https://github.com/login/oauth/authorize';
      break;
    default:
      authEndpoint = process.env.OAUTH_AUTH_ENDPOINT || '';
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope.join(' '),
    ...(state && { state }),
  });

  return `${authEndpoint}?${params.toString()}`;
}