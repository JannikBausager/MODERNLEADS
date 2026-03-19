import { Router, type Router as RouterType } from 'express';
import { CreateLeadSchema, UpdateLeadSchema, ChangeStageSchema } from '@modernleads/shared';
import { v4 as uuid } from 'uuid';
import { db } from '../db/database.js';
import {
  createLead,
  getLead,
  listLeads,
  updateLead,
  changeStage,
  createOpportunity,
  logTelemetry,
} from '../db/repository.js';
import { mapLeadToOpportunity, toBcPayload } from '../conversion/mapping.js';
import { createBcOpportunity } from '../bcAdapter/client.js';

const router: RouterType = Router();

// POST / — create lead
router.post('/', (req, res) => {
  const parsed = CreateLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid lead data', details: parsed.error.flatten() },
    });
    return;
  }
  const lead = createLead(parsed.data);
  logTelemetry('lead_created', lead.id, { source: lead.source });
  res.status(201).json(lead);
});

// GET / — list leads
router.get('/', (req, res) => {
  const stage = req.query.stage as string | undefined;
  const search = req.query.search as string | undefined;
  const leads = listLeads({ stage, search });
  res.json(leads);
});

// GET /prioritized — leads sorted by score desc, excluding Converted/Disqualified
router.get('/prioritized', (req, res) => {
  const all = listLeads();
  const prioritized = all
    .filter(l => l.stage !== 'Converted' && l.stage !== 'Disqualified')
    .sort((a, b) => b.score - a.score);
  res.json(prioritized);
});

// GET /:id — get single lead
router.get('/:id', (req, res) => {
  const lead = getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    return;
  }
  res.json(lead);
});

// PATCH /:id — update lead
router.patch('/:id', (req, res) => {
  const parsed = UpdateLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid update data', details: parsed.error.flatten() },
    });
    return;
  }
  try {
    const lead = updateLead(req.params.id, parsed.data);
    res.json(lead);
  } catch (err: any) {
    if (err.message === 'Lead not found') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
      return;
    }
    throw err;
  }
});

// POST /:id/stage — change stage
router.post('/:id/stage', (req, res) => {
  const parsed = ChangeStageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid stage data', details: parsed.error.flatten() },
    });
    return;
  }
  try {
    const lead = changeStage(req.params.id, parsed.data.stage);
    logTelemetry('stage_changed', lead.id, { stage: lead.stage, reason: parsed.data.reason });
    res.json(lead);
  } catch (err: any) {
    if (err.message === 'Lead not found') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
      return;
    }
    if (err.message.startsWith('Invalid stage transition')) {
      res.status(400).json({ error: { code: 'INVALID_TRANSITION', message: err.message } });
      return;
    }
    throw err;
  }
});

// POST /:id/enrich — enrichment stub
router.post('/:id/enrich', (req, res) => {
  try {
    const lead = getLead(req.params.id);
    if (!lead) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
      return;
    }

    const enrichedFields = {
      ...lead.enrichedFields,
      industry: 'Technology',
      companySize: '50-200',
      website: `https://${lead.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
    };
    const newScore = Math.min(lead.score + 10, 100);

    updateLead(req.params.id, { score: newScore, consentFlags: lead.consentFlags });

    // Update enrichedFields directly since it's a JSON column
    db.prepare('UPDATE leads SET enrichedFields = ? WHERE id = ?').run(
      JSON.stringify(enrichedFields),
      req.params.id,
    );

    const updated = getLead(req.params.id)!;
    logTelemetry('lead_enriched', updated.id, { enrichedFields });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'Lead not found') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
      return;
    }
    throw err;
  }
});

// POST /:id/convert — convert lead to opportunity
router.post('/:id/convert', async (req, res, next) => {
  try {
    const lead = getLead(req.params.id);
    if (!lead) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
      return;
    }
    if (lead.stage !== 'Qualified') {
      res.status(400).json({
        error: { code: 'INVALID_STATE', message: 'Lead must be in Qualified stage to convert' },
      });
      return;
    }

    const conversionResult = mapLeadToOpportunity(lead);
    const bcPayload = toBcPayload(conversionResult);
    const bcResponse = await createBcOpportunity(bcPayload);

    // Change stage to Converted
    changeStage(req.params.id, 'Converted');

    // Create opportunity record
    const oppId = uuid();
    const opportunity = createOpportunity({
      id: oppId,
      bcOpportunityId: bcResponse.bcOpportunityId,
      leadId: lead.id,
      name: conversionResult.opportunityName,
      value: conversionResult.value,
      stage: conversionResult.stage,
      closeDate: conversionResult.closeDate,
      accountRef: conversionResult.accountRef,
      contactRef: conversionResult.contactRef,
    });

    logTelemetry('lead_converted', lead.id, { opportunityId: oppId, bcOpportunityId: bcResponse.bcOpportunityId });
    res.status(201).json(opportunity);
  } catch (err) {
    next(err);
  }
});

export default router;
