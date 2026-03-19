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
