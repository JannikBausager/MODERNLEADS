const BASE = '/api';

async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw err;
  }
  return res.json();
}

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, v);
  }
  const s = p.toString();
  return s ? '?' + s : '';
}

export interface Lead {
  id: string;
  contactName: string;
  companyName: string;
  email: string;
  phone?: string;
  stage: string;
  score?: number;
  source?: string;
  nextBestAction?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Interaction {
  id: string;
  leadId: string;
  type: string;
  content: string;
  createdAt: string;
}

export interface Opportunity {
  id: string;
  leadId: string;
  title: string;
  value?: number;
  stage: string;
  createdAt: string;
}

export interface AgentResponse {
  reply: string;
  action?: {
    type: string;
    confirmationRequired?: boolean;
    params?: Record<string, any>;
  };
  data?: any;
}

export interface BcSettings {
  enabled: boolean;
  tenant: string;
  environment: string;
  company: string;
  mcpConfig: string;
  authType: string;
  accessToken?: string;
  hasToken?: boolean;
}

export interface ScoringSettings {
  enabled: boolean;
  weights: Record<string, number>;
  hotThreshold: number;
  autoQualifyScore: number;
}

export interface NotificationSettings {
  newLead: boolean;
  stageChange: boolean;
  goingCold: boolean;
  dailySummary: boolean;
}

export interface GeneralSettings {
  defaultOwner: string;
  timezone: string;
  autoAssign: boolean;
  leadSources: string[];
}

export interface EntraSettings {
  clientId: string;
  tenantId: string;
  redirectUri: string;
}

export interface DeviceCodeResponse {
  userCode: string;
  verificationUri: string;
  message: string;
}

export interface AuthStatus {
  signedIn: boolean;
  username: string;
}

export interface DeviceCodePollResponse {
  status: 'pending' | 'completed' | 'error' | 'expired' | 'none';
  username?: string;
  error?: string;
}

export const api = {
  leads: {
    list: (params?: { stage?: string; search?: string }) =>
      request<Lead[]>('/leads' + qs(params ?? {})),
    get: (id: string) => request<Lead>(`/leads/${id}`),
    create: (data: Partial<Lead>) =>
      request<Lead>('/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Lead>) =>
      request<Lead>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    changeStage: (id: string, stage: string, reason?: string) =>
      request(`/leads/${id}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage, reason }),
      }),
    enrich: (id: string) =>
      request(`/leads/${id}/enrich`, { method: 'POST' }),
    convert: (id: string) =>
      request(`/leads/${id}/convert`, { method: 'POST' }),
    prioritized: () => request<Lead[]>('/leads/prioritized'),
  },
  interactions: {
    list: (leadId: string) =>
      request<Interaction[]>('/interactions' + qs({ leadId })),
    create: (data: { leadId: string; type: string; content: string }) =>
      request<Interaction>('/interactions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  opportunities: {
    list: () => request<Opportunity[]>('/opportunities'),
  },
  agent: {
    chat: (message: string, confirmAction?: boolean) =>
      request<AgentResponse>('/agent/chat', {
        method: 'POST',
        body: JSON.stringify({ message, confirmAction }),
      }),
  },
  settings: {
    getBc: () => request<BcSettings>('/settings/bc'),
    updateBc: (data: BcSettings) =>
      request('/settings/bc', { method: 'PUT', body: JSON.stringify(data) }),
    testBc: () => request<{ success: boolean; message: string; tools?: Array<{ name: string; description: string }> }>('/settings/bc/test', { method: 'POST' }),
    getGeneral: () => request<GeneralSettings>('/settings/general'),
    updateGeneral: (data: Partial<GeneralSettings>) =>
      request<GeneralSettings>('/settings/general', { method: 'PUT', body: JSON.stringify(data) }),
    getScoring: () => request<ScoringSettings>('/settings/scoring'),
    updateScoring: (data: Partial<ScoringSettings>) =>
      request<ScoringSettings>('/settings/scoring', { method: 'PUT', body: JSON.stringify(data) }),
    getNotifications: () => request<NotificationSettings>('/settings/notifications'),
    updateNotifications: (data: Partial<NotificationSettings>) =>
      request<NotificationSettings>('/settings/notifications', { method: 'PUT', body: JSON.stringify(data) }),
    getEntra: () => request<EntraSettings>('/settings/entra'),
    updateEntra: (data: Partial<EntraSettings>) =>
      request<EntraSettings>('/settings/entra', { method: 'PUT', body: JSON.stringify(data) }),
  },
  bc: {
    customers: () => request<any[]>('/bc/customers'),
    contacts: () => request<any[]>('/bc/contacts'),
    opportunities: () => request<any[]>('/bc/opportunities'),
  },
  auth: {
    startDeviceCode: () =>
      request<DeviceCodeResponse>('/auth/device-code', { method: 'POST' }),
    pollDeviceCode: () =>
      request<DeviceCodePollResponse>('/auth/device-code/poll'),
    status: () => request<AuthStatus>('/auth/status'),
    signOut: () => request('/auth/signout', { method: 'POST' }),
  },
};
