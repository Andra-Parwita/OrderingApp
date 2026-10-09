// Routes for /api/auth/* and /api/admin/* (stage 7.1; real passkeys, cookie sessions and request
// limits in 8.2). The routes only use the Repository.
import {
  AUTH_RATE_MAX,
  AUTH_RATE_WINDOW_SECONDS,
  parseAdminSetupRequest,
  parseCodeSignInRequest,
  parseCreateSellerRequest,
  parseKeySignInRequest,
  parsePasskeyOptionsRequest,
  parsePasskeySignInRequest,
  parsePasswordSignInRequest,
  parseRegisterRequest,
  parseRenameDeviceRequest,
  type ChefAccessResponse,
  type DevicesResponse,
  type MeResponse,
  type PasskeyOptionsResponse,
  type SellerResponse,
  type SellersResponse,
  type SessionResponse,
} from '../../shared/authContract';
import { isValidSlug } from '../../shared/seller';
import type { OkResponse } from '../../shared/setupContract';
import { clearedSessionCookie, sessionCookie, sessionTokenOf, withCookie } from '../auth/cookie';
import {
  authenticationOptions,
  checkRegistration,
  registrationOptions,
  relyingParty,
  signInWithPasskey,
  type RelyingParty,
} from '../auth/webauthn';
import type {
  AuthResult,
  Caller,
  Repository,
  SellerRepository,
  SessionGrant,
} from '../repo/Repository';
import { authError, error, readJson } from './respond';

const bad = () => error('invalid_request', 'Invalid request');

/**
 * A new session: the token goes into the HttpOnly cookie and never into the body, so a script on
 * the page cannot read it.
 */
function sessionResult(outcome: AuthResult<SessionGrant>, status = 200): Response {
  if (!outcome.ok) return authError(outcome);
  const { token, ...body } = outcome.value;
  return withCookie(
    Response.json(body satisfies SessionResponse, { status }),
    sessionCookie(token, body.me.stage),
  );
}

/** The signed-in caller: a full session, or a response to send instead. */
export async function requireSession(
  store: Repository,
  request: Request,
): Promise<{ caller: Caller } | { response: Response }> {
  const caller = await store.auth.resolve(sessionTokenOf(request));
  if (!caller || caller.setup) return { response: error('unauthorized', 'Sign in first') };
  return { caller };
}

/**
 * The request limiter on sign-in calls: per browser id (no IP is kept, D-007), 30 a minute. The
 * lockout after 5 wrong tries is separate and lives in the repository.
 */
async function limited(store: Repository, deviceId: string): Promise<Response | null> {
  const wait = await store.auth.rateLimit(
    `rate:${deviceId}`,
    AUTH_RATE_MAX,
    AUTH_RATE_WINDOW_SECONDS,
  );
  return wait > 0
    ? error('locked_out', 'Too many requests. Try again in a moment.', { retryAfterSeconds: wait })
    : null;
}

/** Passkeys need a web address; the home Wi-Fi IP address of a phone test has none (D-046). */
const noPasskeyHere = () =>
  error('invalid_request', 'Passkeys need a web address, not an IP address. Use the password.');

/** The relying party, or the plain refusal to send. */
function rpOrRefusal(request: Request): RelyingParty | Response {
  return relyingParty(request) ?? noPasskeyHere();
}

/** Everything under /api/auth/*. */
export async function handleAuth(
  store: Repository,
  request: Request,
  [a, b]: [string | undefined, string | undefined],
): Promise<Response | null> {
  const method = request.method;
  const auth = store.auth;

  // Passkey options: one for registering (setup session), one for signing in (any browser).
  if (method === 'POST' && a === 'register' && b === 'options') {
    const token = sessionTokenOf(request);
    const caller = await auth.resolve(token);
    if (!token || !caller?.setup) return error('unauthorized', 'Sign in first');
    const rp = rpOrRefusal(request);
    if (rp instanceof Response) return rp;
    const options = await registrationOptions(auth, rp, token, caller);
    return Response.json({ options } satisfies PasskeyOptionsResponse);
  }
  if (method === 'POST' && a === 'passkey' && b === 'options') {
    const input = parsePasskeyOptionsRequest(await readJson(request));
    if (!input) return bad();
    const slowDown = await limited(store, input.deviceId);
    if (slowDown) return slowDown;
    const rp = rpOrRefusal(request);
    if (rp instanceof Response) return rp;
    const options = await authenticationOptions(auth, rp, input.deviceId, input.credentialId);
    return Response.json({ options } satisfies PasskeyOptionsResponse);
  }

  if (method === 'POST' && !b) {
    const body = await readJson(request);
    if (a === 'invite') {
      const input = parseKeySignInRequest(body);
      if (!input) return bad();
      return (
        (await limited(store, input.deviceId)) ??
        sessionResult(await auth.redeemKey(input.key, input.deviceId))
      );
    }
    if (a === 'code') {
      const input = parseCodeSignInRequest(body);
      if (!input) return bad();
      return (
        (await limited(store, input.deviceId)) ??
        sessionResult(await auth.redeemCode(input.code, input.deviceId))
      );
    }
    if (a === 'password') {
      const input = parsePasswordSignInRequest(body);
      if (!input) return bad();
      return (
        (await limited(store, input.deviceId)) ?? sessionResult(await auth.signInPassword(input))
      );
    }
    if (a === 'passkey') {
      const input = parsePasskeySignInRequest(body);
      if (!input) return bad();
      const slowDown = await limited(store, input.deviceId);
      if (slowDown) return slowDown;
      const rp = rpOrRefusal(request);
      if (rp instanceof Response) return rp;
      return sessionResult(await signInWithPasskey(auth, rp, input.deviceId, input.response));
    }
    if (a === 'register') {
      const input = parseRegisterRequest(body);
      if (!input) return bad();
      const token = sessionTokenOf(request) ?? '';
      if (input.kind === 'password') {
        return sessionResult(await auth.register(token, input), 201);
      }
      const caller = await auth.resolve(token);
      if (!caller?.setup) return error('unauthorized', 'Sign in first');
      const rp = rpOrRefusal(request);
      if (rp instanceof Response) return rp;
      const passkey = await checkRegistration(auth, rp, token, input.response);
      if (!passkey) return error('invalid_request', 'The passkey could not be checked. Try again.');
      return sessionResult(
        await auth.register(token, { kind: 'passkey', deviceName: input.deviceName, passkey }),
        201,
      );
    }
    if (a === 'sign-out') {
      const token = sessionTokenOf(request);
      if (token) await auth.signOut(token);
      return withCookie(Response.json({ ok: true } satisfies OkResponse), clearedSessionCookie());
    }
    if (a === 'device-codes') {
      const session = await requireSession(store, request);
      return 'response' in session
        ? session.response
        : Response.json(await auth.createCode(session.caller), { status: 201 });
    }
    return null;
  }

  if (a === 'me' && !b && method === 'GET') {
    const token = sessionTokenOf(request);
    const caller = await auth.resolve(token);
    if (!caller || !token) {
      // A cookie the server no longer knows (expired, signed out elsewhere) is cleared.
      const refusal = error('unauthorized', 'Sign in first');
      return token ? withCookie(refusal, clearedSessionCookie()) : refusal;
    }
    const me = await auth.me(caller);
    const answer = Response.json({ me } satisfies MeResponse);
    // A full session slides: the server renewed it, so the cookie is renewed too.
    return caller.setup ? answer : withCookie(answer, sessionCookie(token, 'full'));
  }

  if (a === 'devices') {
    const session = await requireSession(store, request);
    if ('response' in session) return session.response;
    const { caller } = session;
    if (!b && method === 'GET') {
      return Response.json({ devices: await auth.devicesOf(caller) } satisfies DevicesResponse);
    }
    if (b && method === 'PATCH') {
      const input = parseRenameDeviceRequest(await readJson(request));
      if (!input) return bad();
      return (await auth.renameDevice(caller, b, input.name))
        ? Response.json({ ok: true } satisfies OkResponse)
        : error('not_found', 'Device not found');
    }
    if (b && method === 'DELETE') {
      return (await auth.revokeOwnDevice(caller, b))
        ? Response.json({ ok: true } satisfies OkResponse)
        : error('not_found', 'Device not found');
    }
  }
  return null;
}

/** Each chef of a seller with the number of devices signed in as them (no order data). */
export async function chefAccess(
  store: Repository,
  sellerStore: SellerRepository,
): Promise<ChefAccessResponse> {
  const chefs: ChefAccessResponse['chefs'] = [];
  for (const chef of await sellerStore.listChefs()) {
    const devices = await store.auth.chefDeviceCount(sellerStore.seller.id, chef.id);
    chefs.push({ id: chef.id, name: chef.name, devices });
  }
  return { chefs };
}

/** Everything under /api/admin/*. The admin sees sellers, keys and devices, never order data. */
export async function handleAdmin(
  store: Repository,
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

  // The repository compares the key with the ADMIN_SETUP_KEY secret.
  if (a === 'setup' && !b && method === 'POST') {
    const input = parseAdminSetupRequest(await readJson(request));
    if (!input) return bad();
    return (
      (await limited(store, input.deviceId)) ??
      sessionResult(await store.auth.adminSetup(input.setupKey, input.deviceId))
    );
  }

  const session = await requireSession(store, request);
  if ('response' in session) return session.response;
  if (session.caller.role !== 'admin') return error('forbidden', 'Admins only');

  if (a === 'sellers') {
    if (!b && method === 'GET') {
      return Response.json({ sellers: await store.adminSellers() } satisfies SellersResponse);
    }
    if (!b && method === 'POST') {
      const input = parseCreateSellerRequest(await readJson(request));
      if (!input || !isValidSlug(input.slug)) return bad();
      if (await store.sellerBySlug(input.slug)) {
        return error('slug_taken', 'That link is already taken');
      }
      return Response.json(
        { seller: await store.addSeller(input.name, input.slug) } satisfies SellerResponse,
        {
          status: 201,
        },
      );
    }
    const target = b ? await store.sellerById(b) : undefined;
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
        return Response.json(await chefAccess(store, sellerStore));
      }
      const chefId = d;
      if (chefId && e === 'sign-out-all' && method === 'POST') {
        if (!(await sellerStore.listChefs()).some((chef) => chef.id === chefId)) {
          return error('unknown_chef', 'Unknown chef');
        }
        await store.auth.signOutChef(b, chefId);
        return Response.json({ ok: true } satisfies OkResponse);
      }
    }
    if (b && c === 'devices') {
      if (!d && method === 'GET') {
        return Response.json({
          devices: await store.auth.devicesOfSeller(b),
        } satisfies DevicesResponse);
      }
      if (d && method === 'DELETE') {
        return (await store.auth.revokeSellerDevice(b, d))
          ? Response.json({ ok: true } satisfies OkResponse)
          : error('not_found', 'Device not found');
      }
    }
  }
  return null;
}
