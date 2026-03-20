import { api } from '../api.js';
import { showToast } from '../components/toast.js';

interface ScoringRule {
  id: string;
  category: string;
  signal: string;
  description: string;
  score: number;
  enabled: number;
  isDefault: number;
}

const CATEGORY_META: Record<string, { label: string; accent: string; icon: string }> = {
  engagement: { label: 'Engagement Signals', accent: '#16a34a', icon: '💬' },
  fit: { label: 'Fit Signals', accent: '#2563eb', icon: '🎯' },
  negative: { label: 'Negative Signals', accent: '#dc2626', icon: '⚠️' },
  decay: { label: 'Decay', accent: '#d97706', icon: '⏳' },
};

let rules: ScoringRule[] = [];
let pendingChanges: Map<string, Partial<ScoringRule>> = new Map();

export async function renderLinkedInScoring(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="scoring-page">
      <div class="scoring-page-header">
        <h1>LinkedIn Lead Scoring</h1>
        <p class="scoring-page-subtitle">Configure how LinkedIn engagement signals are scored to prioritize your best leads.</p>
      </div>
      <div id="scoring-categories-area"><p style="color:#5f6368;">Loading scoring rules...</p></div>
      <div class="nl-rule-creator" id="nl-rule-creator">
        <h3>Natural Language Rule Creator</h3>
        <p style="font-size:.85rem;color:#5f6368;margin-bottom:.75rem;">Describe a scoring rule in plain English and we'll parse it for you.</p>
        <div class="nl-rule-input-row">
          <input type="text" class="form-input" id="nl-rule-input" placeholder="Describe a scoring rule in plain English..." />
          <button class="btn btn-primary" id="nl-rule-btn">Add Rule</button>
        </div>
        <div id="nl-rule-preview"></div>
      </div>
      <div class="scoring-page-actions">
        <button class="btn btn-primary" id="scoring-save-btn">Save Changes</button>
        <button class="btn btn-secondary" id="scoring-reset-btn">Reset to Defaults</button>
      </div>
    </div>
  `;

  await loadAndRenderRules(container);
  bindActions(container);
}

async function loadAndRenderRules(container: HTMLElement): Promise<void> {
  try {
    rules = await api.linkedin.getScoringRules();
    pendingChanges.clear();
    renderCategories(container);
  } catch (err: any) {
    const area = container.querySelector('#scoring-categories-area');
    if (area) area.innerHTML = `<p style="color:#dc2626;">Failed to load rules: ${err.message || 'Unknown error'}</p>`;
  }
}

function renderCategories(container: HTMLElement): void {
  const area = container.querySelector('#scoring-categories-area');
  if (!area) return;

  const grouped: Record<string, ScoringRule[]> = {};
  for (const r of rules) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  const order = ['engagement', 'fit', 'negative', 'decay'];
  area.innerHTML = order
    .filter(cat => grouped[cat]?.length)
    .map(cat => {
      const meta = CATEGORY_META[cat] || { label: cat, accent: '#6b7280', icon: '📋' };
      const catRules = grouped[cat];
      return `
        <div class="scoring-category" style="border-left-color: ${meta.accent};">
          <div class="scoring-category-header">
            <span class="scoring-category-icon">${meta.icon}</span>
            <h2 class="scoring-category-title">${meta.label}</h2>
            <span class="scoring-category-count">${catRules.length} rule${catRules.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="scoring-rules-list">
            ${catRules.map(rule => renderRuleRow(rule)).join('')}
          </div>
        </div>
      `;
    })
    .join('');

  // Bind rule row events
  area.querySelectorAll('.scoring-rule-toggle input').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const id = (e.target as HTMLInputElement).dataset.ruleId!;
      const enabled = (e.target as HTMLInputElement).checked ? 1 : 0;
      trackChange(id, { enabled });
    });
  });

  area.querySelectorAll('.scoring-rule-score').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = (e.target as HTMLInputElement).dataset.ruleId!;
      const score = parseInt((e.target as HTMLInputElement).value) || 0;
      trackChange(id, { score });
    });
  });

  area.querySelectorAll('.scoring-rule-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.ruleId!;
      const rule = rules.find(r => r.id === id);
      if (rule) showEditModal(rule, container);
    });
  });

  area.querySelectorAll('.scoring-rule-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.ruleId!;
      if (!confirm('Delete this custom rule?')) return;
      try {
        await api.linkedin.deleteScoringRule(id);
        showToast('Rule deleted', 'success');
        await loadAndRenderRules(container);
      } catch (err: any) {
        showToast(err.message || 'Cannot delete this rule', 'error');
      }
    });
  });
}

function renderRuleRow(rule: ScoringRule): string {
  const pending = pendingChanges.get(rule.id);
  const enabled = pending?.enabled !== undefined ? pending.enabled : rule.enabled;
  const score = pending?.score !== undefined ? pending.score : rule.score;

  return `
    <div class="scoring-rule-row">
      <label class="scoring-rule-toggle">
        <input type="checkbox" ${enabled ? 'checked' : ''} data-rule-id="${rule.id}" />
        <span class="toggle-switch"></span>
      </label>
      <div class="scoring-rule-info">
        <span class="scoring-rule-name">${formatSignal(rule.signal)}</span>
        <span class="scoring-rule-desc">${rule.description}</span>
      </div>
      <input type="number" class="scoring-rule-score" value="${score}" data-rule-id="${rule.id}" />
      <button class="btn btn-sm btn-ghost scoring-rule-edit" data-rule-id="${rule.id}" title="Edit">✏️</button>
      ${!rule.isDefault ? `<button class="btn btn-sm btn-ghost scoring-rule-delete" data-rule-id="${rule.id}" title="Delete">🗑️</button>` : ''}
    </div>
  `;
}

function formatSignal(signal: string): string {
  return signal.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function trackChange(id: string, changes: Partial<ScoringRule>): void {
  const existing = pendingChanges.get(id) || {};
  pendingChanges.set(id, { ...existing, ...changes });
}

function showEditModal(rule: ScoringRule, container: HTMLElement): void {
  const existing = document.getElementById('modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Edit Scoring Rule</h3>
        <button class="modal-close">&times;</button>
      </div>
      <form class="modal-body" id="edit-rule-form">
        <div class="form-group">
          <label>Signal</label>
          <input type="text" class="form-input" id="edit-signal" value="${rule.signal}" ${rule.isDefault ? 'readonly' : ''} />
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" class="form-input" id="edit-desc" value="${rule.description}" />
        </div>
        <div class="form-group">
          <label>Category</label>
          <select class="form-input" id="edit-category">
            <option value="engagement" ${rule.category === 'engagement' ? 'selected' : ''}>Engagement</option>
            <option value="fit" ${rule.category === 'fit' ? 'selected' : ''}>Fit</option>
            <option value="negative" ${rule.category === 'negative' ? 'selected' : ''}>Negative</option>
            <option value="decay" ${rule.category === 'decay' ? 'selected' : ''}>Decay</option>
          </select>
        </div>
        <div class="form-group">
          <label>Score</label>
          <input type="number" class="form-input form-input-sm" id="edit-score" value="${rule.score}" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.modal-close')!.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.modal-cancel')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#edit-rule-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.linkedin.updateScoringRule(rule.id, {
        signal: (overlay.querySelector('#edit-signal') as HTMLInputElement).value,
        description: (overlay.querySelector('#edit-desc') as HTMLInputElement).value,
        category: (overlay.querySelector('#edit-category') as HTMLSelectElement).value,
        score: parseInt((overlay.querySelector('#edit-score') as HTMLInputElement).value),
        enabled: rule.enabled,
      });
      overlay.remove();
      showToast('Rule updated!', 'success');
      await loadAndRenderRules(container);
    } catch (err: any) {
      showToast(err.message || 'Failed to update rule', 'error');
    }
  });
}

function bindActions(container: HTMLElement): void {
  // Save Changes
  container.querySelector('#scoring-save-btn')?.addEventListener('click', async () => {
    if (pendingChanges.size === 0) {
      showToast('No changes to save', 'info');
      return;
    }
    try {
      for (const [id, changes] of pendingChanges.entries()) {
        const rule = rules.find(r => r.id === id);
        if (!rule) continue;
        await api.linkedin.updateScoringRule(id, {
          ...rule,
          ...changes,
        });
      }
      showToast(`Saved ${pendingChanges.size} change(s)!`, 'success');
      await loadAndRenderRules(container);
    } catch (err: any) {
      showToast(err.message || 'Failed to save changes', 'error');
    }
  });

  // Reset to Defaults
  container.querySelector('#scoring-reset-btn')?.addEventListener('click', async () => {
    if (!confirm('Reset all scoring rules to defaults? This will delete any custom rules.')) return;
    try {
      await api.linkedin.resetScoringDefaults();
      showToast('Scoring rules reset to defaults', 'success');
      await loadAndRenderRules(container);
    } catch (err: any) {
      showToast(err.message || 'Failed to reset', 'error');
    }
  });

  // Natural Language Rule Creator
  container.querySelector('#nl-rule-btn')?.addEventListener('click', async () => {
    const input = container.querySelector('#nl-rule-input') as HTMLInputElement;
    const text = input.value.trim();
    if (!text) {
      showToast('Enter a rule description first', 'info');
      return;
    }

    const preview = container.querySelector('#nl-rule-preview') as HTMLElement;
    preview.innerHTML = '<p style="color:#5f6368;">Interpreting...</p>';

    try {
      const parsed = await api.linkedin.interpretRule(text);
      const meta = CATEGORY_META[parsed.category] || { label: parsed.category, accent: '#6b7280', icon: '📋' };
      preview.innerHTML = `
        <div class="nl-rule-preview-card" style="border-left-color: ${meta.accent};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <strong>${formatSignal(parsed.signal)}</strong>
              <p style="font-size:.85rem;color:#5f6368;margin:.25rem 0;">${parsed.description}</p>
              <span style="font-size:.75rem;background:#f3f4f6;padding:.15rem .5rem;border-radius:4px;">${meta.label}</span>
              <span style="font-size:.75rem;margin-left:.5rem;color:#5f6368;">Confidence: ${Math.round(parsed.confidence * 100)}%</span>
            </div>
            <span style="font-size:1.25rem;font-weight:700;color:${parsed.score >= 0 ? '#16a34a' : '#dc2626'};">${parsed.score >= 0 ? '+' : ''}${parsed.score}</span>
          </div>
          <div style="margin-top:.75rem;display:flex;gap:.5rem;">
            <button class="btn btn-sm btn-primary" id="nl-confirm-btn">Confirm & Add</button>
            <button class="btn btn-sm btn-secondary" id="nl-cancel-btn">Cancel</button>
          </div>
        </div>
      `;

      preview.querySelector('#nl-confirm-btn')?.addEventListener('click', async () => {
        try {
          await api.linkedin.createScoringRule({
            category: parsed.category,
            signal: parsed.signal,
            description: parsed.description,
            score: parsed.score,
          });
          showToast('Custom rule added!', 'success');
          input.value = '';
          preview.innerHTML = '';
          await loadAndRenderRules(container);
        } catch (err: any) {
          showToast(err.message || 'Failed to add rule', 'error');
        }
      });

      preview.querySelector('#nl-cancel-btn')?.addEventListener('click', () => {
        preview.innerHTML = '';
      });
    } catch (err: any) {
      preview.innerHTML = `<p style="color:#dc2626;">Failed to interpret: ${err.message || 'Unknown error'}</p>`;
    }
  });

  // Allow enter key in input
  container.querySelector('#nl-rule-input')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      e.preventDefault();
      (container.querySelector('#nl-rule-btn') as HTMLButtonElement)?.click();
    }
  });
}
