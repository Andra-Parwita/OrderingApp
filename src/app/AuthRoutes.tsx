import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { styled } from 'styled-components';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { AdminHomeScreen, AdminSetupScreen, AdminSignInScreen } from '../features/admin';
import {
  DeviceCodeScreen,
  PasskeyHelpScreen,
  PasswordSetupScreen,
  SetupKeyScreen,
  SignInScreen,
} from '../features/seller-auth';
import { isValidSlug } from '../../shared/seller';
import { lastSignedIn } from '../api/device/sellerContext';
import { PageHeader } from '../ui';
import { useSession } from './session';

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
  color: ${({ theme }) => theme.colour.accent};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

type SetupStep = 'key' | 'code' | 'passkey' | 'password';

/** /seller/setup: invite key (or add-device code), then a passkey or a password, then in. */
export function SellerSetupRoute() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [step, setStep] = useState<SetupStep>('key');
  const toPasskey = useCallback(() => setStep('passkey'), []);
  const done = useCallback(() => {
    void refresh().then(() => navigate('/seller', { replace: true }));
  }, [navigate, refresh]);
  return (
    <AuthFrame>
      {step === 'key' ? (
        <SetupKeyScreen onSession={toPasskey} onUseCode={() => setStep('code')} />
      ) : null}
      {step === 'code' ? (
        <DeviceCodeScreen onSession={toPasskey} onUseKey={() => setStep('key')} />
      ) : null}
      {step === 'passkey' ? (
        <PasskeyHelpScreen onDone={done} onUsePassword={() => setStep('password')} />
      ) : null}
      {step === 'password' ? <PasswordSetupScreen onDone={done} onUsePasskey={toPasskey} /> : null}
    </AuthFrame>
  );
}

/** /seller/sign-in: the kitchen is `?kitchen=`, else the one last signed in on this device. */
export function SellerSignInRoute() {
  const { t } = useTranslation();
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
  if (!slug) return <Navigate to="/seller/setup" replace />;
  const kitchenName = slug === last?.slug ? last.kitchenName : undefined;
  return (
    <AuthFrame>
      <SignInScreen
        slug={slug}
        {...(kitchenName ? { kitchenName } : {})}
        {...(chefId ? { chefId } : {})}
        onSignedIn={signedIn}
        footer={<FootLink to="/seller/setup">{t('sellerNav.firstTime')}</FootLink>}
      />
    </AuthFrame>
  );
}

export function AdminSetupRoute() {
  const navigate = useNavigate();
  const done = useCallback(() => void navigate('/admin', { replace: true }), [navigate]);
  return (
    <AuthFrame>
      <AdminSetupScreen onDone={done} />
    </AuthFrame>
  );
}

export function AdminSignInRoute() {
  const navigate = useNavigate();
  const done = useCallback(() => void navigate('/admin', { replace: true }), [navigate]);
  return (
    <AuthFrame>
      <AdminSignInScreen onSignedIn={done} />
    </AuthFrame>
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
