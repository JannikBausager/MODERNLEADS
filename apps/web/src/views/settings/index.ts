import { renderGeneralSettings } from './general.js';
import { renderScoringSettings } from './scoring.js';
import { renderNotificationSettings } from './notifications.js';
import { renderBcConnection } from './bcConnection.js';
import { renderConnectionCategory } from './integrations.js';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
}

interface SidebarGroup {
  group: string;
  items: SidebarItem[];
}

const SIDEBAR_SECTIONS: SidebarGroup[] = [
  {
    group: 'Lead Agent',
    items: [
      { id: 'general', label: 'General', icon: '⚙️' },
      { id: 'scoring', label: 'Scoring', icon: '📊' },
      { id: 'notifications', label: 'Notifications', icon: '🔔' },
    ],
  },
  {
    group: 'Connections',
    items: [
      { id: 'opportunity', label: 'Opportunity Management', icon: '💼' },
      { id: 'social', label: 'Social Media', icon: '🌐' },
      { id: 'chatbot', label: 'Chat Bots', icon: '💬' },
      { id: 'email', label: 'Email & Calendar', icon: '📧' },
      { id: 'forms', label: 'Survey & Forms', icon: '📋' },
      { id: 'voice', label: 'Voice & Calls', icon: '📞' },
      { id: 'enrichment', label: 'Data Enrichment', icon: '🔍' },
      { id: 'marketing', label: 'Marketing Automation', icon: '📣' },
    ],
  },
];

let activeSection = 'general';

export function render(container: HTMLElement): void {
  container.innerHTML = `
    <div class="settings-hub">
      <div class="settings-sidebar" id="settings-sidebar"></div>
      <div class="settings-content" id="settings-content"></div>
    </div>
  `;

  renderSidebar(container);
  renderSection(container);
}

function renderSidebar(container: HTMLElement): void {
  const sidebar = container.querySelector('#settings-sidebar')!;
  sidebar.innerHTML = `
    <div class="settings-sidebar-header">
      <h2>⚙️ Settings</h2>
    </div>
    ${SIDEBAR_SECTIONS.map(section => `
      <div class="settings-sidebar-group">
        <div class="settings-sidebar-group-label">${section.group}</div>
        ${section.items.map(item => `
          <button class="settings-sidebar-item ${item.id === activeSection ? 'active' : ''}" data-section="${item.id}">
            <span class="settings-sidebar-icon">${item.icon}</span>
            <span class="settings-sidebar-label">${item.label}</span>
          </button>
        `).join('')}
      </div>
    `).join('')}
  `;

  sidebar.querySelectorAll('.settings-sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSection = (btn as HTMLElement).dataset.section!;
      renderSidebar(container);
      renderSection(container);
    });
  });
}

function renderSection(container: HTMLElement): void {
  const content = container.querySelector('#settings-content') as HTMLElement;
  if (!content) return;

  switch (activeSection) {
    case 'general':
      renderGeneralSettings(content);
      break;
    case 'scoring':
      renderScoringSettings(content);
      break;
    case 'notifications':
      renderNotificationSettings(content);
      break;
    case 'opportunity':
      renderBcConnection(content);
      break;
    default:
      renderConnectionCategory(content, activeSection);
      break;
  }
}
