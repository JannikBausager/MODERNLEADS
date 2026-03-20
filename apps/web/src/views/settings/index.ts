import { renderGeneralSettings } from './general.js';
import { renderScoringSettings } from './scoring.js';
import { renderNotificationSettings } from './notifications.js';
import { renderBcConnection } from './bcConnection.js';
import { renderConnectionCategory } from './integrations.js';
import { renderLinkedInScoring } from '../linkedinScoring.js';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  indent?: boolean;
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
      { id: 'scoring-linkedin', label: 'LinkedIn', icon: '🔷', indent: true },
      { id: 'scoring-facebook', label: 'Facebook / Meta', icon: '🔵', indent: true },
      { id: 'scoring-twitter', label: 'Twitter / X', icon: '🐦', indent: true },
      { id: 'scoring-instagram', label: 'Instagram', icon: '📸', indent: true },
      { id: 'scoring-tiktok', label: 'TikTok', icon: '🎵', indent: true },
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
          <button class="settings-sidebar-item ${item.id === activeSection ? 'active' : ''} ${item.indent ? 'sidebar-indent' : ''}" data-section="${item.id}">
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
    case 'scoring-linkedin':
      renderLinkedInScoring(content);
      break;
    case 'scoring-facebook':
    case 'scoring-twitter':
    case 'scoring-instagram':
    case 'scoring-tiktok':
      renderComingSoonScoring(content, activeSection);
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

function renderComingSoonScoring(container: HTMLElement, section: string): void {
  const names: Record<string, { name: string; icon: string }> = {
    'scoring-facebook': { name: 'Facebook / Meta', icon: '🔵' },
    'scoring-twitter': { name: 'Twitter / X', icon: '🐦' },
    'scoring-instagram': { name: 'Instagram', icon: '📸' },
    'scoring-tiktok': { name: 'TikTok', icon: '🎵' },
  };
  const info = names[section] || { name: section, icon: '📋' };
  container.innerHTML = `
    <div class="settings-panel">
      <div class="settings-panel-header">
        <h2>${info.icon} ${info.name} Lead Scoring</h2>
        <p class="settings-panel-desc">Configure how ${info.name} engagement signals are scored to prioritize your best leads.</p>
      </div>
      <div class="card settings-form-card" style="text-align:center;padding:3rem">
        <div style="font-size:3rem;margin-bottom:1rem">${info.icon}</div>
        <h3 style="color:#1e293b;margin-bottom:.5rem">${info.name} Scoring — Coming Soon</h3>
        <p style="color:#64748b;max-width:400px;margin:0 auto .75rem">
          We're building scoring rules for ${info.name} engagement signals. This will work just like LinkedIn scoring with customizable rules and natural language configuration.
        </p>
        <p style="color:#64748b;font-size:.85rem">
          In the meantime, connect ${info.name} in <strong>Settings → Social Media</strong> to be notified when it's ready.
        </p>
      </div>
    </div>
  `;
}
