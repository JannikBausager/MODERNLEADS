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

export default router;
