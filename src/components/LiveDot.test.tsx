import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKOFF_MAX_MS, subscribeLive, type SocketLike } from '../api/live';
import { LiveDot } from './LiveDot';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';

const renderDot = (ui: ReactNode) => render(<AppThemeProvider>{ui}</AppThemeProvider>);

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  await i18n.changeLanguage('en');
});

class FakeSocket implements SocketLike {
  static all: Array<FakeSocket> = [];
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  constructor() {
    FakeSocket.all.push(this);
  }
  send() {}
  close() {}
}
const last = () => FakeSocket.all[FakeSocket.all.length - 1] as FakeSocket;
const create = () => new FakeSocket();

let stop: (() => void) | undefined;

beforeEach(() => {
  FakeSocket.all = [];
  vi.useFakeTimers();
  stop = subscribeLive({ onEvent: () => undefined, onStatus: () => undefined }, create);
});
afterEach(async () => {
  stop?.();
  vi.useRealTimers();
  await act(() => i18n.changeLanguage('en'));
});

const dot = () => screen.getByRole('status');
const open = () =>
  act(() => {
    last().onopen?.(new Event('open'));
  });
const drop = () =>
  act(() => {
    last().onclose?.(new CloseEvent('close'));
  });
const retryTimer = () =>
  act(() => {
    vi.advanceTimersByTime(BACKOFF_MAX_MS);
  });

describe('LiveDot', () => {
  it('shows live while the socket is open, reconnecting after a drop, offline after repeated failures', () => {
    renderDot(<LiveDot fetchFailed={false} />);
    expect(dot()).toHaveTextContent('Reconnecting…');
    expect(dot()).toHaveAttribute('data-live', 'reconnecting');

    open();
    expect(dot()).toHaveTextContent('● Live');
    expect(dot()).toHaveAttribute('data-live', 'live');

    drop();
    expect(dot()).toHaveAttribute('data-live', 'reconnecting');

    for (let n = 0; n < 2; n++) {
      retryTimer();
      drop();
    }
    expect(dot()).toHaveAttribute('data-live', 'offline');
    expect(dot()).toHaveTextContent('Offline');

    retryTimer();
    open();
    expect(dot()).toHaveAttribute('data-live', 'live');
  });

  it('shows offline when the last fetch failed, even with an open socket', () => {
    renderDot(<LiveDot fetchFailed />);
    open();
    expect(dot()).toHaveAttribute('data-live', 'offline');
  });

  it('speaks Indonesian', async () => {
    await act(() => i18n.changeLanguage('id'));
    renderDot(<LiveDot fetchFailed={false} />);
    expect(dot()).toHaveTextContent('Menyambung lagi…');
    open();
    expect(dot()).toHaveTextContent('● Langsung');
  });
});
