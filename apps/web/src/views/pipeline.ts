import { api, type Lead } from '../api';
import { showToast } from '../components/toast';

const STAGES = ['New', 'Contacted', 'Qualified', 'Disqualified', 'Converted'];
const STAGE_COLORS: Record<string, string> = {
  New: '#3b82f6',
  Contacted: '#f59e0b',
  Qualified: '#16a34a',
  Disqualified: '#ef4444',
  Converted: '#8b5cf6',
};
const VALID_TRANSITIONS: Record<string, string[]> = {
  New: ['Contacted', 'Disqualified'],
  Contacted: ['Qualified', 'Disqualified'],
  Qualified: ['Converted', 'Disqualified'],
  Disqualified: [],
  Converted: [],
};

export function render(container: HTMLElement): void {
  container.innerHTML = `
    <div class="view-header">
      <h1>📊 Pipeline</h1>
    </div>
    <div class="pipeline-board" id="pipeline-board">
      <div class="loading-spinner"></div>
    </div>
  `;

  loadPipeline(container);
}

async function loadPipeline(container: HTMLElement) {
  const board = container.querySelector('#pipeline-board') as HTMLElement;

  try {
    const leads = await api.leads.list();
    const grouped: Record<string, Lead[]> = {};
    for (const s of STAGES) grouped[s] = [];
    for (const lead of leads) {
      if (grouped[lead.stage]) grouped[lead.stage].push(lead);
    }

    board.innerHTML = '';
    for (const stage of STAGES) {
      const col = document.createElement('div');
      col.className = 'pipeline-col';
      col.dataset.stage = stage;

      const color = STAGE_COLORS[stage];
      col.innerHTML = `
        <div class="pipeline-col-header" style="border-top: 3px solid ${color}">
          <span class="pipeline-col-title">${stage}</span>
          <span class="pipeline-col-count">${grouped[stage].length}</span>
        </div>
        <div class="pipeline-col-body" data-stage="${stage}"></div>
      `;

      const body = col.querySelector('.pipeline-col-body') as HTMLElement;

      for (const lead of grouped[stage]) {
        const card = document.createElement('div');
        card.className = 'pipeline-card card';
        card.draggable = true;
        card.dataset.leadId = lead.id;
        card.dataset.currentStage = lead.stage;
        card.innerHTML = `
          <div class="pipeline-card-name">${esc(lead.contactName)}</div>
          <div class="pipeline-card-company">${esc(lead.companyName)}</div>
          ${lead.score ? `<div class="pipeline-card-score">Score: ${lead.score}</div>` : ''}
        `;

        card.addEventListener('click', () => {
          window.location.hash = '/leads/' + lead.id;
        });

        card.addEventListener('dragstart', (e) => {
          e.dataTransfer!.setData('text/plain', lead.id);
          e.dataTransfer!.setData('application/stage', lead.stage);
          card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
        });

        body.appendChild(card);
      }

      // Drop zone handling
      body.addEventListener('dragover', (e) => {
        e.preventDefault();
        body.classList.add('drag-over');
      });

      body.addEventListener('dragleave', () => {
        body.classList.remove('drag-over');
      });

      body.addEventListener('drop', async (e) => {
        e.preventDefault();
        body.classList.remove('drag-over');

        const leadId = e.dataTransfer!.getData('text/plain');
        const fromStage = e.dataTransfer!.getData('application/stage');
        const toStage = stage;

        if (fromStage === toStage) return;

        const allowed = VALID_TRANSITIONS[fromStage] || [];
        if (!allowed.includes(toStage)) {
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

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
