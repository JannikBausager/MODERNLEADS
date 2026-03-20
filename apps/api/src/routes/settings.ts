import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import {
  getBcSettings, setSetting,
  getScoringSettings, setScoringSettings,
  getNotificationSettings, setNotificationSettings,
  getGeneralSettings, setGeneralSettings,
  getEntraSettings, setEntraSettings,
} from '../db/repository.js';

const router: RouterType = Router();

const BcSettingsSchema = z.object({
  tenant: z.string().min(1).optional(),
  environment: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  mcpConfig: z.string().min(1).optional(),
  authType: z.enum(['none', 'bearer']).optional(),
  accessToken: z.string().optional(),
  enabled: z.boolean().optional(),
});

// GET /api/settings/bc — get BC MCP configuration
router.get('/bc', (_req, res) => {
  const settings = getBcSettings();
  // Don't expose the full access token
  res.json({
    ...settings,
    accessToken: settings.accessToken ? '••••••' + settings.accessToken.slice(-6) : '',
    hasToken: !!settings.accessToken,
  });
});

// PUT /api/settings/bc — update BC MCP configuration
router.put('/bc', (req, res) => {
  const parsed = BcSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid settings', details: parsed.error.flatten() },
    });
    return;
  }

  const data = parsed.data;
  if (data.tenant !== undefined) setSetting('bc_tenant', data.tenant);
  if (data.environment !== undefined) setSetting('bc_environment', data.environment);
  if (data.company !== undefined) setSetting('bc_company', data.company);
  if (data.mcpConfig !== undefined) setSetting('bc_mcp_config', data.mcpConfig);
  if (data.authType !== undefined) setSetting('bc_auth_type', data.authType);
  if (data.accessToken !== undefined) setSetting('bc_access_token', data.accessToken);
  if (data.enabled !== undefined) setSetting('bc_mcp_enabled', data.enabled ? 'true' : 'false');

  const settings = getBcSettings();
  res.json({
    ...settings,
    accessToken: settings.accessToken ? '••••••' + settings.accessToken.slice(-6) : '',
    hasToken: !!settings.accessToken,
  });
});

// POST /api/settings/bc/test — test BC MCP connection
router.post('/bc/test', async (req, res, next) => {
  try {
    const settings = getBcSettings();
    if (!settings.enabled) {
      res.json({ success: false, message: 'BC MCP integration is not enabled. Enable it in settings first.' });
      return;
    }
    if (!settings.accessToken) {
      res.json({ success: false, message: 'No access token configured. Add a bearer token in settings.' });
      return;
    }

    const { listMcpTools, disconnectClient } = await import('../bcAdapter/mcpClient.js');
    try {
      const tools = await listMcpTools();
      res.json({
        success: true,
        message: `Connected successfully! Found ${tools.length} available tool(s).`,
        tools: tools.map((t: any) => ({ name: t.name, description: t.description })),
      });
    } catch (err: any) {
      await disconnectClient();
      res.json({
        success: false,
        message: `Connection failed: ${err.message}`,
      });
    }
  } catch (err) {
    next(err);
  }
});

// === General Settings ===

router.get('/general', (_req, res) => {
  res.json(getGeneralSettings());
});

router.put('/general', (req, res) => {
  const result = setGeneralSettings(req.body);
  res.json(result);
});

// === Scoring Settings ===

router.get('/scoring', (_req, res) => {
  res.json(getScoringSettings());
});

router.put('/scoring', (req, res) => {
  const result = setScoringSettings(req.body);
  res.json(result);
});

// === Notification Settings ===

router.get('/notifications', (_req, res) => {
  res.json(getNotificationSettings());
});

router.put('/notifications', (req, res) => {
  const result = setNotificationSettings(req.body);
  res.json(result);
});

// === Entra ID Settings ===

router.get('/entra', (_req, res) => {
  res.json(getEntraSettings());
});

router.put('/entra', (req, res) => {
  const result = setEntraSettings(req.body);
  res.json(result);
});

export default router;
