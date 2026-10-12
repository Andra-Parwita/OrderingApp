import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { styled } from 'styled-components';
import { ADMIN_NS, AdminHomeScreen, AdminSetupScreen, AdminSignInScreen } from '../features/admin';
import {
  AUTH_NS,
  DeviceCodeScreen,
  PasskeyHelpScreen,
  PasswordSetupScreen,
  SetupKeyScreen,
  SignInScreen,
} from '../features/seller-auth';
import { HELP_NS } from '../features/seller-help';
import { KitchenImagesEditor, type ResizeFn } from '../features/seller-setup';
import type { Me } from '../../shared/authContract';
import type { ImageSlot } from '../../shared/imageSlots';
import { SELLER_HELP_PATH } from '../../shared/help';
import { isValidSlug } from '../../shared/seller';
import { fetchSellerImages, removeSellerImage, uploadSellerImage } from '../api/auth';
import { lastSignedIn } from '../api/device/sellerContext';
import { BrandBottomBar, BrandTopBar } from './BrandPanel';
import { useSession } from './session';
import { SignInFrame } from './SignInFrame';
import { SWITCH_SIGN_IN } from './SwitchPerson';

// Sign-in, setup and admin pages: outside the seller shell. Where each screen leads is decided here.

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
  const { t: tHelp } = useTranslation(HELP_NS);
  const alreadySetUp = (
    <>
      <FootLink to={SWITCH_SIGN_IN}>{t('signIn.alreadySetUp')}</FootLink>
      {/* Plan 058: the invite key is the step people get stuck on; Help topic 2 explains it. */}
      <FootLink to={`${SELLER_HELP_PATH}?topic=2`}>{tHelp('inviteKeyHelp')}</FootLink>
    </>
  );
  return (
    <SignInFrame brand="sellerSetup">
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
  const { t: tHelp } = useTranslation(HELP_NS);
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
        footer={
          <>
            <FootLink to="/seller/setup">{t('signIn.firstTime')}</FootLink>
            <FootLink to={SELLER_HELP_PATH}>{tHelp('needHelp')}</FootLink>
          </>
        }
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
    <SignInFrame brand="admin">
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
    <SignInFrame brand="admin">
      <AdminSignInScreen
        onSignedIn={done}
        autoStart={params.get('switch') === '1'}
        footer={<FootLink to="/admin/setup?method=code">{t('signIn.newDevice')}</FootLink>}
      />
    </SignInFrame>
  );
}

/** The brand bar and footer the app layer gives the admin page (features may not import app). */
export const ADMIN_TOP = (tools: ReactNode) => <BrandTopBar page="admin">{tools}</BrandTopBar>;
export const ADMIN_BOTTOM = <BrandBottomBar />;

/** The pictures editor of one kitchen, wired to the admin's image calls (plan 041). */
export function AdminKitchenImages({
  sellerId,
  resize,
}: Readonly<{ sellerId: string; resize?: ResizeFn }>) {
  const calls = useMemo(
    () => ({
      load: () => fetchSellerImages(sellerId),
      upload: (slot: ImageSlot, dataUrl: string) => uploadSellerImage(sellerId, slot, dataUrl),
      remove: (slot: ImageSlot) => removeSellerImage(sellerId, slot),
    }),
    [sellerId],
  );
  return <KitchenImagesEditor calls={calls} {...(resize ? { resize } : {})} />;
}
const ADMIN_IMAGES = (sellerId: string) => <AdminKitchenImages sellerId={sellerId} />;

export function AdminHomeRoute() {
  const navigate = useNavigate();
  const { adopt } = useSession();
  const toSignIn = useCallback(() => {
    adopt(null);
    void navigate('/admin/sign-in', { replace: true });
  }, [adopt, navigate]);
  // The admin page carries its own brand bar (plan 038), with the language switch and Sign out.
  return (
    <AdminHomeScreen
      onSignedOut={toSignIn}
      onSignInNeeded={toSignIn}
      top={ADMIN_TOP}
      bottom={ADMIN_BOTTOM}
      images={ADMIN_IMAGES}
    />
  );
}
