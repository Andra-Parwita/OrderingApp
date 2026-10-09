import { act, screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKOFF_MAX_MS, subscribeLive, type SocketLike } from '../../api/live';
import { LiveDot } from './LiveDot';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);

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
    renderWithStore(<LiveDot fetchFailed={false} />, createTestStore({ saga: false }));
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
    renderWithStore(<LiveDot fetchFailed />, createTestStore({ saga: false }));
    open();
    expect(dot()).toHaveAttribute('data-live', 'offline');
  });

  it('speaks Indonesian', async () => {
    await act(() => i18n.changeLanguage('id'));
    renderWithStore(<LiveDot fetchFailed={false} />, createTestStore({ saga: false }));
    expect(dot()).toHaveTextContent('Menyambung lagi…');
    open();
    expect(dot()).toHaveTextContent('● Langsung');
  });
});
