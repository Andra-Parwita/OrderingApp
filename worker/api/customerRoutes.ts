// Routes for /api/customer/* (plan 087, "Remember me"): the customer's optional passkey, kept apart
// from the sellers' sign-in. A customer session lives in its own cookie (`__Host-customer`) and its
// own tables; nothing under /api/seller, /api/admin or the seller live socket ever reads it.
// The server never sees a key: the sealed address is ciphertext, and a passkey's PRF output is
// stripped by the parsers (shared/customerContract.ts) before anything is stored or logged.
import {
  AUTH_RATE_MAX,
  AUTH_RATE_WINDOW_SECONDS,
  parsePasskeyOptionsRequest,
  type PasskeyOptionsResponse,
} from '../../shared/authContract';
import {
  parseCustomerAddPasskeyRequest,
  parseCustomerJoinRequest,
  parseCustomerOrdersRequest,
  parseCustomerPatchRequest,
  parseCustomerRegisterOptionsRequest,
  parseCustomerRegisterRequest,
  parseCustomerSignInRequest,
  parseSealedAddress,
  type CustomerMeResponse,
  type CustomerOrdersResponse,
  type CustomerSealedResponse,
  type PhoneCodeResponse,
} from '../../shared/customerContract';
import type { OkResponse } from '../../shared/setupContract';
import { clearedCustomerCookie, customerCookie, customerTokenOf } from '../auth/customerCookie';
import { withCookie } from '../auth/cookie';
import {
  checkCustomerRegistration,
  customerAddOptions,
  customerAuthenticationOptions,
  customerRegistrationOptions,
  customerSignInWithPasskey,
  relyingParty,
  type RelyingParty,
} from '../auth/webauthn';
import type { AuthResult, CustomerCaller, CustomerGrant, Repository } from '../repo/Repository';
import { authError, error, readJson } from './respond';

const bad = () => error('invalid_request', 'Invalid request');

/** The request limiter on customer sign-in calls: per browser id, 30 a minute (like the sellers'). */
async function limited(store: Repository, deviceId: string): Promise<Response | null> {
  const wait = await store.auth.rateLimit(
    `crate:${deviceId}`,
    AUTH_RATE_MAX,
    AUTH_RATE_WINDOW_SECONDS,
  );
  return wait > 0
    ? error('locked_out', 'Too many requests. Try again in a moment.', { retryAfterSeconds: wait })
    : null;
}

/** Passkeys need a web address; the home Wi-Fi IP address of a phone test has none (D-046). */
function rpOrRefusal(request: Request): RelyingParty | Response {
  return (
    relyingParty(request) ??
    error('invalid_request', 'Passkeys need a web address, not an IP address.')
  );
}

/** A salted daily hash of the network address for the per-network code limit; never the address. */
async function networkHash(store: Repository, request: Request): Promise<string | undefined> {
  const ip = request.headers.get('CF-Connecting-IP');
  return ip ? (await store.auth.ipKey(`customer:${ip}`)).slice(0, 24) : undefined;
}

const OTHER_KIND = () =>
  error(
    'passkey_other_kind',
    'That passkey is for kitchen sign-in, not for Remember me. Choose your Remember me passkey.',
  );

/** A signed-in customer (a full session unless `allowSetup`), or the response to send instead. */
async function requireCustomer(
  store: Repository,
  request: Request,
  allowSetup = false,
): Promise<{ caller: CustomerCaller } | { response: Response }> {
  const token = customerTokenOf(request);
  const caller = await store.customers.resolve(token);
  if (!caller || (caller.setup && !allowSetup)) {
    const refusal = error('unauthorized', 'Sign in first');
    // A cookie the server no longer knows is cleared.
    return { response: token && !caller ? withCookie(refusal, clearedCustomerCookie()) : refusal };
  }
  return { caller };
}

/** The signed-in answer: the cookie goes in the header and never in the body. */
async function meResponse(
  store: Repository,
  grant: CustomerGrant,
  accountId: string,
  credentialId: string | null,
  status = 200,
): Promise<Response> {
  const caller: CustomerCaller = {
    token: grant.token,
    accountId,
    credentialId,
    setup: grant.setup,
  };
  const me = await store.customers.me(caller);
  return withCookie(
    Response.json({ me } satisfies CustomerMeResponse, { status }),
    customerCookie(grant.token, grant.setup),
  );
}

/** The account behind a freshly issued token (the repository answers a grant, not the account). */
async function sessionOf(store: Repository, grant: CustomerGrant): Promise<CustomerCaller> {
  return (await store.customers.resolve(grant.token)) as CustomerCaller;
}

async function grantResponse(
  store: Repository,
  outcome: AuthResult<CustomerGrant>,
  status = 200,
): Promise<Response> {
  if (!outcome.ok) return authError(outcome);
  const caller = await sessionOf(store, outcome.value);
  return meResponse(store, outcome.value, caller.accountId, caller.credentialId, status);
}

/** Everything under /api/customer/*. */
export async function handleCustomer(
  store: Repository,
  request: Request,
  [a, b]: [string | undefined, string | undefined],
  searchParams: URLSearchParams,
): Promise<Response | null> {
  const method = request.method;
  const customers = store.customers;

  // ---- Turn it on: a new passkey, a new account ----
  if (method === 'POST' && a === 'register' && b === 'options') {
    const input = parseCustomerRegisterOptionsRequest(await readJson(request));
    if (!input) return bad();
    const slowDown = await limited(store, input.deviceId);
    if (slowDown) return slowDown;
    const rp = rpOrRefusal(request);
    if (rp instanceof Response) return rp;
    const options = await customerRegistrationOptions(
      customers,
      rp,
      input.deviceId,
      input.firstName ?? '',
    );
    return Response.json({ options } satisfies PasskeyOptionsResponse);
  }
  if (method === 'POST' && a === 'register' && !b) {
    const input = parseCustomerRegisterRequest(await readJson(request));
    if (!input) return bad();
    const slowDown = await limited(store, input.deviceId);
    if (slowDown) return slowDown;
    const rp = rpOrRefusal(request);
    if (rp instanceof Response) return rp;
    const checked = await checkCustomerRegistration(
      customers,
      rp,
      { purpose: 'register', clientDeviceId: input.deviceId },
      input.response,
    );
    if (!checked?.accountId)
      return error('invalid_request', 'The passkey could not be checked. Try again.');
    // Only order links that exist are kept; the kitchen comes from the order, not from the phone.
    const found = await store.lookupByTokens(input.tokens);
    const links = [...found].map(([token, hit]) => ({ token, sellerId: hit.sellerRepo.seller.id }));
    const adopt: Array<{ sellerId: string; slug: string; code: string; token: string }> = [];
    for (const item of input.adopt) {
      const seller = await store.sellerBySlug(item.slug);
      if (seller) adopt.push({ ...item, sellerId: seller.seller.id });
    }
    const outcome = await customers.register({
      accountId: checked.accountId,
      firstName: input.firstName ?? checked.firstName,
      passkey: checked.passkey,
      prf: input.prf,
      links,
      adopt,
    });
    if (!outcome.ok) return authError(outcome);
    return meResponse(store, outcome.value, checked.accountId, checked.passkey.credentialId, 201);
  }

  // ---- Sign in on a phone that has the passkey ----
  if (method === 'POST' && a === 'passkey' && b === 'options') {
    const input = parsePasskeyOptionsRequest(await readJson(request));
    if (!input) return bad();
    const slowDown = await limited(store, input.deviceId);
    if (slowDown) return slowDown;
    const rp = rpOrRefusal(request);
    if (rp instanceof Response) return rp;
    if (
      input.credentialId &&
      !(await customers.hasPasskey(input.credentialId)) &&
      (await store.auth.passkeyById(input.credentialId))
    ) {
      return OTHER_KIND();
    }
    const options = await customerAuthenticationOptions(
      customers,
      rp,
      input.deviceId,
      input.credentialId,
    );
    return Response.json({ options } satisfies PasskeyOptionsResponse);
  }
  if (method === 'POST' && a === 'passkey' && !b) {
    const input = parseCustomerSignInRequest(await readJson(request));
    if (!input) return bad();
    const slowDown = await limited(store, input.deviceId);
    if (slowDown) return slowDown;
    const rp = rpOrRefusal(request);
    if (rp instanceof Response) return rp;
    // A kitchen passkey offered here: a plain refusal, not a counted wrong try.
    if (
      !(await customers.hasPasskey(input.response.id)) &&
      (await store.auth.passkeyById(input.response.id))
    ) {
      return OTHER_KIND();
    }
    return grantResponse(
      store,
      await customerSignInWithPasskey(customers, rp, input.deviceId, input.response),
    );
  }

  // ---- A new phone joins with a 6-digit code from a signed-in phone, then adds its own passkey ----
  if (method === 'POST' && a === 'phone-codes' && !b) {
    const session = await requireCustomer(store, request);
    if ('response' in session) return session.response;
    const slowDown = await limited(store, session.caller.accountId);
    if (slowDown) return slowDown;
    const made: PhoneCodeResponse = await customers.createPhoneCode(session.caller);
    return Response.json(made, { status: 201 });
  }
  if (method === 'POST' && a === 'code' && !b) {
    const input = parseCustomerJoinRequest(await readJson(request));
    if (!input) return bad();
    const slowDown = await limited(store, input.deviceId);
    if (slowDown) return slowDown;
    const outcome = await customers.joinWithCode(
      input.deviceId,
      await networkHash(store, request),
      input.code,
    );
    return grantResponse(store, outcome);
  }
  if (method === 'POST' && a === 'passkeys' && b === 'options') {
    const session = await requireCustomer(store, request, true);
    if ('response' in session) return session.response;
    const rp = rpOrRefusal(request);
    if (rp instanceof Response) return rp;
    const slowDown = await limited(store, session.caller.accountId);
    if (slowDown) return slowDown;
    const me = await customers.me(session.caller);
    const options = await customerAddOptions(customers, rp, session.caller, me.firstName);
    return Response.json({ options } satisfies PasskeyOptionsResponse);
  }
  if (method === 'POST' && a === 'passkeys' && !b) {
    const session = await requireCustomer(store, request, true);
    if ('response' in session) return session.response;
    const input = parseCustomerAddPasskeyRequest(await readJson(request));
    if (!input) return bad();
    const slowDown = await limited(store, session.caller.accountId);
    if (slowDown) return slowDown;
    const rp = rpOrRefusal(request);
    if (rp instanceof Response) return rp;
    const checked = await checkCustomerRegistration(
      customers,
      rp,
      { purpose: 'add', sessionToken: session.caller.token },
      input.response,
    );
    if (!checked) return error('invalid_request', 'The passkey could not be checked. Try again.');
    const outcome = await customers.addPasskey(session.caller, checked.passkey, input.prf);
    if (!outcome.ok) return authError(outcome);
    return meResponse(store, outcome.value, session.caller.accountId, checked.passkey.credentialId);
  }

  if (method === 'POST' && a === 'sign-out' && !b) {
    const token = customerTokenOf(request);
    if (token) await customers.signOut(token);
    return withCookie(Response.json({ ok: true } satisfies OkResponse), clearedCustomerCookie());
  }

  // ---- Me: name, passkey state, the kitchen's stable code; delete everything ----
  if (a === 'me' && !b) {
    if (method === 'GET') {
      const session = await requireCustomer(store, request, true);
      if ('response' in session) return session.response;
      const slug = searchParams.get('slug');
      const seller = slug ? await store.sellerBySlug(slug) : undefined;
      const me = await customers.me(session.caller, seller?.seller.id);
      // The server renewed a full session, so the cookie is renewed too.
      return withCookie(
        Response.json({ me } satisfies CustomerMeResponse),
        customerCookie(session.caller.token, session.caller.setup),
      );
    }
    if (method === 'PATCH') {
      const session = await requireCustomer(store, request);
      if ('response' in session) return session.response;
      const input = parseCustomerPatchRequest(await readJson(request));
      if (!input) return bad();
      await customers.setFirstName(session.caller, input.firstName);
      return Response.json({
        me: await customers.me(session.caller),
      } satisfies CustomerMeResponse);
    }
    if (method === 'DELETE') {
      const session = await requireCustomer(store, request);
      if ('response' in session) return session.response;
      await customers.deleteAccount(session.caller.accountId);
      return withCookie(Response.json({ ok: true } satisfies OkResponse), clearedCustomerCookie());
    }
  }

  // ---- My orders: the list of links, merged from the phone ----
  if (a === 'orders' && !b) {
    const session = await requireCustomer(store, request);
    if ('response' in session) return session.response;
    if (method === 'GET') {
      return Response.json({
        orders: await customers.orders(session.caller),
      } satisfies CustomerOrdersResponse);
    }
    if (method === 'POST') {
      const input = parseCustomerOrdersRequest(await readJson(request));
      if (!input) return bad();
      const found = await store.lookupByTokens(input.tokens);
      await customers.linkOrders(
        session.caller,
        [...found].map(([token, hit]) => ({ token, sellerId: hit.sellerRepo.seller.id })),
      );
      return Response.json({
        orders: await customers.orders(session.caller),
      } satisfies CustomerOrdersResponse);
    }
  }

  // ---- The sealed address (ciphertext only) ----
  if (a === 'address' && !b) {
    const session = await requireCustomer(store, request);
    if ('response' in session) return session.response;
    const { caller } = session;
    if (method === 'GET') {
      return Response.json({
        sealed: await customers.sealedAddress(caller),
      } satisfies CustomerSealedResponse);
    }
    if (method === 'PUT') {
      const sealed = parseSealedAddress(await readJson(request));
      if (!sealed) return bad();
      if (!(await customers.putSealedAddress(caller, sealed))) {
        return error(
          'no_recent_order',
          'The address can be saved within 30 days of an order. Order first.',
        );
      }
      return Response.json({ sealed } satisfies CustomerSealedResponse);
    }
    if (method === 'DELETE') {
      await customers.deleteSealedAddress(caller);
      return Response.json({ sealed: null } satisfies CustomerSealedResponse);
    }
  }
  return null;
}
