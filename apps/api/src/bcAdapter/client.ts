import { v4 as uuid } from 'uuid';

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

// Mock BC API - in production this would call Business Central's OData/REST API
export async function createBcOpportunity(payload: BcOpportunityPayload): Promise<BcOpportunityResponse> {
  await new Promise(r => setTimeout(r, 50));

  console.log('[BC Adapter] Creating opportunity in Business Central:', payload.name);

  return {
    bcOpportunityId: `BC-OPP-${uuid().slice(0, 8).toUpperCase()}`,
    status: 'created',
    timestamp: new Date().toISOString(),
  };
}
