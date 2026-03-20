import { api } from '../../api.js';
import { showToast } from '../../components/toast.js';

const WEIGHT_FIELDS = [
  { key: 'companySize', label: 'Company Size', desc: 'Larger companies score higher' },
  { key: 'engagement', label: 'Engagement Level', desc: 'Recent interactions boost score' },
  { key: 'intent', label: 'Intent Signal', desc: 'Clear buying intent increases score' },
  { key: 'budget', label: 'Budget Indicated', desc: 'Known budget boosts qualification' },
  { key: 'decisionMaker', label: 'Decision Maker', desc: 'Direct contact with decision makers' },
];

export function renderScoringSettings(container: HTMLElement): void {
  container.innerHTML = `
    <div class="settings-panel">
      <div class="settings-panel-header">
        <h2>Lead Scoring</h2>
        <p class="settings-panel-desc">Configure how leads are scored and prioritized. Weights should total 100.</p>
      </div>
      <div class="card settings-form-card">
        <form id="scoring-form">
          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" id="scoring-enabled" />
              <span class="toggle-switch"></span>
              Enable AI-powered lead scoring
            </label>
          </div>

          <div class="scoring-section" id="scoring-weights-section">
            <h3 class="section-subtitle">Score Weights</h3>
            <div class="weight-total-bar" id="weight-total">Total: 100 / 100</div>
            ${WEIGHT_FIELDS.map(f => `
              <div class="weight-field">
                <div class="weight-field-header">
                  <label>${f.label}</label>
                  <span class="weight-value" id="val-${f.key}">0</span>
                </div>
                <input type="range" class="weight-slider" id="weight-${f.key}" min="0" max="100" step="5" value="0" data-key="${f.key}" />
                <span class="form-hint">${f.desc}</span>
              </div>
            `).join('')}
          </div>

          <div class="scoring-section">
            <h3 class="section-subtitle">Thresholds</h3>
            <div class="form-group">
              <label>Hot Lead Threshold</label>
              <input type="number" class="form-input form-input-sm" id="scoring-hot" min="0" max="100" />
              <span class="form-hint">Leads above this score are visually highlighted as "hot"</span>
            </div>
            <div class="form-group">
              <label>Auto-Qualify Score</label>
              <input type="number" class="form-input form-input-sm" id="scoring-auto-qualify" min="0" max="100" />
              <span class="form-hint">Leads above this score are automatically moved to Qualified stage</span>
            </div>
          </div>

          <div class="settings-actions">
            <button type="submit" class="btn btn-primary">Save Scoring Rules</button>
          </div>
        </form>
      </div>
    </div>
  `;

  function updateTotal() {
    let total = 0;
    WEIGHT_FIELDS.forEach(f => {
      const val = parseInt((container.querySelector(`#weight-${f.key}`) as HTMLInputElement).value);
      total += val;
      container.querySelector(`#val-${f.key}`)!.textContent = String(val);
    });
    const totalEl = container.querySelector('#weight-total')!;
    totalEl.textContent = `Total: ${total} / 100`;
    totalEl.className = `weight-total-bar ${total === 100 ? 'weight-valid' : 'weight-invalid'}`;
  }

  container.querySelectorAll('.weight-slider').forEach(slider => {
    slider.addEventListener('input', updateTotal);
  });

  api.settings.getScoring().then(s => {
    (container.querySelector('#scoring-enabled') as HTMLInputElement).checked = s.enabled;
    WEIGHT_FIELDS.forEach(f => {
      (container.querySelector(`#weight-${f.key}`) as HTMLInputElement).value = String(s.weights[f.key] || 0);
    });
    (container.querySelector('#scoring-hot') as HTMLInputElement).value = String(s.hotThreshold);
    (container.querySelector('#scoring-auto-qualify') as HTMLInputElement).value = String(s.autoQualifyScore);
    updateTotal();
  }).catch(() => updateTotal());

  container.querySelector('#scoring-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const weights: Record<string, number> = {};
    WEIGHT_FIELDS.forEach(f => {
      weights[f.key] = parseInt((container.querySelector(`#weight-${f.key}`) as HTMLInputElement).value);
    });
    try {
      await api.settings.updateScoring({
        enabled: (container.querySelector('#scoring-enabled') as HTMLInputElement).checked,
        weights,
        hotThreshold: parseInt((container.querySelector('#scoring-hot') as HTMLInputElement).value),
        autoQualifyScore: parseInt((container.querySelector('#scoring-auto-qualify') as HTMLInputElement).value),
      });
      showToast('Scoring rules saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    }
  });
}
