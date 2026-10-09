import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Me } from '../../shared/authContract';
import { fetchMe, signOut } from '../api/auth';
import { getSessionToken } from '../api/device/session';
import { rememberSignedIn, setSessionSeller } from '../api/device/sellerContext';

// Who is signed in on this device. The server decides (`GET /api/auth/me`); the guards ask it
// when a seller or admin area is entered. The token itself lives in api/device/session.ts.

export type SessionValue = Readonly<{
  /** The last answer from the server; null when signed out or not asked yet. */
  me: Me | null;
  /** Asks the server who this is (no request when the device holds no token). */
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

/** A seller or chef with a finished (not setup) session. */
export function isStaff(me: Me | null): me is Me {
  return me !== null && me.stage === 'full' && (me.role === 'seller' || me.role === 'chef');
}

/** Seller screens act for the session's seller; the device remembers who signed in last. */
function applyMe(me: Me | null): void {
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

  const adopt = useCallback((next: Me | null) => {
    applyMe(next);
    setMe(next);
  }, []);

  const refresh = useCallback(async () => {
    if (getSessionToken() === null) {
      adopt(null);
      return null;
    }
    const result = await fetchMe();
    const next = result.ok ? result.data.me : null;
    adopt(next);
    return next;
  }, [adopt]);

  const end = useCallback(async () => {
    await signOut();
    adopt(null);
  }, [adopt]);

  const value = useMemo(() => ({ me, refresh, adopt, end }), [me, refresh, adopt, end]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
