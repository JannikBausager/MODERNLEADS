import { api, type Lead } from '../api';
import { showToast } from '../components/toast';

const STAGES = ['New', 'Contacted', 'Qualified', 'Disqualified', 'Converted'];
const VALID_TRANSITIONS: Record<string, string[]> = {
  New: ['Contacted', 'Disqualified'],
  Contacted: ['Qualified', 'Disqualified'],
  Qualified: ['Converted', 'Disqualified'],
  Disqualified: [],
  Converted: [],
};

const SOURCE_ICONS: Record<string, string> = {
  email: '📧',
  form: '📋',
  chatbot: '💬',
  manual: '✏️',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return 'now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function isNew24h(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

function scoreClass(score: number): string {
  if (score >= 70) return 'score-high';
  if (score >= 40) return 'score-mid';
  return 'score-low';
}

export function renderPipeline(container: HTMLElement): void {
  container.innerHTML = `
    <div class="pipeline-header">
      <h1>Pipeline</h1>
      <div class="pipeline-stats" id="pipeline-stats"></div>
    </div>
    <div class="pipeline-board" id="pipeline-board">
      <div class="loading-spinner"></div>
    </div>
  `;

  loadPipeline(container);
}

async function loadPipeline(container: HTMLElement) {
  const board = container.querySelector('#pipeline-board') as HTMLElement;
  const statsEl = container.querySelector('#pipeline-stats') as HTMLElement;

  try {
    const leads = await api.leads.list();
    const grouped: Record<string, Lead[]> = {};
    for (const s of STAGES) grouped[s] = [];
    for (const lead of leads) {
      if (grouped[lead.stage]) grouped[lead.stage].push(lead);
    }

    // Stats
    const totalValue = leads.reduce((sum, l) => sum + (l.score ?? 0), 0);
    statsEl.innerHTML = `
      <span class="stat"><strong>${leads.length}</strong> leads</span>
      <span class="stat"><strong>${totalValue}</strong> pipeline score</span>
    `;

    board.innerHTML = '';
    for (const stage of STAGES) {
      const col = document.createElement('div');
      col.className = 'pipeline-col';
      col.dataset.stage = stage;

      col.innerHTML = `
        <div class="pipeline-col-header">
          <span class="pipeline-col-title">${stage}</span>
          <span class="pipeline-col-count">${grouped[stage].length}</span>
        </div>
        <div class="pipeline-col-body" data-stage="${stage}"></div>
      `;

      const body = col.querySelector('.pipeline-col-body') as HTMLElement;

      for (const lead of grouped[stage]) {
        const card = buildCard(lead, stage, container);
        body.appendChild(card);
      }

      // Drop zone handling
      body.addEventListener('dragover', (e) => {
        e.preventDefault();
        const fromStage = e.dataTransfer!.types.includes('application/stage')
          ? (body.dataset as any).__dragFrom ?? ''
          : '';
        body.classList.add('drag-over');
      });

      body.addEventListener('dragenter', (e) => {
        e.preventDefault();
      });

      body.addEventListener('dragleave', (e) => {
        const relTarget = e.relatedTarget as Node | null;
        if (!body.contains(relTarget)) {
          body.classList.remove('drag-over');
          body.classList.remove('drag-invalid');
        }
      });

      body.addEventListener('drop', async (e) => {
        e.preventDefault();
        body.classList.remove('drag-over');
        body.classList.remove('drag-invalid');

        const leadId = e.dataTransfer!.getData('text/plain');
        const fromStage = e.dataTransfer!.getData('application/stage');
        const toStage = stage;

        if (fromStage === toStage) return;

        const allowed = VALID_TRANSITIONS[fromStage] || [];
        if (!allowed.includes(toStage)) {
          body.classList.add('drag-invalid');
          setTimeout(() => body.classList.remove('drag-invalid'), 600);
          showToast(`Cannot move from ${fromStage} to ${toStage}`, 'error');
          return;
        }

        try {
          await api.leads.changeStage(leadId, toStage, `Moved from ${fromStage} to ${toStage}`);
          showToast(`Lead moved to ${toStage}`, 'success');
          loadPipeline(container);
        } catch (err: any) {
          showToast(err.message || 'Failed to change stage', 'error');
        }
      });

      board.appendChild(col);
    }
  } catch {
    board.innerHTML = '<div class="empty-state error">Failed to load pipeline.</div>';
  }
}

function buildCard(lead: Lead, stage: string, pipelineContainer: HTMLElement): HTMLElement {
  const card = document.createElement('div');
  card.className = 'pipeline-card';
  card.draggable = true;
  card.dataset.leadId = lead.id;
  card.dataset.stage = lead.stage;

  const score = lead.score ?? 0;
  const sClass = scoreClass(score);
  const sourceIcon = SOURCE_ICONS[lead.source ?? ''] ?? '';
  const age = timeAgo(lead.createdAt);
  const newIn24h = stage === 'New' && isNew24h(lead.createdAt);

  if (newIn24h) card.classList.add('is-new');

  let html = '';
  if (newIn24h) {
    html += '<span class="pipeline-card-new-badge">NEW</span>';
  }

  html += `
    <div class="pipeline-card-header">
      <span class="pipeline-card-name">${esc(lead.contactName)}</span>
      <span class="pipeline-card-score ${sClass}" title="Lead Score">${score}</span>
    </div>
    <div class="pipeline-card-company">${esc(lead.companyName)}</div>
  `;

  if (lead.nextBestAction) {
    html += `<div class="pipeline-card-action" title="Next best action">💡 ${esc(lead.nextBestAction)}</div>`;
  }

  html += `
    <div class="pipeline-card-footer">
      <span class="pipeline-card-source">${sourceIcon}</span>
      <span class="pipeline-card-age">${age}</span>
    </div>
  `;

  if (stage === 'Qualified') {
    html += `<button class="pipeline-card-convert">🎯 Convert</button>`;
  }

  card.innerHTML = html;

  // Single click — select lead
  card.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.pipeline-card-convert')) return;

    // Remove selected from all cards
    document.querySelectorAll('.pipeline-card.selected').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    // Dispatch lead-selected event
    window.dispatchEvent(new CustomEvent('lead-selected', { detail: { lead } }));
  });

  // Double click — navigate to detail
  card.addEventListener('dblclick', () => {
    window.location.hash = '/leads/' + lead.id;
  });

  // Drag
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer!.setData('text/plain', lead.id);
    e.dataTransfer!.setData('application/stage', lead.stage);
    card.classList.add('dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  // Convert button
  const convertBtn = card.querySelector('.pipeline-card-convert');
  if (convertBtn) {
    convertBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Dispatch through copilot panel
      window.dispatchEvent(new CustomEvent('lead-selected', { detail: { lead } }));
      window.dispatchEvent(new CustomEvent('copilot-convert', { detail: { lead } }));
      try {
        await api.leads.convert(lead.id);
        showToast('Lead converted to opportunity!', 'success');
        loadPipeline(pipelineContainer);
      } catch (err: any) {
        showToast(err.message || 'Conversion failed', 'error');
      }
    });
  }

  return card;
}

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
