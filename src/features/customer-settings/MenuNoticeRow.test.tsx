import { fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { registerInstallI18n, type Environment } from '../../components/install';
import { registerRememberMeI18n } from '../../components/remember-me';
import en from '../../i18n/en.json';
import id from '../../i18n/id.json';
import { lightTheme } from '../../theme/themes';
import { CustomerSettingsView } from './CustomerSettingsView';
import type { MenuNoticeControl } from './MenuNoticeRow';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, id: { translation: id } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  registerInstallI18n();
  registerRememberMeI18n();
});

const env: Environment = {
  platform: 'android',
  inApp: false,
  inAppName: null,
  safari: false,
  installed: false,
  pushSupported: true,
  permission: 'default',
};

const control = (over: Partial<MenuNoticeControl> = {}): MenuNoticeControl => ({
  kitchenName: 'DellaVee',
  on: false,
  busy: false,
  problem: null,
  onTurnOn: vi.fn(),
  onTurnOff: vi.fn(),
  ...over,
});

function show(menuNotice: MenuNoticeControl | undefined, pushSupported = true) {
  render(
    <ThemeProvider theme={lightTheme}>
      <CustomerSettingsView
        lang="en"
        onLang={vi.fn()}
        theme="auto"
        onTheme={vi.fn()}
        install={{ env: { ...env, pushSupported } }}
        menuNotice={menuNotice}
      />
    </ThemeProvider>,
  );
}

const SWITCH = { name: 'New menus from DellaVee' };

describe('Settings, New menus from a kitchen', () => {
  it('is a switch that is off by default, saying Off', () => {
    show(control());
    expect(screen.getByRole('switch', SWITCH)).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', SWITCH).parentElement).toHaveTextContent(
      'New menus from DellaVeeOff',
    );
  });

  it('is not shown when no kitchen is known', () => {
    show(undefined);
    expect(screen.queryByRole('switch', SWITCH)).not.toBeInTheDocument();
  });

  it('is hidden when the browser cannot do push', () => {
    show(control(), false);
    expect(screen.queryByRole('switch', SWITCH)).not.toBeInTheDocument();
  });

  it('explains first: the sheet has the three points and turning on happens only after "Turn on"', () => {
    const onTurnOn = vi.fn();
    show(control({ onTurnOn }));
    fireEvent.click(screen.getByRole('switch', SWITCH));
    const sheet = screen.getByRole('dialog', { name: 'Hear about new DellaVee menus?' });
    expect(
      within(sheet).getByText(
        'You get a notice when DellaVee publishes a new menu, usually once a week.',
      ),
    ).toBeVisible();
    expect(
      within(sheet).getByText('DellaVee only sees how many phones get it, not who you are.'),
    ).toBeVisible();
    expect(within(sheet).getByText('Turn it off here any time.')).toBeVisible();
    expect(onTurnOn).not.toHaveBeenCalled();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Turn on' }));
    expect(onTurnOn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Not now" closes the sheet and turns nothing on', () => {
    const onTurnOn = vi.fn();
    show(control({ onTurnOn }));
    fireEvent.click(screen.getByRole('switch', SWITCH));
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onTurnOn).not.toHaveBeenCalled();
  });

  it('turns off at once, with no sheet', () => {
    const onTurnOff = vi.fn();
    show(control({ on: true, onTurnOff }));
    const toggle = screen.getByRole('switch', SWITCH);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(onTurnOff).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says when the browser blocked notifications', () => {
    show(control({ problem: 'blocked' }));
    expect(screen.getByText('Blocked in your browser settings')).toBeVisible();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    show(control());
    fireEvent.click(screen.getByRole('switch', { name: 'Menu baru dari DellaVee' }));
    expect(
      screen.getByRole('dialog', { name: 'Mau tahu saat ada menu baru dari DellaVee?' }),
    ).toBeVisible();
    await i18n.changeLanguage('en');
  });
});
