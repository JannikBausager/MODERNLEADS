import { api, type AgentResponse } from '../api';

interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
  data?: any;
  action?: AgentResponse['action'];
}

export function renderChatPane(container: HTMLElement, leadId: string): void {
  const messages: ChatMessage[] = [];
  let pendingAction: AgentResponse['action'] | null = null;

  container.innerHTML = `
    <div class="chat-pane">
      <div class="chat-header">
        <span class="chat-header-icon">🤖</span> AI Assistant
      </div>
      <div class="chat-messages" id="chat-messages">
        <div class="message message-agent">
          <div class="message-bubble">Hi! I can help you with this lead. Ask me anything — enrich data, suggest next steps, or draft messages.</div>
        </div>
      </div>
      <div class="chat-confirm" id="chat-confirm" style="display:none">
        <span id="chat-confirm-text"></span>
        <div class="chat-confirm-btns">
          <button class="btn btn-sm btn-primary" id="chat-confirm-yes">Confirm</button>
          <button class="btn btn-sm btn-secondary" id="chat-confirm-no">Cancel</button>
        </div>
      </div>
      <form class="chat-input-form" id="chat-form">
        <input type="text" class="form-input chat-input" id="chat-input" placeholder="Ask the AI assistant..." />
        <button type="submit" class="btn btn-primary btn-sm">Send</button>
      </form>
    </div>
  `;

  const msgContainer = container.querySelector('#chat-messages') as HTMLElement;
  const form = container.querySelector('#chat-form') as HTMLFormElement;
  const input = container.querySelector('#chat-input') as HTMLInputElement;
  const confirmEl = container.querySelector('#chat-confirm') as HTMLElement;
  const confirmText = container.querySelector('#chat-confirm-text') as HTMLElement;
  const confirmYes = container.querySelector('#chat-confirm-yes') as HTMLButtonElement;
  const confirmNo = container.querySelector('#chat-confirm-no') as HTMLButtonElement;

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
      const contextMsg = confirm ? text : `[Lead ID: ${leadId}] ${text}`;
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
}

function escHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
