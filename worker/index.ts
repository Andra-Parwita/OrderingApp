import type { HealthResponse } from '../shared/health';

export default {
  fetch(request: Request): Response {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/health' && request.method === 'GET') {
      const body: HealthResponse = { status: 'ok', time: new Date().toISOString() };
      return Response.json(body);
    }
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler;
