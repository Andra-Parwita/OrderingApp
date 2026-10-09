// Mock routes for /api/auth/* and /api/admin/* (stage 7.1). Dev only, like the rest of the mock.
import {
  parseAdminSetupRequest,
  parseCodeSignInRequest,
  parseCreateSellerRequest,
  parseKeySignInRequest,
  parsePasskeySignInRequest,
  parsePasswordSignInRequest,
  parseRegisterRequest,
  parseRenameDeviceRequest,
  type ChefAccessResponse,
  type DevicesResponse,
  type MeResponse,
  type SellerResponse,
  type SellersResponse,
} from '../../shared/authContract';
import { isValidSlug } from '../../shared/seller';
import type { OkResponse } from '../../shared/setupContract';
import type { AuthResult, Caller } from './auth';
import { authError, bearerOf, error, readJson } from './respond';
import type { MockStore, SellerStore } from './store';

const bad = () => error('invalid_request', 'Invalid request');

function result<T>(outcome: AuthResult<T>, status = 200): Response {
  return outcome.ok ? Response.json(outcome.value, { status }) : authError(outcome);
}

/** The signed-in caller: a full session, or a response to send instead. */
export function requireSession(
  store: MockStore,
  request: Request,
): { caller: Caller } | { response: Response } {
  const caller = store.auth.resolve(bearerOf(request));
  if (!caller || caller.setup) return { response: error('unauthorized', 'Sign in first') };
  return { caller };
}

/** Everything under /api/auth/*. */
export async function handleAuth(
  store: MockStore,
  request: Request,
  [a, b]: [string | undefined, string | undefined],
): Promise<Response | null> {
  const method = request.method;
  const auth = store.auth;

  if (method === 'POST' && !b) {
    const body = await readJson(request);
    if (a === 'invite') {
      const input = parseKeySignInRequest(body);
      return input ? result(await auth.redeemKey(input.key, input.deviceId)) : bad();
    }
    if (a === 'code') {
      const input = parseCodeSignInRequest(body);
      return input ? result(await auth.redeemCode(input.code, input.deviceId)) : bad();
    }
    if (a === 'password') {
      const input = parsePasswordSignInRequest(body);
      return input ? result(await auth.signInPassword(input)) : bad();
    }
    if (a === 'passkey') {
      const input = parsePasskeySignInRequest(body);
      return input ? result(await auth.signInPasskey(input)) : bad();
    }
    if (a === 'register') {
      const input = parseRegisterRequest(body);
      if (!input) return bad();
      return result(await auth.register(bearerOf(request) ?? '', input), 201);
    }
    if (a === 'sign-out') {
      const token = bearerOf(request);
      if (token) auth.signOut(token);
      return Response.json({ ok: true } satisfies OkResponse);
    }
    if (a === 'device-codes') {
      const session = requireSession(store, request);
      return 'response' in session
        ? session.response
        : Response.json(await auth.createCode(session.caller), { status: 201 });
    }
    return null;
  }

  if (a === 'me' && !b && method === 'GET') {
    const caller = auth.resolve(bearerOf(request));
    return caller
      ? Response.json({ me: auth.me(caller) } satisfies MeResponse)
      : error('unauthorized', 'Sign in first');
  }

  if (a === 'devices') {
    const session = requireSession(store, request);
    if ('response' in session) return session.response;
    const { caller } = session;
    if (!b && method === 'GET') {
      return Response.json({ devices: auth.devicesOf(caller) } satisfies DevicesResponse);
    }
    if (b && method === 'PATCH') {
      const input = parseRenameDeviceRequest(await readJson(request));
      if (!input) return bad();
      return auth.renameDevice(caller, b, input.name)
        ? Response.json({ ok: true } satisfies OkResponse)
        : error('not_found', 'Device not found');
    }
    if (b && method === 'DELETE') {
      return auth.revokeOwnDevice(caller, b)
        ? Response.json({ ok: true } satisfies OkResponse)
        : error('not_found', 'Device not found');
    }
  }
  return null;
}

/** Each chef of a seller with the number of devices signed in as them (no order data). */
export function chefAccess(store: MockStore, sellerStore: SellerStore): ChefAccessResponse {
  return {
    chefs: sellerStore.listChefs().map((chef) => ({
      id: chef.id,
      name: chef.name,
      devices: store.auth.chefDeviceCount(sellerStore.seller.id, chef.id),
    })),
  };
}

/** Everything under /api/admin/*. The admin sees sellers, keys and devices, never order data. */
export async function handleAdmin(
  store: MockStore,
  request: Request,
  [a, b, c, d, e]: [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ],
): Promise<Response | null> {
  const method = request.method;

  // Phase 4 reads the ADMIN_SETUP_KEY secret; the mock checks DEV_ADMIN_SETUP_KEY.
  if (a === 'setup' && !b && method === 'POST') {
    const input = parseAdminSetupRequest(await readJson(request));
    return input ? result(await store.auth.adminSetup(input.setupKey, input.deviceId)) : bad();
  }

  const session = requireSession(store, request);
  if ('response' in session) return session.response;
  if (session.caller.role !== 'admin') return error('forbidden', 'Admins only');

  if (a === 'sellers') {
    if (!b && method === 'GET') {
      return Response.json({ sellers: store.adminSellers() } satisfies SellersResponse);
    }
    if (!b && method === 'POST') {
      const input = parseCreateSellerRequest(await readJson(request));
      if (!input || !isValidSlug(input.slug)) return bad();
      if (store.seller(input.slug)) return error('slug_taken', 'That link is already taken');
      return Response.json(
        { seller: store.addSeller(input.name, input.slug) } satisfies SellerResponse,
        {
          status: 201,
        },
      );
    }
    const target = b ? store.sellerById(b) : undefined;
    if (b && !target) return error('seller_not_found', 'Seller not found');
    if (b && (c === 'invite-key' || c === 'recovery-key') && !d && method === 'POST') {
      const key = await store.auth.createKey(
        { role: 'seller', sellerId: b },
        c === 'invite-key' ? 'invite' : 'recovery',
      );
      return Response.json(key, { status: 201 });
    }
    if (b && target && c === 'chefs') {
      const sellerStore = target;
      if (!d && method === 'GET') {
        return Response.json(chefAccess(store, sellerStore));
      }
      const chefId = d;
      if (chefId && e === 'sign-out-all' && method === 'POST') {
        if (!sellerStore.listChefs().some((chef) => chef.id === chefId)) {
          return error('unknown_chef', 'Unknown chef');
        }
        store.auth.signOutChef(b, chefId);
        return Response.json({ ok: true } satisfies OkResponse);
      }
    }
    if (b && c === 'devices') {
      if (!d && method === 'GET') {
        return Response.json({ devices: store.auth.devicesOfSeller(b) } satisfies DevicesResponse);
      }
      if (d && method === 'DELETE') {
        return store.auth.revokeSellerDevice(b, d)
          ? Response.json({ ok: true } satisfies OkResponse)
          : error('not_found', 'Device not found');
      }
    }
  }
  return null;
}
