// Plan 087: the calls of Remember me (/api/customer/*). The session is the HttpOnly
// `__Host-customer` cookie; scripts never see it. Nothing here carries a PRF value or a key.
import { parsePasskeyOptionsResponse } from '../../../shared/authContract';
import { parseCustomerCode } from '../../../shared/customerCode';
import {
  parseSealedAddress,
  type AdoptItem,
  type CustomerMe,
  type CustomerMeResponse,
  type CustomerOrdersResponse,
  type CustomerSealedResponse,
  type PhoneCodeResponse,
  type SealedAddress,
  type WebAuthnAnswer,
} from '../../../shared/customerContract';
import { isRecord } from '../../../shared/parse';
import { parseOkResponse, type OkResponse } from '../../../shared/setupContract';
import { getDeviceId } from '../device/session';
import { request, type ApiResult } from '../http';

const BASE = '/api/customer';

function parseMe(input: unknown): CustomerMe | null {
  if (!isRecord(input)) return null;
  const { firstName, credentialId, prf, setup, sealed, customerCode, code } = input;
  if (typeof firstName !== 'string' || typeof prf !== 'boolean' || typeof setup !== 'boolean') {
    return null;
  }
  const kitchenCode = parseCustomerCode(customerCode);
  return {
    firstName,
    credentialId: typeof credentialId === 'string' ? credentialId : null,
    prf,
    setup,
    sealed: parseSealedAddress(sealed),
    ...(kitchenCode !== null ? { customerCode: kitchenCode } : {}),
    ...(typeof code === 'string' ? { code } : {}),
  };
}

function parseMeResponse(input: unknown): CustomerMeResponse | null {
  const me = isRecord(input) ? parseMe(input['me']) : null;
  return me ? { me } : null;
}

function parseOrders(input: unknown): CustomerOrdersResponse | null {
  if (!isRecord(input) || !Array.isArray(input['orders'])) return null;
  const orders: CustomerOrdersResponse['orders'] = [];
  for (const item of input['orders'] as Array<unknown>) {
    if (!isRecord(item) || typeof item['token'] !== 'string' || typeof item['slug'] !== 'string') {
      return null;
    }
    orders.push({ token: item['token'], slug: item['slug'] });
  }
  return { orders };
}

function parseSealed(input: unknown): CustomerSealedResponse | null {
  if (!isRecord(input) || !('sealed' in input)) return null;
  return { sealed: parseSealedAddress(input['sealed']) };
}

function parsePhoneCode(input: unknown): PhoneCodeResponse | null {
  if (!isRecord(input)) return null;
  const { code, expiresAt } = input;
  return typeof code === 'string' && typeof expiresAt === 'string' ? { code, expiresAt } : null;
}

const post = <T>(path: string, parse: (input: unknown) => T | null, body?: unknown) =>
  request(`${BASE}${path}`, parse, { method: 'POST', ...(body !== undefined ? { body } : {}) });

export type Options = ApiResult<{ options: Record<string, unknown> }>;

export const registerOptions = (firstName: string): Promise<Options> =>
  post('/register/options', parsePasskeyOptionsResponse, {
    deviceId: getDeviceId(),
    ...(firstName !== '' ? { firstName } : {}),
  });

export const registerPasskey = (input: {
  response: WebAuthnAnswer;
  firstName: string;
  prf: boolean;
  tokens: Array<string>;
  adopt: Array<AdoptItem>;
}): Promise<ApiResult<CustomerMeResponse>> =>
  post('/register', parseMeResponse, {
    deviceId: getDeviceId(),
    response: input.response,
    ...(input.firstName !== '' ? { firstName: input.firstName } : {}),
    prf: input.prf,
    tokens: input.tokens,
    adopt: input.adopt,
  });

export const signInOptions = (): Promise<Options> =>
  post('/passkey/options', parsePasskeyOptionsResponse, { deviceId: getDeviceId() });

export const signInPasskey = (response: WebAuthnAnswer): Promise<ApiResult<CustomerMeResponse>> =>
  post('/passkey', parseMeResponse, { deviceId: getDeviceId(), response });

export const createPhoneCode = (): Promise<ApiResult<PhoneCodeResponse>> =>
  post('/phone-codes', parsePhoneCode);

export const joinWithCode = (code: string): Promise<ApiResult<CustomerMeResponse>> =>
  post('/code', parseMeResponse, { deviceId: getDeviceId(), code });

export const addPasskeyOptions = (): Promise<Options> =>
  post('/passkeys/options', parsePasskeyOptionsResponse);

export const addPasskey = (
  response: WebAuthnAnswer,
  prf: boolean,
): Promise<ApiResult<CustomerMeResponse>> => post('/passkeys', parseMeResponse, { response, prf });

export const signOutCustomer = (): Promise<ApiResult<OkResponse>> =>
  post('/sign-out', parseOkResponse);

/** `slug` adds that kitchen's stable code to the answer. */
export const fetchCustomerMe = (slug?: string): Promise<ApiResult<CustomerMeResponse>> =>
  request(`${BASE}/me${slug ? `?slug=${encodeURIComponent(slug)}` : ''}`, parseMeResponse);

/** Deletes everything on our side at once. */
export const deleteCustomerData = (): Promise<ApiResult<OkResponse>> =>
  request(`${BASE}/me`, parseOkResponse, { method: 'DELETE' });

export const fetchCustomerOrders = (): Promise<ApiResult<CustomerOrdersResponse>> =>
  request(`${BASE}/orders`, parseOrders);

export const linkCustomerOrders = (
  tokens: Array<string>,
): Promise<ApiResult<CustomerOrdersResponse>> => post('/orders', parseOrders, { tokens });

export const fetchSealedAddress = (): Promise<ApiResult<CustomerSealedResponse>> =>
  request(`${BASE}/address`, parseSealed);

export const putSealedAddress = (
  sealed: SealedAddress,
): Promise<ApiResult<CustomerSealedResponse>> =>
  request(`${BASE}/address`, parseSealed, { method: 'PUT', body: sealed });
