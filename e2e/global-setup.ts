import { request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ADMIN_FILE, ADMIN_LABELS, DEV_ADMIN_SETUP_KEY } from './adminSession';

// Registers the dev admin once per run (the mock keeps a single admin), then adds one more admin
// device per label: signing in on a device ends that device's other session, so each spec gets
// its own passkey and the specs cannot sign each other out.

type SessionBody = { token: string; credentialId?: string };
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// Playwright loads the default export of the global setup file.
// eslint-disable-next-line import-x/no-default-export
export default async function globalSetup(): Promise<void> {
  const baseURL = `https://localhost:${process.env['PORT'] ?? '5181'}`;
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  try {
    const setup = await api.post('/api/admin/setup', {
      data: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: 'e2e-global-admin' },
    });
    if (!setup.ok()) throw new Error(`Admin setup failed: ${setup.status()}`);
    const started = (await setup.json()) as SessionBody;
    const first = await api.post('/api/auth/register', {
      headers: bearer(started.token),
      data: { kind: 'passkey', deviceName: 'E2E admin' },
    });
    const root = (await first.json()) as SessionBody;
    const credentials: Record<string, string> = {};
    for (const label of ADMIN_LABELS) {
      const code = await api.post('/api/auth/device-codes', { headers: bearer(root.token) });
      const { code: digits } = (await code.json()) as { code: string };
      const redeemed = await api.post('/api/auth/code', {
        data: { code: digits, deviceId: `e2e-${label}` },
      });
      const { token } = (await redeemed.json()) as SessionBody;
      const done = await api.post('/api/auth/register', {
        headers: bearer(token),
        data: { kind: 'passkey', deviceName: `E2E ${label}` },
      });
      const body = (await done.json()) as SessionBody;
      if (!body.credentialId) throw new Error(`No passkey for ${label}`);
      credentials[label] = body.credentialId;
    }
    mkdirSync('test-results', { recursive: true });
    writeFileSync(ADMIN_FILE, JSON.stringify(credentials));
  } finally {
    await api.dispose();
  }
}
