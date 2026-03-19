import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type supertest from 'supertest';

const DB_PATH = path.join(os.tmpdir(), `crm-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DB_PATH = DB_PATH;

let request: supertest.SuperTest<supertest.Test>;

beforeAll(async () => {
  const { app } = await import('../app.js');
  const supertestModule = await import('supertest');
  request = supertestModule.default(app) as any;
});

afterAll(() => {
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  try { fs.unlinkSync(DB_PATH + '-wal'); } catch { /* ignore */ }
  try { fs.unlinkSync(DB_PATH + '-shm'); } catch { /* ignore */ }
});

const leadPayload = {
  source: 'manual' as const,
  companyName: 'Test Corp',
  contactName: 'Jane Smith',
  email: 'jane@testcorp.com',
  phone: '555-0100',
  productInterest: 'Enterprise Plan',
};

let createdLeadId: string;

describe('POST /api/leads', () => {
  it('creates a lead and returns correct shape', async () => {
    const res = await request.post('/api/leads').send(leadPayload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.companyName).toBe('Test Corp');
    expect(res.body.contactName).toBe('Jane Smith');
    expect(res.body.stage).toBe('New');
    expect(res.body.score).toBe(0);
    expect(typeof res.body.consentFlags).toBe('object');
    createdLeadId = res.body.id;
  });

  it('returns validation error for invalid data', async () => {
    const res = await request.post('/api/leads').send({ companyName: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/leads', () => {
  it('lists leads', async () => {
    const res = await request.get('/api/leads');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by stage', async () => {
    const res = await request.get('/api/leads?stage=New');
    expect(res.status).toBe(200);
    expect(res.body.every((l: any) => l.stage === 'New')).toBe(true);
  });

  it('searches by name', async () => {
    const res = await request.get('/api/leads?search=Jane');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/leads/:id', () => {
  it('returns a lead by ID', async () => {
    const res = await request.get(`/api/leads/${createdLeadId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdLeadId);
  });

  it('returns 404 for unknown ID', async () => {
    const res = await request.get('/api/leads/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/leads/:id', () => {
  it('updates lead fields', async () => {
    const res = await request.patch(`/api/leads/${createdLeadId}`).send({ score: 42, owner: 'alice' });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(42);
    expect(res.body.owner).toBe('alice');
  });
});

describe('POST /api/leads/:id/stage', () => {
  it('changes stage from New to Contacted', async () => {
    const res = await request.post(`/api/leads/${createdLeadId}/stage`).send({ stage: 'Contacted' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('Contacted');
  });

  it('rejects invalid transition', async () => {
    const res = await request.post(`/api/leads/${createdLeadId}/stage`).send({ stage: 'Converted' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('POST /api/leads/:id/enrich', () => {
  it('enriches a lead', async () => {
    const res = await request.post(`/api/leads/${createdLeadId}/enrich`);
    expect(res.status).toBe(200);
    expect(res.body.enrichedFields).toHaveProperty('industry');
    expect(res.body.enrichedFields).toHaveProperty('companySize');
    expect(res.body.score).toBe(52); // was 42, +10
  });
});

describe('POST /api/leads/:id/convert', () => {
  it('rejects conversion of non-Qualified lead', async () => {
    const res = await request.post(`/api/leads/${createdLeadId}/convert`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('converts a Qualified lead to opportunity', async () => {
    // Move to Qualified first
    await request.post(`/api/leads/${createdLeadId}/stage`).send({ stage: 'Qualified' });
    const verify = await request.get(`/api/leads/${createdLeadId}`);
    expect(verify.body.stage).toBe('Qualified');

    const res = await request.post(`/api/leads/${createdLeadId}/convert`);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('bcOpportunityId');
    expect(res.body.leadId).toBe(createdLeadId);
    expect(res.body.name).toContain('Test Corp');

    // Lead should now be Converted
    const leadRes = await request.get(`/api/leads/${createdLeadId}`);
    expect(leadRes.body.stage).toBe('Converted');
  });
});

describe('Interactions', () => {
  let interactionLeadId: string;

  beforeAll(async () => {
    const res = await request.post('/api/leads').send({
      source: 'email',
      companyName: 'Interaction Co',
      contactName: 'Bob Test',
      email: 'bob@interaction.co',
    });
    interactionLeadId = res.body.id;
  });

  it('creates an interaction', async () => {
    const res = await request.post('/api/interactions').send({
      leadId: interactionLeadId,
      type: 'note',
      content: 'Spoke with Bob about pricing',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.content).toBe('Spoke with Bob about pricing');
  });

  it('lists interactions for a lead', async () => {
    const res = await request.get(`/api/interactions?leadId=${interactionLeadId}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('requires leadId query param', async () => {
    const res = await request.get('/api/interactions');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/opportunities', () => {
  it('lists opportunities', async () => {
    const res = await request.get('/api/opportunities');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
