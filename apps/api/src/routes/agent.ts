import { Router, type Router as RouterType } from 'express';
import { v4 as uuid } from 'uuid';
import { ChatMessageSchema } from '@modernleads/shared';
import type { AgentResponse } from '@modernleads/shared';
import { getLead, listLeads, changeStage, updateLead, logTelemetry } from '../db/repository.js';
import { mapLeadToOpportunity, toBcPayload } from '../conversion/mapping.js';
import { createBcOpportunity } from '../bcAdapter/client.js';
import { createOpportunity } from '../db/repository.js';

interface PendingAction {
  type: string;
  description: string;
  params: Record<string, any>;
  execute: () => Promise<any>;
}

const pendingActions = new Map<string, PendingAction>();

const router: RouterType = Router();

router.post('/chat', async (req, res, next) => {
  try {
    const parsed = ChatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid chat message', details: parsed.error.flatten() },
      });
      return;
    }

    const { message, confirmAction } = parsed.data;

    // Handle confirmation
    if (confirmAction) {
      const pending = pendingActions.get(confirmAction);
      if (!pending) {
        const response: AgentResponse = { reply: 'No pending action found with that ID. It may have expired.' };
        res.json(response);
        return;
      }
      pendingActions.delete(confirmAction);
      const result = await pending.execute();
      const response: AgentResponse = {
        reply: `Done! ${pending.description}`,
        data: result,
      };
      res.json(response);
      return;
    }

    const msg = message.toLowerCase().trim();

    // "show new leads" / "list leads"
    if (msg.includes('show new leads') || msg.includes('list new leads')) {
      const leads = listLeads({ stage: 'New' });
      const response: AgentResponse = {
        reply: `Found ${leads.length} new lead(s).`,
        data: leads,
      };
      res.json(response);
      return;
    }

    if (msg.includes('list leads') || msg.includes('show leads')) {
      const leads = listLeads();
      const response: AgentResponse = {
        reply: `Found ${leads.length} lead(s).`,
        data: leads,
      };
      res.json(response);
      return;
    }

    // "show lead <id>"
    const showMatch = msg.match(/show lead\s+([a-f0-9-]+)/);
    if (showMatch) {
      const lead = getLead(showMatch[1]);
      if (!lead) {
        const response: AgentResponse = { reply: 'Lead not found.' };
        res.json(response);
        return;
      }
      const response: AgentResponse = {
        reply: `Here's lead ${lead.contactName} at ${lead.companyName} (${lead.stage}).`,
        data: lead,
      };
      res.json(response);
      return;
    }

    // "prioritize" / "priority"
    if (msg.includes('prioritize') || msg.includes('priority')) {
      const all = listLeads();
      const prioritized = all
        .filter(l => l.stage !== 'Converted' && l.stage !== 'Disqualified')
        .sort((a, b) => b.score - a.score);
      const response: AgentResponse = {
        reply: `Here are ${prioritized.length} prioritized lead(s).`,
        data: prioritized,
      };
      res.json(response);
      return;
    }

    // "enrich lead <id>"
    const enrichMatch = msg.match(/enrich lead\s+([a-f0-9-]+)/);
    if (enrichMatch) {
      const leadId = enrichMatch[1];
      const lead = getLead(leadId);
      if (!lead) {
        const response: AgentResponse = { reply: 'Lead not found.' };
        res.json(response);
        return;
      }
      const actionId = uuid();
      pendingActions.set(actionId, {
        type: 'enrich',
        description: `Enriched lead ${lead.contactName} at ${lead.companyName}`,
        params: { leadId },
        execute: async () => {
          const enrichedFields = {
            ...lead.enrichedFields,
            industry: 'Technology',
            companySize: '50-200',
            website: `https://${lead.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
          };
          const newScore = Math.min(lead.score + 10, 100);
          updateLead(leadId, { score: newScore });
          const { db } = await import('../db/database.js');
          db.prepare('UPDATE leads SET enrichedFields = ? WHERE id = ?').run(JSON.stringify(enrichedFields), leadId);
          logTelemetry('lead_enriched', leadId, { enrichedFields });
          return getLead(leadId);
        },
      });
      const response: AgentResponse = {
        reply: `I'll enrich lead ${lead.contactName} at ${lead.companyName}. Please confirm.`,
        action: { type: 'enrich', description: `Enrich lead ${lead.contactName}`, confirmationRequired: true, actionId, params: { leadId } },
      };
      res.json(response);
      return;
    }

    // "convert lead <id>"
    const convertMatch = msg.match(/convert lead\s+([a-f0-9-]+)/);
    if (convertMatch) {
      const leadId = convertMatch[1];
      const lead = getLead(leadId);
      if (!lead) {
        const response: AgentResponse = { reply: 'Lead not found.' };
        res.json(response);
        return;
      }
      const actionId = uuid();
      pendingActions.set(actionId, {
        type: 'convert',
        description: `Converted lead ${lead.contactName} at ${lead.companyName} to an opportunity`,
        params: { leadId },
        execute: async () => {
          const currentLead = getLead(leadId)!;
          if (currentLead.stage !== 'Qualified') {
            throw new Error('Lead must be in Qualified stage to convert');
          }
          const conversionResult = mapLeadToOpportunity(currentLead);
          const bcPayload = toBcPayload(conversionResult);
          const bcResponse = await createBcOpportunity(bcPayload);
          changeStage(leadId, 'Converted');
          const oppId = uuid();
          const opportunity = createOpportunity({
            id: oppId,
            bcOpportunityId: bcResponse.bcOpportunityId,
            leadId,
            name: conversionResult.opportunityName,
            value: conversionResult.value,
            stage: conversionResult.stage,
            closeDate: conversionResult.closeDate,
            accountRef: conversionResult.accountRef,
            contactRef: conversionResult.contactRef,
          });
          logTelemetry('lead_converted', leadId, { opportunityId: oppId });
          return opportunity;
        },
      });
      const response: AgentResponse = {
        reply: `I'll convert lead ${lead.contactName} at ${lead.companyName} to an opportunity. Please confirm.`,
        action: { type: 'convert', description: `Convert lead ${lead.contactName}`, confirmationRequired: true, actionId, params: { leadId } },
      };
      res.json(response);
      return;
    }

    // "move lead <id> to <stage>" / "change lead <id> to <stage>"
    const stageMatch = msg.match(/(?:move|change) lead\s+([a-f0-9-]+)\s+to\s+(\w+)/);
    if (stageMatch) {
      const leadId = stageMatch[1];
      const stage = stageMatch[2].charAt(0).toUpperCase() + stageMatch[2].slice(1);
      const lead = getLead(leadId);
      if (!lead) {
        const response: AgentResponse = { reply: 'Lead not found.' };
        res.json(response);
        return;
      }
      const actionId = uuid();
      pendingActions.set(actionId, {
        type: 'change_stage',
        description: `Moved lead ${lead.contactName} to ${stage}`,
        params: { leadId, stage },
        execute: async () => {
          const updated = changeStage(leadId, stage);
          logTelemetry('stage_changed', leadId, { stage });
          return updated;
        },
      });
      const response: AgentResponse = {
        reply: `I'll move lead ${lead.contactName} to ${stage}. Please confirm.`,
        action: { type: 'change_stage', description: `Move lead to ${stage}`, confirmationRequired: true, actionId, params: { leadId, stage } },
      };
      res.json(response);
      return;
    }

    // "draft reply to lead <id>" / "draft email"
    const draftMatch = msg.match(/draft (?:reply|email)(?:\s+to)?\s+(?:lead\s+)?([a-f0-9-]+)?/);
    if (draftMatch && draftMatch[1]) {
      const lead = getLead(draftMatch[1]);
      if (!lead) {
        const response: AgentResponse = { reply: 'Lead not found.' };
        res.json(response);
        return;
      }
      const template = `Hi ${lead.contactName},\n\nThank you for your interest in ${lead.productInterest || 'our services'}. I'd love to schedule a call to discuss how we can help ${lead.companyName}.\n\nBest regards`;
      const response: AgentResponse = {
        reply: `Here's a draft reply for ${lead.contactName}:`,
        data: { draft: template },
      };
      res.json(response);
      return;
    }

    // Default
    const response: AgentResponse = {
      reply: "I can help you manage leads. Try: 'show new leads', 'prioritize my leads', 'convert lead <id>'",
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
