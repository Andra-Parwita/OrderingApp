import { describe, expect, it } from 'vitest';
import { APP_NAME } from './appName';
import { customerLabel, passkeyLabel } from './passkeyLabels';

describe('passkey names (plan 092)', () => {
  it('names a customer passkey', () => {
    expect(customerLabel('Indra')).toBe('Indra · customer (Remember me)');
    expect(customerLabel('  Indra ')).toBe('Indra · customer (Remember me)');
    expect(customerLabel('')).toBe(`Remember me · ${APP_NAME}`);
  });
  it('names a seller and an admin passkey', () => {
    expect(passkeyLabel('seller', 'Indra')).toBe('Indra · seller');
    expect(passkeyLabel('admin', 'Indra')).toBe('Indra · admin');
    expect(passkeyLabel('seller', undefined)).toBe(`Seller · ${APP_NAME}`);
    expect(passkeyLabel('admin', ' ')).toBe(`Admin · ${APP_NAME}`);
  });
  it('never carries a kitchen name', () => {
    expect(passkeyLabel('seller', 'Indra')).not.toMatch(/kitchen|dapur/i);
  });
});
