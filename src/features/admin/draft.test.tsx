import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from '../../../mocks/browserPasskeys';
import { clearCookies, installCookieJar } from '../../../mocks/cookieJar';
import { DEV_ADMIN_SETUP_KEY, mockStores } from '../../../mocks/handlers';
import { adminSetup, registerDevice } from '../../api/auth';
import { draftKey } from '../../components/draft';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { AdminHomeScreen } from './AdminHomeScreen';
import { registerAdminI18n } from './i18n/register';
import { KeyBox } from './KeyBox';

// Plan 061 stage 8: the invite name and the new kitchen's name / link survive a reload; no key is stored.

vi.mock(
  '@simplewebauthn/browser',
  async () => (await import('../../../mocks/browserPasskeys')).browserMock,
);

let restoreFetch: () => void;
afterAll(() => restoreFetch());
beforeAll(async () => {
  restoreFetch = installCookieJar();
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerAdminI18n();
});
beforeEach(async () => {
  await mockStores.reset();
  localStorage.clear();
  clearCookies();
  browserPasskeys.reset();
  await i18n.changeLanguage('en');
});
afterEach(() => vi.restoreAllMocks());

const themed = (ui: React.ReactNode) => render(<AppThemeProvider>{ui}</AppThemeProvider>);
const drafts = () => Object.keys(localStorage).filter((key) => key.startsWith('draft:'));

describe('KeyBox draft', () => {
  const box = () => (
    <KeyBox
      title="Invite"
      slug="onde-onde"
      kitchen="Onde Onde"
      create={() => Promise.resolve('DLV-AAAA-BBBB')}
      onDone={() => undefined}
    />
  );

  it('restores the typed name, clears it on success and never stores the key', async () => {
    const first = themed(box());
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Tia' } });
    first.unmount();
    expect(localStorage.getItem(draftKey('admin', 'invite', 'onde-onde'))).not.toBeNull();
    themed(box());
    expect(screen.getByLabelText<HTMLInputElement>(/name/i).value).toBe('Tia');
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(await screen.findByText('DLV-AAAA-BBBB')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'my text DLV-AAAA-BBBB' } });
    expect(drafts()).toEqual([]);
    expect(JSON.stringify({ ...localStorage })).not.toContain('DLV-AAAA-BBBB');
  });
});

describe('Add a seller draft', () => {
  it('restores the typed name and link, and clears them once the seller is added', async () => {
    expect((await adminSetup(DEV_ADMIN_SETUP_KEY)).ok).toBe(true);
    expect((await registerDevice({ kind: 'passkey', deviceName: 'Test PC' })).ok).toBe(true);
    const first = themed(<AdminHomeScreen />);
    await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a seller' }));
    fireEvent.change(screen.getByLabelText('Seller name'), { target: { value: 'Warung Baru' } });
    fireEvent.change(screen.getByLabelText('Customer link'), { target: { value: 'warung-baru' } });
    first.unmount();
    themed(<AdminHomeScreen />);
    await screen.findByRole('list', { name: 'Sellers' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a seller' }));
    expect(screen.getByLabelText<HTMLInputElement>('Seller name').value).toBe('Warung Baru');
    expect(screen.getByLabelText<HTMLInputElement>('Customer link').value).toBe('warung-baru');
    fireEvent.click(screen.getByRole('button', { name: 'Add seller' }));
    await screen.findByText('Warung Baru was added. The link is /warung-baru.');
    expect(drafts()).toEqual([]);
  });
});
