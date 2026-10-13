import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { MyOrdersView } from './MyOrdersView';
import type { CurrentRow, EarlierRow } from './myOrdersModel';
import { renderWithStore, setupI18n } from './testSupport';

beforeAll(() => setupI18n('en'));

const current = (token: string, slug: string, kitchen: string): CurrentRow => ({
  token,
  code: 'K7F2QX',
  slug,
  kitchen,
  kitchenLogo: undefined,
  summary: '1 × Rice',
  dayText: 'Sat 17 Oct',
  fulfilment: 'pickup',
  place: undefined,
  totalCents: 1500,
  status: 'confirmed',
  locked: false,
  paid: undefined,
  unseen: false,
});
const earlier = (token: string, slug: string, kitchen: string): EarlierRow => ({
  token,
  code: 'ABCDEF',
  slug,
  kitchen,
  kitchenLogo: undefined,
  dayText: 'Sat 10 Oct',
  totalCents: 1000,
  status: 'collected',
});

function view(ownKitchen?: string | null) {
  const noop = () => undefined;
  return renderWithStore(
    <MyOrdersView
      lang="en"
      status="ready"
      current={[current('a', 'ondeonde', 'OndeOnde'), current('b', 'dellavee', 'Dellavee')]}
      earlier={[earlier('c', 'ondeonde', 'OndeOnde'), earlier('d', 'dellavee', 'Dellavee')]}
      stale={false}
      offline={false}
      findToken={() => undefined}
      onFind={() => Promise.resolve('found')}
      hasKitchen
      kitchenName={null}
      onOpenOrder={noop}
      onOpenMenu={noop}
      onRetry={noop}
      {...(ownKitchen !== undefined ? { ownKitchen } : {})}
    />,
  );
}

describe('My orders in a home-screen app (plan 068)', () => {
  it('own kitchen first, the others folded with a count; expanding shows them', () => {
    view('dellavee');
    expect(screen.getAllByText('Dellavee')).toHaveLength(2);
    expect(screen.queryByText('OndeOnde')).toBeNull();
    const fold = screen.getByRole('button', { name: 'Other kitchens (2)' });
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(fold);
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('OndeOnde')).toHaveLength(2);
  });

  it('counts every order as other when the own kitchen has none', () => {
    view('nobody');
    expect(screen.getByRole('button', { name: 'Other kitchens (4)' })).toBeVisible();
  });

  it('in a browser tab all orders show, no fold', () => {
    view(null);
    expect(screen.getAllByText('OndeOnde')).toHaveLength(2);
    expect(screen.getAllByText('Dellavee')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Other kitchens/ })).toBeNull();
  });
});
