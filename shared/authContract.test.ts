import { describe, expect, it } from 'vitest';
import { parseApiError } from './apiError';
import {
  checkPassword,
  parseChefAccessResponse,
  parseInviteRequest,
  parseMembersResponse,
  parseSwitchRequest,
  parseKeySignInRequest,
  parsePasskeyOptionsRequest,
  parsePasskeySignInRequest,
  parsePasswordSignInRequest,
  passkeysAvailable,
  parseRegisterRequest,
  parseSellerResponse,
  parseSellersResponse,
  parseSessionResponse,
} from './authContract';
import { parseSendUpdatesRequest, statusOfTemplate } from './updateContract';

const deviceId = 'device-1234';

describe('admin responses', () => {
  const seller = { id: 's1', slug: 'onde-onde', name: 'Onde Onde' };

  it('needs the created date on every listed seller', () => {
    const createdAt = '2026-08-15T09:00:00.000Z';
    expect(parseSellersResponse({ sellers: [{ ...seller, createdAt }] })).toEqual({
      sellers: [{ ...seller, createdAt }],
    });
    expect(parseSellersResponse({ sellers: [seller] })).toBeNull();
    expect(parseSellersResponse({ sellers: [{ ...seller, createdAt: 'soon' }] })).toBeNull();
    expect(parseSellerResponse({ seller: { ...seller, createdAt } })?.seller.createdAt).toBe(
      createdAt,
    );
    expect(parseSellerResponse({ seller })).toBeNull();
  });

  it('parses chefs with a device count', () => {
    expect(
      parseChefAccessResponse({ chefs: [{ id: 'wati', name: 'Chef Wati', devices: 2 }] }),
    ).toEqual({
      chefs: [{ id: 'wati', name: 'Chef Wati', devices: 2 }],
    });
    expect(parseChefAccessResponse({ chefs: [{ id: 'wati', name: 'Chef Wati' }] })).toBeNull();
    expect(parseChefAccessResponse({ chefs: [{ id: 'wati', name: 'W', devices: -1 }] })).toBeNull();
    expect(parseChefAccessResponse({})).toBeNull();
  });
});

describe('auth contract', () => {
  it('checks the password length (10 to 200)', () => {
    expect(checkPassword('123456789')).toBe('too_short');
    expect(checkPassword('1234567890')).toBe('ok');
    expect(checkPassword('x'.repeat(201))).toBe('too_long');
  });

  it('parses sign-in requests and refuses bad device ids', () => {
    expect(parseKeySignInRequest({ key: ' DLV-AAAA ', deviceId })).toEqual({
      key: 'DLV-AAAA',
      deviceId,
    });
    expect(parseKeySignInRequest({ key: 'DLV-AAAA', deviceId: 'short' })).toBeNull();
    expect(parseKeySignInRequest({ key: '', deviceId })).toBeNull();
    expect(
      parsePasswordSignInRequest({
        slug: 'a-b',
        password: 'x',
        deviceId,
        deviceName: 'Phone',
        chefId: '',
      }),
    ).toBeNull();
  });

  it('parses registration: passkey, or a password of 10+ characters', () => {
    const response = { id: 'cred-1', rawId: 'cred-1', type: 'public-key' };
    expect(parseRegisterRequest({ kind: 'passkey', deviceName: 'Phone', response })).toEqual({
      kind: 'passkey',
      deviceName: 'Phone',
      response,
    });
    expect(parseRegisterRequest({ kind: 'passkey', deviceName: 'Phone' })).toBeNull();
    expect(
      parseRegisterRequest({ kind: 'passkey', deviceName: 'Phone', response: { id: '' } }),
    ).toBeNull();
    expect(
      parseRegisterRequest({ kind: 'password', password: 'short', deviceName: 'Phone' }),
    ).toBeNull();
    expect(
      parseRegisterRequest({ kind: 'password', password: 'long enough!', deviceName: '' }),
    ).toBeNull();
    expect(parseRegisterRequest({ kind: 'pin', deviceName: 'Phone' })).toBeNull();
  });

  it('checks a session response', () => {
    expect(parseSessionResponse({ me: { role: 'admin', stage: 'full' } })).toEqual({
      me: { role: 'admin', stage: 'full' },
    });
    expect(parseSessionResponse({ me: { role: 'owner', stage: 'full' } })).toBeNull();
    expect(
      parseSessionResponse({ me: { role: 'admin', stage: 'full' }, credentialId: 5 }),
    ).toBeNull();
  });

  it('parses passkey options and sign-in requests', () => {
    expect(parsePasskeyOptionsRequest({ deviceId })).toEqual({ deviceId });
    expect(parsePasskeyOptionsRequest({ deviceId, credentialId: 'abc' })).toEqual({
      deviceId,
      credentialId: 'abc',
    });
    expect(parsePasskeyOptionsRequest({ deviceId, credentialId: '' })).toBeNull();
    expect(parsePasskeyOptionsRequest({ credentialId: 'abc' })).toBeNull();
    expect(parsePasskeySignInRequest({ deviceId, response: { id: 'abc' } })?.response.id).toBe(
      'abc',
    );
    expect(parsePasskeySignInRequest({ deviceId, credentialId: 'abc' })).toBeNull();
  });

  it('allows passkeys on names and localhost, never on an IP address (D-046)', () => {
    expect(passkeysAvailable('localhost')).toBe(true);
    expect(passkeysAvailable('delave.example.com')).toBe(true);
    expect(passkeysAvailable('192.168.1.20')).toBe(false);
    expect(passkeysAvailable('[::1]')).toBe(false);
    expect(passkeysAvailable('::1')).toBe(false);
    expect(passkeysAvailable('')).toBe(false);
  });

  it('keeps tries left and the lockout time on API errors', () => {
    expect(parseApiError({ error: 'invalid_credentials', message: 'm', triesLeft: 3 })).toEqual({
      error: 'invalid_credentials',
      message: 'm',
      triesLeft: 3,
    });
    expect(
      parseApiError({ error: 'locked_out', message: 'm', retryAfterSeconds: 900 })
        ?.retryAfterSeconds,
    ).toBe(900);
    expect(parseApiError({ error: 'forbidden', message: 'm', triesLeft: -1 })).toEqual({
      error: 'forbidden',
      message: 'm',
    });
  });

  it('maps update templates to statuses', () => {
    expect(statusOfTemplate('readyIn')).toBe('ready_for_pickup');
    expect(statusOfTemplate('arrivingIn')).toBe('out_for_delivery');
    expect(statusOfTemplate('arrived')).toBeNull();
    expect(statusOfTemplate('custom')).toBeNull();
    expect(
      parseSendUpdatesRequest({ template: 'ready', codes: ['ABC234'], alsoSetStatus: 'yes' }),
    ).toBeNull();
  });
});

describe('people and memberships (plan 033)', () => {
  it('reads an invite by name and role; only a chef carries a cook', () => {
    expect(parseInviteRequest({ displayName: ' Dewi ', role: 'chef' })).toEqual({
      displayName: 'Dewi',
      role: 'chef',
    });
    expect(parseInviteRequest({ displayName: 'Dewi', role: 'chef', chefId: 'wati' })?.chefId).toBe(
      'wati',
    );
    expect(parseInviteRequest({ displayName: 'Budi', role: 'owner', chefId: 'wati' })).toBeNull();
    expect(parseInviteRequest({ displayName: '', role: 'owner' })).toBeNull();
    expect(parseInviteRequest({ displayName: 'X', role: 'seller' })).toBeNull();
  });

  it('needs the person on a password sign-in, and takes an optional kitchen on a passkey one', () => {
    const base = { deviceId, slug: 'onde-onde', password: 'pw', deviceName: 'Phone' };
    expect(parsePasswordSignInRequest(base)).toBeNull();
    expect(parsePasswordSignInRequest({ ...base, accountId: 'person:a' })?.accountId).toBe(
      'person:a',
    );
    const response = { id: 'cred' };
    expect(parsePasskeySignInRequest({ deviceId, response })).toEqual({ deviceId, response });
    expect(parsePasskeySignInRequest({ deviceId, response, slug: 'two' })?.slug).toBe('two');
    expect(parsePasskeySignInRequest({ deviceId, response, slug: 3 })).toBeNull();
    expect(parseSwitchRequest({ sellerId: 's1' })).toEqual({ sellerId: 's1' });
    expect(parseSwitchRequest({})).toBeNull();
  });

  it('lets the key carry an edited name', () => {
    expect(parseKeySignInRequest({ deviceId, key: 'K', displayName: 'Sari W' })?.displayName).toBe(
      'Sari W',
    );
    expect(parseKeySignInRequest({ deviceId, key: 'K', displayName: 5 })).toBeNull();
  });

  it('reads the member list', () => {
    const member = {
      accountId: 'person:a',
      displayName: 'Dewi',
      role: 'chef',
      devices: 1,
      createdAt: '2026-10-10T00:00:00.000Z',
    };
    expect(parseMembersResponse({ members: [member] })?.members[0]?.displayName).toBe('Dewi');
    expect(parseMembersResponse({ members: [{ ...member, role: 'seller' }] })).toBeNull();
  });
});
