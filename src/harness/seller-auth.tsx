import { useCallback, useState } from 'react';
import { styled } from 'styled-components';
import {
  adminSetup,
  createInviteKey,
  fetchSellers,
  registerDevice,
  signInWithPasskey,
  signOut,
} from '../api/auth';
import {
  DeviceCodeScreen,
  DevicesScreen,
  PasskeyHelpScreen,
  PasswordSetupScreen,
  SetupKeyScreen,
  SignInScreen,
  registerSellerAuthI18n,
} from '../features/seller-auth';
import { AppThemeProvider } from '../theme/AppThemeProvider';

// ?harness=seller-auth&screen=key|code|passkey|password|signin|devices; talks to the dev Worker
// mock API. Own theme and strings, so the screens run without the app shell (7.3 adds the routes).
// The panel at the bottom makes an invite key for Dapur Demo, so the whole flow can be walked.

registerSellerAuthI18n();

type ScreenName = 'key' | 'code' | 'passkey' | 'password' | 'signin' | 'devices';
const SCREENS: ReadonlyArray<ScreenName> = [
  'key',
  'code',
  'passkey',
  'password',
  'signin',
  'devices',
];
const DEMO_SLUG = 'dapur-demo';
// The dev admin setup key (.dev.vars.example); production reads a real secret instead.
const DEV_ADMIN_SETUP_KEY = 'DLV-DEVA-DMIN-SETU-PKEY';

const Panel = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  max-width: min(100%, 32rem);
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const PanelButton = styled.button`
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.text};
  font: inherit;
  cursor: pointer;
`;
const Key = styled.output`
  font-family: monospace;
  font-size: ${({ theme }) => theme.type.size.base};
  color: ${({ theme }) => theme.colour.text};
`;

/** Admin (dev key, or the passkey this browser kept) makes an invite key for Dapur Demo. */
async function makeDemoInvite(): Promise<{ key: string } | { problem: string }> {
  const setup = await adminSetup(DEV_ADMIN_SETUP_KEY);
  if (setup.ok) {
    const registered = await registerDevice({ kind: 'passkey', deviceName: 'Harness admin' });
    if (!registered.ok) return { problem: `Admin setup failed: ${registered.error}` };
  } else if (setup.error === 'admin_exists') {
    const signedIn = await signInWithPasskey('admin');
    if (!signedIn.ok) {
      return { problem: 'An admin already exists and this browser has no admin passkey.' };
    }
  } else {
    return { problem: `Admin setup failed: ${setup.error}` };
  }
  const sellers = await fetchSellers();
  const seller = sellers.ok ? sellers.data.sellers.find((s) => s.slug === DEMO_SLUG) : undefined;
  if (!seller) return { problem: 'Dapur Demo was not found.' };
  const invite = await createInviteKey(seller.id);
  // Leave the admin session behind, so the seller flow starts from a clean browser.
  await signOut();
  return invite.ok ? { key: invite.data.key } : { problem: `Invite failed: ${invite.error}` };
}

function DevPanel({ onGo }: Readonly<{ onGo: (screen: ScreenName) => void }>) {
  const [key, setKey] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = useCallback(async () => {
    setBusy(true);
    setProblem(null);
    const made = await makeDemoInvite();
    setBusy(false);
    if ('key' in made) setKey(made.key);
    else setProblem(made.problem);
  }, []);

  return (
    <Panel aria-label="Dev panel">
      <span>Dev panel (prototype only)</span>
      <PanelButton disabled={busy} onClick={() => void create()}>
        Create invite key for Dapur Demo
      </PanelButton>
      {key ? <Key aria-label="Invite key">{key}</Key> : null}
      {problem ? <span role="status">{problem}</span> : null}
      <nav aria-label="Screens" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SCREENS.map((name) => (
          <PanelButton key={name} onClick={() => onGo(name)}>
            {name}
          </PanelButton>
        ))}
      </nav>
    </Panel>
  );
}

function initialScreen(): ScreenName {
  const wanted = new URLSearchParams(window.location.search).get('screen');
  return SCREENS.find((name) => name === wanted) ?? 'key';
}

export function SellerAuthHarness() {
  const [screen, setScreen] = useState<ScreenName>(initialScreen);
  const go = useCallback((next: ScreenName) => setScreen(next), []);

  return (
    <AppThemeProvider>
      {screen === 'key' ? (
        <SetupKeyScreen onSession={() => go('passkey')} onUseCode={() => go('code')} />
      ) : null}
      {screen === 'code' ? (
        <DeviceCodeScreen onSession={() => go('passkey')} onUseKey={() => go('key')} />
      ) : null}
      {screen === 'passkey' ? (
        <PasskeyHelpScreen onDone={() => go('devices')} onUsePassword={() => go('password')} />
      ) : null}
      {screen === 'password' ? (
        <PasswordSetupScreen onDone={() => go('devices')} onUsePasskey={() => go('passkey')} />
      ) : null}
      {screen === 'signin' ? (
        <SignInScreen slug={DEMO_SLUG} kitchenName="Dapur Demo" onSignedIn={() => go('devices')} />
      ) : null}
      {screen === 'devices' ? <DevicesScreen onSignedOut={() => go('signin')} /> : null}
      <DevPanel onGo={go} />
    </AppThemeProvider>
  );
}

export const Harness = SellerAuthHarness;
