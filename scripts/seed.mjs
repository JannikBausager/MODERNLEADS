#!/usr/bin/env node
// Seed script — creates sample leads and interactions for demo purposes
// Usage: node --experimental-sqlite scripts/seed.mjs

const BASE = 'http://localhost:3001/api';

const leads = [
  { source: 'form', companyName: 'Contoso Ltd', contactName: 'Alice Johnson', email: 'alice@contoso.com', phone: '+1-555-0101', productInterest: 'Enterprise CRM', intentSummary: 'Looking for CRM solution for 200+ users' },
  { source: 'email', companyName: 'Fabrikam Inc', contactName: 'Bob Smith', email: 'bob@fabrikam.com', phone: '+1-555-0102', productInterest: 'Sales Automation', intentSummary: 'Interested in automating sales pipeline' },
  { source: 'chatbot', companyName: 'Northwind Traders', contactName: 'Carol Williams', email: 'carol@northwind.com', phone: '+1-555-0103', productInterest: 'Analytics Dashboard', intentSummary: 'Needs real-time sales analytics' },
  { source: 'manual', companyName: 'Adventure Works', contactName: 'David Brown', email: 'david@adventureworks.com', phone: '+1-555-0104', productInterest: 'Lead Management', intentSummary: 'Switching from spreadsheet-based tracking' },
  { source: 'form', companyName: 'Woodgrove Bank', contactName: 'Eve Davis', email: 'eve@woodgrove.com', phone: '+1-555-0105', productInterest: 'Financial CRM', intentSummary: 'Need compliance-ready CRM for banking' },
  { source: 'email', companyName: 'Trey Research', contactName: 'Frank Miller', email: 'frank@treyresearch.com', phone: '+1-555-0106', productInterest: 'Research Management', intentSummary: 'Project tracking for research teams' },
  { source: 'chatbot', companyName: 'Adatum Corp', contactName: 'Grace Wilson', email: 'grace@adatum.com', phone: '+1-555-0107', productInterest: 'Customer Portal', intentSummary: 'Self-service portal for customers' },
  { source: 'form', companyName: 'Alpine Ski House', contactName: 'Henry Taylor', email: 'henry@alpineski.com', phone: '+1-555-0108', productInterest: 'Booking System', intentSummary: 'Integrated booking and CRM system' },
];

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${err}`);
  }
  return res.json();
}

async function seed() {
  console.log('🌱 Seeding Lead Copilot database...\n');

  const created = [];
  for (const lead of leads) {
    const result = await post('/leads', lead);
    created.push(result);
    console.log(`  ✅ Lead: ${result.contactName} at ${result.companyName} (${result.id.slice(0, 8)}...)`);
  }

  // Move some leads through stages
  console.log('\n📋 Setting up pipeline stages...');

  // Alice → Contacted → Qualified (score 85)
  await post(`/leads/${created[0].id}/stage`, { stage: 'Contacted' });
  await post(`/leads/${created[0].id}/stage`, { stage: 'Qualified' });
  await fetch(BASE + `/leads/${created[0].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 85, nextBestAction: 'Schedule demo call' }) });
  console.log('  ✅ Alice Johnson → Qualified (score 85)');

  // Bob → Contacted (score 60)
  await post(`/leads/${created[1].id}/stage`, { stage: 'Contacted' });
  await fetch(BASE + `/leads/${created[1].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 60, nextBestAction: 'Send product brochure' }) });
  console.log('  ✅ Bob Smith → Contacted (score 60)');

  // Carol → Contacted → Qualified (score 72)
  await post(`/leads/${created[2].id}/stage`, { stage: 'Contacted' });
  await post(`/leads/${created[2].id}/stage`, { stage: 'Qualified' });
  await fetch(BASE + `/leads/${created[2].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 72, nextBestAction: 'Prepare pricing proposal' }) });
  console.log('  ✅ Carol Williams → Qualified (score 72)');

  // David stays New (score 40)
  await fetch(BASE + `/leads/${created[3].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 40, nextBestAction: 'Initial outreach' }) });
  console.log('  ✅ David Brown → New (score 40)');

  // Eve → Contacted → Disqualified
  await post(`/leads/${created[4].id}/stage`, { stage: 'Contacted' });
  await post(`/leads/${created[4].id}/stage`, { stage: 'Disqualified', reason: 'Budget not available this year' });
  console.log('  ✅ Eve Davis → Disqualified');

  // Frank stays New (score 55)
  await fetch(BASE + `/leads/${created[5].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 55, nextBestAction: 'Research company background' }) });
  console.log('  ✅ Frank Miller → New (score 55)');

  // Grace → Contacted (score 68)
  await post(`/leads/${created[6].id}/stage`, { stage: 'Contacted' });
  await fetch(BASE + `/leads/${created[6].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 68, nextBestAction: 'Follow-up call' }) });
  console.log('  ✅ Grace Wilson → Contacted (score 68)');

  // Henry stays New (score 30)
  await fetch(BASE + `/leads/${created[7].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 30, nextBestAction: 'Qualify interest level' }) });
  console.log('  ✅ Henry Taylor → New (score 30)');

  // Add some interactions
  console.log('\n💬 Adding interactions...');

  await post('/interactions', { leadId: created[0].id, type: 'email', content: 'Sent initial introduction email with product overview.' });
  await post('/interactions', { leadId: created[0].id, type: 'call', content: '30-min discovery call. Very interested in enterprise features. Budget approved for Q2.' });
  await post('/interactions', { leadId: created[0].id, type: 'note', content: 'Key decision maker. Fast-track for demo.' });

  await post('/interactions', { leadId: created[1].id, type: 'email', content: 'Responded to inbound email inquiry about sales automation.' });
  await post('/interactions', { leadId: created[1].id, type: 'note', content: 'Needs follow-up with product brochure and pricing.' });

  await post('/interactions', { leadId: created[2].id, type: 'system', content: 'Lead captured from chatbot conversation on website.' });
  await post('/interactions', { leadId: created[2].id, type: 'call', content: 'Initial qualification call. Interested in analytics module.' });
  await post('/interactions', { leadId: created[2].id, type: 'meeting', content: 'Virtual demo scheduled for next Tuesday.' });

  await post('/interactions', { leadId: created[4].id, type: 'email', content: 'Sent follow-up but no budget available this fiscal year.' });

  console.log('  ✅ Added 9 interactions');

  // Enrich a couple of leads
  console.log('\n🔍 Enriching leads...');
  await post(`/leads/${created[0].id}/enrich`, {});
  await post(`/leads/${created[2].id}/enrich`, {});
  console.log('  ✅ Enriched Alice and Carol');

  console.log('\n✨ Seed complete! 8 leads, various stages, 9 interactions.\n');
  console.log('Pipeline summary:');
  console.log('  New: 3 (David, Frank, Henry)');
  console.log('  Contacted: 2 (Bob, Grace)');
  console.log('  Qualified: 2 (Alice, Carol)');
  console.log('  Disqualified: 1 (Eve)');
  console.log('  Converted: 0');
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
