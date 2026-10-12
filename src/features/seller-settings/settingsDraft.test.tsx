import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import { server } from '../../../mocks/server';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { draftKey } from '../../components/draft';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import type { PaneId } from './panes';
import { SettingsPanes } from './SettingsPanes';
import { createTestStore, setupI18n } from './testSupport';

// Plan 061 stages 5 and 6: kitchen, post, ordering rules and a pickup place keep what was typed.

beforeAll(setupI18n);

const settings = {
  languages: 'both',
  postGreeting: { en: 'Hi', id: 'Halo' },
  postClosing: { en: 'Bye', id: 'Dah' },
  orderingOpen: true,
};
const preferences = {
  theme: 'onde',
  menuDefaults: {
    cutoffDaysBefore: 1,
    cutoffTime: '21:00',
    delivery: { available: false, note: { en: '', id: '' } },
  },
};
const key = (form: string, id?: string) => draftKey(currentSellerSlug(), form, id);

function pane(id: PaneId) {
  return (
    <Provider store={createTestStore()}>
      <AppThemeProvider>
        <MemoryRouter>
          <SettingsPanes
            pane={id}
            devices={<p>Devices</p>}
            images={<p>Images</p>}
            chefs={<p>Chefs</p>}
            backup={<p>Backup</p>}
          />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>
  );
}
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('settings drafts', () => {
  it('kitchen: restores the number after a reload; Save clears it', async () => {
    server.use(
      http.get('*/api/seller/settings', () => HttpResponse.json({ sellerId: 's', settings })),
      http.put('*/api/seller/settings', async ({ request }) =>
        HttpResponse.json({ sellerId: 's', settings: await request.json() }),
      ),
    );
    const first = render(pane('kitchen'));
    const phone = await screen.findByLabelText('WhatsApp number');
    fireEvent.change(phone, { target: { value: '0412 345 678' } });
    first.unmount();
    expect(localStorage.getItem(key('kitchen'))).not.toBeNull();
    render(pane('kitchen'));
    expect((await screen.findByLabelText<HTMLInputElement>('WhatsApp number')).value).toBe(
      '0412 345 678',
    );
    expect(screen.getByText('Restored what you typed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(localStorage.getItem(key('kitchen'))).toBeNull());
    await waitFor(() => expect(screen.queryByText('Restored what you typed')).toBeNull());
  });

  it('kitchen: after Save the field shows the server value and no draft is left, even when saved within the debounce', async () => {
    server.use(
      http.get('*/api/seller/settings', () => HttpResponse.json({ sellerId: 's', settings })),
      http.put('*/api/seller/settings', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          sellerId: 's',
          settings: { ...body, whatsappNumber: '61412345678' },
        });
      }),
    );
    render(pane('kitchen'));
    const phone = await screen.findByLabelText('WhatsApp number');
    fireEvent.change(phone, { target: { value: '0412 345 678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>('WhatsApp number').value).toBe(
        '+61 412 345 678',
      ),
    );
    expect(localStorage.getItem(key('kitchen'))).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(localStorage.getItem(key('kitchen'))).toBeNull();
  });

  it('post: restores the greeting; Discard goes back to the saved text', async () => {
    server.use(
      http.get('*/api/seller/settings', () => HttpResponse.json({ sellerId: 's', settings })),
    );
    const first = render(pane('post'));
    await screen.findByLabelText('Greeting (English)');
    change('Greeting (English)', 'Hello there');
    first.unmount();
    render(pane('post'));
    expect((await screen.findByLabelText<HTMLInputElement>('Greeting (English)')).value).toBe(
      'Hello there',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByLabelText<HTMLInputElement>('Greeting (English)').value).toBe('Hi');
    expect(localStorage.getItem(key('post'))).toBeNull();
  });

  it('ordering rules: restores and clears on Save', async () => {
    server.use(
      http.get('*/api/seller/preferences', () => HttpResponse.json({ preferences })),
      http.put('*/api/seller/preferences', () => HttpResponse.json({ preferences })),
    );
    const first = render(pane('defaults'));
    await screen.findByLabelText('Days before the cooking day');
    change('Days before the cooking day', '3');
    first.unmount();
    render(pane('defaults'));
    expect(
      (await screen.findByLabelText<HTMLInputElement>('Days before the cooking day')).value,
    ).toBe('3');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(localStorage.getItem(key('defaults'))).toBeNull());
  });

  it('pickup place: restores a half-typed new place; Cancel forgets it', async () => {
    server.use(http.get('*/api/seller/pickup-places', () => HttpResponse.json({ places: [] })));
    const first = render(pane('pickup'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add a place' }));
    change('Place', 'Clayton');
    first.unmount();
    expect(localStorage.getItem(key('pickup', 'new'))).not.toBeNull();
    render(pane('pickup'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add a place' }));
    expect(screen.getByLabelText<HTMLInputElement>('Place').value).toBe('Clayton');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(localStorage.getItem(key('pickup', 'new'))).toBeNull();
  });
});
