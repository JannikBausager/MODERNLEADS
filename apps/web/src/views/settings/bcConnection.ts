import { api, type BcSettings } from '../../api.js';
import { showToast } from '../../components/toast.js';

const DEFAULT_SETTINGS: BcSettings = {
  enabled: false,
  tenant: 'DirectionsEmeaWorkshop1.onmicrosoft.com',
  environment: 'PRODUCTION',
  company: 'CRONUS USA, Inc.',
  mcpConfig: 'MCPleads',
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

        <!-- Authentication (Device Code — no app registration needed) -->
        <div class="auth-section" id="auth-section">
          <h4 class="auth-section-title">🔐 Authentication</h4>
          <p class="form-hint" style="margin-bottom:.75rem">
            Sign in with your Microsoft account to connect to Business Central.
            <strong>No app registration required</strong> — we use the device code flow so you just sign in with your browser.
          </p>
          <div class="auth-status" id="auth-status">
            <span class="form-hint">Checking auth status…</span>
          </div>
          <div class="device-code-box" id="device-code-box" style="display:none">
            <div class="device-code-instruction">
              <span class="device-code-step">1.</span>
              Open <a id="device-code-link" href="https://microsoft.com/devicelogin" target="_blank" class="device-code-url">https://microsoft.com/devicelogin</a>
            </div>
            <div class="device-code-instruction">
              <span class="device-code-step">2.</span>
              Enter this code:
              <span class="device-code-value" id="device-code-value"></span>
              <button class="btn btn-sm btn-ghost" id="btn-copy-code" title="Copy code">📋</button>
            </div>
            <div class="device-code-instruction">
              <span class="device-code-step">3.</span>
              Sign in with your Business Central account and approve access.
            </div>
            <div class="device-code-polling" id="device-code-polling">
              <span class="loading-dot"></span> Waiting for you to complete sign-in…
            </div>
          </div>
          <div class="settings-actions" style="border-top:none;padding-top:.5rem">
            <button type="button" class="btn btn-primary btn-microsoft" id="btn-signin">
              <svg width="16" height="16" viewBox="0 0 21 21" fill="none" style="margin-right:6px;vertical-align:middle"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
              Sign in with Microsoft
            </button>
            <button type="button" class="btn btn-secondary" id="btn-signout" style="display:none">Sign Out</button>
          </div>
        </div>

        <hr class="section-divider" />

        <!-- MCP Connection -->
        <form id="bc-settings-form">
          <h4 class="auth-section-title">🔗 MCP Connection</h4>
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
              <div class="input-with-action">
                <input type="text" class="form-input" id="bc-mcp-name" placeholder="e.g. MCPleads" />
                <button type="button" class="btn btn-sm btn-ghost" id="btn-validate-config" title="Validate configuration">✓ Validate</button>
              </div>
              <span class="form-hint">Enter the MCP Server Configuration name from Business Central → MCP Server Configuration page.</span>
            </div>
          </div>
          <div class="mcp-tools-panel" id="mcp-tools-panel" style="display:none">
            <h5 class="mcp-tools-title">Available MCP Tools</h5>
            <div id="mcp-tools-list"></div>
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
          <button class="tab" data-tab="contacts">Contacts</button>
          <button class="tab" data-tab="opportunities">Opportunities</button>
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
  const statusEl = container.querySelector('#connection-status') as HTMLElement;
  const previewSection = container.querySelector('#bc-preview-section') as HTMLElement;
  const previewContent = container.querySelector('#preview-content') as HTMLElement;
  const previewTabs = container.querySelector('#preview-tabs') as HTMLElement;
  const statusBadge = container.querySelector('#bc-status-badge') as HTMLElement;
  const authStatusEl = container.querySelector('#auth-status') as HTMLElement;
  const deviceCodeBox = container.querySelector('#device-code-box') as HTMLElement;
  const deviceCodeValue = container.querySelector('#device-code-value') as HTMLElement;
  const deviceCodePolling = container.querySelector('#device-code-polling') as HTMLElement;
  const btnSignIn = container.querySelector('#btn-signin') as HTMLButtonElement;
  const btnSignOut = container.querySelector('#btn-signout') as HTMLButtonElement;

  let activeTab = 'customers';
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const toolsPanel = container.querySelector('#mcp-tools-panel') as HTMLElement;
  const toolsList = container.querySelector('#mcp-tools-list') as HTMLElement;
  const btnValidate = container.querySelector('#btn-validate-config') as HTMLButtonElement;

  function fillForm(s: BcSettings) {
    enabledEl.checked = s.enabled;
    tenantEl.value = s.tenant;
    envEl.value = s.environment;
    companyEl.value = s.company;
    mcpNameEl.value = s.mcpConfig || '';
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
      mcpConfig: mcpNameEl.value,
      authType: 'bearer',
      accessToken: '',
    };
  }

  function showAuthStatus(signedIn: boolean, username?: string) {
    btnSignIn.style.display = signedIn ? 'none' : '';
    btnSignOut.style.display = signedIn ? '' : 'none';
    deviceCodeBox.style.display = 'none';
    if (signedIn && username) {
      authStatusEl.innerHTML = `<span class="status-success">✅ Signed in as <strong>${esc(username)}</strong></span>`;
    } else if (signedIn) {
      authStatusEl.innerHTML = '<span class="status-success">✅ Authenticated (token stored)</span>';
    } else {
      authStatusEl.innerHTML = '<span class="form-hint">Not signed in. Click "Sign in with Microsoft" to authenticate.</span>';
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // Sign in: start device code flow
  btnSignIn.addEventListener('click', async () => {
    try {
      btnSignIn.disabled = true;
      btnSignIn.textContent = 'Starting…';
      authStatusEl.innerHTML = '<span class="status-testing">Requesting device code…</span>';

      const res = await api.auth.startDeviceCode();

      // Show device code UI
      deviceCodeBox.style.display = 'block';
      deviceCodeValue.textContent = res.userCode;
      deviceCodePolling.innerHTML = '<span class="loading-dot"></span> Waiting for you to complete sign-in…';
      (container.querySelector('#device-code-link') as HTMLAnchorElement).href = res.verificationUri;
      (container.querySelector('#device-code-link') as HTMLAnchorElement).textContent = res.verificationUri;
      authStatusEl.innerHTML = '';

      // Copy code button
      container.querySelector('#btn-copy-code')?.addEventListener('click', () => {
        navigator.clipboard.writeText(res.userCode);
        showToast('Code copied to clipboard!', 'success');
      });

      // Reset button
      btnSignIn.style.display = 'none';

      // Start polling for completion
      stopPolling();
      pollTimer = setInterval(async () => {
        try {
          const poll = await api.auth.pollDeviceCode();
          if (poll.status === 'completed') {
            stopPolling();
            showAuthStatus(true, poll.username);
            showToast(`Signed in as ${poll.username}!`, 'success');
          } else if (poll.status === 'error') {
            stopPolling();
            deviceCodePolling.innerHTML = `<span class="status-error">❌ ${esc(poll.error || 'Authentication failed')}</span>`;
            btnSignIn.style.display = '';
            btnSignIn.disabled = false;
            btnSignIn.innerHTML = `<svg width="16" height="16" viewBox="0 0 21 21" fill="none" style="margin-right:6px;vertical-align:middle"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg> Retry Sign in`;
          } else if (poll.status === 'expired') {
            stopPolling();
            deviceCodePolling.innerHTML = '<span class="status-error">Code expired. Please try again.</span>';
            btnSignIn.style.display = '';
            btnSignIn.disabled = false;
            btnSignIn.innerHTML = `<svg width="16" height="16" viewBox="0 0 21 21" fill="none" style="margin-right:6px;vertical-align:middle"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg> Retry Sign in`;
          }
          // 'pending' — keep polling
        } catch {
          // Network error — keep trying
        }
      }, 2000);

    } catch (err: any) {
      authStatusEl.innerHTML = `<span class="status-error">❌ ${esc(err.message || 'Failed to start sign-in')}</span>`;
      showToast(err.message || 'Sign-in failed', 'error');
      btnSignIn.disabled = false;
      btnSignIn.innerHTML = `<svg width="16" height="16" viewBox="0 0 21 21" fill="none" style="margin-right:6px;vertical-align:middle"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg> Sign in with Microsoft`;
    }
  });

  // Sign out
  btnSignOut.addEventListener('click', async () => {
    try {
      stopPolling();
      await api.auth.signOut();
      showAuthStatus(false);
      showToast('Signed out', 'success');
    } catch (err: any) {
      showToast(err.message || 'Sign-out failed', 'error');
    }
  });

  // Validate MCP Configuration
  btnValidate.addEventListener('click', async () => {
    const configName = mcpNameEl.value.trim();
    if (!configName) {
      showToast('Enter a configuration name first', 'error');
      return;
    }

    btnValidate.disabled = true;
    btnValidate.textContent = 'Validating…';
    toolsPanel.style.display = 'block';
    toolsList.innerHTML = '<span class="form-hint">Connecting to BC MCP server…</span>';

    try {
      // Save current config first so the backend uses it
      await api.settings.updateBc(readForm());

      const res = await api.settings.testBc();
      if (res.success && res.tools?.length) {
        toolsList.innerHTML = res.tools.map((t: any) => `
          <div class="mcp-tool-item">
            <span class="mcp-tool-name">🔧 ${esc(t.name)}</span>
            <span class="mcp-tool-desc">${esc(t.description || '')}</span>
          </div>
        `).join('');
        showToast(`Configuration "${configName}" is valid — ${res.tools.length} tools available`, 'success');
      } else if (res.success) {
        toolsList.innerHTML = `<span class="status-success">✅ Connected but no tools found. Check the configuration in BC.</span>`;
      } else {
        toolsList.innerHTML = `<span class="status-error">❌ ${esc(res.message)}</span>`;
      }
    } catch (err: any) {
      toolsList.innerHTML = `<span class="status-error">❌ ${esc(err.message || 'Validation failed')}</span>`;
    }

    btnValidate.disabled = false;
    btnValidate.textContent = '✓ Validate';
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
      let response: any;
      if (activeTab === 'customers') {
        response = await api.bc.customers();
      } else if (activeTab === 'contacts') {
        response = await api.bc.contacts();
      } else {
        response = await api.bc.opportunities();
      }

      // Response may be { source, data, message } or a raw array
      const data = Array.isArray(response) ? response : response?.data ?? [];
      const source = response?.source ?? 'unknown';
      const message = response?.message ?? '';

      if (!data || data.length === 0) {
        previewContent.innerHTML = '<div class="empty-state">No data available.</div>';
        return;
      }

      const sourceBadge = source === 'bc'
        ? '<span class="opp-source-badge opp-source-live" style="margin-left:.5rem">● BC Live</span>'
        : '<span class="opp-source-badge opp-source-mock" style="margin-left:.5rem">Mock</span>';

      const keys = Object.keys(data[0]);
      const table = document.createElement('div');
      table.innerHTML = `
        ${message ? `<div class="opp-message">${esc(message)}</div>` : ''}
        <div style="font-size:.75rem;color:#64748b;margin-bottom:.5rem">
          Showing ${data.length} records ${sourceBadge}
        </div>
      `;
      const tbl = document.createElement('table');
      tbl.className = 'data-table';
      tbl.innerHTML = `
        <thead><tr>${keys.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead>
        <tbody>${data.slice(0, 20).map((row: any) =>
          `<tr>${keys.map(k => `<td>${esc(String(row[k] ?? ''))}</td>`).join('')}</tr>`
        ).join('')}</tbody>
      `;
      table.appendChild(tbl);
      previewContent.innerHTML = '';
      previewContent.appendChild(table);
    } catch (err: any) {
      previewContent.innerHTML = `<div class="warning-banner">⚠️ ${esc(err.message || 'Could not load data.')}</div>`;
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

  // Check auth status
  api.auth.status()
    .then(s => showAuthStatus(s.signedIn, s.username))
    .catch(() => showAuthStatus(false));
}

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
