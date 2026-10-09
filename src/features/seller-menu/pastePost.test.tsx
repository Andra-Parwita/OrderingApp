import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { PastePostScreen } from './PastePostScreen';
import { emptyMenu, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
beforeEach(async () => {
  await mockStore.reset();
  await mockStore.setWeek({ status: 'draft' });
});

// The brief's post (briefs/food-ordering-concept-brief.md): six items, a greeting and a closing.
const POST = `Halo semuanya! Menu hari Sabtu 10 Oktober:

1. Nasi campur daun jeruk (lauk: ayam goreng tepung tumis cabe garam, tempe mendoan, tumis kubis) – $15
2. Pesmol ikan nila – $15
3. Lemper ayam, 4 biji – $10
4. Empek-empek kapal selam – $10
5) Ayam goreng tepung tumis cabe garam, 250 gr - $12.50
6. Tempe mendoan, 4 biji – $10

Kirim nomor pesanan ya. Terima kasih!`;

function renderPaste() {
  const onBack = vi.fn();
  const onDone = vi.fn();
  renderWithStore(<PastePostScreen onBack={onBack} onDone={onDone} />);
  return { onBack, onDone };
}
async function read(text: string) {
  fireEvent.change(await screen.findByLabelText('Paste your WhatsApp post'), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Read items' }));
}

describe('PastePostScreen', () => {
  it('cannot read an empty box', async () => {
    renderPaste();
    expect(await screen.findByRole('button', { name: 'Read items' })).toBeDisabled();
  });

  it('shows the items it read and the lines it did not', async () => {
    await emptyMenu();
    renderPaste();
    await read(POST);
    expect(screen.getByText('Found 6 items')).toBeInTheDocument();
    expect(screen.getByText('3. Lemper ayam')).toBeInTheDocument();
    expect(screen.getAllByText('4 biji · $10.00')).toHaveLength(2);
    expect(
      within(screen.getByRole('region', { name: 'Items found' })).getByText(
        /lauk: ayam goreng tepung/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("These lines weren't read:")).toBeInTheDocument();
    expect(screen.getByText('Halo semuanya! Menu hari Sabtu 10 Oktober:')).toBeInTheDocument();
    expect(screen.getByText('Kirim nomor pesanan ya. Terima kasih!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use these 6 items' })).toBeEnabled();
  });

  it('says so when nothing could be read', async () => {
    renderPaste();
    await read('Halo! Menu minggu ini belum siap.');
    expect(
      await screen.findByText('No items found. Each line needs a number, a name and a price.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Use/ })).not.toBeInTheDocument();
  });

  it('adds the items as new menu items in Indonesian and reports the count', async () => {
    await emptyMenu();
    const { onDone } = renderPaste();
    await read(POST);
    fireEvent.click(screen.getByRole('button', { name: 'Use these 6 items' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(6));
    const items = (await mockStore.getSellerMenu()).items;
    expect(items).toHaveLength(6);
    expect(items[2]).toMatchObject({
      name: { en: '', id: 'Lemper ayam' },
      size: { en: '', id: '4 biji' },
      priceCents: 1000,
    });
    expect(items[4]).toMatchObject({ priceCents: 1250, size: { id: '250 gr' } });
  });

  it('respects the 10-item limit and says how many fit', async () => {
    // The sample menu has 6 items, so 4 of the 6 pasted ones fit.
    const { onDone } = renderPaste();
    await read(POST);
    expect(
      await screen.findByText(
        'Only 4 of 6 items fit, because the menu holds 10. The first 4 will be added.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use these 4 items' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(4));
    expect((await mockStore.getSellerMenu()).items).toHaveLength(10);
  });

  it('adds nothing when the menu is already full', async () => {
    while ((await mockStore.getSellerMenu()).items.length < 10) {
      await mockStore.addItem({ name: { en: 'x', id: '' }, priceCents: 100 });
    }
    renderPaste();
    await read(POST);
    expect(
      await screen.findByText('The menu already has 10 items. Remove one to add more.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use these 0 items' })).toBeDisabled();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    await emptyMenu();
    renderPaste();
    fireEvent.change(await screen.findByLabelText('Tempel postingan WhatsApp kamu'), {
      target: { value: POST },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Baca item' }));
    expect(screen.getByText('Ditemukan 6 item')).toBeInTheDocument();
    expect(screen.getByText('Baris ini tidak terbaca:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pakai 6 item ini' })).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});
