import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AdminSeller, TeamMember } from '../../../shared/authContract';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerAdminI18n } from './i18n/register';
import { SellerDetails } from './SellerDetails';

// Plan 125: admin -> kitchen -> People -> Remove (two taps) left the row on screen. The cause: a
// people list asked for earlier (the page was refreshed) arrived after the one asked for after the
// remove, and the older answer overwrote the newer one.

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerAdminI18n();
  await i18n.changeLanguage('en');
});
afterEach(() => vi.restoreAllMocks());

const SELLER = { id: 's1', slug: 'onde', name: 'Onde Onde' } as unknown as AdminSeller;
const member = (id: string, name: string): TeamMember => ({
  accountId: id,
  displayName: name,
  role: 'owner',
  devices: 1,
  passkeys: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
});

describe('SellerDetails people list', () => {
  it('an older people answer that arrives late does not bring a removed person back', async () => {
    let server = [member('a', 'Bu Ani'), member('b', 'Pak Budi')];
    const held: Array<() => void> = [];
    let membersCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const json = (body: unknown) => Response.json(body);
      if (url.endsWith('/members') && (init?.method ?? 'GET') === 'GET') {
        membersCalls += 1;
        const snapshot = server;
        if (membersCalls === 2) {
          // the refresh: its answer is held back until the test lets it go
          return new Promise<Response>((resolve) =>
            held.push(() => resolve(json({ members: snapshot }))),
          );
        }
        return Promise.resolve(json({ members: snapshot }));
      }
      if (url.endsWith('/invites')) return Promise.resolve(json({ invites: [] }));
      if (init?.method === 'DELETE') {
        server = server.filter((m) => !url.endsWith(`/members/${m.accountId}`));
        return Promise.resolve(json({ ok: true }));
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
    const props = {
      seller: SELLER,
      refused: () => 'refused',
      onSeller: vi.fn(),
      onDevices: vi.fn(),
    };
    const view = render(
      <AppThemeProvider>
        <SellerDetails {...props} refreshKey={0} />
      </AppThemeProvider>,
    );
    const list = await screen.findByRole('list', { name: 'People' });
    expect(within(list).getByText('Bu Ani')).toBeInTheDocument();

    view.rerender(
      <AppThemeProvider>
        <SellerDetails {...props} refreshKey={1} />
      </AppThemeProvider>,
    );
    await waitFor(() => expect(held).toHaveLength(1));
    const row = within(list).getByText('Bu Ani').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Tap again to remove' }));
    await waitFor(() => expect(within(list).queryByText('Bu Ani')).not.toBeInTheDocument());

    held[0]?.(); // the old answer, with Bu Ani still in it
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(within(screen.getByRole('list', { name: 'People' })).queryByText('Bu Ani')).toBeNull();
    expect(screen.getByText('Pak Budi')).toBeInTheDocument();
  });
});
