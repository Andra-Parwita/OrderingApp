import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/customer/rememberMe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/customer/rememberMe')>()),
  rememberMeSupported: () => true,
}));

import { setRememberMeLocal } from '../../api/customer/state';
import { detectEnvironment } from '../../components/install/detect';
import { NUDGE_STOP_AFTER, nudgeKey } from '../../components/notice/ordersNudgeState';
import { registerRememberMeI18n } from '../../components/remember-me';
import { lightTheme } from '../../theme/themes';
import { setTopBarHeight } from '../../theme/topBars';
import { OrdersNudge } from './OrdersNudge';
import { setupI18n } from './testSupport';

// Plan 121 part A: the My orders card. One at a time, notifications first, dismiss until something
// new, four dismissals and stop, iPhone-in-a-browser wording, no storage.

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const push = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
  platform: 'Win32',
  hasPushManager: true,
  hasServiceWorker: true,
};
/** Notifications can be turned on here, and are off. */
const canTurnOn = { env: detectEnvironment({ ...push, permission: 'default' }) };
/** Turned on already. */
const alreadyOn = { env: detectEnvironment({ ...push, permission: 'granted' }), subscribed: true };
/** iPhone in Safari, not installed. */
const iphoneBrowser = { env: detectEnvironment({ userAgent: IPHONE, permission: 'default' }) };
/** No way to get notifications here. */
const cannot = {
  env: detectEnvironment({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120' }),
};

const notify = () => screen.queryByTestId('orders-nudge-notify');
const remember = () => screen.queryByTestId('orders-nudge-remember');

const saveOrders = (...tokens: Array<string>) =>
  localStorage.setItem(
    'myOrders',
    JSON.stringify(
      tokens.map((token) => ({ code: token, token, placedAt: '2026-10-20T00:00:00Z' })),
    ),
  );

type Install = typeof canTurnOn | typeof alreadyOn | typeof iphoneBrowser | typeof cannot;
function show(props: { open?: boolean; menus?: Record<string, string>; install?: Install } = {}) {
  const ui = (next: typeof props) => (
    <ThemeProvider theme={lightTheme}>
      <OrdersNudge
        hasOpenOrder={next.open ?? true}
        menus={next.menus ?? { onde: '2026-10-31' }}
        kitchenName="Onde Onde"
        install={next.install ?? canTurnOn}
      />
    </ThemeProvider>
  );
  const view = render(ui(props));
  return { ...view, again: (next: typeof props) => view.rerender(ui(next)) };
}
const dismiss = () => fireEvent.click(screen.getByRole('button', { name: 'Hide this' }));

beforeAll(async () => {
  await setupI18n('en');
  registerRememberMeI18n();
});
beforeEach(() => {
  localStorage.clear();
  saveOrders('order-one');
});
afterEach(async () => {
  cleanup();
  setTopBarHeight('update', 0);
  vi.restoreAllMocks();
  await act(() => i18n.changeLanguage('en'));
});

describe('which card', () => {
  it('shows the notifications card while an order is open and notifications are off', () => {
    show();
    expect(screen.getByText('Get a message when your order is ready')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeVisible();
  });

  it('is one card at a time: notifications come before Remember me', () => {
    show({ open: true });
    expect(notify()).not.toBeNull();
    expect(remember()).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('shows the Remember me card when no order is open, and Turn on opens its sheet', () => {
    show({ open: false });
    expect(notify()).toBeNull();
    expect(screen.getByText('Keep your orders on all your phones')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('shows Remember me instead when notifications are already on', () => {
    show({ open: true, install: alreadyOn });
    expect(notify()).toBeNull();
    expect(remember()).not.toBeNull();
  });

  it('shows nothing when Remember me is on and notifications cannot work here', () => {
    setRememberMeLocal({ credentialId: 'c', sealing: true, setup: false });
    show({ open: true, install: cannot });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Turn on starts the notification flow (the permission prompt is asked from this tap)', () => {
    const ask = vi.fn(() => Promise.resolve('default' as NotificationPermission));
    vi.stubGlobal(
      'Notification',
      Object.assign(ask, { permission: 'default', requestPermission: ask }),
    );
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(ask).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('is not shown while an update, maintenance or offline bar is up', () => {
    setTopBarHeight('update', 52);
    show();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('iPhone in a browser', () => {
  it('asks to add to the home screen first, and How opens the install steps', () => {
    show({ install: iphoneBrowser });
    expect(
      screen.getByText('Add to your home screen to get a message when your order is ready'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'How' }));
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('is in Indonesian too', async () => {
    await act(() => i18n.changeLanguage('id'));
    show({ install: iphoneBrowser });
    expect(
      screen.getByText('Tambahkan ke layar utama agar dapat pesan saat pesanan siap'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Caranya' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sembunyikan' })).toBeVisible();
  });
});

describe('Remember me card: iPhone has separate storage per home-screen app', () => {
  it('says "Turn on or restore" on an iPhone, and the sheet offers both', () => {
    show({ open: false, install: iphoneBrowser });
    expect(screen.queryByRole('button', { name: 'Turn on' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on or restore' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('Turned on Remember me before?')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Restore your orders' })).toBeVisible();
  });

  it('is in Indonesian too', async () => {
    await act(() => i18n.changeLanguage('id'));
    show({ open: false, install: iphoneBrowser });
    expect(screen.getByRole('button', { name: 'Nyalakan atau pulihkan' })).toBeVisible();
  });

  it('keeps "Turn on" on Android and desktop browsers', () => {
    show({ open: false });
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Turn on or restore' })).toBeNull();
  });
});

describe('the cross', () => {
  it('goes quiet, and stays quiet on the next visit while nothing is new', () => {
    const first = show();
    dismiss();
    expect(notify()).toBeNull();
    first.unmount();
    show();
    expect(notify()).toBeNull();
    // The card that is only quiet keeps its place: Remember me does not jump in.
    expect(remember()).toBeNull();
  });

  it('comes back after a kitchen publishes a new menu', () => {
    const view = show();
    dismiss();
    view.unmount();
    // A kitchen that was not noted at the dismissal (its menu loaded late) does not wake it.
    const same = show({ menus: { onde: '2026-10-31', other: '2026-11-07' } });
    expect(notify()).toBeNull();
    same.unmount();
    show({ menus: { onde: '2026-11-07' } });
    expect(notify()).not.toBeNull();
  });

  it('comes back after the next order', () => {
    const view = show();
    dismiss();
    view.unmount();
    saveOrders('order-one', 'order-two');
    show();
    expect(notify()).not.toBeNull();
  });

  it('counts per card: dismissing one does not quiet the other', () => {
    const view = show({ open: true });
    dismiss();
    view.unmount();
    show({ open: false });
    expect(remember()).not.toBeNull();
  });

  it(`stops for good after ${String(NUDGE_STOP_AFTER)} dismissals, and Remember me takes the place`, () => {
    for (let round = 1; round <= NUDGE_STOP_AFTER; round += 1) {
      saveOrders('order-one', ...Array.from({ length: round }, (_, i) => `later-${String(i)}`));
      const view = show();
      expect(notify()).not.toBeNull();
      dismiss();
      view.unmount();
    }
    saveOrders('order-one', 'a-new-one', 'and-another');
    show({ menus: { onde: '2027-01-01' } });
    expect(notify()).toBeNull();
    expect(remember()).not.toBeNull();
  });

  it('Remember me stops after four dismissals too', () => {
    for (let round = 1; round <= NUDGE_STOP_AFTER; round += 1) {
      saveOrders('order-one', ...Array.from({ length: round }, (_, i) => `later-${String(i)}`));
      const view = show({ open: false });
      expect(remember()).not.toBeNull();
      dismiss();
      view.unmount();
    }
    saveOrders('order-one', 'a-new-one', 'and-another');
    show({ open: false });
    expect(screen.queryByRole('status')).toBeNull();
    expect(JSON.parse(localStorage.getItem(nudgeKey('remember')) ?? '{}')).toMatchObject({
      count: NUDGE_STOP_AFTER,
    });
  });
});

describe('without storage', () => {
  it('shows the card, and the cross still hides it for this visit', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    show();
    expect(notify()).not.toBeNull();
    dismiss();
    expect(notify()).toBeNull();
    expect(remember()).toBeNull();
  });
});
