import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { ItemEditor } from './ItemEditor';
import { fillMenu, orderThenDraft, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
beforeEach(() => {
  mockStore.reset();
  mockStore.setWeek({ status: 'draft' });
});

function renderEditor(itemId: string | null, desktop = false) {
  const onClose = vi.fn();
  renderWithStore(<ItemEditor itemId={itemId} desktop={desktop} onClose={onClose} />);
  return onClose;
}
const field = (name: string) => screen.getByLabelText(name);
const item = (id: string) =>
  mockStore.getSellerMenu().items.find((candidate) => candidate.id === id);

describe('ItemEditor', () => {
  it('fills the form from the item, with the helpers', async () => {
    renderEditor('lemper');
    expect(await screen.findByLabelText('Name (English)')).toHaveValue('Chicken lemper');
    expect(field('Name (Indonesian)')).toHaveValue('Lemper ayam');
    expect(field('Price (AUD)')).toHaveValue('10.00');
    expect(field('Portion limit (optional)')).toHaveValue('20');
    expect(field('Chef')).toHaveDisplayValue('Chef Wati');
    expect(screen.getByText('Only you and your chefs see this')).toBeInTheDocument();
    expect(screen.getAllByText('If one is empty, the other is shown').length).toBeGreaterThan(0);
    expect(screen.getByRole('switch', { name: 'Sold out' })).not.toBeChecked();
  });

  it('lists None with the kitchen name as the first chef option', async () => {
    renderEditor('lemper');
    await screen.findByLabelText('Chef');
    const options = within(field('Chef')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['None — Onde Onde', 'Chef Wati']);
  });

  it('opens as a slide-over dialog on a desktop', async () => {
    renderEditor('lemper', true);
    expect(await screen.findByRole('dialog', { name: 'Edit item' })).toBeInTheDocument();
  });

  it('refuses a missing name and a bad price inline, and sends nothing', async () => {
    let writes = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method !== 'GET') writes += 1;
    });
    renderEditor(null);
    await screen.findByLabelText('Name (English)');
    fireEvent.change(field('Price (AUD)'), { target: { value: 'ten' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(await screen.findByText('Add a name in at least one language.')).toBeInTheDocument();
    expect(screen.getByText('Enter a price like 10, 10.00 or 10,50.')).toBeInTheDocument();
    expect(field('Price (AUD)')).toHaveAttribute('aria-invalid', 'true');
    expect(writes).toBe(0);
  });

  it('adds an item, with 10,50 stored as 1050 cents, and closes', async () => {
    const onClose = renderEditor(null);
    await screen.findByLabelText('Name (English)');
    fireEvent.change(field('Name (Indonesian)'), { target: { value: 'Sate ayam' } });
    fireEvent.change(field('Price (AUD)'), { target: { value: '10,50' } });
    fireEvent.change(field('Portion limit (optional)'), { target: { value: '8' } });
    fireEvent.change(field('Chef'), { target: { value: 'wati' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const added = mockStore.getSellerMenu().items.at(-1);
    expect(added).toMatchObject({
      name: { en: '', id: 'Sate ayam' },
      priceCents: 1050,
      limit: 8,
      chefId: 'wati',
    });
  });

  it('edits the price, removes the limit and the chef, and turns Sold out on', async () => {
    const onClose = renderEditor('lemper');
    await screen.findByLabelText('Name (English)');
    fireEvent.change(field('Price (AUD)'), { target: { value: '11' } });
    fireEvent.change(field('Portion limit (optional)'), { target: { value: '' } });
    fireEvent.change(field('Chef'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Sold out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = item('lemper');
    expect(saved?.priceCents).toBe(1100);
    expect(saved?.limit).toBeUndefined();
    expect(saved?.chefId).toBeUndefined();
    expect(saved?.manualSoldOut).toBe(true);
  });

  it('shows a general message when saving fails', async () => {
    server.use(http.patch('*/api/seller/menu/items/*', () => HttpResponse.error()));
    const onClose = renderEditor('lemper');
    await screen.findByLabelText('Name (English)');
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('hides Delete for a new item, and stops adding at 10 items', async () => {
    fillMenu();
    renderEditor(null);
    expect(await screen.findByRole('button', { name: 'Add item' })).toBeDisabled();
    expect(screen.getByText('The menu already has 10 items.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete item' })).not.toBeInTheDocument();
  });

  it('deletes with a second tap', async () => {
    const onClose = renderEditor('pesmol');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete item' }));
    expect(item('pesmol')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to delete' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(item('pesmol')).toBeUndefined();
  });

  it('explains an item with orders and marks it sold out in one tap', async () => {
    mockStore.setWeek({ status: 'published' });
    orderThenDraft('pesmol');
    const onClose = renderEditor('pesmol');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This item has orders, so it can't be deleted. Mark it sold out instead.",
    );
    expect(item('pesmol')).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mark sold out' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(item('pesmol')).toMatchObject({ soldOut: true, manualSoldOut: true });
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderEditor('lemper');
    expect(await screen.findByLabelText('Nama (Indonesia)')).toHaveValue('Lemper ayam');
    expect(screen.getByRole('button', { name: 'Simpan item' })).toBeInTheDocument();
    expect(screen.getByText('Hanya kamu dan kokimu yang melihat ini')).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});
