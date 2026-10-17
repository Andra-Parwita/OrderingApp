// WebAuthn passkeys (stage 8.2, D-011, D-014): the checks around @simplewebauthn/server. Storage
// (challenges, public keys, counters, the lockout) is the AuthRepository's job; this file makes the
// options, reads the challenge back out of the browser's answer and does the cryptographic checks.
//
// Relying party: the ID is the request's hostname (`localhost` in dev) and the expected origin is
// the request's own origin (https). Passkeys are tied to a domain name, so an IP-address host
// (such as the home Wi-Fi address used to try the app on a phone) cannot use them at all (D-046):
// `relyingParty` answers null there, the routes refuse with a plain message, and the sign-in
// screens hide the passkey button and offer the password.
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { APP_NAME } from '../../shared/appName';
import { passkeysAvailable, RP_NAME, type Me } from '../../shared/authContract';
import { REMEMBER_ME_LABEL } from '../../shared/customerContract';
import { fromHex, sha256Hex } from '../db/crypto';
import type {
  AuthRepository,
  AuthResult,
  Caller,
  CustomerCaller,
  CustomerChallengeBinding,
  CustomerGrant,
  CustomerRepository,
  SessionGrant,
  StoredPasskey,
} from '../repo/Repository';

export type RelyingParty = { id: string; origin: string };

/** This site as WebAuthn sees it; null on a host that cannot hold passkeys (an IP address). */
export function relyingParty(request: Request): RelyingParty | null {
  const url = new URL(request.url);
  return passkeysAvailable(url.hostname) ? { id: url.hostname, origin: url.origin } : null;
}

/** The challenge inside a browser answer (clientDataJSON), or null when it cannot be read. */
function challengeOf(response: Record<string, unknown>): string | null {
  try {
    const inner = response.response as { clientDataJSON?: unknown } | undefined;
    if (typeof inner?.clientDataJSON !== 'string') return null;
    const data = JSON.parse(isoBase64URL.toUTF8String(inner.clientDataJSON)) as {
      challenge?: unknown;
    };
    return typeof data.challenge === 'string' && data.challenge !== '' ? data.challenge : null;
  } catch {
    return null;
  }
}

/** A stable, opaque user handle per account (the account id itself is not handed to the browser). */
async function userHandle(accountId: string): Promise<Uint8Array<ArrayBuffer>> {
  return fromHex(await sha256Hex(`user-handle:${accountId}`)) as Uint8Array<ArrayBuffer>;
}

function labelOf(me: Me): string {
  if (me.role === 'admin') return `${APP_NAME} admin`;
  // One passkey per person across kitchens (plan 033): the name, not the kitchen.
  return me.displayName ?? me.sellerName ?? APP_NAME;
}

// ---- Registration ----

/** Options for `startRegistration`; the challenge is kept for this setup session. */
export async function registrationOptions(
  auth: AuthRepository,
  rp: RelyingParty,
  token: string,
  caller: Caller,
): Promise<Record<string, unknown>> {
  const label = labelOf(await auth.me(caller));
  const existing = await auth.passkeysOfAccount(caller.accountId);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.id,
    userName: label,
    userDisplayName: label,
    userID: await userHandle(caller.accountId),
    attestationType: 'none',
    excludeCredentials: existing.map((item) => ({
      id: item.credentialId,
      transports: item.transports,
    })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await auth.saveChallenge(options.challenge, { purpose: 'register', sessionToken: token });
  return options as unknown as Record<string, unknown>;
}

/** The passkey to store, or null when the answer is not valid for this session and site. */
export async function checkRegistration(
  auth: AuthRepository,
  rp: RelyingParty,
  token: string,
  response: Record<string, unknown>,
): Promise<StoredPasskey | null> {
  const challenge = challengeOf(response);
  if (!challenge) return null;
  // Single use: the challenge is gone after this call, whatever the outcome.
  if (!(await auth.takeChallenge(challenge, { purpose: 'register', sessionToken: token }))) {
    return null;
  }
  try {
    const checked = await verifyRegistrationResponse({
      response: response as unknown as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: false,
    });
    if (!checked.verified) return null;
    const { credential } = checked.registrationInfo;
    const sent = (response as { response?: { transports?: unknown } }).response?.transports;
    return {
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports:
        credential.transports ??
        (Array.isArray(sent)
          ? sent.filter((item): item is string => typeof item === 'string')
          : []),
    };
  } catch {
    return null;
  }
}

// ---- Authentication ----

/**
 * Options for `startAuthentication`. With a credential id (the one this browser kept) only that
 * passkey is offered; an unknown id gets the same kind of options, so nothing says whether it
 * exists. Without one the browser lists the passkeys it holds for this site.
 */
export async function authenticationOptions(
  auth: AuthRepository,
  rp: RelyingParty,
  clientDeviceId: string,
  credentialId?: string,
): Promise<Record<string, unknown>> {
  const known = credentialId ? await auth.passkeyById(credentialId) : undefined;
  const options = await generateAuthenticationOptions({
    rpID: rp.id,
    userVerification: 'preferred',
    ...(credentialId
      ? {
          allowCredentials: [
            { id: credentialId, ...(known ? { transports: known.transports } : {}) },
          ],
        }
      : {}),
  });
  await auth.saveChallenge(options.challenge, { purpose: 'authenticate', clientDeviceId });
  return options as unknown as Record<string, unknown>;
}

/**
 * Signs in with a passkey answer. Wrong challenge, wrong site, a bad signature, a replayed answer
 * or a counter that did not go up: one `invalid_credentials`, counted toward the lockout.
 */
export function signInWithPasskey(
  auth: AuthRepository,
  rp: RelyingParty,
  clientDeviceId: string,
  response: Record<string, unknown> & { id: string },
  slug?: string,
): Promise<AuthResult<SessionGrant>> {
  return auth.signInPasskey(
    clientDeviceId,
    response.id,
    async (passkey) => {
      const challenge = challengeOf(response);
      if (!challenge) return null;
      if (!(await auth.takeChallenge(challenge, { purpose: 'authenticate', clientDeviceId }))) {
        return null;
      }
      try {
        const checked = await verifyAuthenticationResponse({
          response: response as unknown as AuthenticationResponseJSON,
          expectedChallenge: challenge,
          expectedOrigin: rp.origin,
          expectedRPID: rp.id,
          credential: {
            id: passkey.credentialId,
            publicKey: isoBase64URL.toBuffer(passkey.publicKey),
            counter: passkey.counter,
            transports: passkey.transports,
          },
          requireUserVerification: false,
        });
        // The library already refuses a counter that did not go up (when either side is non-zero).
        return checked.verified ? checked.authenticationInfo.newCounter : null;
      } catch {
        return null;
      }
    },
    slug,
  );
}

// ---- Customers (plan 087, "Remember me") ----
// The same checks for the customers' own passkeys, challenges and sessions. Separate user handle
// ("customer-handle:"), separate tables, separate cookie: a customer passkey never signs in a seller.

/** Opaque per account, not the account id itself. */
async function customerHandle(accountId: string): Promise<Uint8Array<ArrayBuffer>> {
  return fromHex(await sha256Hex(`customer-handle:${accountId}`)) as Uint8Array<ArrayBuffer>;
}

/** "<first name> · Remember me": what the phone's passkey list shows (never "account"). */
function customerLabel(firstName: string): string {
  return firstName === '' ? REMEMBER_ME_LABEL : `${firstName} · ${REMEMBER_ME_LABEL}`;
}

/** Options to make the customer's first passkey. The new account id rides in the challenge row. */
export async function customerRegistrationOptions(
  customers: CustomerRepository,
  rp: RelyingParty,
  clientDeviceId: string,
  firstName: string,
): Promise<Record<string, unknown>> {
  const accountId = customers.newAccountId();
  const label = customerLabel(firstName);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.id,
    userName: label,
    userDisplayName: label,
    userID: await customerHandle(accountId),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await customers.saveChallenge(
    options.challenge,
    { purpose: 'register', clientDeviceId },
    { accountId, firstName },
  );
  return options as unknown as Record<string, unknown>;
}

/** Options to add a passkey to a signed-in (or just joined) customer. */
export async function customerAddOptions(
  customers: CustomerRepository,
  rp: RelyingParty,
  caller: CustomerCaller,
  firstName: string,
): Promise<Record<string, unknown>> {
  const label = customerLabel(firstName);
  const existing = await customers.passkeysOfAccount(caller.accountId);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.id,
    userName: label,
    userDisplayName: label,
    userID: await customerHandle(caller.accountId),
    attestationType: 'none',
    excludeCredentials: existing.map((item) => ({
      id: item.credentialId,
      transports: item.transports,
    })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await customers.saveChallenge(options.challenge, { purpose: 'add', sessionToken: caller.token });
  return options as unknown as Record<string, unknown>;
}

/**
 * The new passkey (and, for a first registration, the account id and name kept with the challenge),
 * or null when the answer is not valid for this binding and site. The challenge is single use.
 */
export async function checkCustomerRegistration(
  customers: CustomerRepository,
  rp: RelyingParty,
  binding: CustomerChallengeBinding,
  response: Record<string, unknown>,
): Promise<{ passkey: StoredPasskey; accountId: string | null; firstName: string } | null> {
  const challenge = challengeOf(response);
  if (!challenge) return null;
  const taken = await customers.takeChallenge(challenge, binding);
  if (!taken) return null;
  try {
    const checked = await verifyRegistrationResponse({
      response: response as unknown as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: false,
    });
    if (!checked.verified) return null;
    const { credential } = checked.registrationInfo;
    const sent = (response as { response?: { transports?: unknown } }).response?.transports;
    return {
      accountId: taken.accountId,
      firstName: taken.firstName,
      passkey: {
        credentialId: credential.id,
        publicKey: isoBase64URL.fromBuffer(credential.publicKey),
        counter: credential.counter,
        transports:
          credential.transports ??
          (Array.isArray(sent)
            ? sent.filter((item): item is string => typeof item === 'string')
            : []),
      },
    };
  } catch {
    return null;
  }
}

/** Options for a customer sign-in; an unknown credential id gets the same kind of options. */
export async function customerAuthenticationOptions(
  customers: CustomerRepository,
  rp: RelyingParty,
  clientDeviceId: string,
  credentialId?: string,
): Promise<Record<string, unknown>> {
  const known = credentialId ? await customers.passkeyById(credentialId) : undefined;
  const options = await generateAuthenticationOptions({
    rpID: rp.id,
    userVerification: 'preferred',
    ...(credentialId
      ? {
          allowCredentials: [
            { id: credentialId, ...(known ? { transports: known.transports } : {}) },
          ],
        }
      : {}),
  });
  await customers.saveChallenge(options.challenge, { purpose: 'authenticate', clientDeviceId });
  return options as unknown as Record<string, unknown>;
}

/** A customer passkey sign-in: wrong challenge, site, signature or counter is one invalid_credentials. */
export function customerSignInWithPasskey(
  customers: CustomerRepository,
  rp: RelyingParty,
  clientDeviceId: string,
  response: Record<string, unknown> & { id: string },
): Promise<AuthResult<CustomerGrant>> {
  return customers.signInPasskey(clientDeviceId, response.id, async (passkey) => {
    const challenge = challengeOf(response);
    if (!challenge) return null;
    if (!(await customers.takeChallenge(challenge, { purpose: 'authenticate', clientDeviceId }))) {
      return null;
    }
    try {
      const checked = await verifyAuthenticationResponse({
        response: response as unknown as AuthenticationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: rp.origin,
        expectedRPID: rp.id,
        credential: {
          id: passkey.credentialId,
          publicKey: isoBase64URL.toBuffer(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: false,
      });
      return checked.verified ? checked.authenticationInfo.newCounter : null;
    } catch {
      return null;
    }
  });
}
