import { navigate, currentPath } from '../router';
import { api } from '../api';
import { showToast } from './toast';

const NAV_ITEMS = [
  { hash: '/inbox', icon: '📥', label: 'Inbox' },
  { hash: '/pipeline', icon: '📊', label: 'Pipeline' },
  { hash: '/today', icon: '⭐', label: 'Today' },
  { hash: '/settings', icon: '⚙️', label: 'Settings' },
];

export function renderNav(sidebar: HTMLElement): void {
  sidebar.innerHTML = '';

  const brand = document.createElement('div');
  brand.className = 'nav-brand';
  brand.innerHTML = '<span class="nav-brand-icon">🚀</span> Lead Copilot';
  sidebar.appendChild(brand);

  const list = document.createElement('ul');
  list.className = 'nav-list';

  const path = currentPath();
  for (const item of NAV_ITEMS) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + item.hash;
    a.className = 'nav-link' + (path.startsWith(item.hash) ? ' active' : '');
    a.innerHTML = `<span class="nav-icon">${item.icon}</span> ${item.label}`;
    li.appendChild(a);
    list.appendChild(li);
  }
  sidebar.appendChild(list);

  const spacer = document.createElement('div');
  spacer.className = 'nav-spacer';
  sidebar.appendChild(spacer);

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary nav-new-lead';
  btn.textContent = '+ New Lead';
  btn.addEventListener('click', () => showNewLeadModal());
  sidebar.appendChild(btn);
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
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="cold-call">Cold Call</option>
            <option value="linkedin">LinkedIn</option>
            <option value="other">Other</option>
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
