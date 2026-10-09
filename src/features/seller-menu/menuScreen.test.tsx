import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { MenuScreen } from './MenuScreen';
import { emptyMenu, fillMenu, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
beforeEach(() => {
  mockStore.reset();
  mockStore.setWeek({ status: 'draft' });
});

function renderMenu(desktop: boolean) {
  const handlers = {
    onPreview: vi.fn(),
    onEditItem: vi.fn(),
    onSavedSets: vi.fn(),
    onPastePost: vi.fn(),
  };
  renderWithStore(<MenuScreen desktop={desktop} {...handlers} />);
  return handlers;
}

describe('MenuScreen layout', () => {
  it('shows the title, the Draft pill and the items as a table on a desktop', async () => {
    renderMenu(true);
    expect(await screen.findByRole('heading', { name: 'Menu · Sat 10 Oct' })).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Menu items' });
    for (const header of ['#', 'Name (ID / EN)', 'Size', 'Price', 'Limit', 'Chef', 'Sold out']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    const lemper = within(table).getByRole('row', { name: /Lemper ayam/ });
    expect(lemper).toHaveTextContent('Chicken lemper');
    expect(lemper).toHaveTextContent('Chef Wati');
    expect(lemper).toHaveTextContent('20');
    expect(screen.queryByRole('list', { name: 'Menu items' })).not.toBeInTheDocument();
  }, 20000);

  it('shows a compact list on a phone, and no table', async () => {
    renderMenu(false);
    const list = await screen.findByRole('list', { name: 'Menu items' });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(within(list).getByRole('button', { name: /Edit Chicken lemper/ })).toHaveTextContent(
      'limit 20 · Chef Wati',
    );
  });

  it('opens the editor from a row, a new item, sets and paste, and the preview', async () => {
    const handlers = renderMenu(true);
    fireEvent.click(await screen.findByRole('row', { name: /Pesmol ikan nila/ }));
    expect(handlers.onEditItem).toHaveBeenCalledWith('pesmol');
    fireEvent.click(screen.getByRole('button', { name: '+ Add item' }));
    expect(handlers.onEditItem).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'Saved sets' }));
    fireEvent.click(screen.getByRole('button', { name: 'Paste a WhatsApp post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview as customer' }));
    expect(handlers.onSavedSets).toHaveBeenCalled();
    expect(handlers.onPastePost).toHaveBeenCalled();
    expect(handlers.onPreview).toHaveBeenCalled();
  });

  it('turns Add item off at 10 items and says why', async () => {
    fillMenu();
    renderMenu(false);
    expect(await screen.findByRole('button', { name: '+ Add item' })).toBeDisabled();
    expect(screen.getByText('Max 10 items')).toBeInTheDocument();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderMenu(true);
    expect(await screen.findByRole('heading', { name: 'Menu · Sab 10 Okt' })).toBeInTheDocument();
    expect(screen.getByText('Draf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terbitkan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lihat seperti pelanggan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paket tersimpan' })).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });

  it('shows a retry when the menu cannot load', async () => {
    server.use(http.get('*/api/seller/menu', () => HttpResponse.error()));
    renderMenu(false);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the menu.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('publishing', () => {
  it('publishes a draft, then offers Unpublish', async () => {
    renderMenu(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(mockStore.getWeek().status).toBe('published');
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    expect(await screen.findByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(mockStore.getWeek().status).toBe('draft');
  });

  it('disables Publish with a reason when there are no items', async () => {
    emptyMenu();
    renderMenu(false);
    const publish = await screen.findByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription('Add an item before you publish.');
  });

  it('shows the no_items refusal inline', async () => {
    server.use(
      http.post('*/api/seller/week/publish', () =>
        HttpResponse.json({ error: 'no_items', message: 'x' }, { status: 409 }),
      ),
    );
    renderMenu(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add at least one item before publishing.',
    );
  });
});

describe('reordering', () => {
  it('moves an item down and calls the reorder endpoint with every id', async () => {
    const bodies: Array<unknown> = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PUT' && request.url.endsWith('/api/seller/menu/order')) {
        bodies.push(await request.clone().json());
      }
    });
    renderMenu(true);
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Move Chicken lemper up' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move Lime-leaf mixed rice down' }));
    await waitFor(() =>
      expect(
        mockStore
          .getSellerMenu()
          .items.map((item) => item.id)
          .slice(0, 2),
      ).toEqual(['pesmol', 'nasi-campur']),
    );
    expect(JSON.stringify(bodies[0])).toContain('"pesmol","nasi-campur"');
    expect(screen.getByRole('button', { name: 'Move Lime-leaf mixed rice up' })).toBeEnabled();
  });

  it('cannot move the first item up or the last item down', async () => {
    renderMenu(false);
    expect(
      await screen.findByRole('button', { name: 'Move Lime-leaf mixed rice up' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Thin battered tempeh down' })).toBeDisabled();
  });

  it('does not open the editor when a move button is used', async () => {
    const handlers = renderMenu(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Move Tilapia pesmol up' }));
    await waitFor(() => expect(mockStore.getSellerMenu().items[0]?.id).toBe('pesmol'));
    expect(handlers.onEditItem).not.toHaveBeenCalled();
  });
});
