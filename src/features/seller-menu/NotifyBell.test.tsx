import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MenuNoticeStatus } from '../../../shared/menuNoticeContract';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerSellerMenuI18n } from './i18n/register';
import { NotifyBell } from './NotifyBell';

const api = vi.hoisted(() => ({ status: vi.fn(), send: vi.fn() }));
vi.mock('../../api/menuNotices', () => ({
  fetchMenuNoticeStatus: api.status,
  sendMenuNotice: api.send,
}));

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerSellerMenuI18n();
  await i18n.changeLanguage('en');
});
afterEach(() => {
  api.status.mockReset();
  api.send.mockReset();
});

const NOW = new Date('2026-10-08T05:00:00Z');
const at = (iso: string) => ({ sentAt: iso, reached: 23 });
const status = (over: Partial<MenuNoticeStatus> = {}): MenuNoticeStatus => ({
  phones: 23,
  sends: [],
  canSend: true,
  kitchenName: 'DellaVee',
  cookingDate: '2026-10-25',
  ...over,
});
const ok = (data: MenuNoticeStatus) => Promise.resolve({ ok: true, data });

function show() {
  render(
    <AppThemeProvider>
      <NotifyBell now={NOW} />
    </AppThemeProvider>,
  );
}
const BELL = { name: /^Notify customers \(23 phones\)/ };
const TWICE = [at('2026-10-08T00:10:00Z'), at('2026-10-08T02:30:00Z')];

describe('NotifyBell', () => {
  it('shows nothing when orders are closed', async () => {
    api.status.mockReturnValue(ok(status({ canSend: false })));
    show();
    await waitFor(() => expect(api.status).toHaveBeenCalled());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows nothing when the status call is refused (not the owner)', async () => {
    api.status.mockResolvedValue({ ok: false, error: 'forbidden', status: 403, message: '' });
    show();
    await waitFor(() => expect(api.status).toHaveBeenCalled());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('is an icon button named with the phone count; the first window says Not sent yet and previews the notice', async () => {
    api.status.mockReturnValue(ok(status()));
    show();
    fireEvent.click(await screen.findByRole('button', BELL));
    const sheet = screen.getByRole('dialog', { name: 'Notify customers?' });
    expect(within(sheet).getByText('Not sent yet for this menu.')).toBeVisible();
    expect(within(sheet).getByText('23 phones get new-menu notices. They will see:')).toBeVisible();
    expect(within(sheet).getByText('DellaVee')).toBeVisible();
    expect(within(sheet).getByText('New menu is out: order for Sun 25 Oct.')).toBeVisible();
    expect(within(sheet).getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(within(sheet).getByRole('button', { name: 'Send' })).toBeVisible();
  });

  it('sends, shows Sending while it saves, then the n times beside the bell', async () => {
    api.status.mockReturnValue(ok(status()));
    let finish: (value: unknown) => void = () => undefined;
    api.send.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    show();
    fireEvent.click(await screen.findByRole('button', BELL));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(api.send).toHaveBeenCalledWith(false, expect.anything());
    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled();
    finish({ ok: true, data: status({ sends: [at('2026-10-08T00:10:00Z')] }) });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('1×')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Notified 1× · / })).toBeVisible();
  });

  it('after one send the window says when it went and to how many phones', async () => {
    api.status.mockReturnValue(ok(status({ sends: [at('2026-10-08T00:10:00Z')] })));
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Notified 1×/ }));
    const sheet = screen.getByRole('dialog', { name: 'Notify customers?' });
    expect(
      within(sheet).getByText(/^Sent for this menu: once, today .+ to 23 phones\.$/),
    ).toBeVisible();
  });

  it('after two sends it asks Send again and Send anyway sends with again', async () => {
    api.status.mockReturnValue(ok(status({ sends: TWICE })));
    api.send.mockResolvedValue({ ok: true, data: status({ sends: TWICE }) });
    show();
    expect(await screen.findByText('2×')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Notified 2×/ }));
    const sheet = screen.getByRole('dialog', { name: 'Send again?' });
    expect(
      within(sheet).getByText(/You've sent this menu twice already \(.+ and .+\)\./),
    ).toBeVisible();
    expect(within(sheet).getByRole('button', { name: "Don't send" })).toBeVisible();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send anyway' }));
    await waitFor(() => expect(api.send).toHaveBeenCalledWith(true, expect.anything()));
  });

  it("Don't send closes the window and sends nothing", async () => {
    api.status.mockReturnValue(ok(status({ sends: TWICE })));
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Notified 2×/ }));
    fireEvent.click(screen.getByRole('button', { name: "Don't send" }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.send).not.toHaveBeenCalled();
  });

  it('keeps the window open with a message when the send fails', async () => {
    api.status.mockReturnValue(ok(status()));
    api.send.mockResolvedValue({ ok: false, error: 'network', status: 0, message: '' });
    show();
    fireEvent.click(await screen.findByRole('button', BELL));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send. Try again.');
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    api.status.mockReturnValue(ok(status()));
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Beri tahu pelanggan (23 ponsel)' }));
    expect(screen.getByRole('dialog', { name: 'Beri tahu pelanggan?' })).toBeVisible();
    expect(screen.getByText('Belum dikirim untuk menu ini.')).toBeVisible();
    await i18n.changeLanguage('en');
  });
});
