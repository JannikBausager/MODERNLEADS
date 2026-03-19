import type { Lead } from '../api';

const STAGE_CLASSES: Record<string, string> = {
  New: 'badge-new',
  Contacted: 'badge-contacted',
  Qualified: 'badge-qualified',
  Disqualified: 'badge-disqualified',
  Converted: 'badge-converted',
};

export function createLeadCard(lead: Lead, options?: { compact?: boolean; draggable?: boolean }): HTMLElement {
  const card = document.createElement('div');
  card.className = 'lead-card card';
  card.dataset.leadId = lead.id;

  if (options?.draggable) {
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer!.setData('text/plain', lead.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  }

  const badgeCls = STAGE_CLASSES[lead.stage] || 'badge-new';
  const score = lead.score ?? 0;
  const date = new Date(lead.createdAt).toLocaleDateString();

  if (options?.compact) {
    card.innerHTML = `
      <div class="lead-card-compact">
        <div class="lead-card-name">${esc(lead.contactName)}</div>
        <div class="lead-card-company">${esc(lead.companyName)}</div>
        ${score > 0 ? `<div class="lead-card-score">${score}</div>` : ''}
      </div>
    `;
  } else {
    card.innerHTML = `
      <div class="lead-card-row">
        <div class="lead-card-info">
          <div class="lead-card-name">${esc(lead.contactName)}</div>
          <div class="lead-card-company">${esc(lead.companyName)}</div>
          <div class="lead-card-email">${esc(lead.email)}</div>
        </div>
        <div class="lead-card-meta">
          <span class="badge ${badgeCls}">${esc(lead.stage)}</span>
          ${score > 0 ? `<span class="lead-card-score">${score}</span>` : ''}
          <span class="lead-card-date">${date}</span>
        </div>
      </div>
    `;
  }

  card.addEventListener('click', () => {
    window.location.hash = '/leads/' + lead.id;
  });

  return card;
}

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
