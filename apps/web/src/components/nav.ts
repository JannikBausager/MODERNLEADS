import { navigate, currentPath } from '../router';
import { api } from '../api';
import { showToast } from './toast';

export function renderTopbar(container: HTMLElement): void {
  const path = currentPath();
  const isPipeline = path === '/' || path.startsWith('/pipeline') || path.startsWith('/leads/');
  const isCharter = path.startsWith('/agent-charter');
  const isStatistics = path.startsWith('/statistics');
  const isSettings = path.startsWith('/settings');

  container.innerHTML = `
    <div class="topbar">
      <div class="topbar-left">
        <span class="topbar-brand">Lead Agent</span>
        <nav class="topbar-nav">
          <a href="#/pipeline" class="topbar-link ${isPipeline ? 'active' : ''}">Pipeline</a>
          <a href="#/agent-charter" class="topbar-link ${isCharter ? 'active' : ''}">Agent Charter</a>
          <a href="#/statistics" class="topbar-link ${isStatistics ? 'active' : ''}">Statistics</a>
          <a href="#/settings" class="topbar-link ${isSettings ? 'active' : ''}">Settings</a>
        </nav>
      </div>
      <div class="topbar-right">
        <button class="topbar-new-lead" id="topbar-new-lead">+ New Lead</button>
        <span class="topbar-company">CRONUS USA, Inc.</span>
        <span class="topbar-avatar">JB</span>
      </div>
    </div>
  `;

  container.querySelector('#topbar-new-lead')?.addEventListener('click', () => showNewLeadModal());
}

function showNewLeadModal(): void {
  const existing = document.getElementById('modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>New Lead</h3>
        <button class="modal-close">&times;</button>
      </div>
      <form class="modal-body" id="new-lead-form">
        <div class="form-group">
          <label>Contact Name *</label>
          <input type="text" name="contactName" required class="form-input" />
        </div>
        <div class="form-group">
          <label>Company Name *</label>
          <input type="text" name="companyName" required class="form-input" />
        </div>
        <div class="form-group">
          <label>Email *</label>
          <input type="email" name="email" required class="form-input" />
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" name="phone" class="form-input" />
        </div>
        <div class="form-group">
          <label>Source</label>
          <select name="source" class="form-input">
            <option value="">Select source</option>
            <option value="linkedin">LinkedIn</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="twitter">X / Twitter</option>
            <option value="website">Website</option>
            <option value="email">Email</option>
            <option value="form">Form</option>
            <option value="chatbot">Chatbot</option>
            <option value="referral">Referral</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea name="notes" class="form-input" rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Lead</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.modal-cancel')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const form = overlay.querySelector('#new-lead-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === 'string' && v.trim()) data[k] = v.trim();
    });

    try {
      const lead = await api.leads.create(data);
      overlay.remove();
      showToast('Lead created successfully!', 'success');
      navigate('/leads/' + lead.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to create lead', 'error');
    }
  });
}
