import { fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { beforeAll, describe, expect, it } from 'vitest';
import { lightTheme } from '../../theme/themes';
import type { Environment } from './detect';
import { InstallOverlay } from './InstallScreens';
import { registerInstallI18n } from './i18n/register';
import { NotifyCard, NotifyLine, UpdatesCard } from './NotifyParts';
import { useOrderInstall, type InstallOverride } from './useInstallFlow';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {},
    interpolation: { escapeValue: false },
  });
  registerInstallI18n();
});

const iphone: Environment = {
  platform: 'ios',
  inApp: false,
  inAppName: null,
  safari: true,
  installed: false,
  pushSupported: false,
  permission: 'default',
};

function Everything({ install }: Readonly<{ install: InstallOverride }>) {
  const controller = useOrderInstall('tok', install);
  return (
    <>
      <NotifyCard controller={controller} code="K7F-2QX" />
      <NotifyLine controller={controller} />
      <UpdatesCard controller={controller} />
      <InstallOverlay controller={controller} kitchenName="Onde Onde" code="K7F-2QX" />
    </>
  );
}

function show(install: InstallOverride) {
  render(
    <ThemeProvider theme={lightTheme}>
      <Everything install={install} />
    </ThemeProvider>,
  );
}

describe('notification entry points', () => {
  it('iPhone in Safari: a quiet line and the card both open the guide, and Skip is always there', () => {
    show({ env: iphone });
    expect(screen.getByText('Notifications are off')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on updates' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeVisible();
    // The card behind the guide has the same heading, so look inside the dialog.
    expect(
      within(dialog).getByRole('heading', { name: 'Get a message when your order is ready' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Show me how' }));
    expect(screen.getByText('Step 1 of 4')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('iPhone inside WhatsApp: Copy link, with Skip', () => {
    show({ env: { ...iphone, inApp: true, inAppName: 'WhatsApp', safari: false } });
    fireEvent.click(screen.getByRole('button', { name: 'Turn on updates' }));
    expect(screen.getByRole('heading', { name: 'First, open this page in Safari' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeVisible();
    expect(screen.getByRole('button', { name: "Skip, I'll check the order page" })).toBeVisible();
  });

  it('an installed iPhone sees the Last step card; Not now leaves the quiet line', () => {
    show({ env: { ...iphone, installed: true, pushSupported: true } });
    expect(screen.getByTestId('notify-last-step')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('notify-last-step')).toBeNull();
    expect(screen.getByText('Notifications are off')).toBeVisible();
  });

  it('shows the green banner when notifications are on, and hides the line', () => {
    show({
      env: { ...iphone, installed: true, pushSupported: true, permission: 'granted' },
      subscribed: true,
    });
    expect(screen.getAllByText('Notifications are on').length).toBeGreaterThan(0);
    expect(screen.queryByText('Notifications are off')).toBeNull();
  });

  it('desktop gets the quiet line for this computer', () => {
    show({ env: { ...iphone, platform: 'desktop', safari: false, pushSupported: true } });
    expect(screen.getByText('Get updates on this computer')).toBeVisible();
  });

  it('shows nothing where notifications cannot work', () => {
    show({ env: { ...iphone, platform: 'desktop', safari: false, pushSupported: false } });
    expect(screen.queryByText('Get updates on this computer')).toBeNull();
    expect(screen.queryByTestId('updates-card')).toBeNull();
  });
});
