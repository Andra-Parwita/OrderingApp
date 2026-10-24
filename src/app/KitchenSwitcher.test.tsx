import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Me, Membership } from '../../shared/authContract';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { KitchenSwitcher } from './KitchenSwitcher';

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
const fetchMemberships = vi.fn(() => Promise.resolve({ ok: true, data: { memberships } }));
vi.mock('../api/auth', () => ({
  fetchMemberships: () => fetchMemberships(),
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
      <KitchenSwitcher name="Onde" onSwitched={onSwitched} />
    </AppThemeProvider>,
  );

describe('KitchenSwitcher', () => {
  it('is plain text with one kitchen', async () => {
    memberships = [two[0]!];
    renderIt();
    expect(screen.getByText('Onde')).toBeInTheDocument();
    await waitFor(() => expect(fetchMemberships).toHaveBeenCalled());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens a menu of kitchens with the active one checked, and switches', async () => {
    memberships = two;
    const onSwitched = vi.fn();
    renderIt(onSwitched);
    const button = await screen.findByRole('button', { name: 'Kitchen: Onde' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Onde · Owner' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Stall · Helper' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Demo · Chef' }));
    await waitFor(() => expect(onSwitched).toHaveBeenCalled());
    expect(switchKitchen).toHaveBeenCalledWith('s2');
    expect(adopt).toHaveBeenCalled();
  });

  it('closes on Escape and keeps the kitchen when the active one is picked', async () => {
    memberships = two;
    const onSwitched = vi.fn();
    renderIt(onSwitched);
    const button = await screen.findByRole('button', { name: 'Kitchen: Onde' });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Onde · Owner' }));
    expect(switchKitchen).not.toHaveBeenCalled();
    expect(onSwitched).not.toHaveBeenCalled();
  });
});
