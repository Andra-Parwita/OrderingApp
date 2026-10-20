import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { MenuResponse } from '../../../shared/menuContract';
import { MenuScreen, resetMenuFreshness } from './MenuScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

// Hotfix 1.0.43.1: no picture flash and no second menu request when the home page remounts.

const noop = () => undefined;

beforeAll(() => setupI18n('en'));
beforeEach(resetMenuFreshness);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function serveMenu(pictureUrl?: string) {
  const body = (await (await fetch('/api/s/onde-onde/menu')).json()) as MenuResponse;
  const menu = { ...body, ...(pictureUrl ? { pictureUrl } : {}) };
  const calls: Array<string> = [];
  server.use(
    http.get('*/api/s/:slug/menu', ({ params }) => {
      calls.push(String(params.slug));
      return HttpResponse.json(menu);
    }),
  );
  return calls;
}

const home = (slug: string) => <MenuScreen slug={slug} onSeeDishes={noop} onHowItWorks={noop} />;

describe('menu home picture', () => {
  it('decodes the hero picture synchronously and eagerly', async () => {
    await serveMenu('/samples/rail.png');
    renderWithStore(home('onde-onde'));
    const img = (await screen.findAllByAltText(/Menu for/))[0] as HTMLImageElement;
    expect(img).toHaveAttribute('decoding', 'sync');
    expect(img).toHaveAttribute('loading', 'eager');
  });
});

describe('menu request on remount', () => {
  async function loadOnce(store = createTestStore()) {
    const first = renderWithStore(home('onde-onde'), store);
    await screen.findByRole('heading', { name: 'Onde Onde' });
    first.unmount();
    return store;
  }

  it('skips the request when the menu is ready and fresh', async () => {
    const calls = await serveMenu();
    const store = await loadOnce();
    renderWithStore(home('onde-onde'), store);
    await screen.findByRole('heading', { name: 'Onde Onde' });
    expect(calls).toEqual(['onde-onde']);
  });

  it('requests again when the last request is stale', async () => {
    const calls = await serveMenu();
    const store = await loadOnce();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    renderWithStore(home('onde-onde'), store);
    await vi.waitFor(() => expect(calls).toHaveLength(2));
  });

  it('requests again for a different slug', async () => {
    const calls = await serveMenu();
    const store = await loadOnce();
    renderWithStore(home('other-kitchen'), store);
    await vi.waitFor(() => expect(calls).toEqual(['onde-onde', 'other-kitchen']));
  });
});
