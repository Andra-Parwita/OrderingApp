// Plan 087 ("Remember me"): the optional customer passkey. Request and response shapes of
// /api/customer/*, with the parsers the Worker uses. Nothing here carries an email, a password or a
// phone number; the sealed address is an opaque blob the server cannot read.
import { parseCustomerCode } from './customerCode';
import { FIRST_NAME_MAX } from './limits';
import { isInt, isRecord } from './parse';

export const CUSTOMER_COOKIE = '__Host-customer';
/** My orders kept for one customer; the oldest go first. */
export const CUSTOMER_ORDERS_CAP = 200;
/** Order links sent in one call. */
export const CUSTOMER_TOKENS_MAX = 200;
/** Plan 071 codes adopted in one registration. */
export const CUSTOMER_ADOPT_MAX = 50;
export const CUSTOMER_SESSION_DAYS = 90;
/** A phone that joined by code has this long to add its passkey. */
export const JOIN_SESSION_MINUTES = 30;
export const PHONE_CODE_LENGTH = 6;
export const PHONE_CODE_TTL_MINUTES = 5;
/** Wrong codes per phone (and per network) before a 15-minute lock. */
export const PHONE_CODE_MAX_WRONG = 5;
/** Wrong codes anywhere in 5 minutes that cancel every live code. */
export const PHONE_CODE_BREAKER_WRONG = 50;
export const PHONE_CODE_BREAKER_SECONDS = 300;
/** The sealed address is kept this long after the last confirmed order. */
export const ADDRESS_DAYS = 30;
/** A Remember me unused this long is deleted. */
export const ACCOUNT_IDLE_DAYS = 365;
export const SEALED_CT_MAX = 2048;
export const SEALED_IV_MAX = 64;

/** The words in the passkey's display name (see customerLabel in worker/auth/webauthn.ts). */
export const REMEMBER_ME_LABEL = 'Remember me';

/** An order link token: base64url, as the order link carries it. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;

/** The address blob a phone sealed with its passkey key (AES-GCM). `v` is the format version. */
export type SealedAddress = { v: number; iv: string; ct: string };

export type AdoptItem = { slug: string; code: string; token: string };

export type WebAuthnAnswer = Record<string, unknown> & { id: string };

export type CustomerRegisterOptionsRequest = { deviceId: string; firstName?: string };
export type CustomerRegisterRequest = {
  deviceId: string;
  response: WebAuthnAnswer;
  firstName?: string;
  /** The phone says its passkey can seal (PRF worked). The server never sees the PRF output. */
  prf: boolean;
  tokens: Array<string>;
  adopt: Array<AdoptItem>;
};
export type CustomerAddPasskeyRequest = { response: WebAuthnAnswer; prf: boolean };
export type CustomerSignInRequest = { deviceId: string; response: WebAuthnAnswer };
export type CustomerJoinRequest = { deviceId: string; code: string };
export type CustomerOrdersRequest = { tokens: Array<string> };
export type CustomerPatchRequest = { firstName: string };

export type CustomerMe = {
  firstName: string;
  /** The passkey this session used. Null only while a phone that joined by code has none yet. */
  credentialId: string | null;
  /** This passkey can seal the address (PRF). */
  prf: boolean;
  /** True until a phone that joined by code has added its own passkey. */
  setup: boolean;
  /** This passkey's sealed address, if any. */
  sealed: SealedAddress | null;
  /** With `?slug=`: the stable code for that kitchen (24 lowercase hex, the plan 071 format). */
  customerCode?: string;
  /** The same, as a seller sees it: "C-7K3M". */
  code?: string;
  /** When this Remember me account was made (ISO). Absent from an older server: the card hides the row. */
  createdAt?: string;
};
export type CustomerMeResponse = { me: CustomerMe };
export type CustomerOrdersResponse = { orders: Array<{ token: string; slug: string }> };
export type CustomerSealedResponse = { sealed: SealedAddress | null };
export type PhoneCodeResponse = { code: string; expiresAt: string };

/**
 * The browser's passkey answer without its extension results for PRF. The phone strips them before
 * sending (the key never leaves it); this drops them again so nothing downstream can store or log one.
 */
export function stripPrf(response: Record<string, unknown>): Record<string, unknown> {
  const results = response['clientExtensionResults'];
  if (!isRecord(results) || !('prf' in results)) return response;
  const rest = { ...results };
  delete rest['prf'];
  return { ...response, clientExtensionResults: rest };
}

function deviceIdOf(input: Record<string, unknown>): string | null {
  const { deviceId } = input;
  return typeof deviceId === 'string' && DEVICE_ID.test(deviceId) ? deviceId : null;
}

/** '' when absent; null when present but invalid. */
function firstNameOf(value: unknown): string | null {
  if (value === undefined) return '';
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length <= FIRST_NAME_MAX ? name : null;
}

function responseOf(value: unknown): WebAuthnAnswer | null {
  if (!isRecord(value) || typeof value['id'] !== 'string') return null;
  if (value['id'] === '' || value['id'].length > 1400) return null;
  if (JSON.stringify(value).length > 20_000) return null;
  return stripPrf(value) as WebAuthnAnswer;
}

function tokensOf(value: unknown): Array<string> | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > CUSTOMER_TOKENS_MAX) return null;
  const out = new Set<string>();
  for (const item of value as Array<unknown>) {
    if (typeof item !== 'string' || !TOKEN_RE.test(item)) return null;
    out.add(item);
  }
  return [...out];
}

function adoptOf(value: unknown): Array<AdoptItem> | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > CUSTOMER_ADOPT_MAX) return null;
  const out: Array<AdoptItem> = [];
  for (const item of value as Array<unknown>) {
    if (!isRecord(item)) return null;
    const { slug, token } = item;
    const code = parseCustomerCode(item['code']);
    if (typeof slug !== 'string' || slug === '' || slug.length > 100) return null;
    if (typeof token !== 'string' || !TOKEN_RE.test(token) || code === null) return null;
    out.push({ slug, code, token });
  }
  return out;
}

function prfOf(input: Record<string, unknown>): boolean | null {
  const prf = input['prf'];
  if (prf === undefined) return false;
  return typeof prf === 'boolean' ? prf : null;
}

export function parseCustomerRegisterOptionsRequest(
  input: unknown,
): CustomerRegisterOptionsRequest | null {
  if (!isRecord(input)) return null;
  const deviceId = deviceIdOf(input);
  const firstName = firstNameOf(input['firstName']);
  if (!deviceId || firstName === null) return null;
  return firstName === '' ? { deviceId } : { deviceId, firstName };
}

export function parseCustomerRegisterRequest(input: unknown): CustomerRegisterRequest | null {
  if (!isRecord(input)) return null;
  const deviceId = deviceIdOf(input);
  const response = responseOf(input['response']);
  const firstName = firstNameOf(input['firstName']);
  const tokens = tokensOf(input['tokens']);
  const adopt = adoptOf(input['adopt']);
  const prf = prfOf(input);
  if (!deviceId || !response || firstName === null || !tokens || !adopt || prf === null) {
    return null;
  }
  return {
    deviceId,
    response,
    ...(firstName !== '' ? { firstName } : {}),
    prf,
    tokens,
    adopt,
  };
}

export function parseCustomerAddPasskeyRequest(input: unknown): CustomerAddPasskeyRequest | null {
  if (!isRecord(input)) return null;
  const response = responseOf(input['response']);
  const prf = prfOf(input);
  return response && prf !== null ? { response, prf } : null;
}

/** A sign-in answer: deviceId + the browser's answer, PRF results stripped. */
export function parseCustomerSignInRequest(input: unknown): CustomerSignInRequest | null {
  if (!isRecord(input)) return null;
  const deviceId = deviceIdOf(input);
  const response = responseOf(input['response']);
  return deviceId && response ? { deviceId, response } : null;
}

export function parseCustomerJoinRequest(input: unknown): CustomerJoinRequest | null {
  if (!isRecord(input)) return null;
  const deviceId = deviceIdOf(input);
  const code = input['code'];
  if (!deviceId || typeof code !== 'string') return null;
  const clean = code.replace(/\s/g, '');
  return new RegExp(`^\\d{${String(PHONE_CODE_LENGTH)}}$`).test(clean)
    ? { deviceId, code: clean }
    : null;
}

export function parseCustomerOrdersRequest(input: unknown): CustomerOrdersRequest | null {
  if (!isRecord(input) || input['tokens'] === undefined) return null;
  const tokens = tokensOf(input['tokens']);
  return tokens ? { tokens } : null;
}

export function parseCustomerPatchRequest(input: unknown): CustomerPatchRequest | null {
  if (!isRecord(input) || input['firstName'] === undefined) return null;
  const firstName = firstNameOf(input['firstName']);
  return firstName === null ? null : { firstName };
}

export function parseSealedAddress(input: unknown): SealedAddress | null {
  if (!isRecord(input)) return null;
  const { v, iv, ct } = input;
  if (!isInt(v, 1, 99)) return null;
  if (typeof iv !== 'string' || iv === '' || iv.length > SEALED_IV_MAX || !B64URL_RE.test(iv)) {
    return null;
  }
  if (typeof ct !== 'string' || ct === '' || ct.length > SEALED_CT_MAX || !B64URL_RE.test(ct)) {
    return null;
  }
  return { v, iv, ct };
}
