import { cleanup, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { MenuResponse } from '../../../shared/menuContract';
import { MyOrdersScreen } from './MyOrdersScreen';
import { renderWithStore, setupI18n } from './testSupport';

// Plan 068 follow-up: My orders shows the banner of the kitchen the customer came from.
const own = vi.hoisted(() => ({ slug: null as string | null }));
vi.mock('../../components/install', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/install')>()),
  ownKitchen: () => own.slug,
}));

const noop = () => undefined;

/** Serves the sample menu under another kitchen's slug and name (no banner picture: its name shows). */
async function serveKitchen(slug: string, name: string): Promise<void> {
  const body = (await (await fetch('/api/s/onde-onde/menu')).json()) as MenuResponse;
  const kitchen = { ...body.kitchen, bannerImageUrl: undefined, images: undefined };
  const next: MenuResponse = {
    ...body,
    seller: { ...body.seller, slug },
    kitchen: { ...kitchen, name },
  };
  server.use(http.get(`*/api/s/${slug}/menu`, () => HttpResponse.json(next)));
}

beforeAll(() => setupI18n('en'));
beforeEach(() => {
  own.slug = null;
  localStorage.clear();
});
afterEach(cleanup);

describe('My orders kitchen banner', () => {
  it("shows the home-screen app's kitchen, not the last kitchen opened", async () => {
    await serveKitchen('dellavee', 'Della Vee');
    await serveKitchen('ondeonde', 'Onde Two');
    own.slug = 'dellavee';
    localStorage.setItem('lastKitchen', 'ondeonde');
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByText('Della Vee')).toBeVisible();
    expect(screen.queryByText('Onde Two')).toBeNull();
  });

  it('in a browser tab, shows the last kitchen opened', async () => {
    await serveKitchen('dellavee', 'Della Vee');
    localStorage.setItem('lastKitchen', 'dellavee');
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    expect(await screen.findByText('Della Vee')).toBeVisible();
  });

  it('with no kitchen known, shows no banner', async () => {
    renderWithStore(<MyOrdersScreen onBack={noop} onOpenOrder={noop} />);
    await screen.findByRole('heading', { name: 'My orders' });
    await waitFor(() => expect(screen.queryByText('Della Vee')).toBeNull());
    expect(screen.queryByRole('img')).toBeNull();
  });
});
