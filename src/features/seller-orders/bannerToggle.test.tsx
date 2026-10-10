// Plan 014, stage 1: the Orders home banner toggle collapses, restores and is remembered.
import { fireEvent, screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useBannerCollapsed } from '../../components/useBannerCollapsed';
import { BannerToggle } from './BannerToggle';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
});

function Probe() {
  return <output>{useBannerCollapsed() ? 'collapsed' : 'full'}</output>;
}

const mount = () =>
  renderWithStore(
    <>
      <BannerToggle />
      <Probe />
    </>,
    createTestStore({ saga: false }),
  );

describe('banner toggle', () => {
  it('collapses and restores, with a name and aria-expanded', () => {
    mount();
    const button = screen.getByRole('button', { name: 'Show more orders' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(button);
    expect(screen.getByText('collapsed')).toBeInTheDocument();
    const back = screen.getByRole('button', { name: 'Show the banner' });
    expect(back).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(back);
    expect(screen.getByText('full')).toBeInTheDocument();
  });

  it('is remembered after a remount', () => {
    const first = mount();
    fireEvent.click(screen.getByRole('button'));
    first.unmount();
    mount();
    expect(screen.getByText('collapsed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    mount();
    expect(
      screen.getByRole('button', { name: 'Tampilkan lebih banyak pesanan' }),
    ).toBeInTheDocument();
  });
});
