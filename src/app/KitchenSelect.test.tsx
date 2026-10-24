import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Me, Membership } from '../../shared/authContract';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { KitchenSelect } from './KitchenSelect';

const me: Me = {
  role: 'seller',
  stage: 'full',
  sellerId: 's1',
  slug: 'onde-onde',
  sellerName: 'Onde',
};
const adopt = vi.fn();
let memberships: Array<Membership> = [];
const switchKitchen = vi.fn((id: string) =>
  Promise.resolve({ ok: true, data: { me: { ...me, sellerId: id } } }),
);
vi.mock('./session', () => ({
  useSession: () => ({ me, adopt }),
}));
vi.mock('../api/auth', () => ({
  fetchMemberships: () => Promise.resolve({ ok: true, data: { memberships } }),
  switchKitchen: (id: string) => switchKitchen(id),
}));

beforeAll(async () => {
  window.matchMedia = () =>
    ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
});
afterEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
});

const two: Array<Membership> = [
  { sellerId: 's1', slug: 'onde-onde', sellerName: 'Onde', role: 'owner' },
  { sellerId: 's2', slug: 'demo', sellerName: 'Demo', role: 'chef', chefId: 'c1' },
  { sellerId: 's3', slug: 'stall', sellerName: 'Stall', role: 'helper' },
];
const renderIt = (onSwitched = vi.fn()) =>
  render(
    <AppThemeProvider>
      <KitchenSelect onSwitched={onSwitched} />
    </AppThemeProvider>,
  );

describe('KitchenSelect', () => {
  it('is hidden with one kitchen', async () => {
    memberships = [two[0]!];
    renderIt();
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  });

  it('lists every kitchen with its role and switches', async () => {
    memberships = two;
    const onSwitched = vi.fn();
    renderIt(onSwitched);
    const select = await screen.findByRole('combobox', { name: 'Kitchen' });
    expect(screen.getByRole('option', { name: 'Onde · Owner' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Demo · Chef' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Stall · Helper' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 's2' } });
    await waitFor(() => expect(onSwitched).toHaveBeenCalled());
    expect(switchKitchen).toHaveBeenCalledWith('s2');
    expect(adopt).toHaveBeenCalled();
  });
});
