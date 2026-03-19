import { z } from 'zod';
export declare const LeadStage: z.ZodEnum<["New", "Contacted", "Qualified", "Disqualified", "Converted"]>;
export type LeadStage = z.infer<typeof LeadStage>;
export declare const LeadSource: z.ZodEnum<["email", "form", "chatbot", "manual"]>;
export type LeadSource = z.infer<typeof LeadSource>;
export declare const CreateLeadSchema: z.ZodObject<{
    source: z.ZodEnum<["email", "form", "chatbot", "manual"]>;
    owner: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    companyName: z.ZodString;
    contactName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    intentSummary: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    productInterest: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    consentFlags: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>>;
    rawPayload: z.ZodDefault<z.ZodOptional<z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    source: "email" | "form" | "chatbot" | "manual";
    owner: string;
    companyName: string;
    contactName: string;
    phone: string;
    intentSummary: string;
    productInterest: string;
    consentFlags: Record<string, boolean>;
    rawPayload?: any;
}, {
    email: string;
    source: "email" | "form" | "chatbot" | "manual";
    companyName: string;
    contactName: string;
    owner?: string | undefined;
    phone?: string | undefined;
    intentSummary?: string | undefined;
    productInterest?: string | undefined;
    consentFlags?: Record<string, boolean> | undefined;
    rawPayload?: any;
}>;
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export declare const UpdateLeadSchema: z.ZodObject<{
    owner: z.ZodOptional<z.ZodString>;
    companyName: z.ZodOptional<z.ZodString>;
    contactName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    intentSummary: z.ZodOptional<z.ZodString>;
    productInterest: z.ZodOptional<z.ZodString>;
    score: z.ZodOptional<z.ZodNumber>;
    nextBestAction: z.ZodOptional<z.ZodString>;
    consentFlags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    owner?: string | undefined;
    companyName?: string | undefined;
    contactName?: string | undefined;
    phone?: string | undefined;
    intentSummary?: string | undefined;
    productInterest?: string | undefined;
    consentFlags?: Record<string, boolean> | undefined;
    score?: number | undefined;
    nextBestAction?: string | undefined;
}, {
    email?: string | undefined;
    owner?: string | undefined;
    companyName?: string | undefined;
    contactName?: string | undefined;
    phone?: string | undefined;
    intentSummary?: string | undefined;
    productInterest?: string | undefined;
    consentFlags?: Record<string, boolean> | undefined;
    score?: number | undefined;
    nextBestAction?: string | undefined;
}>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
export declare const ChangeStageSchema: z.ZodObject<{
    stage: z.ZodEnum<["New", "Contacted", "Qualified", "Disqualified", "Converted"]>;
    reason: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    stage: "New" | "Contacted" | "Qualified" | "Disqualified" | "Converted";
    reason: string;
}, {
    stage: "New" | "Contacted" | "Qualified" | "Disqualified" | "Converted";
    reason?: string | undefined;
}>;
export type ChangeStageInput = z.infer<typeof ChangeStageSchema>;
export declare const InteractionType: z.ZodEnum<["email", "call", "meeting", "note", "system"]>;
export type InteractionType = z.infer<typeof InteractionType>;
export declare const CreateInteractionSchema: z.ZodObject<{
    leadId: z.ZodString;
    type: z.ZodEnum<["email", "call", "meeting", "note", "system"]>;
    content: z.ZodString;
    meta: z.ZodDefault<z.ZodOptional<z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    type: "email" | "call" | "meeting" | "note" | "system";
    leadId: string;
    content: string;
    meta?: any;
}, {
    type: "email" | "call" | "meeting" | "note" | "system";
    leadId: string;
    content: string;
    meta?: any;
}>;
export type CreateInteractionInput = z.infer<typeof CreateInteractionSchema>;
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
export interface ApiError {
    error: {
        code: string;
        message: string;
        details?: any;
    };
}
export declare const ChatMessageSchema: z.ZodObject<{
    message: z.ZodString;
    confirmAction: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    confirmAction?: string | undefined;
}, {
    message: string;
    confirmAction?: string | undefined;
}>;
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
export type TelemetryEvent = 'lead_created' | 'lead_enriched' | 'lead_converted' | 'stage_changed' | 'interaction_added' | 'opportunity_created';
//# sourceMappingURL=schemas.d.ts.map