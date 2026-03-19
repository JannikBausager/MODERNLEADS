import { addRoute, startRouter, navigate } from './router.js';
import { renderNav } from './components/nav.js';
import { renderCopilotPanel } from './components/copilotPanel.js';
import { renderPipeline } from './views/pipeline.js';
import { renderDetail } from './views/detail.js';
import { render as renderSettings } from './views/settings.js';

function boot() {
  const sidebar = document.getElementById('sidebar')!;
  const content = document.getElementById('content')!;
  const copilotPanel = document.getElementById('copilot-panel')!;

  renderNav(sidebar);
  renderCopilotPanel(copilotPanel);

  addRoute('/', (el) => renderPipeline(el));
  addRoute('/pipeline', (el) => renderPipeline(el));
  addRoute('/leads/:id', (el, params) => renderDetail(el, params.id));
  addRoute('/settings', (el) => renderSettings(el));

  startRouter();

  // Update nav active state on route change
  window.addEventListener('hashchange', () => {
    renderNav(sidebar);
  });
}

boot();
