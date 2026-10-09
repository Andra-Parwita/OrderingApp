import { chromium, request, type APIRequestContext } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SoftAuthenticator, type ExportedCredential } from '../mocks/softAuthenticator';
import { ADMIN_FILE, ADMIN_LABELS, DEV_ADMIN_SETUP_KEY, originHeaders } from './adminSession';

// Registers the dev admin once per run (the database holds a single admin), then adds one more admin
// device per label: signing in on a device ends that device's other session, so each spec gets
// its own passkey and the specs cannot sign each other out. The passkeys are real WebAuthn: a
// software authenticator answers the server's registration options with a genuine ES256 key pair,
// and the key pair is written to a file so specs can load it into Chrome's virtual authenticator
// or sign in over the API with it.

type SessionBody = { credentialId?: string };

/**
 * The run's own database: scripts/scratch-server.mjs deleted, migrated and seeded it before the
 * server started (the web server starts BEFORE this setup, so doing it here would race the server
 * that already holds the files). Here it is only checked, before anything is written: the path is
 * exactly scratch/e2e-d1, never `.wrangler/state` (the owner's dev data), and the server answers
 * with dev tools on and both sample kitchens.
 */
const E2E_DB_DIR = path.resolve('scratch', 'e2e-d1');

async function assertScratchDatabase(baseURL: string): Promise<void> {
  if (E2E_DB_DIR.includes('.wrangler') || path.basename(path.dirname(E2E_DB_DIR)) !== 'scratch') {
    throw new Error(`Refusing to run e2e against ${E2E_DB_DIR}`);
  }
  if (!existsSync(path.join(E2E_DB_DIR, 'v3'))) {
    throw new Error(
      `No e2e database at ${E2E_DB_DIR}: start the server with scripts/scratch-server.mjs`,
    );
  }
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  try {
    const health = (await (await api.get('/api/health')).json()) as { devTools?: boolean };
    if (health.devTools !== true) throw new Error('The e2e server must run with DEV_TOOLS=1');
    const sellers = (await (await api.get('/api/dev/sellers')).json()) as {
      sellers: Array<unknown>;
    };
    if (sellers.sellers.length !== 2) throw new Error('The e2e database is not freshly seeded');
  } finally {
    await api.dispose();
  }
}

/**
 * Loads the customer app and a seller page once. The first page load after a code change makes
 * vite re-optimise its dependencies and reload, which made the first specs time out; doing it
 * here, before any spec starts, moves that cost out of them.
 */
async function warmUp(baseURL: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
    for (const route of ['/', '/seller/sign-in']) {
      await page.goto(baseURL + route, { waitUntil: 'networkidle', timeout: 90_000 });
    }
  } finally {
    await browser.close();
  }
}

/** Registration options → software authenticator → the server's own verification. */
async function registerPasskey(
  api: APIRequestContext,
  soft: SoftAuthenticator,
  deviceName: string,
): Promise<SessionBody> {
  const asked = await api.post('/api/auth/register/options', { headers: originHeaders });
  if (!asked.ok()) throw new Error(`No passkey options: ${asked.status()}`);
  const { options } = (await asked.json()) as { options: { challenge: string } };
  const done = await api.post('/api/auth/register', {
    headers: originHeaders,
    data: { kind: 'passkey', deviceName, response: soft.create(options) },
  });
  if (!done.ok()) throw new Error(`Passkey registration failed: ${done.status()}`);
  return (await done.json()) as SessionBody;
}

// Playwright loads the default export of the global setup file.
// eslint-disable-next-line import-x/no-default-export
export default async function globalSetup(): Promise<void> {
  const baseURL = `https://localhost:${process.env['PORT'] ?? '5181'}`;
  await assertScratchDatabase(baseURL);
  await warmUp(baseURL);
  const contexts: Array<APIRequestContext> = [];
  const open = async () => {
    const context = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    contexts.push(context);
    return context;
  };
  try {
    const root = await open();
    const setup = await root.post('/api/admin/setup', {
      headers: originHeaders,
      data: { setupKey: DEV_ADMIN_SETUP_KEY, deviceId: 'e2e-global-admin' },
    });
    if (!setup.ok()) throw new Error(`Admin setup failed: ${setup.status()}`);
    await registerPasskey(root, new SoftAuthenticator(baseURL), 'E2E admin');
    const credentials: Record<string, ExportedCredential> = {};
    for (const label of ADMIN_LABELS) {
      const code = await root.post('/api/auth/device-codes', { headers: originHeaders });
      const { code: digits } = (await code.json()) as { code: string };
      // A fresh context: this device has no session yet, as a real second device.
      const device = await open();
      const redeemed = await device.post('/api/auth/code', {
        headers: originHeaders,
        data: { code: digits, deviceId: `e2e-${label}` },
      });
      if (!redeemed.ok()) throw new Error(`Add-device code failed for ${label}`);
      const soft = new SoftAuthenticator(baseURL);
      const body = await registerPasskey(device, soft, `E2E ${label}`);
      const exported = soft.export()[0];
      if (!body.credentialId || !exported) throw new Error(`No passkey for ${label}`);
      credentials[label] = exported;
    }
    mkdirSync('test-results', { recursive: true });
    writeFileSync(ADMIN_FILE, JSON.stringify(credentials));
  } finally {
    await Promise.all(contexts.map((context) => context.dispose()));
  }
}
