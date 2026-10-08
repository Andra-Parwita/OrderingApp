import type { HealthResponse } from '../shared/health';

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/health' && request.method === 'GET') {
      const body: HealthResponse = { status: 'ok', time: new Date().toISOString() };
      return Response.json(body);
    }
    // Temporary in-memory mock API (stage 3.2). `import.meta.env.DEV` is replaced by `false` in
    // `vite build`, so the whole mock is dropped from the production Worker.
    if (import.meta.env.DEV) {
      const { handleMock } = await import('./mock');
      const response = await handleMock(request);
      if (response) return response;
    }
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler;
