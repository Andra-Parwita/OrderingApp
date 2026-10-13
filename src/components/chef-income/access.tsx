import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchPreferences } from '../../api/menus';

// Plan 069: who gets a "Per chef" / "My income" button. The server enforces it as well; this only
// decides whether the button is offered. 'all' = owner, 'own' = a chef while the kitchen setting
// is on, null = a helper, or a chef while it is off.

export type IncomeAccess = 'all' | 'own' | null;

const AccessContext = createContext<IncomeAccess>(null);

type Role = 'seller' | 'chef' | 'helper' | 'admin' | undefined;

export function IncomeAccessProvider({
  role,
  children,
}: Readonly<{ role: Role; children: ReactNode }>) {
  const [chefMay, setChefMay] = useState(false);
  useEffect(() => {
    if (role !== 'chef') return undefined;
    let live = true;
    void fetchPreferences(undefined, currentSellerSlug()).then((result) => {
      if (live) setChefMay(result.ok && result.data.preferences.chefsSeeIncome !== false);
    });
    return () => {
      live = false;
    };
  }, [role]);
  const access: IncomeAccess =
    role === 'seller' ? 'all' : role === 'chef' && chefMay ? 'own' : null;
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

export function useIncomeAccess(): IncomeAccess {
  return useContext(AccessContext);
}
