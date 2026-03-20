/**
 * MSAL (Microsoft Entra ID) authentication for Business Central MCP.
 *
 * How it works:
 * 1. User enters their Entra ID App Registration details in Settings
 *    (Client ID, Tenant ID, optional redirect URI).
 * 2. Clicking "Sign in with Microsoft" triggers the MSAL popup/redirect flow.
 * 3. On success, an access token scoped to BC is acquired and stored.
 * 4. The token is sent to the backend, which uses it as Bearer token for MCP calls.
 *
 * Required Azure setup:
 *   - Register an app in Azure Portal → App registrations
 *   - Add a Single-page application (SPA) redirect URI: http://localhost:5173
 *   - Under API permissions, add: Dynamics 365 Business Central → user_impersonation
 *   - Grant admin consent (or let users consent on first sign-in)
 */

import {
  PublicClientApplication,
  type Configuration,
  type AuthenticationResult,
  type AccountInfo,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';

// BC API scope — this is the standard scope for Business Central API access
const BC_SCOPE = 'https://dynamics.microsoft.com/.default';

let msalInstance: PublicClientApplication | null = null;
let currentAccount: AccountInfo | null = null;

export interface EntraConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
}

function buildMsalConfig(config: EntraConfig): Configuration {
  return {
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: config.redirectUri || window.location.origin,
    },
    cache: {
      cacheLocation: 'localStorage',
    },
  };
}

export async function initializeMsal(config: EntraConfig): Promise<void> {
  if (msalInstance) {
    msalInstance = null;
    currentAccount = null;
  }

  const msalConfig = buildMsalConfig(config);
  msalInstance = new PublicClientApplication(msalConfig);
  await msalInstance.initialize();

  // Handle redirect response (if coming back from redirect login)
  try {
    const response = await msalInstance.handleRedirectPromise();
    if (response) {
      currentAccount = response.account;
    }
  } catch (err) {
    console.error('[MSAL] Redirect handling error:', err);
  }

  // Check for existing session
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    currentAccount = accounts[0];
  }
}

export function isSignedIn(): boolean {
  return currentAccount !== null;
}

export function getAccount(): AccountInfo | null {
  return currentAccount;
}

export async function signIn(): Promise<AuthenticationResult | null> {
  if (!msalInstance) throw new Error('MSAL not initialized. Configure Entra ID in Settings first.');

  try {
    const result = await msalInstance.loginPopup({
      scopes: [BC_SCOPE],
    });
    currentAccount = result.account;
    return result;
  } catch (err) {
    console.error('[MSAL] Login error:', err);
    throw err;
  }
}

export async function signOut(): Promise<void> {
  if (!msalInstance) return;
  try {
    await msalInstance.logoutPopup({
      account: currentAccount ?? undefined,
    });
  } catch {
    // silent
  }
  currentAccount = null;
}

/**
 * Acquire an access token for Business Central.
 * Tries silent first, falls back to popup if needed.
 */
export async function acquireBcToken(): Promise<string> {
  if (!msalInstance || !currentAccount) {
    throw new Error('Not signed in. Please sign in with Microsoft first.');
  }

  const request = {
    scopes: [BC_SCOPE],
    account: currentAccount,
  };

  try {
    const result = await msalInstance.acquireTokenSilent(request);
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const result = await msalInstance.acquireTokenPopup(request);
      currentAccount = result.account;
      return result.accessToken;
    }
    throw err;
  }
}

/**
 * Helper: acquire token and push it to the backend settings.
 */
export async function acquireAndStoreToken(
  updateSettingsFn: (data: { authType: string; accessToken: string }) => Promise<any>
): Promise<string> {
  const token = await acquireBcToken();
  await updateSettingsFn({ authType: 'bearer', accessToken: token });
  return token;
}
