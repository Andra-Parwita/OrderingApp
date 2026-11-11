import { fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import { quantitySet } from './customerSlice';
import { CheckoutFlow, createTestStore, renderWithStore, setupI18n } from './testSupport';

// Plan 129: the last checkout step says WhatsApp comes next, and a successful order opens it.

beforeAll(() => setupI18n('en'));
afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

// The label has a long and a short text (the width picks one); the long one is the label to find.
const placeButton = (label: string) => screen.getByText(label).closest('button') as HTMLElement;

function fakeTab() {
  return { opener: {}, location: { href: '' }, close: vi.fn() };
}

async function toNamePage(name = 'Rina') {
  const store = createTestStore();
  renderWithStore(
    <CheckoutFlow slug="onde-onde" onBack={() => undefined} onPlaced={vi.fn()} />,
    store,
  );
  await waitFor(() => expect(store.getState().customer.menu.status).toBe('ready'));
  store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 2 }));
  fireEvent.click(await screen.findByRole('button', { name: /^(Next: your name|Berikutnya)/ }));
  fireEvent.change(await screen.findByLabelText(/^(First name|Nama depan)/), {
    target: { value: name },
  });
  return store;
}

describe('last checkout step (plan 129)', () => {
  it('shows the amber line and the Place order & send on WhatsApp button', async () => {
    await toNamePage();
    expect(screen.getByTestId('send-next')).toHaveTextContent(
      /^⚠ Next you send your order on WhatsApp\. Without your message, .* can't confirm it\.$/,
    );
    expect(placeButton('Place order & send on WhatsApp')).toBeVisible();
  });

  it('opens WhatsApp once with the order message after the order is placed', async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    await toNamePage();
    fireEvent.click(placeButton('Place order & send on WhatsApp'));
    await waitFor(() => expect(tab.location.href).toContain('https://api.whatsapp.com/send'));
    expect(open).toHaveBeenCalledTimes(1);
    const text = decodeURIComponent(tab.location.href.split('text=')[1] ?? '');
    expect(text).toContain('2× Thin battered tempeh');
    expect(text).toContain('Name: Rina');
    expect(tab.close).not.toHaveBeenCalled();
  });

  it('opens nothing when the order fails, and gives the reserved tab back', async () => {
    server.use(
      http.post('*/api/s/onde-onde/orders', () =>
        HttpResponse.json({ error: 'sold_out', message: 'x' }, { status: 409 }),
      ),
    );
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    await toNamePage();
    fireEvent.click(placeButton('Place order & send on WhatsApp'));
    await waitFor(() => expect(tab.close).toHaveBeenCalledTimes(1));
    expect(tab.location.href).toBe('');
  });

  it('is in Indonesian', async () => {
    await i18n.changeLanguage('id');
    await toNamePage();
    expect(screen.getByTestId('send-next')).toHaveTextContent('Selanjutnya Anda mengirim');
    expect(placeButton('Pesan & kirim lewat WhatsApp')).toBeVisible();
  });
});
