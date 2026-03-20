import { Router, type Router as RouterType } from 'express';
import { getBcSettings } from '../db/repository.js';

const router: RouterType = Router();

/**
 * Helper: ensure we have a valid BC connection (token + enabled).
 * Tries to refresh the token silently if one exists in MSAL cache.
 * Returns null if ready, or a mock-fallback response object if not.
 */
async function ensureBcReady(): Promise<string | null> {
  const settings = getBcSettings();
  if (!settings.enabled) return 'BC MCP integration is not enabled.';

  // If we have a token, we're good — mcpClient will auto-refresh it
  if (settings.accessToken) return null;

  // No stored token — try refresh from MSAL cache
  try {
    const { refreshToken, getAuthStatus } = await import('../auth/deviceCodeAuth.js');
    const auth = getAuthStatus();
    if (auth.signedIn) {
      const token = await refreshToken(settings.tenant);
      if (token) return null; // refreshed successfully
    }
  } catch { /* ignore */ }

  return 'Not authenticated. Sign in via Settings → Opportunity Management.';
}

// GET /api/bc/customers — get customers from BC via MCP
router.get('/customers', async (req, res, next) => {
  try {
    const notReady = await ensureBcReady();
    if (notReady) {
      res.json({ source: 'mock', data: getMockCustomers(), message: notReady + ' Showing mock data.' });
      return;
    }

    try {
      const { getBcCustomers } = await import('../bcAdapter/mcpClient.js');
      const customers = await getBcCustomers();
      res.json({ source: 'bc', data: customers });
    } catch (err: any) {
      res.json({
        source: 'mock',
        data: getMockCustomers(),
        message: `BC MCP error: ${err.message}. Showing mock data.`,
      });
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/bc/contracts — get contracts from BC via MCP
router.get('/contracts', async (req, res, next) => {
  try {
    const notReady = await ensureBcReady();
    if (notReady) {
      res.json({ source: 'mock', data: getMockContracts(), message: notReady + ' Showing mock data.' });
      return;
    }

    try {
      const { getBcContracts } = await import('../bcAdapter/mcpClient.js');
      const contracts = await getBcContracts();
      res.json({ source: 'bc', data: contracts });
    } catch (err: any) {
      res.json({
        source: 'mock',
        data: getMockContracts(),
        message: `BC MCP error: ${err.message}. Showing mock data.`,
      });
    }
  } catch (err) {
    next(err);
  }
});

// Mock data for when MCP is not connected
function getMockCustomers() {
  return [
    { no: 'C10000', name: 'Adatum Corporation', city: 'Miami', country: 'US', balance: 0 },
    { no: 'C20000', name: 'Trey Research', city: 'Chicago', country: 'US', balance: 1500 },
    { no: 'C30000', name: 'School of Fine Art', city: 'Atlanta', country: 'US', balance: 3200 },
    { no: 'C40000', name: 'Alpine Ski House', city: 'Fort Worth', country: 'US', balance: 0 },
    { no: 'C50000', name: 'Relecloud', city: 'New York', country: 'US', balance: 750 },
  ];
}

function getMockContracts() {
  return [
    { no: 'SC1000', description: 'Annual Maintenance', customerNo: 'C10000', customerName: 'Adatum Corporation', status: 'Active', amount: 12000 },
    { no: 'SC2000', description: 'Premium Support', customerNo: 'C20000', customerName: 'Trey Research', status: 'Active', amount: 24000 },
    { no: 'SC3000', description: 'Basic Support', customerNo: 'C30000', customerName: 'School of Fine Art', status: 'Expired', amount: 6000 },
  ];
}

function getMockOpportunities() {
  return [
    { no: 'OPP1000', description: 'Enterprise Licensing', contactName: 'John Smith', salesCycleCode: 'SALES', estimatedValue: 45000, status: 'In Progress', closingDate: '2026-06-30', probability: 70 },
    { no: 'OPP2000', description: 'Cloud Migration', contactName: 'Sarah Chen', salesCycleCode: 'SALES', estimatedValue: 120000, status: 'In Progress', closingDate: '2026-08-15', probability: 45 },
    { no: 'OPP3000', description: 'Support Renewal', contactName: 'Mike Johnson', salesCycleCode: 'SERVICE', estimatedValue: 24000, status: 'Won', closingDate: '2026-03-01', probability: 100 },
  ];
}

// GET /api/bc/opportunities — get opportunities from BC via MCP
router.get('/opportunities', async (req, res, next) => {
  try {
    const notReady = await ensureBcReady();
    if (notReady) {
      res.json({ source: 'mock', data: getMockOpportunities(), message: notReady + ' Showing mock data.' });
      return;
    }

    try {
      const { getBcOpportunities } = await import('../bcAdapter/mcpClient.js');
      const data = await getBcOpportunities();
      res.json({ source: 'bc', data });
    } catch (err: any) {
      console.error('[BC Opportunities] MCP error:', err.message);
      res.json({
        source: 'mock',
        data: getMockOpportunities(),
        message: `BC MCP error: ${err.message}. Showing mock data.`,
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
