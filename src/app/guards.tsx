import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router';
import { styled } from 'styled-components';
import type { Me } from '../../shared/authContract';
import { adminSetup } from '../api/auth';
import { useDevTools } from '../api/devTools';
import { lastSignedIn } from '../api/device/sellerContext';
import { getCredentialId, hasSessionHint } from '../api/device/session';
import { LaunchGate } from './LaunchGate';
import { launchTarget } from './launchKitchen';
import { HELPER_HOME, helperMayOpen } from './sellerNav';
import { isStaff, useSession } from './session';

// Route guards. Each asks the server who this is once, when its area is entered (a sign-in, a
// 401 or a signed-out device then shows up here, not as broken screens).

/** Asks the server on entry; null until the answer is in. */
function useEntryCheck(): { done: boolean; me: Me | null } {
  const { refresh } = useSession();
  const [state, setState] = useState<{ done: boolean; me: Me | null }>({
    // Never signed in on this device, nothing to ask: the answer is known at once.
    done: !hasSessionHint(),
    me: null,
  });
  useEffect(() => {
    if (!hasSessionHint()) return undefined;
    let live = true;
    void refresh().then((me) => {
      if (live) setState({ done: true, me });
    });
    return () => {
      live = false;
    };
  }, [refresh]);
  return state;
}

/**
 * Seller and chef pages need a finished sign-in. A server running with DEV_TOOLS keeps the seller
 * picker for a device without any session (the dev override); production always asks for a sign-in.
 */
export function SellerGuard({ children }: Readonly<{ children: ReactNode }>) {
  const { done, me } = useEntryCheck();
  const devTools = useDevTools();
  const { pathname, search } = useLocation();
  // Plan 101: a kitchen's own seller app names its kitchen (`?k=`, remembered for this window).
  const target = launchTarget(search);
  if (!done) return null;
  // A helper (plan 028) opens a few pages only; a link to any other goes to Orders.
  if (isStaff(me) && me.role === 'helper' && !helperMayOpen(pathname)) {
    return <Navigate to={HELPER_HOME} replace />;
  }
  if (isStaff(me)) {
    return target ? (
      <LaunchGate me={me} target={target}>
        {children}
      </LaunchGate>
    ) : (
      <>{children}</>
    );
  }
  if (me === null && !hasSessionHint()) {
    if (devTools === undefined) return null; // the server has not said yet
    if (devTools) return <>{children}</>;
  }
  // The launch kitchen is kept through the sign-in (heading and password check); `lastSignedIn` is the
  // fallback for a launch with no kitchen only.
  if (target) return <Navigate to={`/seller/sign-in?kitchen=${target}&k=${target}`} replace />;
  return <Navigate to={lastSignedIn() ? '/seller/sign-in' : '/seller/setup'} replace />;
}

/** Whether an admin exists is asked once per page load (a wrong setup key never works). */
let adminKnown: boolean | undefined;

async function adminExists(): Promise<boolean> {
  if (adminKnown !== undefined) return adminKnown;
  // The setup endpoint refuses with 409 when an admin exists; a made-up key never gets in.
  const probe = await adminSetup('probe');
  adminKnown = !probe.ok && probe.error === 'admin_exists';
  return adminKnown;
}

/** The admin page needs the admin; else sign-in, or setup while no admin exists yet. */
export function AdminGuard({ children }: Readonly<{ children: ReactNode }>) {
  const { done, me } = useEntryCheck();
  const [target, setTarget] = useState<string | null>(null);
  const allowed = done && me !== null && me.role === 'admin' && me.stage === 'full';
  useEffect(() => {
    if (!done || allowed) return undefined;
    let live = true;
    const known = getCredentialId('admin') !== null;
    void (known ? Promise.resolve(true) : adminExists()).then((exists) => {
      if (live) setTarget(exists ? '/admin/sign-in' : '/admin/setup');
    });
    return () => {
      live = false;
    };
  }, [done, allowed]);
  if (allowed) return <>{children}</>;
  return target ? <Navigate to={target} replace /> : null;
}

const Notice = styled.main`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
`;
const NoticeTitle = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
`;
const Back = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.minTapTarget};
  color: ${({ theme }) => theme.colour.accent};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

/** Pages the server closes to chefs (D-013): a chef sees why instead of a page of refusals. */
export function SellerOnly({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation();
  const { me } = useSession();
  if (me?.role !== 'chef') return <>{children}</>;
  return (
    <Notice>
      <NoticeTitle>{t('sellerNav.notForChefs')}</NoticeTitle>
      <span>{t('sellerNav.notForChefsBody')}</span>
      <Back to="/seller/orders">{t('sellerNav.toOrders')}</Back>
    </Notice>
  );
}
