// The shape of one /api/seller/* route and how a request is matched to it (plan 098 C1 + C2).
//
// Every route lists the roles that may call it: an ALLOW-list. A route added without roles is
// refused for everyone but the owner by the type system (roles is required), so a new route can
// never leak to a chef or a helper by default. A chef or helper entry may carry an extra check on
// the request (their own dish, a sold-out switch alone). Matching order is the order of the table.
import type { StaffActor } from '../../shared/domain';
import type { Repository, SellerRepository, StoreResult } from '../repo/Repository';
import type { SellerOrder } from '../../shared/domain';
import type { RouteContext } from './routeKit';

/** The owner is `seller` in the audit log; chef and helper are as the invite made them. */
export type SellerRole = 'owner' | 'chef' | 'helper';

/** Everything a seller handler needs, for the one seller the request is scoped to. */
export type SellerCall = {
  repo: Repository;
  store: SellerRepository;
  request: Request;
  /** The second and third path parts after `/api/seller/<area>`. */
  b: string | undefined;
  c: string | undefined;
  bad: () => Response;
  actor: StaffActor;
  context: RouteContext;
  sellerId: string;
  /** The signed-in person (absent in a DEV_TOOLS header call). */
  accountId: string | undefined;
  /** A signed-in chef's id: their new dishes are always theirs (plan 030). */
  chefId: string | undefined;
  /** The signed-in person's name (the day-sales log records it; plan 029). */
  personName: string | undefined;
  changed: (result: StoreResult<SellerOrder>) => Promise<StoreResult<SellerOrder>>;
  menuChanged: () => Promise<void>;
};

export type SellerHandler = (call: SellerCall) => Promise<Response | null>;
type Check = (call: SellerCall) => boolean | Promise<boolean>;

export type SellerRoute = {
  method: string;
  /** `orders/:code/status`: literal parts must match, `:x` needs any value, `*` takes anything (or nothing), and a missing part must be absent. */
  path: string;
  /** Who may call it. The owner is also what a DEV_TOOLS header call (no session) counts as. */
  roles: ReadonlyArray<SellerRole>;
  /** A further check on top of the role, for chef or helper only. */
  only?: { chef?: Check; helper?: Check };
  /** The route exists only while this holds (the team list needs a signed-in person). */
  when?: Check;
  /** Skip the live "from this device" wrapper and the address decoration (the demo samples). */
  bare?: true;
  /** The answer carries `order` / `orders`: add the team-only delivery address (plan 071). */
  addresses?: true;
  handler: SellerHandler;
};

export const OWNER: ReadonlyArray<SellerRole> = ['owner'];
export const OWNER_CHEF: ReadonlyArray<SellerRole> = ['owner', 'chef'];
export const OWNER_HELPER: ReadonlyArray<SellerRole> = ['owner', 'helper'];
export const EVERYONE: ReadonlyArray<SellerRole> = ['owner', 'chef', 'helper'];

/** The first table entry that answers this method and path, else undefined. */
export async function findRoute(
  table: ReadonlyArray<SellerRoute>,
  method: string,
  a: string | undefined,
  b: string | undefined,
  c: string | undefined,
  call: SellerCall,
): Promise<SellerRoute | undefined> {
  const actual = [a, b, c];
  for (const route of table) {
    if (route.method !== method) continue;
    const parts = route.path.split('/');
    const fits = [0, 1, 2].every((index) => {
      const part = parts[index];
      if (part === undefined) return !actual[index];
      if (part === '*') return true;
      if (part.startsWith(':')) return !!actual[index];
      return actual[index] === part;
    });
    if (fits && (!route.when || (await route.when(call)))) return route;
  }
  return undefined;
}

type Extra = Pick<SellerRoute, 'only' | 'when' | 'bare' | 'addresses'>;

/** One table entry. */
export function route(
  method: string,
  path: string,
  roles: ReadonlyArray<SellerRole>,
  handler: SellerHandler,
  extra: Extra = {},
): SellerRoute {
  return { method, path, roles, handler, ...extra };
}
