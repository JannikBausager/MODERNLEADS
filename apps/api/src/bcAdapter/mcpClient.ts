import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getBcSettings } from '../db/repository.js';

export interface BcMcpConfig {
  tenant: string;
  environment: string;
  company: string;
  mcpConfig: string;
  accessToken: string;
}

let mcpClient: Client | null = null;
let currentConfig: BcMcpConfig | null = null;

function buildMcpUrl(config: BcMcpConfig): string {
  // BC MCP server URL format:
  // https://businesscentral.dynamics.com/{tenant}/{environment}/mcp/{configName}
  return `https://businesscentral.dynamics.com/${encodeURIComponent(config.tenant)}/${encodeURIComponent(config.environment)}/mcp/${encodeURIComponent(config.mcpConfig)}`;
}

export async function getOrCreateClient(config?: BcMcpConfig): Promise<Client> {
  const settings = config || {
    tenant: getBcSettings().tenant,
    environment: getBcSettings().environment,
    company: getBcSettings().company,
    mcpConfig: getBcSettings().mcpConfig,
    accessToken: getBcSettings().accessToken,
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
  };
  if (settings.accessToken) {
    headers['Authorization'] = `Bearer ${settings.accessToken}`;
  }

  const transport = new StreamableHTTPClientTransport(
    new URL(url),
    { requestInit: { headers } }
  );

  mcpClient = new Client(
    { name: 'modernleads-crm', version: '1.0.0' },
    { capabilities: {} }
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
}

export async function listMcpTools(): Promise<any[]> {
  const client = await getOrCreateClient();
  const response = await client.listTools();
  return response.tools;
}

export async function callMcpTool(toolName: string, args: Record<string, any>): Promise<any> {
  const client = await getOrCreateClient();
  const response = await client.callTool({ name: toolName, arguments: args });
  return response;
}

// High-level BC operations using MCP tools

export async function getBcCustomers(): Promise<any[]> {
  try {
    const result = await callMcpTool('getCustomers', {
      company: getBcSettings().company,
    });
    // MCP tool results come as content array
    if (result.content && Array.isArray(result.content)) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try { return JSON.parse(item.text); } catch { return [item.text]; }
        }
      }
    }
    return Array.isArray(result) ? result : [];
  } catch (err: any) {
    console.error('[BC MCP] Error getting customers:', err.message);
    throw new Error(`BC MCP error: ${err.message}`);
  }
}

export async function getBcContracts(): Promise<any[]> {
  try {
    const result = await callMcpTool('getContracts', {
      company: getBcSettings().company,
    });
    if (result.content && Array.isArray(result.content)) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try { return JSON.parse(item.text); } catch { return [item.text]; }
        }
      }
    }
    return Array.isArray(result) ? result : [];
  } catch (err: any) {
    console.error('[BC MCP] Error getting contracts:', err.message);
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
    const result = await callMcpTool('createOpportunity', {
      company: getBcSettings().company,
      description: data.name,
      estimatedValue: data.value,
      contactEmail: data.contactEmail,
      accountName: data.accountName,
      expectedCloseDate: data.closeDate,
      externalReference: data.leadId,
    });
    if (result.content && Array.isArray(result.content)) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try { return JSON.parse(item.text); } catch { return { id: item.text }; }
        }
      }
    }
    return result;
  } catch (err: any) {
    console.error('[BC MCP] Error creating opportunity:', err.message);
    throw new Error(`BC MCP error: ${err.message}`);
  }
}
