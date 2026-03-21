import { v4 as uuid } from 'uuid';
import { db } from './database.js';
import type {
  Lead,
  Interaction,
  Opportunity,
  CreateLeadInput,
  UpdateLeadInput,
} from '@modernleads/shared';

// Valid stage transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  New: ['Contacted'],
  Contacted: ['Qualified', 'Disqualified'],
  Qualified: ['Converted', 'Disqualified'],
  Disqualified: ['Contacted'],
  Converted: [],
};

function parseLeadRow(row: any): Lead {
  return {
    ...row,
    consentFlags: JSON.parse(row.consentFlags ?? '{}'),
    rawPayload: JSON.parse(row.rawPayload ?? 'null'),
    enrichedFields: JSON.parse(row.enrichedFields ?? '{}'),
  };
}

function parseInteractionRow(row: any): Interaction {
  return {
    ...row,
    meta: JSON.parse(row.meta ?? 'null'),
  };
}

export function createLead(input: CreateLeadInput): Lead {
  const id = uuid();
  const stmt = db.prepare(`
    INSERT INTO leads (id, source, owner, companyName, contactName, email, phone, intentSummary, productInterest, consentFlags, rawPayload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    input.source,
    input.owner ?? 'unassigned',
    input.companyName,
    input.contactName,
    input.email,
    input.phone ?? '',
    input.intentSummary ?? '',
    input.productInterest ?? '',
    JSON.stringify(input.consentFlags ?? {}),
    JSON.stringify(input.rawPayload ?? null),
  );
  return getLead(id)!;
}

export function getLead(id: string): Lead | null {
  const stmt = db.prepare('SELECT * FROM leads WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return parseLeadRow(row);
}

export function listLeads(filters?: { stage?: string; search?: string }): Lead[] {
  let query = 'SELECT * FROM leads';
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters?.stage) {
    conditions.push('stage = ?');
    params.push(filters.stage);
  }
  if (filters?.search) {
    conditions.push('(companyName LIKE ? OR contactName LIKE ? OR email LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY createdAt DESC';

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];
  return rows.map(parseLeadRow);
}

export function updateLead(id: string, input: UpdateLeadInput): Lead {
  const existing = getLead(id);
  if (!existing) throw new Error('Lead not found');

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (key === 'consentFlags') {
      fields.push('consentFlags = ?');
      values.push(JSON.stringify(value));
    } else {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  values.push(id);
  const stmt = db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
  return getLead(id)!;
}

export function changeStage(id: string, stage: string): Lead {
  const existing = getLead(id);
  if (!existing) throw new Error('Lead not found');

  const allowed = VALID_TRANSITIONS[existing.stage] ?? [];
  if (!allowed.includes(stage)) {
    throw new Error(`Invalid stage transition from '${existing.stage}' to '${stage}'`);
  }

  const stmt = db.prepare('UPDATE leads SET stage = ? WHERE id = ?');
  stmt.run(stage, id);
  return getLead(id)!;
}

export function createInteraction(input: { leadId: string; type: string; content: string; meta?: any }): Interaction {
  const lead = getLead(input.leadId);
  if (!lead) throw new Error('Lead not found');

  const id = uuid();
  const stmt = db.prepare(`
    INSERT INTO interactions (id, leadId, type, content, meta)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, input.leadId, input.type, input.content, JSON.stringify(input.meta ?? null));

  // Update lead's lastInteractionAt
  const updateStmt = db.prepare('UPDATE leads SET lastInteractionAt = datetime(\'now\') WHERE id = ?');
  updateStmt.run(input.leadId);

  const getStmt = db.prepare('SELECT * FROM interactions WHERE id = ?');
  const row = getStmt.get(id) as any;
  return parseInteractionRow(row);
}

export function getInteractions(leadId: string): Interaction[] {
  const stmt = db.prepare('SELECT * FROM interactions WHERE leadId = ? ORDER BY timestamp DESC');
  const rows = stmt.all(leadId) as any[];
  return rows.map(parseInteractionRow);
}

export function createOpportunity(data: Omit<Opportunity, 'createdAt'>): Opportunity {
  const stmt = db.prepare(`
    INSERT INTO opportunities (id, bcOpportunityId, leadId, name, value, stage, closeDate, accountRef, contactRef)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.id,
    data.bcOpportunityId,
    data.leadId,
    data.name,
    data.value,
    data.stage,
    data.closeDate,
    data.accountRef,
    data.contactRef,
  );

  const getStmt = db.prepare('SELECT * FROM opportunities WHERE id = ?');
  return getStmt.get(data.id) as unknown as Opportunity;
}

export function listOpportunities(): Opportunity[] {
  const stmt = db.prepare('SELECT * FROM opportunities ORDER BY createdAt DESC');
  return stmt.all() as unknown as Opportunity[];
}

export function logTelemetry(event: string, entityId: string, payload?: any): void {
  const stmt = db.prepare(`
    INSERT INTO telemetry (event, entityId, payload)
    VALUES (?, ?, ?)
  `);
  stmt.run(event, entityId, JSON.stringify(payload ?? {}));
}

// Settings helpers

export function getSetting(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key) as any;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, datetime(\'now\'))');
  stmt.run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const stmt = db.prepare('SELECT key, value FROM settings');
  const rows = stmt.all() as any[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function getBcSettings(): {
  tenant: string;
  environment: string;
  company: string;
  mcpConfig: string;
  authType: string;
  accessToken: string;
  enabled: boolean;
} {
  return {
    tenant: getSetting('bc_tenant') || '',
    environment: getSetting('bc_environment') || '',
    company: getSetting('bc_company') || '',
    mcpConfig: getSetting('bc_mcp_config') || '',
    authType: getSetting('bc_auth_type') || 'none',
    accessToken: getSetting('bc_access_token') || '',
    enabled: getSetting('bc_mcp_enabled') === 'true',
  };
}

// Scoring settings
const WEIGHT_KEY_MAP: Record<string, string> = {
  companySize: 'app_scoring_weight_company_size',
  engagement: 'app_scoring_weight_engagement',
  intent: 'app_scoring_weight_intent',
  budget: 'app_scoring_weight_budget',
  decisionMaker: 'app_scoring_weight_decision_maker',
};

export function getScoringSettings() {
  const weights: Record<string, number> = {};
  for (const [camel, dbKey] of Object.entries(WEIGHT_KEY_MAP)) {
    weights[camel] = parseInt(getSetting(dbKey) || '0', 10);
  }
  return {
    enabled: getSetting('app_scoring_enabled') === 'true',
    weights,
    hotThreshold: parseInt(getSetting('app_scoring_hot_threshold') || '70', 10),
    autoQualifyScore: parseInt(getSetting('app_scoring_auto_qualify_score') || '85', 10),
  };
}

export function setScoringSettings(data: {
  enabled?: boolean;
  weights?: Record<string, number>;
  hotThreshold?: number;
  autoQualifyScore?: number;
}) {
  if (data.enabled !== undefined) setSetting('app_scoring_enabled', String(data.enabled));
  if (data.weights) {
    for (const [camel, value] of Object.entries(data.weights)) {
      const dbKey = WEIGHT_KEY_MAP[camel];
      if (dbKey) setSetting(dbKey, String(value));
    }
  }
  if (data.hotThreshold !== undefined) setSetting('app_scoring_hot_threshold', String(data.hotThreshold));
  if (data.autoQualifyScore !== undefined) setSetting('app_scoring_auto_qualify_score', String(data.autoQualifyScore));
  return getScoringSettings();
}

// Notification settings
export function getNotificationSettings() {
  return {
    newLead: getSetting('app_notif_new_lead') === 'true',
    stageChange: getSetting('app_notif_stage_change') === 'true',
    goingCold: getSetting('app_notif_going_cold') === 'true',
    dailySummary: getSetting('app_notif_daily_summary') === 'true',
  };
}

export function setNotificationSettings(data: Record<string, boolean>) {
  const keyMap: Record<string, string> = {
    newLead: 'app_notif_new_lead',
    stageChange: 'app_notif_stage_change',
    goingCold: 'app_notif_going_cold',
    dailySummary: 'app_notif_daily_summary',
  };
  for (const [field, dbKey] of Object.entries(keyMap)) {
    if (data[field] !== undefined) setSetting(dbKey, String(data[field]));
  }
  return getNotificationSettings();
}

// General app settings
export function getGeneralSettings() {
  return {
    defaultOwner: getSetting('app_general_default_owner') || '',
    timezone: getSetting('app_general_timezone') || 'UTC',
    autoAssign: getSetting('app_general_auto_assign') === 'true',
    leadSources: (getSetting('app_general_lead_sources') || '').split(',').filter(Boolean),
  };
}

export function setGeneralSettings(data: {
  defaultOwner?: string;
  timezone?: string;
  autoAssign?: boolean;
  leadSources?: string[];
}) {
  if (data.defaultOwner !== undefined) setSetting('app_general_default_owner', data.defaultOwner);
  if (data.timezone !== undefined) setSetting('app_general_timezone', data.timezone);
  if (data.autoAssign !== undefined) setSetting('app_general_auto_assign', String(data.autoAssign));
  if (data.leadSources !== undefined) setSetting('app_general_lead_sources', data.leadSources.join(','));
  return getGeneralSettings();
}

// Entra ID settings
export function getEntraSettings() {
  return {
    clientId: getSetting('entra_client_id') || '',
    tenantId: getSetting('entra_tenant_id') || '',
    redirectUri: getSetting('entra_redirect_uri') || 'http://localhost:5173',
  };
}

export function setEntraSettings(data: {
  clientId?: string;
  tenantId?: string;
  redirectUri?: string;
}) {
  if (data.clientId !== undefined) setSetting('entra_client_id', data.clientId);
  if (data.tenantId !== undefined) setSetting('entra_tenant_id', data.tenantId);
  if (data.redirectUri !== undefined) setSetting('entra_redirect_uri', data.redirectUri);
  return getEntraSettings();
}

// Agent Charter settings

const DEFAULT_CORE_PRIORITIES = `You are a lead management agent for a growing SMB. Your core mission is to identify, nurture, and convert the most promising leads into customers. Focus on:

1. **Qualification Speed** — Quickly assess whether a new lead matches our ideal customer profile (SMB, 50–500 employees, decision-maker role). Don't let leads sit in "New" for more than 24 hours.

2. **Personalized Outreach** — Tailor every touchpoint to the lead's industry, role, and engagement history. Reference specific actions they've taken (e.g., "I noticed you liked our post about…").

3. **Multi-Channel Engagement** — Don't rely on email alone. Use LinkedIn, phone calls, and chat to reach leads where they're most active. Prioritize the channel with the highest past response rate.

4. **Follow-Up Discipline** — Never let a warm lead go cold. Follow up within 48 hours of any engagement signal. If a lead has gone quiet for 5+ days, re-engage with fresh value (case study, invite, insight).

5. **Pipeline Hygiene** — Keep stages accurate. Move stale leads to Disqualified rather than letting them linger. A clean pipeline is a predictable pipeline.

6. **Value-First Communication** — Always lead with value, not a sales pitch. Share relevant content, industry insights, or event invitations before asking for a meeting.

7. **Conversion Focus** — For qualified leads, build urgency by tying your solution to their specific pain points and timelines. Aim to convert within 30 days of qualification.`;

export function getAgentCharter() {
  const corePriorities = getSetting('agent_charter_core_priorities');
  const challenges = getSetting('agent_charter_challenges');
  const growth = getSetting('agent_charter_growth');
  return {
    corePriorities: corePriorities ?? DEFAULT_CORE_PRIORITIES,
    challenges: challenges ? JSON.parse(challenges) : [],
    growthOpportunities: growth ? JSON.parse(growth) : [],
  };
}

export function setAgentCharter(data: {
  corePriorities?: string;
  challenges?: Array<{ id: string; description: string; response: string }>;
  growthOpportunities?: Array<{ id: string; description: string }>;
}) {
  if (data.corePriorities !== undefined) setSetting('agent_charter_core_priorities', data.corePriorities);
  if (data.challenges !== undefined) setSetting('agent_charter_challenges', JSON.stringify(data.challenges));
  if (data.growthOpportunities !== undefined) setSetting('agent_charter_growth', JSON.stringify(data.growthOpportunities));
  return getAgentCharter();
}

// LinkedIn settings

function maskSecret(value: string): string {
  if (!value || value.length <= 6) return value ? '••••••' : '';
  return '••••••' + value.slice(-6);
}

export function getLinkedInSettings() {
  return {
    clientId: getSetting('linkedin_client_id') || '',
    clientSecret: maskSecret(getSetting('linkedin_client_secret') || ''),
    redirectUri: getSetting('linkedin_redirect_uri') || 'http://localhost:5173/auth/linkedin/callback',
    accessToken: maskSecret(getSetting('linkedin_access_token') || ''),
    enabled: getSetting('linkedin_enabled') === 'true',
    hasToken: !!(getSetting('linkedin_access_token')),
    hasSecret: !!(getSetting('linkedin_client_secret')),
  };
}

export function setLinkedInSettings(data: {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  accessToken?: string;
  enabled?: boolean;
}) {
  if (data.clientId !== undefined) setSetting('linkedin_client_id', data.clientId);
  if (data.clientSecret !== undefined) setSetting('linkedin_client_secret', data.clientSecret);
  if (data.redirectUri !== undefined) setSetting('linkedin_redirect_uri', data.redirectUri);
  if (data.accessToken !== undefined) setSetting('linkedin_access_token', data.accessToken);
  if (data.enabled !== undefined) setSetting('linkedin_enabled', data.enabled ? 'true' : 'false');
  return getLinkedInSettings();
}

// LinkedIn scoring rules

export interface LinkedInScoringRule {
  id: string;
  category: string;
  signal: string;
  description: string;
  score: number;
  enabled: number;
  isDefault: number;
  createdAt: string;
}

export function getLinkedInScoringRules(): LinkedInScoringRule[] {
  const stmt = db.prepare('SELECT * FROM linkedin_scoring_rules ORDER BY category, score DESC');
  return stmt.all() as LinkedInScoringRule[];
}

export function upsertLinkedInScoringRule(rule: {
  id: string;
  category: string;
  signal: string;
  description: string;
  score: number;
  enabled?: number;
  isDefault?: number;
}) {
  const stmt = db.prepare(`
    INSERT INTO linkedin_scoring_rules (id, category, signal, description, score, enabled, isDefault)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      signal = excluded.signal,
      description = excluded.description,
      score = excluded.score,
      enabled = excluded.enabled
  `);
  stmt.run(
    rule.id,
    rule.category,
    rule.signal,
    rule.description,
    rule.score,
    rule.enabled ?? 1,
    rule.isDefault ?? 0,
  );
  const get = db.prepare('SELECT * FROM linkedin_scoring_rules WHERE id = ?');
  return get.get(rule.id) as LinkedInScoringRule;
}

export function deleteLinkedInScoringRule(id: string): boolean {
  const existing = db.prepare('SELECT isDefault FROM linkedin_scoring_rules WHERE id = ?').get(id) as any;
  if (!existing) return false;
  if (existing.isDefault === 1) return false;
  db.prepare('DELETE FROM linkedin_scoring_rules WHERE id = ?').run(id);
  return true;
}

export function resetLinkedInScoringDefaults(): void {
  db.prepare('DELETE FROM linkedin_scoring_rules').run();
  const ins = db.prepare(
    `INSERT OR IGNORE INTO linkedin_scoring_rules (id, category, signal, description, score, enabled, isDefault) VALUES (?, ?, ?, ?, ?, 1, 1)`
  );
  const defaults: [string, string, string, string, number][] = [
    ['like_reaction', 'engagement', 'like_reaction', 'Like or Reaction on your post', 2],
    ['comment_post', 'engagement', 'comment_post', 'Comment on your post', 8],
    ['share_reshare', 'engagement', 'share_reshare', 'Share/Reshare of your post', 10],
    ['inbound_connection', 'engagement', 'inbound_connection', 'Inbound connection request', 15],
    ['direct_message', 'engagement', 'direct_message', 'Direct message or InMail reply', 20],
    ['profile_view', 'engagement', 'profile_view', 'Profile view by target prospect', 5],
    ['follow', 'engagement', 'follow', 'Follow your profile or company page', 3],
    ['repeat_engagement', 'engagement', 'repeat_engagement', 'Multiple/repeat engagements', 5],
    ['company_size_smb', 'fit', 'company_size_smb', 'Company size fits SMB target (50-500 employees)', 10],
    ['target_industry', 'fit', 'target_industry', 'Industry is a target vertical', 5],
    ['senior_decision_maker', 'fit', 'senior_decision_maker', 'Role is senior decision-maker (CxO, VP, Director)', 10],
    ['target_location', 'fit', 'target_location', 'Location in target market (supported region)', 2],
    ['low_value_role', 'negative', 'low_value_role', 'Low-value role or student (not a decision-maker)', -5],
    ['company_too_large', 'negative', 'company_too_large', 'Company too large or not SMB (>1000 employees)', -10],
    ['non_target_industry', 'negative', 'non_target_industry', 'Non-target industry (unrelated sector)', -5],
    ['competitor_vendor', 'negative', 'competitor_vendor', 'Competitor or vendor company (not a buyer)', 0],
    ['stale_lead', 'decay', 'stale_lead', 'No recent engagement (score decays over time)', -2],
  ];
  for (const d of defaults) {
    ins.run(...d);
  }
}
