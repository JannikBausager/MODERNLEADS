import { addRoute, startRouter } from './router.js';
import { renderTopbar } from './components/nav.js';
import { renderCopilotPanel } from './components/copilotPanel.js';
import { renderPipeline } from './views/pipeline.js';
import { renderDetail } from './views/detail.js';
import { render as renderSettings } from './views/settings/index.js';
import { renderStatistics } from './views/statistics.js';
import { renderAgentCharter } from './views/settings/agentCharter.js';

function boot() {
  const topbar = document.getElementById('topbar')!;
  const content = document.getElementById('content')!;
  const copilotPanel = document.getElementById('copilot-panel')!;

  renderTopbar(topbar);
  renderCopilotPanel(copilotPanel);

  addRoute('/', (el) => renderPipeline(el));
  addRoute('/pipeline', (el) => renderPipeline(el));
  addRoute('/leads/:id', (el, params) => renderDetail(el, params.id));
  addRoute('/settings', (el) => renderSettings(el));
  addRoute('/statistics', (el) => renderStatistics(el));
  addRoute('/agent-charter', (el) => renderAgentCharter(el));

  startRouter();

  window.addEventListener('hashchange', () => {
    renderTopbar(topbar);
  });
}

boot();
