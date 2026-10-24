import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ReactReduxContext } from 'react-redux';
import type { Me } from '../../shared/authContract';
import { staffSignedOut } from '../api/staffSignedOut';
import { fetchMe, signOut } from '../api/auth';
import { hasSessionHint } from '../api/device/session';
import { launchMemory, rememberLaunchKitchen } from './launchKitchen';
import { rememberSignedIn, setSessionDemo, setSessionSeller } from '../api/device/sellerContext';

// Who is signed in on this device. The server decides (`GET /api/auth/me`); the guards ask it
// when a seller or admin area is entered. The session is an HttpOnly cookie: scripts cannot see
// it, so the only way to know is to ask (a plain hint in api/device/session.ts saves asking a
// device that never signed in).

export type SessionValue = Readonly<{
  /** The last answer from the server; null when signed out or not asked yet. */
  me: Me | null;
  /** Asks the server who this is (no request when this device never signed in). */
  refresh: () => Promise<Me | null>;
  /** Takes a person who just signed in. */
  adopt: (me: Me | null) => void;
  /** Signs this device out and forgets the session. */
  end: () => Promise<void>;
}>;

const NONE: SessionValue = {
  me: null,
  refresh: () => Promise.resolve(null),
  adopt: () => undefined,
  end: () => Promise.resolve(),
};

const SessionContext = createContext<SessionValue>(NONE);

export const useSession = (): SessionValue => useContext(SessionContext);

/** A seller, chef or helper with a finished (not setup) session. */
export function isStaff(me: Me | null): me is Me {
  return (
    me !== null &&
    me.stage === 'full' &&
    (me.role === 'seller' || me.role === 'chef' || me.role === 'helper')
  );
}

/** The new-menu bell asks an owner-only API: a chef or helper must not even try (a dev run with no session still may). */
export const mayNotify = (me: Me | null): boolean => me?.role !== 'chef' && me?.role !== 'helper';

/** Seller screens act for the session's seller; the device remembers who signed in last. */
function applyMe(me: Me | null): void {
  setSessionDemo(isStaff(me) && me.demo === true);
  if (isStaff(me) && me.slug) {
    setSessionSeller(me.slug);
    rememberSignedIn({
      slug: me.slug,
      ...(me.sellerName ? { kitchenName: me.sellerName } : {}),
      ...(me.role === 'chef' && me.chefId ? { chefId: me.chefId } : {}),
    });
  } else {
    setSessionSeller(null);
  }
}

export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [me, setMe] = useState<Me | null>(null);

  const meRef = useRef<Me | null>(null);
  const apply = useCallback((next: Me | null) => {
    applyMe(next);
    meRef.current = next;
    setMe(next);
  }, []);

  // A person who switches kitchen on purpose (the switcher) moves this window's remembered kitchen
  // (plan 101 stage 4); a sign-in or the entry check (`refresh`) never does.
  const adopt = useCallback(
    (next: Me | null) => {
      const before = meRef.current;
      if (
        isStaff(before) &&
        isStaff(next) &&
        next.slug &&
        before.slug !== next.slug &&
        launchMemory() !== null
      ) {
        rememberLaunchKitchen(next.slug);
      }
      apply(next);
    },
    [apply],
  );

  const refresh = useCallback(async () => {
    if (!hasSessionHint()) {
      apply(null);
      return null;
    }
    const result = await fetchMe();
    const next = result.ok ? result.data.me : null;
    apply(next);
    return next;
  }, [apply]);

  // The store is optional: some test trees have a session but no store.
  const redux = useContext(ReactReduxContext);
  const end = useCallback(async () => {
    // Stop the seller sagas and the live socket first, so nothing asks the API once the cookie goes.
    redux?.store.dispatch(staffSignedOut());
    await signOut();
    apply(null);
  }, [apply, redux]);

  const value = useMemo(() => ({ me, refresh, adopt, end }), [me, refresh, adopt, end]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
