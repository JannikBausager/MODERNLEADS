import { Router, type Router as RouterType } from 'express';
import { CreateInteractionSchema } from '@modernleads/shared';
import { createInteraction, getInteractions } from '../db/repository.js';
import { logTelemetry } from '../db/repository.js';

const router: RouterType = Router();

// GET / — list interactions (leadId required)
router.get('/', (req, res) => {
  const leadId = req.query.leadId as string | undefined;
  if (!leadId) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'leadId query parameter is required' },
    });
    return;
  }
  const interactions = getInteractions(leadId);
  res.json(interactions);
});

// POST / — create interaction
router.post('/', (req, res) => {
  const parsed = CreateInteractionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid interaction data', details: parsed.error.flatten() },
    });
    return;
  }
  try {
    const interaction = createInteraction(parsed.data);
    logTelemetry('interaction_added', interaction.id, { leadId: interaction.leadId, type: interaction.type });
    res.status(201).json(interaction);
  } catch (err: any) {
    if (err.message === 'Lead not found') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
      return;
    }
    throw err;
  }
});

export default router;
