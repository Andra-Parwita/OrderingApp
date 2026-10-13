import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './http';
import { isMaintenanceBlocked, setMaintenanceBlocked } from './maintenanceState';
import { resetNetState } from './netState';
import { setRetryDelays } from './retryPolicy';

const refusal = () =>
  new Response(JSON.stringify({ error: 'maintenance', message: 'Updating' }), {
    status: 503,
    headers: { 'X-Maintenance': '1', 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  resetNetState();
  setMaintenanceBlocked(false);
  setRetryDelays([1, 1, 1]);
});
afterEach(() => {
  vi.unstubAllGlobals();
  setRetryDelays([1000, 3000, 9000]);
});

describe('a 503 maintenance answer (plan 046)', () => {
  it('is not retried, comes back as the maintenance error, and raises the Updating screen', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(refusal()));
    vi.stubGlobal('fetch', fetchMock);
    const result = await request('/api/s/x/menu', (input) => input);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, error: 'maintenance', status: 503 });
    expect(isMaintenanceBlocked()).toBe(true);
  });

  it('still retries an ordinary 503', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('', { status: 503 })));
    vi.stubGlobal('fetch', fetchMock);
    await request('/api/s/x/menu', (input) => input);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(isMaintenanceBlocked()).toBe(false);
  });
});
