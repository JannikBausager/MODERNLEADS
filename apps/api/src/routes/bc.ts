import { Router, type Router as RouterType } from 'express';
import { getBcSettings } from '../db/repository.js';

const router: RouterType = Router();

// GET /api/bc/customers — get customers from BC via MCP
router.get('/customers', async (req, res, next) => {
  try {
    const settings = getBcSettings();
    if (!settings.enabled || !settings.accessToken) {
      res.json({
        source: 'mock',
        data: getMockCustomers(),
        message: 'BC MCP not configured. Showing mock data.',
      });
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
    const settings = getBcSettings();
    if (!settings.enabled || !settings.accessToken) {
      res.json({
        source: 'mock',
        data: getMockContracts(),
        message: 'BC MCP not configured. Showing mock data.',
      });
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
    const settings = getBcSettings();
    if (!settings.enabled || !settings.accessToken) {
      res.json({
        source: 'mock',
        data: getMockOpportunities(),
        message: 'BC MCP not configured. Showing mock data.',
      });
      return;
    }

    try {
      const { callMcpTool } = await import('../bcAdapter/mcpClient.js');
      const result = await callMcpTool('getOpportunities', {
        company: settings.company,
      });
      let data: any[] = [];
      if (result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === 'text') {
            try { data = JSON.parse(item.text); } catch { data = [item.text]; }
          }
        }
      }
      res.json({ source: 'bc', data: Array.isArray(data) ? data : [] });
    } catch (err: any) {
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
