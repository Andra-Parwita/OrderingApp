import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchPreferencesCached } from '../../api/cachedReads';

// Plan 069: who gets a "Per chef" / "My income" button. The server enforces it as well; this only
// decides whether the button is offered. 'all' = owner, 'own' = a chef while the kitchen setting
// is on, null = a helper, or a chef while it is off.

export type IncomeAccess = 'all' | 'own' | null;

const AccessContext = createContext<IncomeAccess>(null);
// Plan 081: a chef's own id, to show only her row of the private orders' figures.
const ChefIdContext = createContext<string | undefined>(undefined);

type Role = 'seller' | 'chef' | 'helper' | 'admin' | undefined;

export function IncomeAccessProvider({
  role,
  chefId,
  children,
}: Readonly<{ role: Role; chefId?: string | undefined; children: ReactNode }>) {
  const [chefMay, setChefMay] = useState(false);
  useEffect(() => {
    if (role !== 'chef') return undefined;
    let live = true;
    void fetchPreferencesCached().then((result) => {
      if (live) setChefMay(result.ok && result.data.preferences.chefsSeeIncome !== false);
    });
    return () => {
      live = false;
    };
  }, [role]);
  const access: IncomeAccess =
    role === 'seller' ? 'all' : role === 'chef' && chefMay ? 'own' : null;
  return (
    <AccessContext.Provider value={access}>
      <ChefIdContext.Provider value={chefId}>{children}</ChefIdContext.Provider>
    </AccessContext.Provider>
  );
}

export function useIncomeAccess(): IncomeAccess {
  return useContext(AccessContext);
}

export function useIncomeChefId(): string | undefined {
  return useContext(ChefIdContext);
}
