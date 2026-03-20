import { api } from '../../api.js';
import { showToast } from '../../components/toast.js';

const NOTIFICATIONS = [
  { key: 'newLead', label: 'New lead received', desc: 'Get notified when a new lead enters the pipeline', icon: '📥' },
  { key: 'stageChange', label: 'Lead stage changed', desc: 'Alert when a lead moves to a new pipeline stage', icon: '🔄' },
  { key: 'goingCold', label: 'Lead going cold', desc: 'Warning when leads have no activity for 7+ days', icon: '❄️' },
  { key: 'dailySummary', label: 'Daily pipeline summary', desc: 'Receive a daily digest of your pipeline activity', icon: '📊' },
];

export function renderNotificationSettings(container: HTMLElement): void {
  container.innerHTML = `
    <div class="settings-panel">
      <div class="settings-panel-header">
        <h2>Notifications</h2>
        <p class="settings-panel-desc">Choose which alerts and summaries you want to receive.</p>
      </div>
      <div class="card settings-form-card">
        <form id="notif-form">
          <div class="notif-list">
            ${NOTIFICATIONS.map(n => `
              <div class="notif-item">
                <div class="notif-left">
                  <span class="notif-icon">${n.icon}</span>
                  <div class="notif-info">
                    <span class="notif-label">${n.label}</span>
                    <span class="notif-desc">${n.desc}</span>
                  </div>
                </div>
                <label class="toggle-label compact">
                  <input type="checkbox" id="notif-${n.key}" />
                  <span class="toggle-switch"></span>
                </label>
              </div>
            `).join('')}
          </div>
          <div class="settings-actions">
            <button type="submit" class="btn btn-primary">Save Preferences</button>
          </div>
        </form>
      </div>
    </div>
  `;

  api.settings.getNotifications().then(s => {
    NOTIFICATIONS.forEach(n => {
      (container.querySelector(`#notif-${n.key}`) as HTMLInputElement).checked = (s as any)[n.key];
    });
  }).catch(() => {});

  container.querySelector('#notif-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data: Record<string, boolean> = {};
    NOTIFICATIONS.forEach(n => {
      data[n.key] = (container.querySelector(`#notif-${n.key}`) as HTMLInputElement).checked;
    });
    try {
      await api.settings.updateNotifications(data);
      showToast('Notification preferences saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    }
  });
}
