/**
 * Device Code Flow authentication for Business Central MCP.
 *
 * Uses the well-known Azure CLI first-party client ID so the user
 * does NOT need to register any app in Azure / Entra ID.
 *
 * Flow:
 * 1. Frontend calls POST /api/auth/device-code
 * 2. Backend returns { userCode, verificationUri, message }
 * 3. User opens the URL in their browser, enters the code, signs in
 * 4. Frontend polls POST /api/auth/device-code/poll until token is acquired
 * 5. Token is stored in settings and used for BC MCP calls
 */

import {
  PublicClientApplication,
  type DeviceCodeRequest,
  type AuthenticationResult,
  type AccountInfo,
} from '@azure/msal-node';
import { getSetting, setSetting } from '../db/repository.js';

// Azure CLI first-party client ID — no app registration required
const AZURE_CLI_CLIENT_ID = '04b07795-8ddb-461a-bbee-02f9e1bf7b46';

// BC API scope
const BC_SCOPES = ['https://dynamics.microsoft.com/.default'];

interface PendingAuth {
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  completed: boolean;
  result?: AuthenticationResult;
  error?: string;
}

let msalApp: PublicClientApplication | null = null;
let pendingAuth: PendingAuth | null = null;
let cachedAccount: AccountInfo | null = null;

function getMsalApp(tenantId: string): PublicClientApplication {
  const authority = `https://login.microsoftonline.com/${tenantId || 'organizations'}`;

  if (msalApp) return msalApp;

  msalApp = new PublicClientApplication({
    auth: {
      clientId: AZURE_CLI_CLIENT_ID,
      authority,
    },
  });

  return msalApp;
}

/**
 * Start the device code flow.
 * Returns the user code and verification URL for the user to complete.
 */
export async function startDeviceCodeFlow(tenantId: string): Promise<{
  userCode: string;
  verificationUri: string;
  message: string;
}> {
  // Reset if previous flow was pending
  pendingAuth = null;
  msalApp = null; // Force re-create with potentially new tenant

  const app = getMsalApp(tenantId);

  return new Promise((outerResolve, outerReject) => {
    const deviceCodeRequest: DeviceCodeRequest = {
      scopes: BC_SCOPES,
      deviceCodeCallback: (response) => {
        // This fires when the device code is ready
        pendingAuth = {
          userCode: response.userCode,
          verificationUri: response.verificationUri,
          expiresAt: Date.now() + (response.expiresIn * 1000),
          completed: false,
        };

        outerResolve({
          userCode: response.userCode,
          verificationUri: response.verificationUri,
          message: response.message,
        });
      },
    };

    // Start the flow — this runs in the background until user completes or timeout
    app.acquireTokenByDeviceCode(deviceCodeRequest)
      .then((result) => {
        if (result && pendingAuth) {
          pendingAuth.completed = true;
          pendingAuth.result = result;
          cachedAccount = result.account;

          // Auto-store the token
          setSetting('bc_access_token', result.accessToken);
          setSetting('bc_auth_type', 'bearer');
          console.log(`[Auth] Device code flow completed for: ${result.account?.username}`);
        }
      })
      .catch((err) => {
        if (pendingAuth) {
          pendingAuth.completed = true;
          pendingAuth.error = err.message || 'Authentication failed';
        }
        console.error('[Auth] Device code flow error:', err.message);
      });
  });
}

/**
 * Poll for completion of the device code flow.
 */
export function pollDeviceCodeStatus(): {
  status: 'pending' | 'completed' | 'error' | 'expired' | 'none';
  username?: string;
  error?: string;
} {
  if (!pendingAuth) {
    return { status: 'none' };
  }

  if (pendingAuth.completed) {
    if (pendingAuth.error) {
      return { status: 'error', error: pendingAuth.error };
    }
    if (pendingAuth.result) {
      return {
        status: 'completed',
        username: pendingAuth.result.account?.username || 'unknown',
      };
    }
  }

  if (Date.now() > pendingAuth.expiresAt) {
    return { status: 'expired' };
  }

  return { status: 'pending' };
}

/**
 * Try to silently refresh the token using cached account.
 */
export async function refreshToken(tenantId: string): Promise<string | null> {
  if (!cachedAccount) return null;

  try {
    const app = getMsalApp(tenantId);
    const result = await app.acquireTokenSilent({
      scopes: BC_SCOPES,
      account: cachedAccount,
    });
    if (result) {
      setSetting('bc_access_token', result.accessToken);
      return result.accessToken;
    }
  } catch {
    // Silent refresh failed — user needs to re-auth
  }
  return null;
}

/**
 * Get current auth status.
 */
export function getAuthStatus(): {
  signedIn: boolean;
  username: string;
} {
  const token = getSetting('bc_access_token');
  return {
    signedIn: !!token && token.length > 0,
    username: cachedAccount?.username || '',
  };
}

/**
 * Sign out — clear cached token and account.
 */
export function signOut(): void {
  cachedAccount = null;
  pendingAuth = null;
  msalApp = null;
  setSetting('bc_access_token', '');
  setSetting('bc_auth_type', 'none');
}
