import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { styled } from 'styled-components';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { AdminHomeScreen, AdminSetupScreen, AdminSignInScreen } from '../features/admin';
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

/** /seller/setup: invite key (or add-device code), then a passkey or a password, then in. */
export function SellerSetupRoute() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const { t } = useTranslation(AUTH_NS);
  const [step, setStep] = useState<SetupStep>('key');
  // "Welcome, <first name>": only a chef's invite carries a person's name.
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [setup, setSetup] = useState<Me | undefined>(undefined);
  const toPasskey = useCallback((me: Me) => {
    setSetup(me);
    setFirstName(me.chefName?.trim().split(/\s+/)[0] || undefined);
    setStep('passkey');
  }, []);
  const done = useCallback(() => {
    void refresh().then(() => navigate('/seller', { replace: true }));
  }, [navigate, refresh]);
  const alreadySetUp = <FootLink to={SWITCH_SIGN_IN}>{t('signIn.alreadySetUp')}</FootLink>;
  return (
    <SignInFrame brand="sellerSetup">
      {step === 'key' ? (
        <SetupKeyScreen
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
  const chefParam = params.get('chef');
  const chefId = chefParam ?? (asked === null || asked === last?.slug ? last?.chefId : undefined);
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
        {...(chefId ? { chefId } : {})}
        onSignedIn={signedIn}
        switchPerson={switching}
        footer={<FootLink to="/seller/setup">{t('signIn.firstTime')}</FootLink>}
      />
    </SignInFrame>
  );
}

export function AdminSetupRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const done = useCallback(() => void navigate('/admin', { replace: true }), [navigate]);
  return (
    <SignInFrame brand="admin">
      <AdminSetupScreen
        onDone={done}
        footer={<FootLink to="/admin/sign-in?switch=1">{t('sellerNav.alreadySetUp')}</FootLink>}
      />
    </SignInFrame>
  );
}

export function AdminSignInRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const done = useCallback(() => void navigate('/admin', { replace: true }), [navigate]);
  return (
    <SignInFrame brand="admin">
      <AdminSignInScreen onSignedIn={done} autoStart={params.get('switch') === '1'} />
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
