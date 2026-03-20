import { api } from '../../api.js';
import { showToast } from '../../components/toast.js';

export function renderGeneralSettings(container: HTMLElement): void {
  container.innerHTML = `
    <div class="settings-panel">
      <div class="settings-panel-header">
        <h2>General</h2>
        <p class="settings-panel-desc">Configure general Lead Agent behavior and defaults.</p>
      </div>
      <div class="card settings-form-card">
        <form id="general-settings-form">
          <div class="form-group">
            <label>Default Lead Owner</label>
            <input type="text" class="form-input" id="general-owner" placeholder="e.g., sales@company.com" />
            <span class="form-hint">New leads are assigned to this owner by default</span>
          </div>
          <div class="form-group">
            <label>Timezone</label>
            <select class="form-input" id="general-timezone">
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (US)</option>
              <option value="America/Chicago">Central Time (US)</option>
              <option value="America/Denver">Mountain Time (US)</option>
              <option value="America/Los_Angeles">Pacific Time (US)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Europe/Copenhagen">Copenhagen (CET)</option>
              <option value="Europe/Berlin">Berlin (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
              <option value="Asia/Singapore">Singapore (SGT)</option>
              <option value="Australia/Sydney">Sydney (AEST)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" id="general-auto-assign" />
              <span class="toggle-switch"></span>
              Auto-assign new leads to default owner
            </label>
          </div>
          <div class="form-group">
            <label>Lead Sources</label>
            <input type="text" class="form-input" id="general-sources" placeholder="email, form, chatbot, manual, linkedin" />
            <span class="form-hint">Comma-separated list of allowed lead sources</span>
          </div>
          <div class="settings-actions">
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  api.settings.getGeneral().then(s => {
    (container.querySelector('#general-owner') as HTMLInputElement).value = s.defaultOwner;
    (container.querySelector('#general-timezone') as HTMLSelectElement).value = s.timezone;
    (container.querySelector('#general-auto-assign') as HTMLInputElement).checked = s.autoAssign;
    (container.querySelector('#general-sources') as HTMLInputElement).value = (s.leadSources || []).join(', ');
  }).catch(() => {});

  container.querySelector('#general-settings-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.settings.updateGeneral({
        defaultOwner: (container.querySelector('#general-owner') as HTMLInputElement).value,
        timezone: (container.querySelector('#general-timezone') as HTMLSelectElement).value,
        autoAssign: (container.querySelector('#general-auto-assign') as HTMLInputElement).checked,
        leadSources: (container.querySelector('#general-sources') as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean),
      });
      showToast('General settings saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    }
  });
}
