import { z } from 'zod';

export const LeadStage = z.enum(['New', 'Contacted', 'Qualified', 'Disqualified', 'Converted']);
export type LeadStage = z.infer<typeof LeadStage>;

export const LeadSource = z.enum(['email', 'form', 'chatbot', 'manual']);
export type LeadSource = z.infer<typeof LeadSource>;

export const CreateLeadSchema = z.object({
  source: LeadSource,
  owner: z.string().optional().default('unassigned'),
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  intentSummary: z.string().optional().default(''),
  productInterest: z.string().optional().default(''),
  consentFlags: z.record(z.boolean()).optional().default({}),
  rawPayload: z.any().optional().default(null),
});
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadSchema = z.object({
  owner: z.string().optional(),
  companyName: z.string().min(1).optional(),
  contactName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  intentSummary: z.string().optional(),
  productInterest: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  nextBestAction: z.string().optional(),
  consentFlags: z.record(z.boolean()).optional(),
});
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;

export const ChangeStageSchema = z.object({
  stage: LeadStage,
  reason: z.string().optional().default(''),
});
export type ChangeStageInput = z.infer<typeof ChangeStageSchema>;

export const InteractionType = z.enum(['email', 'call', 'meeting', 'note', 'system']);
export type InteractionType = z.infer<typeof InteractionType>;

export const CreateInteractionSchema = z.object({
  leadId: z.string().uuid(),
  type: InteractionType,
  content: z.string().min(1),
  meta: z.any().optional().default(null),
});
export type CreateInteractionInput = z.infer<typeof CreateInteractionSchema>;

// Full entity types (as returned by API)
export interface Lead {
  id: string;
  createdAt: string;
  source: LeadSource;
  owner: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  intentSummary: string;
  productInterest: string;
  stage: LeadStage;
  score: number;
  nextBestAction: string;
  lastInteractionAt: string | null;
  consentFlags: Record<string, boolean>;
  rawPayload: any;
  enrichedFields: Record<string, any>;
}

export interface Interaction {
  id: string;
  leadId: string;
  type: InteractionType;
  timestamp: string;
  content: string;
  meta: any;
}

export interface Opportunity {
  id: string;
  bcOpportunityId: string;
  leadId: string;
  name: string;
  value: number;
  stage: string;
  closeDate: string;
  accountRef: string;
  contactRef: string;
  createdAt: string;
}

// API error shape
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Agent chat types
export const ChatMessageSchema = z.object({
  message: z.string().min(1),
  confirmAction: z.string().optional(),
});
export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;

export interface AgentResponse {
  reply: string;
  action?: {
    type: string;
    description: string;
    confirmationRequired: boolean;
    actionId: string;
    params: Record<string, any>;
  };
  data?: any;
}

// Telemetry event types
export type TelemetryEvent =
  | 'lead_created'
  | 'lead_enriched'
  | 'lead_converted'
  | 'stage_changed'
  | 'interaction_added'
  | 'opportunity_created';
