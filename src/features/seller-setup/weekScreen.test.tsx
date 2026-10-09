import { fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { WeekSettingsScreen } from './WeekSettingsScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
afterEach(() => i18n.changeLanguage('en'));

describe('WeekSettingsScreen', () => {
  beforeEach(() => mockStore.reset());

  async function renderWeek() {
    renderWithStore(<WeekSettingsScreen settingsHref="/seller/settings" />, createTestStore());
    await screen.findByLabelText('Pickup place');
  }

  it('shows the saved week, the closing line and the link to Settings', async () => {
    await renderWeek();
    expect(screen.getByLabelText('Cooking date')).toHaveValue('2026-10-10');
    expect(screen.getByLabelText('Order cut-off date')).toHaveValue('2026-10-09');
    expect(screen.getByLabelText('Order cut-off time')).toHaveValue('21:00');
    expect(screen.getByLabelText('Pickup place')).toHaveValue('Glen Waverley');
    expect(
      screen.getByText('Ordering closes automatically at Fri 9 Oct, 9 pm'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open or close ordering in Settings' }),
    ).toHaveAttribute('href', '/seller/settings');
  });

  it('saves changed pickup directions, cut-off and delivery', async () => {
    await renderWeek();
    fireEvent.change(screen.getByLabelText('Directions (English)'), {
      target: { value: 'Ring the bell at the side gate' },
    });
    fireEvent.change(screen.getByLabelText('Order cut-off time'), { target: { value: '18:30' } });
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    await waitFor(() => {
      const week = mockStore.getWeek();
      expect(week.pickupPoints[0]?.directions.en).toBe('Ring the bell at the side gate');
      expect(week.cutoffAt).toBe('2026-10-09T18:30:00+11:00');
      expect(week.delivery.available).toBe(false);
    });
    expect(
      screen.getByText('Ordering closes automatically at Fri 9 Oct, 6:30 pm'),
    ).toBeInTheDocument();
  });

  it('refuses a missing place and a pickup that ends before it starts, and sends nothing', async () => {
    await renderWeek();
    fireEvent.change(screen.getByLabelText('Pickup place'), { target: { value: ' ' } });
    fireEvent.change(screen.getByLabelText('Pickup until'), { target: { value: '13:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Write the pickup place.')).toBeInTheDocument();
    expect(screen.getByText('Pickup must end after it starts.')).toBeInTheDocument();
    expect(mockStore.getWeek().pickupPoints[0]?.place).toBe('Glen Waverley');
  });

  it('refuses a cut-off after the cooking day', async () => {
    await renderWeek();
    fireEvent.change(screen.getByLabelText('Order cut-off date'), {
      target: { value: '2026-10-12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Ordering must close on or before the cooking day.'),
    ).toBeInTheDocument();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderWithStore(<WeekSettingsScreen />, createTestStore());
    expect(await screen.findByText('Pengaturan minggu ini')).toBeInTheDocument();
    expect(screen.getByLabelText('Tempat ambil')).toHaveValue('Glen Waverley');
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
    expect(screen.getByText(/^Pemesanan tutup otomatis pada /)).toBeInTheDocument();
  });
});
