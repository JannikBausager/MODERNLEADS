import { api, type Lead } from '../api';
import { createLeadCard } from '../components/leadCard';

const STAGES = ['All', 'New', 'Contacted', 'Qualified', 'Disqualified', 'Converted'];

export function render(container: HTMLElement): void {
  let activeStage = 'All';
  let searchQuery = '';

  container.innerHTML = `
    <div class="view-header">
      <h1>📥 Inbox</h1>
      <div class="view-header-actions">
        <input type="text" class="form-input search-input" placeholder="Search leads..." id="inbox-search" />
      </div>
    </div>
    <div class="stage-tabs" id="stage-tabs"></div>
    <div class="lead-count" id="lead-count"></div>
    <div class="lead-list" id="lead-list">
      <div class="loading-spinner"></div>
    </div>
  `;

  const tabsEl = container.querySelector('#stage-tabs') as HTMLElement;
  const listEl = container.querySelector('#lead-list') as HTMLElement;
  const countEl = container.querySelector('#lead-count') as HTMLElement;
  const searchEl = container.querySelector('#inbox-search') as HTMLInputElement;

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const stage of STAGES) {
      const btn = document.createElement('button');
      btn.className = 'tab' + (stage === activeStage ? ' tab-active' : '');
      btn.textContent = stage;
      btn.addEventListener('click', () => {
        activeStage = stage;
        renderTabs();
        loadLeads();
      });
      tabsEl.appendChild(btn);
    }
  }

  async function loadLeads() {
    listEl.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const params: { stage?: string; search?: string } = {};
      if (activeStage !== 'All') params.stage = activeStage;
      if (searchQuery) params.search = searchQuery;

      const leads: Lead[] = await api.leads.list(params);
      countEl.textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''}`;
      listEl.innerHTML = '';

      if (leads.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No leads found.</div>';
        return;
      }

      for (const lead of leads) {
        listEl.appendChild(createLeadCard(lead));
      }
    } catch {
      listEl.innerHTML = '<div class="empty-state error">Failed to load leads.</div>';
    }
  }

  let debounce: ReturnType<typeof setTimeout>;
  searchEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = searchEl.value.trim();
      loadLeads();
    }, 300);
  });

  renderTabs();
  loadLeads();
}
