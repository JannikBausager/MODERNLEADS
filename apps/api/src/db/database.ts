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
    source TEXT NOT NULL CHECK(source IN ('email','form','chatbot','manual','linkedin','facebook','instagram','tiktok','twitter','website','referral')),
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
    agentChallenge TEXT DEFAULT '',
    agentRecommendation TEXT DEFAULT '',
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

  CREATE TABLE IF NOT EXISTS linkedin_scoring_rules (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    signal TEXT NOT NULL,
    description TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    isDefault INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Insert default settings
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');

// Migration: widen source CHECK constraint to include social channels
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'").get() as any;
  if (tableInfo?.sql && !tableInfo.sql.includes("'linkedin'")) {
    db.exec(`
      CREATE TABLE leads_new (
        id TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        source TEXT NOT NULL CHECK(source IN ('email','form','chatbot','manual','linkedin','facebook','instagram','tiktok','twitter','website','referral')),
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
      INSERT INTO leads_new SELECT * FROM leads;
      DROP TABLE leads;
      ALTER TABLE leads_new RENAME TO leads;
    `);
  }
} catch { /* migration already applied or not needed */ }

// Migration: add agentChallenge and agentRecommendation columns
try {
  const tableInfo2 = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'").get() as any;
  if (tableInfo2?.sql && !tableInfo2.sql.includes('agentChallenge')) {
    db.exec(`ALTER TABLE leads ADD COLUMN agentChallenge TEXT DEFAULT ''`);
    db.exec(`ALTER TABLE leads ADD COLUMN agentRecommendation TEXT DEFAULT ''`);

    // Seed existing leads with example agent insights
    const seedData: Record<string, { challenge: string; recommendation: string }> = {};
    const rows = db.prepare('SELECT id, contactName, stage FROM leads').all() as any[];
    for (const row of rows) {
      const examples = getAgentInsightForLead(row.contactName, row.stage);
      seedData[row.id] = examples;
    }
    const upd = db.prepare('UPDATE leads SET agentChallenge = ?, agentRecommendation = ? WHERE id = ?');
    for (const [id, data] of Object.entries(seedData)) {
      upd.run(data.challenge, data.recommendation, id);
    }
  }
} catch { /* migration already applied or not needed */ }

function getAgentInsightForLead(name: string, stage: string): { challenge: string; recommendation: string } {
  const insights: Record<string, { challenge: string; recommendation: string }> = {
    'New': {
      challenge: `I sent an introductory email to ${name} 3 days ago but haven't received a response. The email was opened twice but no click-through on the CTA link. I also tried connecting on LinkedIn but the request is still pending.`,
      recommendation: `Could you verify the email address is correct? Also, ${name} may respond better to a phone call — their company profile suggests they prefer direct communication. Try calling during business hours and reference the product interest from their form submission.`,
    },
    'Contacted': {
      challenge: `${name} responded to the initial email positively but went silent after I sent the product brochure. Two follow-up emails over the past week got no reply. They viewed our pricing page twice according to website analytics but didn't fill out the demo request form.`,
      recommendation: `${name} seems interested but may be evaluating alternatives. Consider sending a short case study from a similar company in their industry rather than another follow-up. You could also ask them directly: "Is there something specific holding you back?" A softer approach might re-engage them.`,
    },
    'Qualified': {
      challenge: `${name} passed qualification but is delaying the final decision. They mentioned needing approval from their CFO and requested a detailed ROI breakdown that we don't currently have prepared for their specific industry. I've been unable to find a matching reference customer.`,
      recommendation: `Can you prepare a custom ROI estimate for ${name}'s industry? Even a rough calculation showing potential savings would help. Also, offer to join a call with their CFO — having a senior person from our side can accelerate internal approvals. Time is critical here.`,
    },
    'Disqualified': {
      challenge: `${name} was disqualified after we discovered they are a competitor employee doing market research rather than a genuine buyer. They had engaged heavily with our content which inflated their lead score.`,
      recommendation: `No action needed for this lead. However, this highlights a gap in our qualification process. Consider adding a company verification step early in the funnel to catch competitor or non-buyer profiles before investing outreach effort.`,
    },
    'Converted': {
      challenge: `The conversion process for ${name} took 12 days longer than our target of 30 days. The main delay was waiting for legal review of the contract terms. Our standard terms didn't match their procurement requirements.`,
      recommendation: `Great outcome! For future deals with similar companies, consider preparing a pre-approved alternate contract template that addresses common enterprise procurement requirements. This could cut 1-2 weeks off the closing cycle.`,
    },
  };
  return insights[stage] || insights['New'];
}

// BC MCP connection defaults
insertSetting.run('bc_tenant', 'DirectionsEmeaWorkshop1.onmicrosoft.com');
insertSetting.run('bc_environment', 'PRODUCTION');
insertSetting.run('bc_company', 'CRONUS USA, Inc.');
insertSetting.run('bc_mcp_config', 'MCPleads');
insertSetting.run('bc_auth_type', 'none');
insertSetting.run('bc_access_token', '');
insertSetting.run('bc_mcp_enabled', 'false');

// LinkedIn defaults
insertSetting.run('linkedin_client_id', '');
insertSetting.run('linkedin_client_secret', '');
insertSetting.run('linkedin_redirect_uri', 'http://localhost:5173/auth/linkedin/callback');
insertSetting.run('linkedin_access_token', '');
insertSetting.run('linkedin_enabled', 'false');

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

// LinkedIn scoring rule defaults
const insertRule = db.prepare(
  `INSERT OR IGNORE INTO linkedin_scoring_rules (id, category, signal, description, score, enabled, isDefault) VALUES (?, ?, ?, ?, ?, 1, 1)`
);
// Engagement
insertRule.run('like_reaction', 'engagement', 'like_reaction', 'Like or Reaction on your post', 2);
insertRule.run('comment_post', 'engagement', 'comment_post', 'Comment on your post', 8);
insertRule.run('share_reshare', 'engagement', 'share_reshare', 'Share/Reshare of your post', 10);
insertRule.run('inbound_connection', 'engagement', 'inbound_connection', 'Inbound connection request', 15);
insertRule.run('direct_message', 'engagement', 'direct_message', 'Direct message or InMail reply', 20);
insertRule.run('profile_view', 'engagement', 'profile_view', 'Profile view by target prospect', 5);
insertRule.run('follow', 'engagement', 'follow', 'Follow your profile or company page', 3);
insertRule.run('repeat_engagement', 'engagement', 'repeat_engagement', 'Multiple/repeat engagements', 5);
// Fit
insertRule.run('company_size_smb', 'fit', 'company_size_smb', 'Company size fits SMB target (50-500 employees)', 10);
insertRule.run('target_industry', 'fit', 'target_industry', 'Industry is a target vertical', 5);
insertRule.run('senior_decision_maker', 'fit', 'senior_decision_maker', 'Role is senior decision-maker (CxO, VP, Director)', 10);
insertRule.run('target_location', 'fit', 'target_location', 'Location in target market (supported region)', 2);
// Negative
insertRule.run('low_value_role', 'negative', 'low_value_role', 'Low-value role or student (not a decision-maker)', -5);
insertRule.run('company_too_large', 'negative', 'company_too_large', 'Company too large or not SMB (>1000 employees)', -10);
insertRule.run('non_target_industry', 'negative', 'non_target_industry', 'Non-target industry (unrelated sector)', -5);
insertRule.run('competitor_vendor', 'negative', 'competitor_vendor', 'Competitor or vendor company (not a buyer)', 0);
// Decay
insertRule.run('stale_lead', 'decay', 'stale_lead', 'No recent engagement (score decays over time)', -2);

export function getDb() { return db; }
