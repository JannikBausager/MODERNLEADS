import { showToast } from '../../components/toast.js';

interface FeedbackItem {
  rank: number;
  feedback: string;
  source: string;
  changeInstruction: string;
}

const SOURCES = ['OCV', 'Email', 'Event', 'Forms', 'Support Ticket', 'User Interview', 'App Review', 'Social Media', 'Internal QA', 'Telemetry'];

function generateMockFeedback(): FeedbackItem[] {
  return [
    {
      rank: 1,
      feedback: 'The pipeline board is hard to read on mobile — cards overlap and I can\'t drag them.',
      source: 'OCV',
      changeInstruction: 'Make the pipeline board responsive for mobile. On screens below 768px, stack the stage columns vertically instead of horizontally. Disable drag-and-drop on touch devices and add a "Move to" dropdown on each card instead.',
    },
    {
      rank: 2,
      feedback: 'I need to bulk-import leads from a CSV file instead of adding them one by one.',
      source: 'Email',
      changeInstruction: 'Add a CSV import feature to the Pipeline page. Create a POST /api/leads/import endpoint that accepts a CSV file with columns: contactName, companyName, email, phone, source. Parse with a streaming CSV library, validate each row, and return a summary of imported/skipped/failed rows.',
    },
    {
      rank: 3,
      feedback: 'When I convert a lead, I want to set the opportunity value and close date before it goes to BC.',
      source: 'Event',
      changeInstruction: 'Add a conversion dialog modal that appears when clicking "Convert". Include fields for opportunity name, estimated value (currency input), expected close date (date picker), and notes. Pass these values to the mapLeadToOpportunity function instead of using defaults.',
    },
    {
      rank: 4,
      feedback: 'The scoring page should show a preview of how a sample lead would score with current rules.',
      source: 'OCV',
      changeInstruction: 'Add a "Score Preview" panel to the LinkedIn Scoring page. Let the user pick a lead from a dropdown, then display a breakdown of which scoring rules would fire and the resulting total score. Highlight rules that matched in green.',
    },
    {
      rank: 5,
      feedback: 'I want email notifications when a lead\'s score crosses the hot threshold.',
      source: 'Forms',
      changeInstruction: 'Implement a notification service that checks lead scores after each score update. When a lead crosses the hot threshold (from settings), send an email notification using a configurable SMTP transport. Store notification history in a new notifications table.',
    },
    {
      rank: 6,
      feedback: 'The statistics charts are great but I need to export them as PDF for our weekly sales meeting.',
      source: 'User Interview',
      changeInstruction: 'Add an "Export PDF" button to the Statistics page. Use the html2canvas library to capture each chart as an image, then use jsPDF to compose them into a branded PDF report with KPI summary, all charts, and the top leads table. Include the date range filter in the header.',
    },
    {
      rank: 7,
      feedback: 'Can we add a lead activity timeline showing all interactions in chronological order?',
      source: 'Email',
      changeInstruction: 'Add an activity timeline component to the lead detail page. Query all interactions for the lead sorted by timestamp DESC. Display each as a timeline entry with icon (email/call/meeting/note/system), timestamp, and content. Use a vertical line connector between entries.',
    },
    {
      rank: 8,
      feedback: 'The Agent Charter is useful but I want the agent to automatically update challenges based on pipeline data.',
      source: 'Event',
      changeInstruction: 'Add an "Auto-detect Challenges" button to the Agent Charter page. When clicked, analyze the pipeline: find stages with low conversion rates, sources with low quality leads, leads stuck for >7 days, etc. Generate challenge entries automatically and let the user review before saving.',
    },
    {
      rank: 9,
      feedback: 'I need role-based access so my sales team can see leads but only managers can change settings.',
      source: 'Support Ticket',
      changeInstruction: 'Implement role-based access control with two roles: "sales" and "manager". Add a users table with role field. Create auth middleware that checks the user role. Sales users can view/edit leads but cannot access Settings or Agent Charter. Managers have full access.',
    },
    {
      rank: 10,
      feedback: 'The copilot chat panel should remember conversation history across page navigations.',
      source: 'OCV',
      changeInstruction: 'Store the copilot chat history in sessionStorage under key "copilot-history". On panel render, restore previous messages. Add a "Clear Chat" button. Limit stored history to the last 50 messages to avoid storage limits.',
    },
    {
      rank: 11,
      feedback: 'Would love a dark mode option — staring at the bright white background all day hurts.',
      source: 'App Review',
      changeInstruction: 'Add a dark mode toggle in General Settings. Create a dark theme CSS using CSS custom properties (--bg-primary, --text-primary, etc.). Store preference in settings table. Apply the theme class to the body element on load. Use prefers-color-scheme media query as default.',
    },
    {
      rank: 12,
      feedback: 'The Business Central connection drops after an hour and I have to re-authenticate.',
      source: 'Support Ticket',
      changeInstruction: 'Implement proactive token refresh in the MCP client. Before each API call, check if the token expires within 5 minutes using the stored expiry timestamp. If so, silently refresh using the MSAL refresh token. Add exponential backoff retry (3 attempts) for transient auth failures.',
    },
    {
      rank: 13,
      feedback: 'I want to see which leads came from the same company and group them together.',
      source: 'User Interview',
      changeInstruction: 'Add a "Company View" toggle to the Pipeline page. When enabled, group leads by companyName and display a company card with all associated leads nested inside. Show company-level aggregate score (average) and total lead count.',
    },
    {
      rank: 14,
      feedback: 'Please add keyboard shortcuts — I want to navigate leads without touching the mouse.',
      source: 'Forms',
      changeInstruction: 'Add keyboard navigation: Arrow keys to move between lead cards, Enter to open detail, Escape to go back, N for new lead, / to focus the search bar. Register a global keydown handler in main.ts. Show a keyboard shortcut help modal with ? key.',
    },
    {
      rank: 15,
      feedback: 'The lead detail page needs a notes section where I can write free-text notes per lead.',
      source: 'Email',
      changeInstruction: 'Add a "Notes" tab to the lead detail page with a rich textarea. Store notes as interactions of type "note". Auto-save on blur with a debounce of 1 second. Show a "saved" indicator. Display note count badge on the tab header.',
    },
    {
      rank: 16,
      feedback: 'Integration with Google Calendar so meetings with leads automatically show up.',
      source: 'Event',
      changeInstruction: 'Add a Google Calendar integration in Settings > Connections. Use the Google Calendar API with OAuth2. Sync meetings where attendee email matches a lead email. Create "meeting" interactions automatically. Show upcoming meetings on the lead detail page.',
    },
    {
      rank: 17,
      feedback: 'The search bar on the pipeline should also search by email and phone, not just name.',
      source: 'OCV',
      changeInstruction: 'Update the listLeads query in repository.ts to search across contactName, companyName, email, and phone fields when a search parameter is provided. Use LIKE with wildcards on all four columns joined with OR.',
    },
    {
      rank: 18,
      feedback: 'I accidentally disqualified a lead and couldn\'t undo it — we need an undo feature.',
      source: 'Support Ticket',
      changeInstruction: 'Add an undo mechanism for stage changes. After each stage change, show a toast with an "Undo" button (visible for 8 seconds). Store the previous stage in a temporary variable. If undo is clicked, revert the stage and log a "stage_reverted" telemetry event.',
    },
    {
      rank: 19,
      feedback: 'Would be great to set reminders on leads — "follow up with this person on Friday".',
      source: 'User Interview',
      changeInstruction: 'Add a reminders table (id, leadId, reminderDate, message, completed). Add a "Set Reminder" button on lead cards and detail page. Create a reminders panel that shows today\'s due reminders on the Pipeline page. Add API endpoints for CRUD operations on reminders.',
    },
    {
      rank: 20,
      feedback: 'The TikTok and Instagram scoring pages say "Coming Soon" — when will they be ready?',
      source: 'Social Media',
      changeInstruction: 'Implement the Instagram scoring page following the same pattern as linkedinScoring.ts. Create an instagram_scoring_rules table with default rules for: story views, reel engagement, DM responses, profile visits, hashtag mentions. Add the Natural Language Rule Creator and category-based rule editor.',
    },
  ];
}

let feedbackItems: FeedbackItem[] = generateMockFeedback();

export function renderDevMode(container: HTMLElement): void {
  container.innerHTML = `
    <div class="settings-panel dev-mode">
      <div class="settings-panel-header">
        <h2>🛠️ Agile Feedback Agent</h2>
        <p class="settings-panel-desc">User feedback stack-ranked by priority. Drag rows to re-prioritize. Copy the change instruction prompt to Claude to implement each item.</p>
      </div>
      <div class="card settings-form-card">
        <div class="feedback-table-wrapper">
          <table class="feedback-table" id="feedback-table">
            <thead>
              <tr>
                <th class="fb-col-rank">#</th>
                <th class="fb-col-feedback">Feedback</th>
                <th class="fb-col-source">Source</th>
                <th class="fb-col-instruction">Change Instruction</th>
              </tr>
            </thead>
            <tbody id="feedback-tbody">
              ${feedbackItems.map(renderRow).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  bindEvents(container);
}

function renderRow(item: FeedbackItem): string {
  const sourceBadgeClass = 'fb-source-' + item.source.toLowerCase().replace(/[^a-z]/g, '');
  return `
    <tr data-rank="${item.rank}">
      <td class="fb-cell-rank">
        <div class="fb-rank-controls">
          <button class="fb-move-btn fb-move-up" data-rank="${item.rank}" title="Move up" ${item.rank === 1 ? 'disabled' : ''}>▲</button>
          <span class="fb-rank-number">${item.rank}</span>
          <button class="fb-move-btn fb-move-down" data-rank="${item.rank}" title="Move down" ${item.rank === feedbackItems.length ? 'disabled' : ''}>▼</button>
        </div>
      </td>
      <td class="fb-cell-feedback">${escapeHtml(item.feedback)}</td>
      <td class="fb-cell-source"><span class="fb-source-badge ${sourceBadgeClass}">${escapeHtml(item.source)}</span></td>
      <td class="fb-cell-instruction">
        <div class="fb-instruction-wrap">
          <span class="fb-instruction-text">${escapeHtml(item.changeInstruction)}</span>
          <button class="fb-copy-btn" data-rank="${item.rank}" title="Copy prompt to clipboard">📋</button>
        </div>
      </td>
    </tr>
  `;
}

function bindEvents(container: HTMLElement): void {
  // Move up
  container.querySelectorAll('.fb-move-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rank = parseInt((btn as HTMLElement).dataset.rank!, 10);
      if (rank <= 1) return;
      swapItems(rank, rank - 1);
      reRender(container);
    });
  });

  // Move down
  container.querySelectorAll('.fb-move-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rank = parseInt((btn as HTMLElement).dataset.rank!, 10);
      if (rank >= feedbackItems.length) return;
      swapItems(rank, rank + 1);
      reRender(container);
    });
  });

  // Copy buttons
  container.querySelectorAll('.fb-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rank = parseInt((btn as HTMLElement).dataset.rank!, 10);
      const item = feedbackItems.find(i => i.rank === rank);
      if (!item) return;
      const prompt = `User Feedback: "${item.feedback}"\n\nChange Instruction: ${item.changeInstruction}`;
      navigator.clipboard.writeText(prompt).then(() => {
        showToast('Prompt copied to clipboard!', 'success');
      }).catch(() => {
        showToast('Failed to copy', 'error');
      });
    });
  });
}

function swapItems(rankA: number, rankB: number): void {
  const itemA = feedbackItems.find(i => i.rank === rankA);
  const itemB = feedbackItems.find(i => i.rank === rankB);
  if (itemA && itemB) {
    itemA.rank = rankB;
    itemB.rank = rankA;
    feedbackItems.sort((a, b) => a.rank - b.rank);
  }
}

function reRender(container: HTMLElement): void {
  const tbody = container.querySelector('#feedback-tbody');
  if (!tbody) return;
  tbody.innerHTML = feedbackItems.map(renderRow).join('');
  bindEvents(container);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
