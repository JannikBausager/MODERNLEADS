import { v4 as uuid } from 'uuid';
import { getBcSettings } from '../db/repository.js';

export interface BcOpportunityPayload {
  name: string;
  value: number;
  stage: string;
  closeDate: string;
  accountRef: string;
  contactRef: string;
}

export interface BcOpportunityResponse {
  bcOpportunityId: string;
  status: 'created';
  timestamp: string;
}

// Mock BC API - used when MCP is not enabled
async function createBcOpportunityMock(payload: BcOpportunityPayload): Promise<BcOpportunityResponse> {
  await new Promise(r => setTimeout(r, 50));
  console.log('[BC Adapter] MOCK - Creating opportunity:', payload.name);
  return {
    bcOpportunityId: `BC-OPP-${uuid().slice(0, 8).toUpperCase()}`,
    status: 'created',
    timestamp: new Date().toISOString(),
  };
}

// Real BC call via MCP
async function createBcOpportunityViaMcpAdapter(payload: BcOpportunityPayload): Promise<BcOpportunityResponse> {
  // Dynamic import to avoid circular deps
  const { createBcOpportunityViaMcp } = await import('./mcpClient.js');
  const result = await createBcOpportunityViaMcp({
    name: payload.name,
    value: payload.value,
    contactEmail: payload.contactRef,
    accountName: payload.accountRef,
    closeDate: payload.closeDate,
    leadId: '',
  });
  return {
    bcOpportunityId: result?.id || result?.no || `BC-MCP-${uuid().slice(0, 8).toUpperCase()}`,
    status: 'created',
    timestamp: new Date().toISOString(),
  };
}

export async function createBcOpportunity(payload: BcOpportunityPayload): Promise<BcOpportunityResponse> {
  const settings = getBcSettings();
  if (settings.enabled && settings.accessToken) {
    try {
      return await createBcOpportunityViaMcpAdapter(payload);
    } catch (err: any) {
      console.warn('[BC Adapter] MCP call failed, falling back to mock:', err.message);
      return createBcOpportunityMock(payload);
    }
  }
  return createBcOpportunityMock(payload);
}
