import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import { LabelsScreen } from './LabelsScreen';
import { LONG_NOTE, renderThemed, sampleOrders, setupI18n } from './testSupport';

beforeAll(setupI18n);
afterEach(async () => {
  await i18n.changeLanguage('en');
});

function serveOrders(): void {
  server.use(http.get('*/api/seller/orders', () => HttpResponse.json({ orders: sampleOrders() })));
}

async function openLabels(): Promise<void> {
  serveOrders();
  renderThemed(<LabelsScreen />);
  await screen.findByRole('article', { name: 'K7F-2QX' });
}

describe('LabelsScreen', () => {
  it('shows one label per confirmed order with code, name, items, day and a real QR', async () => {
    await openLabels();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    const label = screen.getByRole('article', { name: 'K7F-2QX' });
    expect(within(label).getByText('Rina')).toBeInTheDocument();
    expect(within(label).getByText('2× Lemper ayam / Chicken lemper')).toBeInTheDocument();
    expect(within(label).getByText(/^Pickup · \w{3} \d{1,2} \w{3}$/)).toBeInTheDocument();
    const qr = within(label).getByRole('img', { name: 'Order QR code' });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(qr.querySelector('path')?.getAttribute('d')).toBeTruthy();
    expect(qr).toHaveTextContent('');
    // A different order gets a different code.
    const other = within(screen.getByRole('article', { name: 'R8P-4WB' })).getByRole('img');
    expect(other.querySelector('path')?.getAttribute('d')).not.toBe(
      qr.querySelector('path')?.getAttribute('d'),
    );
  });

  it('cuts the note to 70 characters and never shows chef, address or phone', async () => {
    await openLabels();
    const label = screen.getByRole('article', { name: 'K7F-2QX' });
    const shown = `${LONG_NOTE.slice(0, 69).trimEnd()}…`;
    expect(shown).toHaveLength(70);
    expect(within(label).getByText(shown)).toBeInTheDocument();
    expect(label).not.toHaveTextContent(LONG_NOTE);
    expect(label.textContent).not.toMatch(/chef|address|alamat|phone|\d{8,}/i);
    expect(screen.getByRole('article', { name: 'R8P-4WB' })).toHaveTextContent('Short note');
  });

  it('shows the counts, and the filter changes which labels are shown', async () => {
    await openLabels();
    expect(screen.getByRole('radio', { name: 'Confirmed (2)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'All not cancelled (3)' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByRole('article', { name: 'H9D-7RV' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'M3H-9TD' })).toHaveTextContent('Delivery');
  });

  it('Selected shows checkboxes and prints only the ticked orders', async () => {
    await openLabels();
    fireEvent.click(screen.getByRole('radio', { name: 'Selected (0)' }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /M3H-9TD/ }));
    expect(screen.getByRole('radio', { name: 'Selected (1)' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled();
  });

  it('the paper option switches the print layout', async () => {
    await openLabels();
    const sheets = screen.getByTestId('label-sheets');
    expect(sheets).toHaveAttribute('data-paper', 'a4');
    expect(sheets.children).toHaveLength(1);
    fireEvent.click(screen.getByRole('radio', { name: 'Label printer (62 mm roll)' }));
    expect(sheets).toHaveAttribute('data-paper', 'roll');
    // On a roll every label is its own page.
    expect(sheets.children).toHaveLength(2);
    fireEvent.click(screen.getByRole('radio', { name: 'A4 sheet (2 × 7 labels)' }));
    expect(sheets).toHaveAttribute('data-paper', 'a4');
    expect(sheets.children).toHaveLength(1);
  });

  it('Print opens the browser print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await openLabels();
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('can be retried when the orders do not load', async () => {
    server.use(http.get('*/api/seller/orders', () => HttpResponse.error()));
    renderThemed(<LabelsScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the orders.');
    serveOrders();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    serveOrders();
    renderThemed(<LabelsScreen />);
    await screen.findByRole('article', { name: 'K7F-2QX' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cetak label');
    expect(screen.getByRole('radio', { name: 'Terkonfirmasi (2)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Lembar A4 (2 × 7 label)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cetak' })).toBeInTheDocument();
    const label = screen.getByRole('article', { name: 'K7F-2QX' });
    expect(within(label).getByText(/^Ambil · /)).toBeInTheDocument();
    expect(within(label).getByRole('img', { name: 'Kode QR pesanan' })).toBeInTheDocument();
  });
});
