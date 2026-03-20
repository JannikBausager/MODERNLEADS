import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getBcSettings, setSetting } from '../db/repository.js';

export interface BcMcpConfig {
  tenant: string;
  environment: string;
  company: string;
  mcpConfig: string;
  accessToken: string;
}

// BC MCP server can be slow (cold start, server-side processing)
const MCP_REQUEST_TIMEOUT = 120_000; // 2 minutes

let mcpClient: Client | null = null;
let currentConfig: BcMcpConfig | null = null;

function buildMcpUrl(config: BcMcpConfig): string {
  // BC MCP server URL format (from Microsoft's BcMCPProxy source):
  // https://api.businesscentral.dynamics.com/v2.0/{environment}/mcp
  // Company and ConfigurationName are passed as HTTP headers, NOT in the URL.
  const env = encodeURIComponent(config.environment);
  return `https://api.businesscentral.dynamics.com/v2.0/${env}/mcp`;
}

/**
 * Ensure we have a fresh access token. If the cached MSAL account exists,
 * silently refresh. This keeps the MCP connection from failing on expired tokens.
 */
async function ensureFreshToken(): Promise<string> {
  const settings = getBcSettings();

  try {
    const { refreshToken, getAuthStatus } = await import('../auth/deviceCodeAuth.js');
    const auth = getAuthStatus();
    if (auth.signedIn) {
      const freshToken = await refreshToken(settings.tenant);
      if (freshToken) {
        // Token was refreshed — if it changed, force MCP client to reconnect
        if (freshToken !== settings.accessToken) {
          console.log('[BC MCP] Token refreshed, will reconnect');
          if (mcpClient) {
            try { await mcpClient.close(); } catch { /* ignore */ }
            mcpClient = null;
            currentConfig = null;
          }
        }
        return freshToken;
      }
    }
  } catch (err: any) {
    console.warn('[BC MCP] Token refresh failed:', err.message);
  }

  // Fall back to stored token
  if (settings.accessToken) return settings.accessToken;
  throw new Error('No access token available. Please sign in via Settings → Opportunity Management.');
}

export async function getOrCreateClient(config?: BcMcpConfig): Promise<Client> {
  // Always try to refresh the token first
  const freshToken = await ensureFreshToken();

  const bcSettings = getBcSettings();
  const settings = config || {
    tenant: bcSettings.tenant,
    environment: bcSettings.environment,
    company: bcSettings.company,
    mcpConfig: bcSettings.mcpConfig,
    accessToken: freshToken,
  };

  // If config changed, disconnect old client
  if (mcpClient && currentConfig && JSON.stringify(currentConfig) !== JSON.stringify(settings)) {
    try { await mcpClient.close(); } catch { /* ignore */ }
    mcpClient = null;
  }

  if (mcpClient) return mcpClient;

  const url = buildMcpUrl(settings);
  console.log(`[BC MCP] Connecting to: ${url}`);

  const headers: Record<string, string> = {
    'Accept': 'application/json, text/event-stream',
    'Company': settings.company,
    'X-Client-Application': 'LeadAgent',
  };
  if (settings.mcpConfig) {
    headers['ConfigurationName'] = settings.mcpConfig;
  }
  if (settings.accessToken) {
    headers['Authorization'] = `Bearer ${settings.accessToken}`;
  }

  const transport = new StreamableHTTPClientTransport(
    new URL(url),
    { requestInit: { headers } }
  );

  mcpClient = new Client(
    { name: 'modernleads-crm', version: '1.0.0' },
    { capabilities: {}, timeout: MCP_REQUEST_TIMEOUT }
  );

  await mcpClient.connect(transport);
  currentConfig = settings;
  console.log('[BC MCP] Connected successfully');

  return mcpClient;
}

export async function disconnectClient(): Promise<void> {
  if (mcpClient) {
    try { await mcpClient.close(); } catch { /* ignore */ }
    mcpClient = null;
    currentConfig = null;
  }
  clearToolCache();
}

export async function listMcpTools(): Promise<any[]> {
  const client = await getOrCreateClient();
  const response = await client.listTools(undefined, { timeout: MCP_REQUEST_TIMEOUT });
  return response.tools;
}

export async function callMcpTool(toolName: string, args: Record<string, any>): Promise<any> {
  const client = await getOrCreateClient();
  const response = await client.callTool({ name: toolName, arguments: args }, undefined, { timeout: MCP_REQUEST_TIMEOUT });
  return response;
}

// Parse MCP tool result content into usable data
function parseMcpResult(result: any): any {
  if (result.content && Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item.type === 'text') {
        try { return JSON.parse(item.text); } catch { return item.text; }
      }
    }
  }
  return result;
}

// Find a tool by matching one of several candidate names (case-insensitive)
async function findTool(candidates: string[]): Promise<string | null> {
  const tools = await listMcpTools();
  const lowerCandidates = candidates.map(c => c.toLowerCase());
  for (const tool of tools) {
    const name = (tool.name || '').toLowerCase();
    if (lowerCandidates.includes(name)) return tool.name;
  }
  // Fallback: partial match
  for (const tool of tools) {
    const name = (tool.name || '').toLowerCase();
    for (const c of lowerCandidates) {
      if (name.includes(c) || c.includes(name)) return tool.name;
    }
  }
  return null;
}

// Cache discovered tool names to avoid repeated listTools calls
let toolNameCache: Record<string, string | null> = {};

async function resolveToolName(category: string, candidates: string[]): Promise<string> {
  if (toolNameCache[category] !== undefined) {
    if (!toolNameCache[category]) throw new Error(`No MCP tool found for: ${category}`);
    return toolNameCache[category]!;
  }
  const name = await findTool(candidates);
  toolNameCache[category] = name;
  if (!name) {
    const tools = await listMcpTools();
    const available = tools.map((t: any) => t.name).join(', ');
    throw new Error(`No MCP tool found for "${category}". Available tools: ${available}`);
  }
  console.log(`[BC MCP] Resolved "${category}" → tool "${name}"`);
  return name;
}

// Reset cache when client disconnects (e.g. config change)
export function clearToolCache(): void {
  toolNameCache = {};
}

// High-level BC operations using MCP tools

export async function getBcCustomers(): Promise<any[]> {
  try {
    const toolName = await resolveToolName('customers', [
      'getCustomers', 'get_customers', 'listCustomers', 'list_customers', 'customers',
    ]);
    const result = await callMcpTool(toolName, {});
    const data = parseMcpResult(result);
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error('[BC MCP] Error getting customers:', err.message);
    throw new Error(`BC MCP error: ${err.message}`);
  }
}

export async function getBcContracts(): Promise<any[]> {
  try {
    const toolName = await resolveToolName('contracts', [
      'getContracts', 'get_contracts', 'listContracts', 'list_contracts', 'contracts',
    ]);
    const result = await callMcpTool(toolName, {});
    const data = parseMcpResult(result);
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error('[BC MCP] Error getting contracts:', err.message);
    throw new Error(`BC MCP error: ${err.message}`);
  }
}

export async function getBcOpportunities(): Promise<any[]> {
  try {
    const toolName = await resolveToolName('opportunities', [
      'getOpportunities', 'get_opportunities', 'listOpportunities', 'list_opportunities', 'opportunities',
    ]);
    const result = await callMcpTool(toolName, {});
    const data = parseMcpResult(result);
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error('[BC MCP] Error getting opportunities:', err.message);
    throw new Error(`BC MCP error: ${err.message}`);
  }
}

export async function createBcOpportunityViaMcp(data: {
  name: string;
  value: number;
  contactEmail: string;
  accountName: string;
  closeDate: string;
  leadId: string;
}): Promise<any> {
  try {
    const toolName = await resolveToolName('createOpportunity', [
      'createOpportunity', 'create_opportunity', 'addOpportunity', 'add_opportunity',
    ]);
    const result = await callMcpTool(toolName, {
      description: data.name,
      estimatedValue: data.value,
      contactEmail: data.contactEmail,
      accountName: data.accountName,
      expectedCloseDate: data.closeDate,
      externalReference: data.leadId,
    });
    const parsed = parseMcpResult(result);
    return typeof parsed === 'object' ? parsed : { id: parsed };
  } catch (err: any) {
    console.error('[BC MCP] Error creating opportunity:', err.message);
    throw new Error(`BC MCP error: ${err.message}`);
  }
}
