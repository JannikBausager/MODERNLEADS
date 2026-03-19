import { addRoute, startRouter, resolve } from './router';
import { renderNav } from './components/nav';
import { render as renderInbox } from './views/inbox';
import { render as renderDetail } from './views/detail';
import { render as renderPipeline } from './views/pipeline';
import { render as renderToday } from './views/today';
import { render as renderSettings } from './views/settings';

// Register routes
addRoute('/', (c) => renderInbox(c));
addRoute('/inbox', (c) => renderInbox(c));
addRoute('/leads/:id', (c, p) => renderDetail(c, p));
addRoute('/pipeline', (c) => renderPipeline(c));
addRoute('/today', (c) => renderToday(c));
addRoute('/settings', (c) => renderSettings(c));

// Render navigation on every route change
function updateNav() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) renderNav(sidebar);
}

window.addEventListener('hashchange', updateNav);
updateNav();

// Start
startRouter();
