import { api } from '../../api.js';
import { showToast } from '../../components/toast.js';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'available' | 'coming_soon' | 'beta';
}

interface Category {
  title: string;
  description: string;
  integrations: Integration[];
}

const CATEGORIES: Record<string, Category> = {
  social: {
    title: 'Social Media',
    description: 'Connect your social channels to capture leads from social selling and track engagement across platforms.',
    integrations: [
      { id: 'linkedin', name: 'LinkedIn Sales Navigator', description: 'Import leads and track InMail outreach. Sync connections and engagement data.', icon: '🔷', status: 'available' },
      { id: 'facebook', name: 'Facebook / Meta Business', description: 'Capture leads from Facebook Lead Ads and Messenger conversations.', icon: '🔵', status: 'coming_soon' },
      { id: 'twitter', name: 'Twitter / X', description: 'Monitor mentions and DMs for lead opportunities and brand engagement.', icon: '🐦', status: 'coming_soon' },
      { id: 'instagram', name: 'Instagram Business', description: 'Track business inquiries from Instagram DMs and story interactions.', icon: '📸', status: 'coming_soon' },
      { id: 'tiktok', name: 'TikTok for Business', description: 'Capture leads from TikTok Lead Gen campaigns and ad interactions.', icon: '🎵', status: 'coming_soon' },
    ],
  },
  chatbot: {
    title: 'Chat Bots',
    description: 'Connect chat platforms to automatically capture and route leads from real-time conversations.',
    integrations: [
      { id: 'webchat', name: 'Website Chat Widget', description: 'Embed a chat widget on your website to capture visitor leads in real-time.', icon: '💬', status: 'coming_soon' },
      { id: 'teams_bot', name: 'Microsoft Teams', description: 'Receive lead notifications and manage leads directly from Microsoft Teams.', icon: '🟣', status: 'coming_soon' },
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'Capture leads from WhatsApp conversations and automate responses.', icon: '🟢', status: 'coming_soon' },
      { id: 'intercom', name: 'Intercom', description: 'Sync leads and conversation history from Intercom.', icon: '🔶', status: 'coming_soon' },
      { id: 'drift', name: 'Drift', description: 'Import conversational marketing leads and meeting bookings from Drift.', icon: '🔹', status: 'coming_soon' },
    ],
  },
  email: {
    title: 'Email & Calendar',
    description: 'Connect email and calendar to track communications, log meetings, and automate follow-ups.',
    integrations: [
      { id: 'outlook', name: 'Microsoft Outlook / Exchange', description: 'Sync emails, track opens and clicks, and log calendar events automatically.', icon: '📧', status: 'coming_soon' },
      { id: 'gmail', name: 'Gmail / Google Workspace', description: 'Connect Gmail for email tracking, contact sync, and calendar integration.', icon: '✉️', status: 'coming_soon' },
      { id: 'smtp', name: 'Custom SMTP / IMAP', description: 'Connect any email provider via standard SMTP/IMAP protocols.', icon: '🔧', status: 'coming_soon' },
    ],
  },
  forms: {
    title: 'Survey & Forms',
    description: 'Capture leads from forms and surveys automatically as they submit responses.',
    integrations: [
      { id: 'msforms', name: 'Microsoft Forms', description: 'Import survey and form submissions from Microsoft Forms as new leads.', icon: '📋', status: 'coming_soon' },
      { id: 'typeform', name: 'Typeform', description: 'Capture leads from Typeform conversational forms and quizzes.', icon: '📝', status: 'coming_soon' },
      { id: 'surveymonkey', name: 'SurveyMonkey', description: 'Import survey respondents and their answers as enriched leads.', icon: '🐵', status: 'coming_soon' },
      { id: 'google_forms', name: 'Google Forms', description: 'Capture Google Forms responses as leads with mapped fields.', icon: '📊', status: 'coming_soon' },
      { id: 'jotform', name: 'JotForm', description: 'Import JotForm submissions with custom field mapping.', icon: '📄', status: 'coming_soon' },
      { id: 'tally', name: 'Tally', description: 'Capture leads from Tally form submissions with webhook integration.', icon: '✅', status: 'coming_soon' },
    ],
  },
  voice: {
    title: 'Voice & Calls',
    description: 'Integrate call platforms to capture transcripts, log outcomes, and track sales conversations.',
    integrations: [
      { id: 'teams_calling', name: 'Microsoft Teams Calling', description: 'Log Teams call transcripts, duration, and outcomes automatically.', icon: '🟣', status: 'coming_soon' },
      { id: 'zoom', name: 'Zoom Phone', description: 'Sync Zoom call recordings, transcripts, and meeting notes.', icon: '📹', status: 'coming_soon' },
      { id: 'gong', name: 'Gong', description: 'Import call intelligence, deal insights, and coaching data from Gong.', icon: '🔔', status: 'coming_soon' },
      { id: 'dialpad', name: 'Dialpad', description: 'Log AI-powered call transcripts and sentiment analysis from Dialpad.', icon: '📱', status: 'coming_soon' },
      { id: 'aircall', name: 'Aircall', description: 'Sync call logs, voicemail transcriptions, and tags from Aircall.', icon: '☎️', status: 'coming_soon' },
    ],
  },
  enrichment: {
    title: 'Data Enrichment',
    description: 'Automatically enrich lead profiles with company, contact, and technographic data.',
    integrations: [
      { id: 'clearbit', name: 'Clearbit', description: 'Enrich leads with firmographic, technographic, and employee data.', icon: '🔍', status: 'coming_soon' },
      { id: 'zoominfo', name: 'ZoomInfo', description: 'Access B2B contact and company intelligence for qualification.', icon: '🎯', status: 'coming_soon' },
      { id: 'apollo', name: 'Apollo.io', description: 'Enrich and verify contact information with Apollo\'s database.', icon: '🚀', status: 'coming_soon' },
      { id: 'lusha', name: 'Lusha', description: 'Find accurate B2B contact details including direct dials and emails.', icon: '👤', status: 'coming_soon' },
      { id: 'linkedin_insights', name: 'LinkedIn Sales Insights', description: 'Pull company insights and growth signals from LinkedIn.', icon: '📈', status: 'coming_soon' },
    ],
  },
  marketing: {
    title: 'Marketing Automation',
    description: 'Sync leads with your marketing tools for nurture campaigns, scoring, and engagement tracking.',
    integrations: [
      { id: 'mailchimp', name: 'Mailchimp', description: 'Sync leads to Mailchimp audiences and track email campaign engagement.', icon: '🐒', status: 'coming_soon' },
      { id: 'hubspot_mktg', name: 'HubSpot Marketing', description: 'Bi-directional lead sync with HubSpot marketing workflows.', icon: '🟠', status: 'coming_soon' },
      { id: 'activecampaign', name: 'ActiveCampaign', description: 'Trigger email sequences and automations based on lead stage.', icon: '⚡', status: 'coming_soon' },
      { id: 'brevo', name: 'Brevo (Sendinblue)', description: 'Manage email campaigns and transactional emails for lead nurturing.', icon: '📤', status: 'coming_soon' },
      { id: 'constant_contact', name: 'Constant Contact', description: 'Email marketing integration for lead nurturing and newsletters.', icon: '📬', status: 'coming_soon' },
    ],
  },
};

export function renderConnectionCategory(container: HTMLElement, categoryId: string): void {
  const cat = CATEGORIES[categoryId];
  if (!cat) {
    container.innerHTML = '<div class="settings-panel"><p>Section not found.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="settings-panel">
      <div class="settings-panel-header">
        <h2>${cat.title}</h2>
        <p class="settings-panel-desc">${cat.description}</p>
      </div>
      <div class="integration-grid">
        ${cat.integrations.map(int => `
          <div class="integration-card">
            <div class="integration-card-header">
              <span class="integration-icon">${int.icon}</span>
              <div class="integration-info">
                <span class="integration-name">${int.name}</span>
                <span class="integration-desc">${int.description}</span>
              </div>
            </div>
            <div class="integration-card-footer">
              <span class="integration-status status-${int.status}">
                ${int.status === 'coming_soon' ? 'Coming Soon' : int.status === 'beta' ? 'Beta' : 'Available'}
              </span>
              ${int.status === 'coming_soon'
                ? '<button class="btn btn-sm btn-ghost" data-notify="' + int.id + '">Notify Me</button>'
                : '<button class="btn btn-sm btn-secondary" data-configure="' + int.id + '">Configure</button>'}
            </div>
          </div>
        `).join('')}
      </div>
      <div id="linkedin-config-panel"></div>
    </div>
  `;

  container.querySelectorAll('.btn-ghost[data-notify]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = (btn.previousElementSibling?.parentElement?.parentElement?.querySelector('.integration-name') as HTMLElement)?.textContent || 'integration';
      btn.textContent = '✓ Subscribed';
      btn.classList.add('btn-subscribed');
      (btn as HTMLButtonElement).disabled = true;
      showToast(`You'll be notified when ${name} is available!`, 'success');
    });
  });

  container.querySelectorAll('.btn-secondary[data-configure]').forEach(btn => {
    btn.addEventListener('click', () => {
      const integrationId = (btn as HTMLElement).dataset.configure;
      if (integrationId === 'linkedin') {
        renderLinkedInConfigPanel(container.querySelector('#linkedin-config-panel') as HTMLElement);
      }
    });
  });
}

async function renderLinkedInConfigPanel(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="card settings-form-card" style="margin-top: 1.5rem;">
      <div class="connection-card-header" style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;">
        <span style="font-size:1.5rem;">🔷</span>
        <div>
          <h3 style="margin:0;font-size:1rem;">LinkedIn Configuration</h3>
          <p style="margin:0;font-size:.85rem;color:#5f6368;">Configure your LinkedIn API credentials to enable lead scoring.</p>
        </div>
      </div>
      <div id="linkedin-settings-form-area" style="color:#5f6368;">Loading settings...</div>
    </div>
  `;

  try {
    const settings = await api.linkedin.getSettings();
    const area = container.querySelector('#linkedin-settings-form-area') as HTMLElement;
    area.innerHTML = `
      <form id="linkedin-settings-form">
        <div class="form-group">
          <label>Client ID</label>
          <input type="text" class="form-input" id="li-client-id" value="${settings.clientId || ''}" placeholder="Enter LinkedIn Client ID" />
        </div>
        <div class="form-group">
          <label>Client Secret</label>
          <input type="password" class="form-input" id="li-client-secret" value="" placeholder="${settings.hasSecret ? '••••••(saved)' : 'Enter LinkedIn Client Secret'}" />
        </div>
        <div class="form-group">
          <label>Redirect URI</label>
          <input type="text" class="form-input" id="li-redirect-uri" value="${settings.redirectUri || ''}" />
        </div>
        <div class="form-group">
          <label class="toggle-label">
            <input type="checkbox" id="li-enabled" ${settings.enabled ? 'checked' : ''} />
            <span class="toggle-switch"></span>
            Enable LinkedIn Integration
          </label>
        </div>
        <div class="settings-actions" style="display:flex;align-items:center;gap:1rem;">
          <button type="submit" class="btn btn-primary">Save LinkedIn Settings</button>
          <a href="#/linkedin-scoring" class="btn btn-secondary" style="text-decoration:none;">→ LinkedIn Scoring Rules</a>
        </div>
      </form>
    `;

    area.querySelector('#linkedin-settings-form')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data: any = {
        clientId: (area.querySelector('#li-client-id') as HTMLInputElement).value,
        redirectUri: (area.querySelector('#li-redirect-uri') as HTMLInputElement).value,
        enabled: (area.querySelector('#li-enabled') as HTMLInputElement).checked,
      };
      const secret = (area.querySelector('#li-client-secret') as HTMLInputElement).value;
      if (secret) data.clientSecret = secret;
      try {
        await api.linkedin.updateSettings(data);
        showToast('LinkedIn settings saved!', 'success');
      } catch (err: any) {
        showToast(err.message || 'Failed to save LinkedIn settings', 'error');
      }
    });
  } catch (err: any) {
    container.querySelector('#linkedin-settings-form-area')!.innerHTML = `<p style="color:#dc2626;">Failed to load LinkedIn settings: ${err.message || 'Unknown error'}</p>`;
  }
}
