import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Me } from '../../shared/authContract';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { MoreSwitchPerson, RailSwitchPerson } from './SwitchPerson';

let me: Me | null = null;
const end = vi.fn(() => Promise.resolve());
vi.mock('./session', () => ({ useSession: () => ({ me, end }) }));

beforeAll(async () => {
  window.matchMedia = () =>
    ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  me = null;
  end.mockClear();
  await i18n.changeLanguage('en');
});

const CHEF: Me = {
  role: 'chef',
  stage: 'full',
  sellerName: 'Onde Onde',
  chefName: 'Rina',
};
const SELLER: Me = { role: 'seller', stage: 'full', sellerName: 'Onde Onde' };

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function renderAt(ui: React.ReactNode) {
  return render(
    <AppThemeProvider>
      <MemoryRouter initialEntries={['/seller']}>
        <Routes>
          <Route path="/seller" element={ui} />
          <Route path="/seller/sign-in" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AppThemeProvider>,
  );
}

describe('Switch person in the rail', () => {
  it('shows the name and a labelled button when expanded, and signs out then goes to sign-in', async () => {
    me = CHEF;
    renderAt(<RailSwitchPerson collapsed={false} />);
    expect(screen.getByText('Rina · chef')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Switch person/ }));
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/seller/sign-in?switch=1'),
    );
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('names the seller as "<name> · seller"', () => {
    me = SELLER;
    renderAt(<RailSwitchPerson collapsed={false} />);
    expect(screen.getByText('Onde Onde · seller')).toBeInTheDocument();
  });

  it('collapsed: only the icon shows, the name and label come on focus', () => {
    me = CHEF;
    renderAt(<RailSwitchPerson collapsed />);
    expect(screen.queryByText('Rina · chef')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Switch person (Rina · chef)' });
    fireEvent.focus(button);
    expect(
      screen.getByText('Rina · chef — Switch person', { selector: 'span[aria-hidden]' }),
    ).toBeInTheDocument();
  });

  it('is hidden when nobody is signed in', () => {
    renderAt(
      <>
        <RailSwitchPerson collapsed={false} />
        <RailSwitchPerson collapsed />
        <MoreSwitchPerson />
      </>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    me = CHEF;
    renderAt(<RailSwitchPerson collapsed={false} />);
    expect(screen.getByRole('button', { name: /Ganti orang/ })).toBeInTheDocument();
  });
});

describe('Switch person on the More tab', () => {
  it('shows "Signed in as", the person and the button', async () => {
    me = CHEF;
    renderAt(<MoreSwitchPerson />);
    expect(screen.getByText('Signed in as')).toBeInTheDocument();
    expect(screen.getByText('Rina · chef')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Switch person/ }));
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/seller/sign-in?switch=1'),
    );
  });
});
