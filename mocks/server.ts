import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// Every query to the test database is an HTTP call from wrangler's platform proxy, and MSW sees
// all of them. Tests that count requests (`server.events.on('request:start', ...)`) mean the app's
// own, so the proxy's calls are filtered out of the events they get.
const PROXY_PATH = '/cdn-cgi/';
type Listener = (info: { request: Request }) => unknown;
const events = server.events as unknown as {
  on: (type: string, listener: Listener) => unknown;
};
const on = events.on.bind(server.events);
events.on = (type, listener) =>
  on(type, (info) =>
    new URL(info.request.url).pathname.startsWith(PROXY_PATH) ? undefined : listener(info),
  );
