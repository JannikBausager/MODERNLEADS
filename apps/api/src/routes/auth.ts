import { Router, type Router as RouterType } from 'express';
import {
  startDeviceCodeFlow,
  pollDeviceCodeStatus,
  getAuthStatus,
  signOut,
} from '../auth/deviceCodeAuth.js';
import { getBcSettings } from '../db/repository.js';

const router: RouterType = Router();

// POST /api/auth/device-code — start device code flow
router.post('/device-code', async (req, res, next) => {
  try {
    const settings = getBcSettings();
    const tenantId = settings.tenant.includes('.')
      ? settings.tenant  // e.g. DirectionsEmeaWorkshop1.onmicrosoft.com
      : settings.tenant;  // e.g. a GUID

    const result = await startDeviceCodeFlow(tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'AUTH_ERROR', message: err.message || 'Failed to start device code flow' },
    });
  }
});

// GET /api/auth/device-code/poll — poll for completion
router.get('/device-code/poll', (_req, res) => {
  const status = pollDeviceCodeStatus();
  res.json(status);
});

// GET /api/auth/status — get current auth status
router.get('/status', (_req, res) => {
  const status = getAuthStatus();
  res.json(status);
});

// POST /api/auth/signout — sign out
router.post('/signout', (_req, res) => {
  signOut();
  res.json({ success: true });
});

export default router;
