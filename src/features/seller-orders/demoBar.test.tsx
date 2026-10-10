// Plan 013, stage 4: the demo kitchen's sample buttons on the Orders home.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setSessionDemo } from '../../api/device/sellerContext';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { demoSamplesClearRequested } from './demoActions';
import { DevTools } from './ordersShared';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

const demoOn = (on: boolean) => setSessionDemo(on);

beforeAll(setupI18n);
beforeEach(() => mockStore.reset());
afterEach(() => {
  demoOn(false);
  server.events.removeAllListeners();
});

describe('demo kitchen buttons', () => {
  it('show Add and Clear (no Reset) only when the kitchen is a demo one', () => {
    demoOn(true);
    renderWithStore(<DevTools />, createTestStore({ saga: false }));
    expect(screen.getByRole('button', { name: 'Add 50 sample orders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear samples' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('are not shown to a real kitchen', () => {
    demoOn(false);
    renderWithStore(<DevTools />, createTestStore({ saga: false }));
    expect(screen.queryByRole('button', { name: 'Clear samples' })).toBeNull();
  });

  it('speak Indonesian', async () => {
    await i18n.changeLanguage('id');
    demoOn(true);
    renderWithStore(<DevTools />, createTestStore({ saga: false }));
    expect(screen.getByRole('button', { name: 'Hapus pesanan contoh' })).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });

  it('a double tap on Add sends one request and the button is off while it runs', async () => {
    demoOn(true);
    let posts = 0;
    server.use(
      http.post('*/api/seller/demo/samples', async () => {
        posts += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ added: 50 });
      }),
    );
    const store = createTestStore({ saga: true, pollMs: 1000 });
    renderWithStore(<DevTools />, store);
    const add = screen.getByRole('button', { name: 'Add 50 sample orders' });
    fireEvent.click(add);
    fireEvent.click(add);
    await waitFor(() => expect(add).toBeDisabled());
    await waitFor(() => expect(store.getState().sellerOrders.toast?.kind).toBe('sampleAdded'));
    expect(posts).toBe(1);
    await waitFor(() => expect(add).toBeEnabled());
  });

  it('Clear asks twice, then sends one DELETE and shows the count', async () => {
    demoOn(true);
    let deletes = 0;
    server.use(
      http.delete('*/api/seller/demo/samples', () => {
        deletes += 1;
        return HttpResponse.json({ removed: 7 });
      }),
    );
    const store = createTestStore({ saga: true, pollMs: 1000 });
    renderWithStore(<DevTools />, store);
    fireEvent.click(screen.getByRole('button', { name: 'Clear samples' }));
    expect(deletes).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to clear' }));
    await waitFor(() =>
      expect(store.getState().sellerOrders.toast).toMatchObject({
        kind: 'samplesCleared',
        name: '7',
      }),
    );
    expect(deletes).toBe(1);
  });

  it('a refused request shows the error toast', async () => {
    server.use(
      http.delete('*/api/seller/demo/samples', () => HttpResponse.json({}, { status: 403 })),
    );
    const store = createTestStore({ saga: true, pollMs: 1000 });
    store.dispatch(demoSamplesClearRequested());
    await waitFor(() => expect(store.getState().sellerOrders.toast?.kind).toBe('clearFailed'));
  });
});
