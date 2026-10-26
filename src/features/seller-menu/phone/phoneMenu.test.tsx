import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuNoticeStatus } from '../../../../shared/menuNoticeContract';
import type { MenuView } from '../../../../shared/menusContract';
import { initI18n } from '../../../i18n/init';
import { AppThemeProvider } from '../../../theme/AppThemeProvider';
import { registerSellerMenuI18n } from '../i18n/register';
import type { ShareMenu, ShareSettings } from '../../../components/shareText/shareText';
import { cardStateOf } from './cardState';
import { registerPhoneMenuI18n } from './i18n/register';
import { PhoneMenuCard, PhoneMenuProvider } from './PhoneMenuCard';

const api = vi.hoisted(() => ({
  status: vi.fn(),
  send: vi.fn(),
  publish: vi.fn(),
  load: vi.fn(),
}));
vi.mock('../../../components/shareText/loadShareData', () => ({ loadShareData: api.load }));
vi.mock('../../../api/menuNotices', () => ({
  fetchMenuNoticeStatus: api.status,
  sendMenuNotice: api.send,
}));
vi.mock('../../../api/menus', () => ({ publishMenu: api.publish }));

const none = { en: '', id: '' };
const MENU: ShareMenu = {
  cookingDate: '2026-10-10',
  cutoffAt: '2026-10-09T21:00:00+10:30',
  pickupPoints: [
    {
      id: 'gw',
      place: 'Glen Waverley',
      directions: none,
      window: { start: '14:00', end: '17:00' },
    },
  ],
  delivery: { available: true, note: none },
  items: [
    {
      name: { en: 'Lime-leaf mixed rice', id: 'Nasi campur daun jeruk' },
      description: none,
      size: { en: '1 box', id: '1 box' },
      priceCents: 1500,
    },
  ],
};
const SETTINGS: ShareSettings = {
  whatsappNumber: '61412345678',
  postGreeting: { en: 'Hi everyone!', id: 'Halo semuanya!' },
  postClosing: { en: 'Questions? WhatsApp me on {phone}', id: 'Ada pertanyaan? WhatsApp {phone}' },
};

const NOW = new Date('2026-10-26T00:00:00Z');

const notice = (over: Partial<MenuNoticeStatus> = {}): MenuNoticeStatus => ({
  phones: 14,
  sends: [],
  canSend: true,
  kitchenName: 'DellaVee',
  cookingDate: '2026-10-31',
  ...over,
});

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
  registerPhoneMenuI18n();
  await i18n.changeLanguage('en');
});
beforeEach(() => {
  localStorage.clear();
  api.status.mockResolvedValue({ ok: true, data: notice() });
  api.load.mockResolvedValue({ menu: MENU, settings: SETTINGS });
});
afterEach(async () => {
  cleanup();
  // Unmounting steps the browser history back out of open layers; let that settle.
  await new Promise((resolve) => setTimeout(resolve, 30));
  vi.unstubAllGlobals();
  api.status.mockReset();
  api.send.mockReset();
  api.publish.mockReset();
  api.load.mockReset();
});

function view(state: MenuView['menu']['state'], over: Partial<MenuView['menu']> = {}): MenuView {
  return {
    menu: {
      id: 'm1',
      state,
      cookingDate: '2026-10-31',
      cutoffAt: '2026-10-30T21:00:00+10:30',
      delivery: { available: true, note: { en: 'Within 5 km', id: 'Dalam 5 km' } },
      pictureRef: 'pic',
      wizardStep: 3,
      takingOrders: true,
      placeUses: [{ placeId: 'p1' }],
      ...(state === 'not_published' ? {} : { publishedAt: '2026-10-25T00:00:00Z' }),
      ...over,
    },
    dishes: [
      {
        id: 'd1',
        name: { en: 'Rendang', id: 'Rendang' },
        description: { en: '', id: '' },
        size: { en: '1 box', id: '1 box' },
        priceCents: 1800,
        chefId: 'c1',
        remaining: null,
        soldOut: false,
      },
      {
        id: 'd2',
        name: { en: 'Snacks', id: 'Snack' },
        description: { en: '', id: '' },
        size: { en: '1 bag', id: '1 kantong' },
        priceCents: 600,
        chefId: 'c1',
        remaining: null,
        soldOut: true,
        preorder: false,
      },
    ],
    pickupPoints: [
      {
        id: 'p1',
        place: 'Glenelg',
        directions: { en: '', id: '' },
        window: { start: '10:00', end: '12:00' },
      },
    ],
  };
}

function show(menu: MenuView | null) {
  const reload = vi.fn();
  render(
    <AppThemeProvider>
      <PhoneMenuProvider view={menu} reload={reload} now={NOW}>
        <PhoneMenuCard />
      </PhoneMenuProvider>
    </AppThemeProvider>,
  );
  return { reload };
}

describe('card state', () => {
  it('decides ready, not ready, live, closed and none', () => {
    expect(cardStateOf(null, NOW).kind).toBe('none');
    expect(cardStateOf(view('not_published'), NOW).kind).toBe('ready');
    const empty = { ...view('not_published'), dishes: [] };
    expect(cardStateOf(empty, NOW)).toMatchObject({ kind: 'notReady', missing: ['noDishes'] });
    expect(cardStateOf(view('live'), NOW).kind).toBe('live');
    expect(cardStateOf(view('live', { cutoffAt: '2026-10-20T21:00:00+10:30' }), NOW)).toEqual({
      kind: 'closed',
      finished: false,
    });
    expect(cardStateOf(view('finished'), NOW)).toEqual({ kind: 'closed', finished: true });
    // A brand-new menu nobody touched is "no menu".
    const untouched = { ...view('not_published', { wizardStep: 0 }), dishes: [] };
    expect(cardStateOf(untouched, NOW).kind).toBe('none');
  });
});

describe('Menu card', () => {
  it('ready: pill, title, summary and Publish menu', () => {
    show(view('not_published'));
    expect(screen.getByText('Ready to publish')).toBeVisible();
    expect(screen.getByText('Menu for Sat 31 Oct')).toBeVisible();
    expect(screen.getByText(/2 dishes · orders close/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publish menu' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Share menu/ })).not.toBeInTheDocument();
  });

  it('not ready: no Publish button; the card lists what is missing and says to finish on the tablet', () => {
    show({ ...view('not_published'), dishes: [] });
    expect(screen.getByText('Not ready')).toBeVisible();
    expect(screen.getByText('Finish on the tablet: no dishes')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Publish menu' })).not.toBeInTheDocument();
  });

  it('live: Live pill, Share menu and Notice', async () => {
    show(view('live'));
    expect(screen.getByText('Live')).toBeVisible();
    expect(screen.getByText(/^until /)).toBeVisible();
    expect(screen.getByRole('button', { name: /Share menu/ })).toBeVisible();
    expect(await screen.findByRole('button', { name: '🔔 Notice' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Publish menu' })).not.toBeInTheDocument();
  });

  it('live but the notice may not be sent: Share stays, Notice goes', async () => {
    api.status.mockResolvedValue({ ok: true, data: notice({ canSend: false }) });
    show(view('live'));
    await waitFor(() => expect(api.status).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Share menu/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: '🔔 Notice' })).not.toBeInTheDocument();
  });

  it('closed: the status only, no buttons', () => {
    show(view('live', { cutoffAt: '2026-10-20T21:00:00+10:30' }));
    expect(screen.getByText('Orders closed')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Share menu/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Notice/ })).not.toBeInTheDocument();
  });

  it('no menu at all: no card', () => {
    show(null);
    expect(screen.queryByText(/Menu for/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('tapping the card opens the read-only menu with the dishes and the footer buttons', async () => {
    show(view('live'));
    fireEvent.click(screen.getByRole('button', { name: 'Open the menu' }));
    const layer = screen.getByRole('dialog', { name: 'Menu · Sat 31 Oct' });
    expect(within(layer).getByText('Rendang')).toBeVisible();
    expect(within(layer).getByText('$18.00')).toBeVisible();
    expect(within(layer).getByText('Sold out')).toBeVisible();
    expect(within(layer).getByText('On the day')).toBeVisible();
    expect(within(layer).getByText('Pre-order')).toBeVisible();
    expect(within(layer).getByRole('button', { name: /Share menu/ })).toBeVisible();
    expect(await within(layer).findByRole('button', { name: '🔔 Notice' })).toBeVisible();
    fireEvent.click(within(layer).getByRole('button', { name: 'Back to Orders' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Publish', () => {
  it('shows the summary, publishes, then Menu is live with Share and the notice', async () => {
    api.publish.mockResolvedValue({ ok: true, data: { menu: view('live') } });
    const { reload } = show(view('not_published'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Publish this menu?' });
    expect(within(sheet).getByText('Sat 31 Oct')).toBeVisible();
    expect(within(sheet).getByText('1 place · delivery')).toBeVisible();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Publish menu' }));
    const live = await screen.findByRole('dialog', { name: 'Menu is live ✓' });
    expect(api.publish).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
    expect(within(live).getByRole('button', { name: /Share menu/ })).toBeVisible();
    expect(
      await within(live).findByRole('button', { name: '🔔 Send new-menu notice · 14 phones' }),
    ).toBeVisible();
    expect(within(live).getByRole('button', { name: 'Done' })).toBeVisible();
  });

  it('says in plain words when publishing fails', async () => {
    api.publish.mockResolvedValue({ ok: false, error: 'x', status: 500, message: '' });
    show(view('not_published'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish menu' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The menu could not be published. Check the connection and try again.',
    );
  });
});

describe('Share menu layer', () => {
  async function openShare() {
    show(view('live'));
    fireEvent.click(screen.getByRole('button', { name: /Share menu/ }));
    const layer = await screen.findByRole('dialog', { name: 'Share menu' });
    return { layer, box: within(layer).getByRole<HTMLTextAreaElement>('textbox') };
  }

  it('has Close, the title and Share in the top bar; the box holds the ready-made post', async () => {
    const { layer, box } = await openShare();
    const bar = layer.querySelector('header') as HTMLElement;
    expect(within(bar).getByRole('button', { name: 'Close' })).toBeVisible();
    expect(within(bar).getByRole('button', { name: 'Share' })).toBeVisible();
    expect(box.value).toContain('Halo semuanya!');
    expect(box.value).toContain('Nasi campur daun jeruk');
  });

  it('keeps her text after a share, shows the green note, shares again; Reset brings the post back', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share });
    const { layer, box } = await openShare();
    const ready = box.value;
    fireEvent.change(box, { target: { value: `Halo Bu Ayu!\n${ready}` } });
    expect(within(layer).getByText('Changed for this share.')).toBeVisible();
    fireEvent.click(within(layer).getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith({ text: `Halo Bu Ayu!\n${ready}` });
    expect(await within(layer).findByText(/Back\? Your text is still here/)).toBeVisible();
    expect(box.value).toBe(`Halo Bu Ayu!\n${ready}`);
    // The next person: change and share again, as often as she likes.
    fireEvent.change(box, { target: { value: 'Halo Pak Budi!' } });
    fireEvent.click(within(layer).getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenLastCalledWith({ text: 'Halo Pak Budi!' });
    expect(await within(layer).findByText(/Back\? Your text is still here/)).toBeVisible();
    fireEvent.click(within(layer).getByRole('button', { name: 'Reset text' }));
    expect(within(layer).queryByText(/Back\? Your text is still here/)).not.toBeInTheDocument();
    expect(box.value).toBe(ready);
    expect(within(layer).queryByRole('button', { name: 'Reset text' })).not.toBeInTheDocument();
  });

  it('falls back to the wa.me link when the phone has no share sheet', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    vi.stubGlobal('navigator', { ...navigator, share: undefined });
    const { layer } = await openShare();
    fireEvent.click(within(layer).getByRole('button', { name: 'Share' }));
    expect(open).toHaveBeenCalled();
    expect(String(open.mock.calls[0]?.[0])).toContain('whatsapp.com/send?text=');
    expect(await within(layer).findByText(/Back\?/)).toBeVisible();
  });

  it('switching the language replaces her text with the ready-made post in that language', async () => {
    const { layer, box } = await openShare();
    fireEvent.change(box, { target: { value: 'my own words' } });
    fireEvent.click(within(layer).getByRole('radio', { name: 'English' }));
    expect(box.value).toContain('Hi everyone!');
    expect(box.value).not.toContain('my own words');
    expect(localStorage.getItem('sellerPhoneShareLanguage')).toBe('en');
  });

  it('Close forgets the changes: opening it again shows the ready-made post', async () => {
    const { layer, box } = await openShare();
    const ready = box.value;
    fireEvent.change(box, { target: { value: 'my own words' } });
    fireEvent.click(within(layer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Share menu/ }));
    const again = (await screen.findByRole('dialog', { name: 'Share menu' })).querySelector(
      'textarea',
    );
    expect(again?.value).toBe(ready);
  });

  it('Android Back forgets the changed text, like Close', async () => {
    const { box } = await openShare();
    fireEvent.change(box, { target: { value: 'my own words' } });
    await pressBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Share menu/ }));
    const again = (await screen.findByRole('dialog', { name: 'Share menu' })).querySelector(
      'textarea',
    );
    expect(again?.value).toContain('Halo semuanya!');
    expect(again?.value).not.toContain('my own words');
  });
});

/** The phone's Back button: the browser steps back one history entry. */
async function pressBack() {
  act(() => window.history.back());
  await new Promise((resolve) => setTimeout(resolve, 30));
}

describe('Android Back', () => {
  it('closes only the top layer: share first, then the menu, a third Back leaves them all closed', async () => {
    show(view('live'));
    fireEvent.click(screen.getByRole('button', { name: 'Open the menu' }));
    const menu = screen.getByRole('dialog', { name: 'Menu · Sat 31 Oct' });
    fireEvent.click(within(menu).getByRole('button', { name: /Share menu/ }));
    await screen.findByRole('dialog', { name: 'Share menu' });
    await pressBack();
    expect(screen.queryByRole('dialog', { name: 'Share menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Menu · Sat 31 Oct' })).toBeVisible();
    await pressBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the publish sheet; a button close then Back does not reopen or close anything else', async () => {
    show(view('not_published'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Publish this menu?' });
    await pressBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Close by the button, then open another layer: Back closes exactly that one.
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(sheet).not.toBeInTheDocument());
    const depth = window.history.length;
    await pressBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.history.length).toBe(depth);
  });

  it('the notice sheet closes with Back, and the layer under it stays', async () => {
    show(view('live'));
    fireEvent.click(await screen.findByRole('button', { name: '🔔 Notice' }));
    await screen.findByRole('dialog', { name: 'Notify customers?' });
    await pressBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
