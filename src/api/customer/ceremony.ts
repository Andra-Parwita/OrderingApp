// Plan 087: the passkey prompts of Remember me, with the PRF extension asked for. The PRF output
// (the secret the sealing key comes from) stays in this phone: it is returned to the caller as bytes
// and REMOVED from the answer before that answer can be sent anywhere (stripPrf).
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { stripPrf } from '../../../shared/customerContract';
import { isRecord } from '../../../shared/parse';
import { reportPasskeyError } from '../clientLog';
import { prfSalt, toB64Url } from './crypto';

export type CeremonyFailure = 'cancelled' | 'failed' | 'exists';
export type CeremonyResult =
  | { ok: true; response: Record<string, unknown> & { id: string }; prf: Uint8Array | null }
  | { ok: false; error: CeremonyFailure };

/** The PRF part of the browser's extension results, as the browser gives it (raw buffers). */
function prfOf(answer: object): { enabled: boolean; first: Uint8Array | null } {
  const results = (answer as Record<string, unknown>)['clientExtensionResults'];
  const prf = isRecord(results) ? results['prf'] : undefined;
  if (!isRecord(prf)) return { enabled: false, first: null };
  const inner = prf['results'];
  const first = isRecord(inner) ? inner['first'] : undefined;
  let bytes: Uint8Array | null = null;
  if (first instanceof ArrayBuffer) bytes = new Uint8Array(first);
  else if (ArrayBuffer.isView(first)) {
    bytes = new Uint8Array(
      first.buffer.slice(first.byteOffset, first.byteOffset + first.byteLength),
    );
  }
  return { enabled: prf['enabled'] === true || bytes !== null, first: bytes };
}

async function withPrf<T extends object>(options: T): Promise<T> {
  const first = await prfSalt();
  const { extensions } = options as { extensions?: object };
  return { ...options, extensions: { ...extensions, prf: { eval: { first } } } };
}

function failure(cause: unknown): CeremonyResult {
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'NotAllowedError' || name === 'AbortError') return { ok: false, error: 'cancelled' };
  if (name === 'InvalidStateError') return { ok: false, error: 'exists' };
  reportPasskeyError(name, cause instanceof Error ? cause.message : '');
  return { ok: false, error: 'failed' };
}

function done(answer: object, prf: Uint8Array | null): CeremonyResult {
  const response = stripPrf(answer as Record<string, unknown>) as Record<string, unknown> & {
    id: string;
  };
  return { ok: true, response, prf };
}

/** One extra prompt that only asks the passkey for its PRF value (create did not return it). */
async function readPrf(credentialId: string): Promise<Uint8Array | null> {
  const options = await withPrf({
    challenge: toB64Url(crypto.getRandomValues(new Uint8Array(32))),
    rpId: location.hostname,
    allowCredentials: [{ id: credentialId, type: 'public-key' as const }],
    userVerification: 'required' as const,
  });
  try {
    const got = await startAuthentication({
      optionsJSON: options,
    });
    return prfOf(got).first;
  } catch {
    return null;
  }
}

/** Makes a passkey. Safari and others answer "enabled" without a value: then one more prompt. */
export async function createPasskey(
  optionsJSON: PublicKeyCredentialCreationOptionsJSON,
): Promise<CeremonyResult> {
  try {
    const made = await startRegistration({ optionsJSON: await withPrf(optionsJSON) });
    const found = prfOf(made);
    const prf = found.first ?? (found.enabled ? await readPrf(made.id) : null);
    return done(made, prf);
  } catch (cause) {
    return failure(cause);
  }
}

/** Signs in with a passkey and asks it for the PRF value in the same prompt. */
export async function signInCeremony(
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
): Promise<CeremonyResult> {
  try {
    const got = await startAuthentication({ optionsJSON: await withPrf(optionsJSON) });
    return done(got, prfOf(got).first);
  } catch (cause) {
    return failure(cause);
  }
}
