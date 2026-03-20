import path from 'node:path';
import fs from 'node:fs';

// Use require() for node:sqlite since Vite can't resolve it and CJS has require available
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => any };

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'crm.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode=WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL CHECK(source IN ('email','form','chatbot','manual')),
    owner TEXT NOT NULL DEFAULT 'unassigned',
    companyName TEXT NOT NULL,
    contactName TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    intentSummary TEXT DEFAULT '',
    productInterest TEXT DEFAULT '',
    stage TEXT NOT NULL DEFAULT 'New' CHECK(stage IN ('New','Contacted','Qualified','Disqualified','Converted')),
    score INTEGER DEFAULT 0 CHECK(score >= 0 AND score <= 100),
    nextBestAction TEXT DEFAULT '',
    lastInteractionAt TEXT,
    consentFlags TEXT DEFAULT '{}',
    rawPayload TEXT DEFAULT 'null',
    enrichedFields TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY,
    leadId TEXT NOT NULL REFERENCES leads(id),
    type TEXT NOT NULL CHECK(type IN ('email','call','meeting','note','system')),
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    content TEXT NOT NULL,
    meta TEXT DEFAULT 'null'
  );

  CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    bcOpportunityId TEXT NOT NULL,
    leadId TEXT NOT NULL REFERENCES leads(id),
    name TEXT NOT NULL,
    value REAL DEFAULT 0,
    stage TEXT NOT NULL DEFAULT 'Prospecting',
    closeDate TEXT NOT NULL,
    accountRef TEXT DEFAULT '',
    contactRef TEXT DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    entityId TEXT,
    payload TEXT DEFAULT '{}',
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Insert default settings
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');

// BC MCP connection defaults
insertSetting.run('bc_tenant', 'DirectionsEmeaWorkshop1.onmicrosoft.com');
insertSetting.run('bc_environment', 'PRODUCTION');
insertSetting.run('bc_company', 'CRONUS USA, Inc.');
insertSetting.run('bc_mcp_config', 'MCPleads');
insertSetting.run('bc_auth_type', 'none');
insertSetting.run('bc_access_token', '');
insertSetting.run('bc_mcp_enabled', 'false');

// Entra ID (MSAL) defaults
insertSetting.run('entra_client_id', '');
insertSetting.run('entra_tenant_id', '');
insertSetting.run('entra_redirect_uri', 'http://localhost:5173');

// App general defaults
insertSetting.run('app_general_default_owner', '');
insertSetting.run('app_general_timezone', 'UTC');
insertSetting.run('app_general_auto_assign', 'false');
insertSetting.run('app_general_lead_sources', 'email,form,chatbot,manual,linkedin,website,referral');

// Scoring defaults
insertSetting.run('app_scoring_enabled', 'true');
insertSetting.run('app_scoring_weight_company_size', '20');
insertSetting.run('app_scoring_weight_engagement', '25');
insertSetting.run('app_scoring_weight_intent', '25');
insertSetting.run('app_scoring_weight_budget', '15');
insertSetting.run('app_scoring_weight_decision_maker', '15');
insertSetting.run('app_scoring_hot_threshold', '70');
insertSetting.run('app_scoring_auto_qualify_score', '85');

// Notification defaults
insertSetting.run('app_notif_new_lead', 'true');
insertSetting.run('app_notif_stage_change', 'true');
insertSetting.run('app_notif_going_cold', 'true');
insertSetting.run('app_notif_daily_summary', 'false');

export function getDb() { return db; }
