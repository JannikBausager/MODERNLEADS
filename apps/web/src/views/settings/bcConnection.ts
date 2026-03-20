import { api, type BcSettings } from '../../api.js';
import { showToast } from '../../components/toast.js';

const DEFAULT_SETTINGS: BcSettings = {
  enabled: false,
  tenant: 'DirectionsEmeaWorkshop1.onmicrosoft.com',
  environment: 'PRODUCTION',
  company: 'CRONUS USA, Inc.',
  mcpConfigName: 'MCPleads',
  authType: 'None',
  accessToken: '',
};

const OTHER_CRMS = [
  { id: 'd365_sales', name: 'Dynamics 365 Sales', icon: '🔷', desc: 'Bi-directional sync with Dynamics 365 Sales opportunities.', status: 'coming_soon' as const },
  { id: 'salesforce', name: 'Salesforce', icon: '☁️', desc: 'Push converted leads to Salesforce as opportunities.', status: 'coming_soon' as const },
  { id: 'hubspot_crm', name: 'HubSpot CRM', icon: '🟠', desc: 'Sync deals and contacts with HubSpot CRM.', status: 'coming_soon' as const },
  { id: 'pipedrive', name: 'Pipedrive', icon: '🟢', desc: 'Export qualified leads to Pipedrive deals.', status: 'coming_soon' as const },
];

export function renderBcConnection(container: HTMLElement): void {
  container.innerHTML = `
    <div class="settings-panel">
      <div class="settings-panel-header">
        <h2>Opportunity Management</h2>
        <p class="settings-panel-desc">Connect your CRM to convert leads into opportunities and sync customer data.</p>
      </div>

      <div class="card settings-form-card bc-connection-card">
        <div class="connection-card-header">
          <div class="connection-card-title">
            <span class="integration-icon-lg">🏢</span>
            <div>
              <h3>Business Central (MCP)</h3>
              <span class="form-hint">Connect via Model Context Protocol for customers, contracts, and opportunities.</span>
            </div>
          </div>
          <span class="integration-status-badge" id="bc-status-badge">Not Connected</span>
        </div>

        <form id="bc-settings-form">
          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" id="bc-enabled" />
              <span class="toggle-switch"></span>
              Enable BC MCP Integration
            </label>
          </div>
          <div class="form-row">
            <div class="form-group form-group-half">
              <label>Tenant</label>
              <input type="text" class="form-input" id="bc-tenant" />
            </div>
            <div class="form-group form-group-half">
              <label>Environment</label>
              <input type="text" class="form-input" id="bc-environment" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group form-group-half">
              <label>Company</label>
              <input type="text" class="form-input" id="bc-company" />
            </div>
            <div class="form-group form-group-half">
              <label>MCP Configuration Name</label>
              <input type="text" class="form-input" id="bc-mcp-name" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group form-group-half">
              <label>Authentication Type</label>
              <select class="form-input" id="bc-auth-type">
                <option value="None">None</option>
                <option value="bearer">Bearer Token</option>
              </select>
            </div>
            <div class="form-group form-group-half" id="bc-token-group" style="display:none">
              <label>Access Token</label>
              <input type="password" class="form-input" id="bc-token" />
            </div>
          </div>
          <div class="settings-actions">
            <button type="submit" class="btn btn-primary">Save Settings</button>
            <button type="button" class="btn btn-secondary" id="btn-test">Test Connection</button>
          </div>
          <div class="connection-status" id="connection-status"></div>
        </form>
      </div>

      <div class="card settings-form-card" id="bc-preview-section" style="display:none">
        <h3>Data Preview</h3>
        <div class="preview-tabs" id="preview-tabs">
          <button class="tab tab-active" data-tab="customers">Customers</button>
          <button class="tab" data-tab="contracts">Contracts</button>
        </div>
        <div id="preview-content">
          <div class="loading-spinner"></div>
        </div>
      </div>

      <div class="integration-section-divider">
        <span>Other CRM Integrations</span>
      </div>

      <div class="integration-grid">
        ${OTHER_CRMS.map(crm => `
          <div class="integration-card">
            <div class="integration-card-header">
              <span class="integration-icon">${crm.icon}</span>
              <div class="integration-info">
                <span class="integration-name">${crm.name}</span>
                <span class="integration-desc">${crm.desc}</span>
              </div>
            </div>
            <div class="integration-card-footer">
              <span class="integration-status status-coming_soon">Coming Soon</span>
              <button class="btn btn-sm btn-ghost">Notify Me</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const form = container.querySelector('#bc-settings-form') as HTMLFormElement;
  const enabledEl = container.querySelector('#bc-enabled') as HTMLInputElement;
  const tenantEl = container.querySelector('#bc-tenant') as HTMLInputElement;
  const envEl = container.querySelector('#bc-environment') as HTMLInputElement;
  const companyEl = container.querySelector('#bc-company') as HTMLInputElement;
  const mcpNameEl = container.querySelector('#bc-mcp-name') as HTMLInputElement;
  const authTypeEl = container.querySelector('#bc-auth-type') as HTMLSelectElement;
  const tokenGroupEl = container.querySelector('#bc-token-group') as HTMLElement;
  const tokenEl = container.querySelector('#bc-token') as HTMLInputElement;
  const statusEl = container.querySelector('#connection-status') as HTMLElement;
  const previewSection = container.querySelector('#bc-preview-section') as HTMLElement;
  const previewContent = container.querySelector('#preview-content') as HTMLElement;
  const previewTabs = container.querySelector('#preview-tabs') as HTMLElement;
  const statusBadge = container.querySelector('#bc-status-badge') as HTMLElement;

  let activeTab = 'customers';

  function fillForm(s: BcSettings) {
    enabledEl.checked = s.enabled;
    tenantEl.value = s.tenant;
    envEl.value = s.environment;
    companyEl.value = s.company;
    mcpNameEl.value = s.mcpConfigName;
    authTypeEl.value = s.authType;
    tokenEl.value = s.accessToken || '';
    tokenGroupEl.style.display = s.authType === 'bearer' ? 'block' : 'none';
    previewSection.style.display = s.enabled ? 'block' : 'none';
    statusBadge.textContent = s.enabled ? 'Enabled' : 'Not Connected';
    statusBadge.className = `integration-status-badge ${s.enabled ? 'badge-enabled' : 'badge-disabled'}`;
  }

  function readForm(): BcSettings {
    return {
      enabled: enabledEl.checked,
      tenant: tenantEl.value,
      environment: envEl.value,
      company: companyEl.value,
      mcpConfigName: mcpNameEl.value,
      authType: authTypeEl.value,
      accessToken: tokenEl.value,
    };
  }

  authTypeEl.addEventListener('change', () => {
    tokenGroupEl.style.display = authTypeEl.value === 'bearer' ? 'block' : 'none';
  });

  enabledEl.addEventListener('change', () => {
    previewSection.style.display = enabledEl.checked ? 'block' : 'none';
    statusBadge.textContent = enabledEl.checked ? 'Enabled' : 'Not Connected';
    statusBadge.className = `integration-status-badge ${enabledEl.checked ? 'badge-enabled' : 'badge-disabled'}`;
    if (enabledEl.checked) loadPreview();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.settings.updateBc(readForm());
      showToast('Settings saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    }
  });

  container.querySelector('#btn-test')!.addEventListener('click', async () => {
    statusEl.innerHTML = '<span class="status-testing">Testing connection…</span>';
    try {
      const res = await api.settings.testBc();
      if (res.success) {
        statusEl.innerHTML = '<span class="status-success">✅ Connected successfully</span>';
      } else {
        statusEl.innerHTML = `<span class="status-error">❌ ${esc(res.message)}</span>`;
      }
    } catch (err: any) {
      statusEl.innerHTML = `<span class="status-error">❌ ${esc(err.message || 'Connection failed')}</span>`;
    }
  });

  previewTabs.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
    if (!btn) return;
    activeTab = btn.dataset.tab!;
    previewTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-active'));
    btn.classList.add('tab-active');
    loadPreview();
  });

  async function loadPreview() {
    previewContent.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const data = activeTab === 'customers'
        ? await api.bc.customers()
        : await api.bc.contracts();

      if (!data || data.length === 0) {
        previewContent.innerHTML = '<div class="empty-state">No data available.</div>';
        return;
      }

      const keys = Object.keys(data[0]);
      const table = document.createElement('table');
      table.className = 'data-table';
      table.innerHTML = `
        <thead><tr>${keys.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead>
        <tbody>${data.slice(0, 50).map((row: any) =>
          `<tr>${keys.map(k => `<td>${esc(String(row[k] ?? ''))}</td>`).join('')}</tr>`
        ).join('')}</tbody>
      `;
      previewContent.innerHTML = '';
      previewContent.appendChild(table);
    } catch {
      previewContent.innerHTML = `
        <div class="warning-banner">⚠️ Could not load BC data. Showing mock data.</div>
        <table class="data-table">
          <thead><tr><th>Name</th><th>ID</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>CRONUS Sample Co.</td><td>C001</td><td>Active</td></tr>
            <tr><td>Fabrikam Inc.</td><td>C002</td><td>Active</td></tr>
            <tr><td>Contoso Ltd.</td><td>C003</td><td>Inactive</td></tr>
          </tbody>
        </table>
      `;
    }
  }

  // "Notify Me" for other CRMs
  container.querySelectorAll('.integration-grid .btn-ghost').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.textContent = '✓ Subscribed';
      btn.classList.add('btn-subscribed');
      (btn as HTMLButtonElement).disabled = true;
    });
  });

  // Load saved settings
  api.settings.getBc()
    .then(s => {
      fillForm(s);
      if (s.enabled) loadPreview();
    })
    .catch(() => fillForm(DEFAULT_SETTINGS));
}

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
