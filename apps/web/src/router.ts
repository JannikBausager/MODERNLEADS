type RouteHandler = (container: HTMLElement, params: Record<string, string>) => void;

interface Route {
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];

export function addRoute(path: string, handler: RouteHandler): void {
  const keys: string[] = [];
  const pattern = path
    .replace(/:(\w+)/g, (_m, key) => {
      keys.push(key);
      return '([^/]+)';
    })
    .replace(/\//g, '\\/');
  routes.push({ pattern: new RegExp('^' + pattern + '$'), keys, handler });
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

export function currentPath(): string {
  return window.location.hash.slice(1) || '/';
}

export function resolve(): void {
  const path = currentPath();
  const content = document.getElementById('content');
  if (!content) return;

  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.keys.forEach((key, i) => {
        params[key] = match[i + 1];
      });
      content.innerHTML = '';
      route.handler(content, params);
      return;
    }
  }

  // Default: redirect to pipeline
  navigate('/pipeline');
}

export function startRouter(): void {
  window.addEventListener('hashchange', () => resolve());
  resolve();
}
