import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { styled } from 'styled-components';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { ADMIN_NS, AdminHomeScreen, AdminSetupScreen, AdminSignInScreen } from '../features/admin';
import {
  AUTH_NS,
  DeviceCodeScreen,
  PasskeyHelpScreen,
  PasswordSetupScreen,
  SetupKeyScreen,
  SignInScreen,
} from '../features/seller-auth';
import type { Me } from '../../shared/authContract';
import { isValidSlug } from '../../shared/seller';
import { lastSignedIn } from '../api/device/sellerContext';
import { PageHeader } from '../ui';
import { useSession } from './session';
import { SignInFrame } from './SignInFrame';
import { SWITCH_SIGN_IN } from './SwitchPerson';

// Sign-in, setup and admin pages: outside the seller shell, each under a bar with the language
// switch. Where each screen leads is decided here.

function AuthFrame({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <PageHeader title="" titleHidden trailing={<LanguageSwitch compact />} />
      {children}
    </>
  );
}

const FootLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.minTapTarget};
  color: ${({ theme }) => theme.c.atext};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

type SetupStep = 'key' | 'code' | 'passkey' | 'password';

/** The key of an invite link (`#key=`); read once, the address is cleaned in an effect. */
function keyFromAddress(): string {
  return new URLSearchParams(location.hash.slice(1)).get('key') ?? '';
}

/**
 * /seller/setup: invite key (or add-device code), then a passkey or a password, then in. A person
 * already signed in joins the kitchen with the key and goes straight to it. `#key=` fills the key.
 */
export function SellerSetupRoute() {
  const navigate = useNavigate();
  const { me, refresh, adopt } = useSession();
  const { t } = useTranslation(AUTH_NS);
  const [params] = useSearchParams();
  const [linkKey] = useState(keyFromAddress);
  useEffect(() => {
    // The key was read above; keep it out of the address bar and the history.
    if (location.hash !== '') history.replaceState(null, '', location.pathname + location.search);
    void refresh(); // is a person already signed in here? Then the key joins a kitchen
  }, [refresh]);
  const person = me?.stage === 'full' && me.role !== 'admin' ? me : null;
  const kitchen = params.get('kitchen') ?? undefined;
  const joined = useCallback(
    (next: Me) => {
      if (next.stage !== 'full') return false;
      adopt(next);
      void navigate('/seller', { replace: true });
      return true;
    },
    [adopt, navigate],
  );
  const [step, setStep] = useState<SetupStep>('key');
  // "Welcome, <first name>": the invite carries the person's name.
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [setup, setSetup] = useState<Me | undefined>(undefined);
  const toPasskey = useCallback(
    (next: Me) => {
      // A joined person is signed in already; a new one (or a code) still sets up a login.
      if (joined(next)) return;
      setSetup(next);
      setFirstName(next.displayName?.trim().split(/\s+/)[0] || undefined);
      setStep('passkey');
    },
    [joined],
  );
  const done = useCallback(() => {
    // An admin's 6-digit code opened this setup: that person belongs on the admin page.
    void refresh().then(() =>
      navigate(setup?.role === 'admin' ? '/admin' : '/seller', { replace: true }),
    );
  }, [navigate, refresh, setup]);
  const alreadySetUp = <FootLink to={SWITCH_SIGN_IN}>{t('signIn.alreadySetUp')}</FootLink>;
  return (
    <SignInFrame>
      {step === 'key' ? (
        <SetupKeyScreen
          initialKey={linkKey}
          {...(person ? { joinKitchen: kitchen ?? t('join.thisKitchen') } : {})}
          onSession={toPasskey}
          onUseCode={() => setStep('code')}
          footer={alreadySetUp}
        />
      ) : null}
      {step === 'code' ? (
        <DeviceCodeScreen
          onSession={toPasskey}
          onUseKey={() => setStep('key')}
          footer={alreadySetUp}
        />
      ) : null}
      {step === 'passkey' ? (
        <PasskeyHelpScreen
          name={firstName}
          setup={setup}
          onDone={done}
          onUsePassword={() => setStep('password')}
        />
      ) : null}
      {step === 'password' ? (
        <PasswordSetupScreen setup={setup} onDone={done} onUsePasskey={() => setStep('passkey')} />
      ) : null}
    </SignInFrame>
  );
}

/** /seller/sign-in: the kitchen is `?kitchen=`, else the one last signed in on this device. */
export function SellerSignInRoute() {
  const { t } = useTranslation(AUTH_NS);
  const navigate = useNavigate();
  const { adopt } = useSession();
  const [params] = useSearchParams();
  const last = lastSignedIn();
  const asked = params.get('kitchen');
  const slug = isValidSlug(asked) ? asked : last?.slug;
  const signedIn = useCallback(
    (me: Parameters<typeof adopt>[0]) => {
      adopt(me);
      void navigate('/seller', { replace: true });
    },
    [adopt, navigate],
  );
  const switching = params.get('switch') === '1';
  // No kitchen known: set-up, unless the person came to pick a passkey this device already holds.
  if (!slug && !switching) return <Navigate to="/seller/setup" replace />;
  const kitchenName = last && slug === last.slug ? last.kitchenName : undefined;
  return (
    <SignInFrame kitchenName={kitchenName}>
      <SignInScreen
        {...(slug ? { slug } : {})}
        onSignedIn={signedIn}
        switchPerson={switching}
        footer={<FootLink to="/seller/setup">{t('signIn.firstTime')}</FootLink>}
      />
    </SignInFrame>
  );
}

export function AdminSetupRoute() {
  const { t } = useTranslation();
  const { t: tAdmin } = useTranslation(ADMIN_NS);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const done = useCallback(() => void navigate('/admin', { replace: true }), [navigate]);
  return (
    <SignInFrame>
      <AdminSetupScreen
        onDone={done}
        codeScreen={(props) => <DeviceCodeScreen {...props} keyTabLabel={tAdmin('setup.tabKey')} />}
        initialMethod={params.get('method') === 'code' ? 'code' : 'key'}
        footer={<FootLink to="/admin/sign-in?switch=1">{t('sellerNav.alreadySetUp')}</FootLink>}
      />
    </SignInFrame>
  );
}

export function AdminSignInRoute() {
  const navigate = useNavigate();
  const { t } = useTranslation(ADMIN_NS);
  const [params] = useSearchParams();
  const done = useCallback(() => void navigate('/admin', { replace: true }), [navigate]);
  return (
    <SignInFrame>
      <AdminSignInScreen
        onSignedIn={done}
        autoStart={params.get('switch') === '1'}
        footer={<FootLink to="/admin/setup?method=code">{t('signIn.newDevice')}</FootLink>}
      />
    </SignInFrame>
  );
}

export function AdminHomeRoute() {
  const navigate = useNavigate();
  const { adopt } = useSession();
  const toSignIn = useCallback(() => {
    adopt(null);
    void navigate('/admin/sign-in', { replace: true });
  }, [adopt, navigate]);
  return (
    <AuthFrame>
      <AdminHomeScreen onSignedOut={toSignIn} onSignInNeeded={toSignIn} />
    </AuthFrame>
  );
}
