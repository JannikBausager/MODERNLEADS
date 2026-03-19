import type { Lead } from '@modernleads/shared';
import type { BcOpportunityPayload } from '../bcAdapter/client.js';

export interface ConversionResult {
  opportunityName: string;
  value: number;
  stage: string;
  closeDate: string;
  accountRef: string;
  contactRef: string;
}

export function mapLeadToOpportunity(lead: Lead): ConversionResult {
  const productPart = lead.productInterest || 'General Inquiry';
  const opportunityName = `${lead.companyName} - ${productPart}`;

  const value = lead.score * 100;

  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 30);

  const accountRef = lead.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return {
    opportunityName,
    value,
    stage: 'Prospecting',
    closeDate: closeDate.toISOString().split('T')[0],
    accountRef,
    contactRef: lead.email,
  };
}

export function toBcPayload(result: ConversionResult): BcOpportunityPayload {
  return {
    name: result.opportunityName,
    value: result.value,
    stage: result.stage,
    closeDate: result.closeDate,
    accountRef: result.accountRef,
    contactRef: result.contactRef,
  };
}
