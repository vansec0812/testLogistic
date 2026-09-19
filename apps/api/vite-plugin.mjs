import { createApiHandler } from './gateway.mjs';

// This plugin runs in Node only; provider credentials never enter the web bundle.
export function localAiGateway(options) {
  const handler = createApiHandler(options);
  const attach = server => {
    server.middlewares.use((request, response, next) => {
      const path = new URL(request.url || '/', 'http://localhost').pathname;
      if (path === '/api/health' || path.startsWith('/api/ai/')) {
        void handler(request, response);
      } else {
        next();
      }
    });
  };
  return {
    name: 'econt-local-ai-gateway',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
