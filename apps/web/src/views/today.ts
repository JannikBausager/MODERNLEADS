import { api, type Lead } from '../api';
import { showToast } from '../components/toast';

export function render(container: HTMLElement): void {
  container.innerHTML = `
    <div class="view-header">
      <h1>⭐ Today — Prioritized Leads</h1>
    </div>
    <div class="today-list" id="today-list">
      <div class="loading-spinner"></div>
    </div>
  `;

  loadPrioritized(container);
}

async function loadPrioritized(container: HTMLElement) {
  const listEl = container.querySelector('#today-list') as HTMLElement;

  try {
    const leads: Lead[] = await api.leads.prioritized();
    const filtered = leads.filter(l => l.stage !== 'Converted' && l.stage !== 'Disqualified');
    listEl.innerHTML = '';

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No prioritized leads for today.</div>';
      return;
    }

    for (const lead of filtered) {
      const card = document.createElement('div');
      card.className = 'card today-card';

      const stageClass = `badge-${lead.stage.toLowerCase()}`;
      card.innerHTML = `
        <div class="today-card-score">${lead.score ?? 0}</div>
        <div class="today-card-info">
          <div class="today-card-name">${esc(lead.contactName)}</div>
          <div class="today-card-company">${esc(lead.companyName)}</div>
          ${lead.nextBestAction ? `<div class="today-card-action">💡 ${esc(lead.nextBestAction)}</div>` : ''}
          <span class="badge ${stageClass}">${esc(lead.stage)}</span>
        </div>
        <div class="today-card-buttons">
          ${lead.stage === 'New' ? '<button class="btn btn-sm btn-contacted" data-action="contact">📞 Contact</button>' : ''}
          <button class="btn btn-sm btn-secondary" data-action="enrich">🔍 Enrich</button>
          <button class="btn btn-sm btn-primary" data-action="view">👁 View</button>
        </div>
      `;

      card.querySelector('[data-action="view"]')?.addEventListener('click', () => {
        window.location.hash = '/leads/' + lead.id;
      });

      card.querySelector('[data-action="enrich"]')?.addEventListener('click', async (e) => {
        const btn = e.target as HTMLButtonElement;
        btn.disabled = true;
        btn.textContent = '⏳';
        try {
          await api.leads.enrich(lead.id);
          showToast('Lead enriched!', 'success');
          loadPrioritized(container);
        } catch (err: any) {
          showToast(err.message || 'Enrichment failed', 'error');
          btn.disabled = false;
          btn.textContent = '🔍 Enrich';
        }
      });

      card.querySelector('[data-action="contact"]')?.addEventListener('click', async (e) => {
        const btn = e.target as HTMLButtonElement;
        if (!confirm(`Mark "${lead.contactName}" as Contacted?`)) return;
        btn.disabled = true;
        try {
          await api.leads.changeStage(lead.id, 'Contacted', 'Contacted from Today view');
          showToast('Lead marked as Contacted', 'success');
          loadPrioritized(container);
        } catch (err: any) {
          showToast(err.message || 'Failed to update', 'error');
          btn.disabled = false;
        }
      });

      listEl.appendChild(card);
    }
  } catch {
    listEl.innerHTML = '<div class="empty-state error">Failed to load prioritized leads.</div>';
  }
}

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
