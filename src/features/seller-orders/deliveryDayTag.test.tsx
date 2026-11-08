import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { NewOrderDayRow, newOrderDays } from './NewOrderDayRow';
import { OrderDayTag } from '../../components/dayChips/OrderDayTag';
import { registerSellerI18n } from './i18n/register';

// Plan 126: the day tag only for an order on another day, the New order Delivery day row, the sort.

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerSellerI18n();
  await i18n.changeLanguage('en');
});
afterEach(cleanup);

const wrap = (node: React.ReactNode) => render(<AppThemeProvider>{node}</AppThemeProvider>);

describe('OrderDayTag', () => {
  it('shows the day of a delivery order on another day', () => {
    wrap(<OrderDayTag order={{ fulfilment: 'delivery', handoverDate: '2026-11-16' }} lang="en" />);
    expect(screen.getByText('Mon 16 Nov')).toBeVisible();
  });

  it('shows nothing on the event day, or for pickup', () => {
    const { container } = wrap(
      <>
        <OrderDayTag order={{ fulfilment: 'delivery' }} lang="en" />
        <OrderDayTag order={{ fulfilment: 'pickup', handoverDate: '2026-11-16' }} lang="en" />
      </>,
    );
    expect(container.textContent).toBe('');
  });
});

describe('New order day row', () => {
  const delivery = {
    available: true,
    note: { en: '', id: '' },
    days: ['2026-11-14', '2026-11-15', '2026-11-16'],
    defaultDay: '2026-11-14',
  };

  it('only for delivery on a menu with more than the event day', () => {
    expect(newOrderDays('2026-11-15', delivery, true).days).toHaveLength(3);
    expect(newOrderDays('2026-11-15', delivery, false).days).toEqual([]);
    expect(newOrderDays('2026-11-15', { ...delivery, days: undefined }, true).days).toEqual([]);
    expect(newOrderDays('2026-11-15', { ...delivery, available: false }, true).days).toEqual([]);
  });

  it('pre-selects the default and lets the seller pick another', () => {
    const offered = newOrderDays('2026-11-15', delivery, true);
    const onChange = vi.fn();
    wrap(
      <NewOrderDayRow
        days={offered.days}
        value={offered.defaultDay}
        lang="en"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Sat 14 Nov' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Mon 16 Nov' }));
    expect(onChange).toHaveBeenCalledWith('2026-11-16');
  });
});
