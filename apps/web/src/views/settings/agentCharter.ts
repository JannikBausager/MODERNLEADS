import { api } from '../../api.js';
import { showToast } from '../../components/toast.js';

interface Challenge {
  id: string;
  description: string;
  response: string;
}

interface GrowthOpportunity {
  id: string;
  description: string;
}

interface AgentCharterData {
  corePriorities: string;
  challenges: Challenge[];
  growthOpportunities: GrowthOpportunity[];
}

let charter: AgentCharterData = {
  corePriorities: '',
  challenges: [],
  growthOpportunities: [],
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function renderAgentCharter(container: HTMLElement): Promise<void> {
  try {
    charter = await api.settings.getAgentCharter();
  } catch {
    // use defaults
  }

  container.innerHTML = `
    <div class="settings-panel agent-charter" style="max-width:900px;margin:0 auto;padding:2rem 1.5rem;">
      <div class="settings-panel-header">
        <h2>🧭 Agent Charter</h2>
        <p class="settings-panel-desc">Define your Lead Agent's mission, acknowledge its challenges, and guide its growth.</p>
      </div>

      <!-- Core Priorities -->
      <div class="card settings-form-card charter-section">
        <div class="charter-section-header">
          <span class="charter-section-icon">🎯</span>
          <div>
            <h3>Core Priorities</h3>
            <p class="charter-section-desc">Describe in plain language what your Lead Agent should focus on. This is the agent's north star — it will use these instructions to prioritize its actions.</p>
          </div>
        </div>
        <textarea id="charter-core-priorities" class="form-input charter-textarea" rows="8" placeholder="Describe what the agent should focus on...">${escapeHtml(charter.corePriorities)}</textarea>
        <div class="charter-hint">💡 Tip: Be specific about your ideal customer profile, preferred communication style, and what "success" looks like for your team.</div>
      </div>

      <!-- Challenges & Setbacks -->
      <div class="card settings-form-card charter-section">
        <div class="charter-section-header">
          <span class="charter-section-icon">⚠️</span>
          <div>
            <h3>Challenges &amp; Setbacks</h3>
            <p class="charter-section-desc">Document difficulties the agent encounters — missing materials, broken pages, low conversion areas. For each challenge, describe how the agent should respond.</p>
          </div>
        </div>
        <div class="charter-table-wrapper">
          <table class="charter-table" id="challenges-table">
            <thead>
              <tr>
                <th class="charter-col-challenge">Challenge</th>
                <th class="charter-col-response">Action Needed</th>
                <th class="charter-col-actions"></th>
              </tr>
            </thead>
            <tbody id="challenges-tbody">
              ${charter.challenges.map(renderChallengeRow).join('')}
            </tbody>
          </table>
        </div>
        <button type="button" class="btn btn-outline charter-add-btn" id="add-challenge">
          <span>+</span> Add Challenge
        </button>
      </div>

      <!-- Opportunities for Growth -->
      <div class="card settings-form-card charter-section">
        <div class="charter-section-header">
          <span class="charter-section-icon">🌱</span>
          <div>
            <h3>Opportunities for Growth</h3>
            <p class="charter-section-desc">Areas where the agent sees potential — new channels to explore, content strategies, market segments to target. The agent reflects on these to suggest proactive improvements.</p>
          </div>
        </div>
        <div id="growth-list" class="charter-list">
          ${charter.growthOpportunities.map(renderGrowthItem).join('')}
        </div>
        <button type="button" class="btn btn-outline charter-add-btn" id="add-growth">
          <span>+</span> Add Opportunity
        </button>
      </div>

      <div class="settings-actions">
        <button type="button" class="btn btn-primary" id="charter-save">Save Charter</button>
      </div>
    </div>
  `;

  bindEvents(container);
}

function renderChallengeRow(c: Challenge): string {
  return `
    <tr data-id="${c.id}">
      <td><textarea class="charter-cell-input challenge-desc" rows="3" placeholder="Describe the challenge...">${escapeHtml(c.description)}</textarea></td>
      <td><textarea class="charter-cell-input challenge-response" rows="3" placeholder="How should the agent respond?">${escapeHtml(c.response)}</textarea></td>
      <td class="charter-cell-actions"><button type="button" class="charter-remove-btn" data-remove="challenge" data-id="${c.id}" title="Remove row">✕</button></td>
    </tr>
  `;
}

function renderGrowthItem(g: GrowthOpportunity): string {
  return `
    <div class="charter-list-item" data-id="${g.id}">
      <div class="charter-item-header">
        <span class="charter-item-label growth">Opportunity</span>
        <button type="button" class="charter-remove-btn" data-remove="growth" data-id="${g.id}" title="Remove">✕</button>
      </div>
      <textarea class="form-input charter-item-input growth-desc" rows="2" placeholder="Describe the growth opportunity (e.g., 'Expand presence on TikTok to reach younger decision-makers in tech startups')">${escapeHtml(g.description)}</textarea>
    </div>
  `;
}

function bindEvents(container: HTMLElement): void {
  // Add challenge row
  container.querySelector('#add-challenge')!.addEventListener('click', () => {
    const newChallenge: Challenge = { id: generateId(), description: '', response: '' };
    charter.challenges.push(newChallenge);
    const tbody = container.querySelector('#challenges-tbody')!;
    tbody.insertAdjacentHTML('beforeend', renderChallengeRow(newChallenge));
    bindRemoveButtons(container);
    const rows = tbody.querySelectorAll('tr');
    const last = rows[rows.length - 1];
    (last.querySelector('.challenge-desc') as HTMLTextAreaElement)?.focus();
  });

  // Add growth opportunity
  container.querySelector('#add-growth')!.addEventListener('click', () => {
    const newGrowth: GrowthOpportunity = { id: generateId(), description: '' };
    charter.growthOpportunities.push(newGrowth);
    const list = container.querySelector('#growth-list')!;
    list.insertAdjacentHTML('beforeend', renderGrowthItem(newGrowth));
    bindRemoveButtons(container);
    const items = list.querySelectorAll('.charter-list-item');
    const last = items[items.length - 1];
    (last.querySelector('.growth-desc') as HTMLTextAreaElement)?.focus();
  });

  // Remove buttons
  bindRemoveButtons(container);

  // Save
  container.querySelector('#charter-save')!.addEventListener('click', async () => {
    collectFormData(container);
    try {
      await api.settings.updateAgentCharter(charter);
      showToast('Agent Charter saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save charter', 'error');
    }
  });
}

function bindRemoveButtons(container: HTMLElement): void {
  container.querySelectorAll('.charter-remove-btn').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  container.querySelectorAll('.charter-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = (btn as HTMLElement).dataset.remove;
      const id = (btn as HTMLElement).dataset.id!;
      if (type === 'challenge') {
        charter.challenges = charter.challenges.filter(c => c.id !== id);
        (btn as HTMLElement).closest('tr')?.remove();
      } else {
        charter.growthOpportunities = charter.growthOpportunities.filter(g => g.id !== id);
        (btn as HTMLElement).closest('.charter-list-item')?.remove();
      }
    });
  });
}

function collectFormData(container: HTMLElement): void {
  charter.corePriorities = (container.querySelector('#charter-core-priorities') as HTMLTextAreaElement).value;

  // Collect challenges from table rows
  const rows = container.querySelectorAll('#challenges-tbody tr');
  charter.challenges = Array.from(rows).map(row => ({
    id: (row as HTMLElement).dataset.id!,
    description: (row.querySelector('.challenge-desc') as HTMLTextAreaElement).value,
    response: (row.querySelector('.challenge-response') as HTMLTextAreaElement).value,
  }));

  // Collect growth opportunities
  const growthItems = container.querySelectorAll('#growth-list .charter-list-item');
  charter.growthOpportunities = Array.from(growthItems).map(item => ({
    id: (item as HTMLElement).dataset.id!,
    description: (item.querySelector('.growth-desc') as HTMLTextAreaElement).value,
  }));
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
