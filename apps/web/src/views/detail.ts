import { api, type Lead, type Interaction } from '../api';
import { renderChatPane } from '../components/chatPane';
import { showToast } from '../components/toast';

const STAGE_ORDER = ['New', 'Contacted', 'Qualified', 'Disqualified', 'Converted'];
const VALID_TRANSITIONS: Record<string, string[]> = {
  New: ['Contacted', 'Disqualified'],
  Contacted: ['Qualified', 'Disqualified'],
  Qualified: ['Converted', 'Disqualified'],
  Disqualified: [],
  Converted: [],
};

const INTERACTION_ICONS: Record<string, string> = {
  note: '📝',
  call: '📞',
  email: '📧',
  meeting: '🤝',
  system: '⚙️',
};

export function render(container: HTMLElement, params: Record<string, string>): void {
  const leadId = params.id;
  if (!leadId) return;

  container.innerHTML = `
    <div class="detail-layout">
      <div class="detail-left" id="detail-left">
        <div class="loading-spinner"></div>
      </div>
      <div class="detail-right" id="detail-right"></div>
    </div>
  `;

  const leftEl = container.querySelector('#detail-left') as HTMLElement;
  const rightEl = container.querySelector('#detail-right') as HTMLElement;

  renderChatPane(rightEl, leadId);
  loadLead(leftEl, leadId);
}

async function loadLead(container: HTMLElement, leadId: string) {
  try {
    const [lead, interactions] = await Promise.all([
      api.leads.get(leadId),
      api.interactions.list(leadId).catch(() => [] as Interaction[]),
    ]);
    renderLeadContent(container, lead, interactions);
  } catch {
    container.innerHTML = '<div class="empty-state error">Failed to load lead.</div>';
  }
}

function renderLeadContent(container: HTMLElement, lead: Lead, interactions: Interaction[]) {
  const stageClass = `badge-${lead.stage.toLowerCase()}`;
  const transitions = VALID_TRANSITIONS[lead.stage] || [];
  const date = new Date(lead.createdAt).toLocaleDateString();
  const updDate = new Date(lead.updatedAt).toLocaleDateString();

  container.innerHTML = `
    <a href="#/inbox" class="back-link">← Back to Inbox</a>
    <div class="card lead-detail-card">
      <div class="lead-detail-header">
        <div>
          <h2>${esc(lead.contactName)}</h2>
          <p class="lead-detail-company">${esc(lead.companyName)}</p>
        </div>
        <span class="badge ${stageClass}">${esc(lead.stage)}</span>
      </div>
      <div class="lead-detail-fields">
        <div class="field-row"><span class="field-label">Email</span><span class="field-value">${esc(lead.email)}</span></div>
        ${lead.phone ? `<div class="field-row"><span class="field-label">Phone</span><span class="field-value">${esc(lead.phone)}</span></div>` : ''}
        ${lead.source ? `<div class="field-row"><span class="field-label">Source</span><span class="field-value">${esc(lead.source)}</span></div>` : ''}
        <div class="field-row"><span class="field-label">Score</span><span class="field-value">${lead.score ?? 'N/A'}</span></div>
        ${lead.nextBestAction ? `<div class="field-row"><span class="field-label">Next Action</span><span class="field-value">${esc(lead.nextBestAction)}</span></div>` : ''}
        ${lead.notes ? `<div class="field-row"><span class="field-label">Notes</span><span class="field-value">${esc(lead.notes)}</span></div>` : ''}
        <div class="field-row"><span class="field-label">Created</span><span class="field-value">${date}</span></div>
        <div class="field-row"><span class="field-label">Updated</span><span class="field-value">${updDate}</span></div>
      </div>
      <div class="lead-detail-actions" id="lead-actions">
        ${transitions.map(s => `<button class="btn btn-sm btn-stage-${s.toLowerCase()}" data-stage="${s}">→ ${s}</button>`).join('')}
        <button class="btn btn-sm btn-secondary" id="btn-enrich">🔍 Enrich</button>
        ${lead.stage === 'Qualified' ? '<button class="btn btn-sm btn-converted" id="btn-convert">🎯 Convert</button>' : ''}
      </div>
    </div>

    <div class="card timeline-card">
      <h3>Timeline</h3>
      <div class="timeline" id="timeline">
        ${interactions.length === 0 ? '<p class="empty-state">No interactions yet.</p>' : ''}
        ${interactions.map(i => `
          <div class="timeline-item">
            <div class="timeline-icon">${INTERACTION_ICONS[i.type] || '📌'}</div>
            <div class="timeline-content">
              <div class="timeline-meta">
                <span class="timeline-type">${esc(i.type)}</span>
                <span class="timeline-date">${new Date(i.createdAt).toLocaleString()}</span>
              </div>
              <div class="timeline-text">${esc(i.content)}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <form class="add-note-form" id="add-note-form">
        <select class="form-input" id="note-type" style="width:auto">
          <option value="note">📝 Note</option>
          <option value="call">📞 Call</option>
          <option value="email">📧 Email</option>
          <option value="meeting">🤝 Meeting</option>
        </select>
        <input type="text" class="form-input" id="note-content" placeholder="Add a note..." required style="flex:1" />
        <button type="submit" class="btn btn-primary btn-sm">Add</button>
      </form>
    </div>
  `;

  // Stage change buttons
  container.querySelectorAll('[data-stage]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newStage = (btn as HTMLElement).dataset.stage!;
      try {
        await api.leads.changeStage(lead.id, newStage, `Changed to ${newStage}`);
        showToast(`Stage changed to ${newStage}`, 'success');
        loadLead(container, lead.id);
      } catch (err: any) {
        showToast(err.message || 'Failed to change stage', 'error');
      }
    });
  });

  // Enrich button
  const enrichBtn = container.querySelector('#btn-enrich');
  enrichBtn?.addEventListener('click', async () => {
    try {
      enrichBtn.textContent = '⏳ Enriching...';
      (enrichBtn as HTMLButtonElement).disabled = true;
      await api.leads.enrich(lead.id);
      showToast('Lead enriched!', 'success');
      loadLead(container, lead.id);
    } catch (err: any) {
      showToast(err.message || 'Enrichment failed', 'error');
      (enrichBtn as HTMLButtonElement).disabled = false;
      enrichBtn.textContent = '🔍 Enrich';
    }
  });

  // Convert button
  const convertBtn = container.querySelector('#btn-convert');
  convertBtn?.addEventListener('click', async () => {
    try {
      await api.leads.convert(lead.id);
      showToast('Lead converted to opportunity!', 'success');
      loadLead(container, lead.id);
    } catch (err: any) {
      showToast(err.message || 'Conversion failed', 'error');
    }
  });

  // Add note form
  const noteForm = container.querySelector('#add-note-form') as HTMLFormElement;
  noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const typeEl = container.querySelector('#note-type') as HTMLSelectElement;
    const contentEl = container.querySelector('#note-content') as HTMLInputElement;
    const content = contentEl.value.trim();
    if (!content) return;

    try {
      await api.interactions.create({ leadId: lead.id, type: typeEl.value, content });
      showToast('Note added!', 'success');
      contentEl.value = '';
      loadLead(container, lead.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to add note', 'error');
    }
  });
}

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
