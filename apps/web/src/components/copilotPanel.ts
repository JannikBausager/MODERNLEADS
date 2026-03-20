import { api, type AgentResponse, type Lead } from '../api';

interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
  data?: any;
  action?: AgentResponse['action'];
}

let selectedLead: Lead | null = null;
let panelContainer: HTMLElement | null = null;

const ALWAYS_PROMPTS = [
  'Summarize my pipeline',
  'Which leads need attention?',
  'Who should I contact next?',
  'Show highest-value leads',
];

const MORE_PROMPTS = [
  'Which leads are going cold?',
  'Prioritize by likelihood to convert',
  'What patterns do you see?',
  'Capture a new lead',
];

function getLeadPrompts(lead: Lead): string[] {
  const prompts = [
    'Summarize this lead',
    'Draft a follow-up email',
    'What should I do next?',
  ];
  if (lead.stage === 'Qualified') {
    prompts.push('Convert to opportunity');
  }
  return prompts;
}

export function setCopilotLead(lead: Lead | null): void {
  selectedLead = lead;
  if (panelContainer) {
    updateContext(panelContainer);
    updateSuggestions(panelContainer);
  }
}

export function renderCopilotPanel(container: HTMLElement): void {
  panelContainer = container;
  const messages: ChatMessage[] = [];
  let pendingAction: AgentResponse['action'] | null = null;
  let moreExpanded = false;

  container.innerHTML = `
    <div class="copilot-panel">
      <div class="copilot-header">
        <span class="copilot-title">🤖 Lead Agent</span>
        <button class="copilot-toggle" title="Toggle panel">◀</button>
      </div>
      <div class="copilot-body">
        <div class="copilot-context" id="copilot-context" style="display:none"></div>
        <div class="copilot-messages" id="copilot-messages">
          <div class="message message-agent">
            <div class="message-bubble">👋 I'm your Lead Agent. Select a lead or ask me about your pipeline.</div>
          </div>
        </div>
        <div class="copilot-suggestions" id="copilot-suggestions"></div>
        <div class="copilot-confirm" id="copilot-confirm" style="display:none">
          <span id="copilot-confirm-text"></span>
          <div class="chat-confirm-btns">
            <button class="btn btn-sm btn-primary" id="copilot-confirm-yes">Confirm</button>
            <button class="btn btn-sm btn-secondary" id="copilot-confirm-no">Cancel</button>
          </div>
        </div>
        <form class="copilot-input" id="copilot-form">
          <input type="text" placeholder="Ask Lead Agent..." id="copilot-input" />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  `;

  const toggleBtn = container.querySelector('.copilot-toggle') as HTMLButtonElement;
  const msgContainer = container.querySelector('#copilot-messages') as HTMLElement;
  const form = container.querySelector('#copilot-form') as HTMLFormElement;
  const input = container.querySelector('#copilot-input') as HTMLInputElement;
  const confirmEl = container.querySelector('#copilot-confirm') as HTMLElement;
  const confirmText = container.querySelector('#copilot-confirm-text') as HTMLElement;
  const confirmYes = container.querySelector('#copilot-confirm-yes') as HTMLButtonElement;
  const confirmNo = container.querySelector('#copilot-confirm-no') as HTMLButtonElement;

  // Toggle collapse
  toggleBtn.addEventListener('click', () => {
    container.classList.toggle('collapsed');
  });

  // Listen for lead-selected event
  window.addEventListener('lead-selected', ((e: CustomEvent) => {
    setCopilotLead(e.detail?.lead ?? null);
  }) as EventListener);

  function addMessage(msg: ChatMessage) {
    messages.push(msg);
    const div = document.createElement('div');
    div.className = `message message-${msg.role}`;

    let html = `<div class="message-bubble">${escHtml(msg.text)}</div>`;
    if (msg.data) {
      html += `<div class="message-data"><pre>${escHtml(JSON.stringify(msg.data, null, 2))}</pre></div>`;
    }
    div.innerHTML = html;
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  async function sendMessage(text: string, confirm?: boolean) {
    addMessage({ role: 'user', text });
    input.value = '';
    input.disabled = true;

    const loading = document.createElement('div');
    loading.className = 'message message-agent';
    loading.innerHTML = '<div class="message-bubble typing"><span></span><span></span><span></span></div>';
    msgContainer.appendChild(loading);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
      let contextMsg = text;
      if (!confirm && selectedLead) {
        contextMsg = `[Lead ID: ${selectedLead.id}] ${text}`;
      }
      const res = await api.agent.chat(contextMsg, confirm);
      loading.remove();
      addMessage({ role: 'agent', text: res.reply, data: res.data, action: res.action });

      if (res.action?.confirmationRequired) {
        pendingAction = res.action;
        confirmText.textContent = `Action: ${res.action.type}. Confirm?`;
        confirmEl.style.display = 'flex';
      }
    } catch {
      loading.remove();
      addMessage({ role: 'agent', text: 'Sorry, something went wrong. Please try again.' });
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    pendingAction = null;
    confirmEl.style.display = 'none';
    sendMessage(text);
  });

  confirmYes.addEventListener('click', () => {
    confirmEl.style.display = 'none';
    if (pendingAction) {
      sendMessage('Yes, confirm this action.', true);
      pendingAction = null;
    }
  });

  confirmNo.addEventListener('click', () => {
    confirmEl.style.display = 'none';
    pendingAction = null;
    addMessage({ role: 'agent', text: 'Action cancelled.' });
  });

  function submitPrompt(text: string) {
    let msg = text;
    if (selectedLead) {
      if (text === 'Summarize this lead') {
        msg = `Summarize lead ${selectedLead.id}`;
      } else if (text === 'Draft a follow-up email') {
        msg = `Draft follow-up email for lead ${selectedLead.id}`;
      } else if (text === 'What should I do next?') {
        msg = `What should I do next for lead ${selectedLead.id}?`;
      } else if (text === 'Convert to opportunity') {
        msg = `Convert lead ${selectedLead.id} to opportunity`;
      }
    }
    input.value = msg;
    pendingAction = null;
    confirmEl.style.display = 'none';
    sendMessage(msg);
  }

  // Build suggestions
  function buildSuggestions() {
    const sugEl = container.querySelector('#copilot-suggestions') as HTMLElement;
    sugEl.innerHTML = '';

    // Always-visible prompts
    for (const p of ALWAYS_PROMPTS) {
      const chip = document.createElement('button');
      chip.className = 'suggestion-chip';
      chip.textContent = p;
      chip.addEventListener('click', () => submitPrompt(p));
      sugEl.appendChild(chip);
    }

    // Lead-specific prompts
    if (selectedLead) {
      for (const p of getLeadPrompts(selectedLead)) {
        const chip = document.createElement('button');
        chip.className = 'suggestion-chip lead-specific';
        chip.textContent = p;
        chip.addEventListener('click', () => submitPrompt(p));
        sugEl.appendChild(chip);
      }
    }

    // More prompts
    const moreBtn = document.createElement('button');
    moreBtn.className = 'suggestion-chip';
    moreBtn.textContent = moreExpanded ? 'Less ▲' : 'More ▼';
    moreBtn.addEventListener('click', () => {
      moreExpanded = !moreExpanded;
      buildSuggestions();
    });
    sugEl.appendChild(moreBtn);

    if (moreExpanded) {
      for (const p of MORE_PROMPTS) {
        const chip = document.createElement('button');
        chip.className = 'suggestion-chip';
        chip.textContent = p;
        chip.addEventListener('click', () => submitPrompt(p));
        sugEl.appendChild(chip);
      }
    }
  }

  buildSuggestions();

  // Store buildSuggestions on the container for external updates
  (container as any).__buildSuggestions = buildSuggestions;
}

function updateContext(container: HTMLElement) {
  const ctxEl = container.querySelector('#copilot-context') as HTMLElement;
  if (!ctxEl) return;
  if (selectedLead) {
    ctxEl.style.display = 'flex';
    ctxEl.textContent = `📌 ${selectedLead.contactName} at ${selectedLead.companyName} — ${selectedLead.stage}`;
  } else {
    ctxEl.style.display = 'none';
    ctxEl.textContent = '';
  }
}

function updateSuggestions(container: HTMLElement) {
  const fn = (container as any).__buildSuggestions;
  if (typeof fn === 'function') fn();
}

function escHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
