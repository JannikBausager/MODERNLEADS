import { describe, it, expect } from 'vitest';
import type { Lead } from '@modernleads/shared';
import { mapLeadToOpportunity, toBcPayload } from '../conversion/mapping.js';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    createdAt: '2024-01-01T00:00:00Z',
    source: 'manual',
    owner: 'unassigned',
    companyName: 'Acme Corp',
    contactName: 'John Doe',
    email: 'john@acme.com',
    phone: '',
    intentSummary: '',
    productInterest: 'CRM Suite',
    stage: 'Qualified',
    score: 75,
    nextBestAction: '',
    lastInteractionAt: null,
    consentFlags: {},
    rawPayload: null,
    enrichedFields: {},
    ...overrides,
  };
}

describe('mapLeadToOpportunity', () => {
  it('produces correct opportunity name format', () => {
    const lead = makeLead();
    const result = mapLeadToOpportunity(lead);
    expect(result.opportunityName).toBe('Acme Corp - CRM Suite');
  });

  it('uses General Inquiry when no productInterest', () => {
    const lead = makeLead({ productInterest: '' });
    const result = mapLeadToOpportunity(lead);
    expect(result.opportunityName).toBe('Acme Corp - General Inquiry');
  });

  it('calculates value from score (score * 100)', () => {
    const lead = makeLead({ score: 80 });
    const result = mapLeadToOpportunity(lead);
    expect(result.value).toBe(8000);
  });

  it('sets close date ~30 days out', () => {
    const lead = makeLead();
    const result = mapLeadToOpportunity(lead);
    const closeDate = new Date(result.closeDate);
    const now = new Date();
    const diffDays = Math.round((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it('slugifies accountRef from companyName', () => {
    const lead = makeLead({ companyName: 'Acme Corp & Co.' });
    const result = mapLeadToOpportunity(lead);
    expect(result.accountRef).toBe('acme-corp-co');
  });

  it('sets stage to Prospecting', () => {
    const lead = makeLead();
    const result = mapLeadToOpportunity(lead);
    expect(result.stage).toBe('Prospecting');
  });

  it('sets contactRef to lead email', () => {
    const lead = makeLead({ email: 'jane@example.com' });
    const result = mapLeadToOpportunity(lead);
    expect(result.contactRef).toBe('jane@example.com');
  });
});

describe('toBcPayload', () => {
  it('transforms ConversionResult to BcOpportunityPayload', () => {
    const lead = makeLead();
    const result = mapLeadToOpportunity(lead);
    const payload = toBcPayload(result);
    expect(payload.name).toBe(result.opportunityName);
    expect(payload.value).toBe(result.value);
    expect(payload.stage).toBe(result.stage);
    expect(payload.closeDate).toBe(result.closeDate);
    expect(payload.accountRef).toBe(result.accountRef);
    expect(payload.contactRef).toBe(result.contactRef);
  });
});
