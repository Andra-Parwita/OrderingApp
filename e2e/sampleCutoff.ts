import { request, type APIRequestContext } from '@playwright/test';
import { originHeaders } from './adminSession';

// The sample menus are seeded from the real clock: cooking the coming Saturday, cut-off Friday
// 21:00 in Adelaide. A run between Friday 21:00 and midnight would find ordering closed and fail
// every spec that places an order (lesson 43). So each run moves the cut-offs a week later and
// reads the cooking date back from the server.

export const SAMPLE_SLUGS = ['onde-onde', 'dapur-demo'] as const;
const WEEK_MS = 7 * 86_400_000;

type CurrentMenu = { menu: { menu: { cookingDate: string; cutoffAt: string } } };

/** Moves both sample kitchens' current cut-off a week later; returns Onde Onde's cooking date. */
export async function pushSampleCutoffs(api: APIRequestContext): Promise<string> {
  let cookingDate = '';
  for (const slug of SAMPLE_SLUGS) {
    const headers = { 'X-Seller': slug, ...originHeaders };
    const got = await api.get('/api/seller/menus/current', { headers });
    if (!got.ok()) throw new Error(`No current menu for ${slug}: ${got.status()}`);
    const { menu } = ((await got.json()) as CurrentMenu).menu;
    const cutoffAt = new Date(Date.parse(menu.cutoffAt) + WEEK_MS).toISOString();
    const put = await api.put('/api/seller/menus/current', { headers, data: { cutoffAt } });
    if (!put.ok()) throw new Error(`Moving the cut-off of ${slug} failed: ${put.status()}`);
    if (slug === 'onde-onde') cookingDate = menu.cookingDate;
  }
  return cookingDate;
}

/**
 * The same, on a cookie-free context (an admin session cookie would win over the dev headers).
 * Only ever called against the scratch server (global-setup checks that first).
 */
export async function pushSampleCutoffsAt(baseURL: string): Promise<string> {
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  try {
    return await pushSampleCutoffs(api);
  } finally {
    await api.dispose();
  }
}
