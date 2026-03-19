"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessageSchema = exports.CreateInteractionSchema = exports.InteractionType = exports.ChangeStageSchema = exports.UpdateLeadSchema = exports.CreateLeadSchema = exports.LeadSource = exports.LeadStage = void 0;
const zod_1 = require("zod");
exports.LeadStage = zod_1.z.enum(['New', 'Contacted', 'Qualified', 'Disqualified', 'Converted']);
exports.LeadSource = zod_1.z.enum(['email', 'form', 'chatbot', 'manual']);
exports.CreateLeadSchema = zod_1.z.object({
    source: exports.LeadSource,
    owner: zod_1.z.string().optional().default('unassigned'),
    companyName: zod_1.z.string().min(1),
    contactName: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().optional().default(''),
    intentSummary: zod_1.z.string().optional().default(''),
    productInterest: zod_1.z.string().optional().default(''),
    consentFlags: zod_1.z.record(zod_1.z.boolean()).optional().default({}),
    rawPayload: zod_1.z.any().optional().default(null),
});
exports.UpdateLeadSchema = zod_1.z.object({
    owner: zod_1.z.string().optional(),
    companyName: zod_1.z.string().min(1).optional(),
    contactName: zod_1.z.string().min(1).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    intentSummary: zod_1.z.string().optional(),
    productInterest: zod_1.z.string().optional(),
    score: zod_1.z.number().min(0).max(100).optional(),
    nextBestAction: zod_1.z.string().optional(),
    consentFlags: zod_1.z.record(zod_1.z.boolean()).optional(),
});
exports.ChangeStageSchema = zod_1.z.object({
    stage: exports.LeadStage,
    reason: zod_1.z.string().optional().default(''),
});
exports.InteractionType = zod_1.z.enum(['email', 'call', 'meeting', 'note', 'system']);
exports.CreateInteractionSchema = zod_1.z.object({
    leadId: zod_1.z.string().uuid(),
    type: exports.InteractionType,
    content: zod_1.z.string().min(1),
    meta: zod_1.z.any().optional().default(null),
});
// Agent chat types
exports.ChatMessageSchema = zod_1.z.object({
    message: zod_1.z.string().min(1),
    confirmAction: zod_1.z.string().optional(),
});
//# sourceMappingURL=schemas.js.map