import { describe, expect, it } from 'vitest';
import { phoneIsValid, toDraft, toSettings } from './settingsForm';

const SETTINGS = {
  whatsappNumber: '61412345678',
  postGreeting: { en: 'Hi', id: 'Halo' },
  postClosing: { en: 'Bye {phone}', id: 'Dah {phone}' },
  orderingOpen: true,
};

describe('settingsForm', () => {
  it('formats the saved number for the field', () => {
    expect(toDraft(SETTINGS).phone).toBe('+61 412 345 678');
    expect(toDraft({ ...SETTINGS, whatsappNumber: undefined }).phone).toBe('');
  });

  it('accepts what the server accepts, and an empty number', () => {
    for (const ok of ['0412 345 678', '+61412345678', '61 412 345 678', '', '  ']) {
      expect(phoneIsValid(ok)).toBe(true);
    }
    for (const bad of ['12345', '0212 345 678', 'abc', '+44 7700 900123']) {
      expect(phoneIsValid(bad)).toBe(false);
    }
  });

  it('round-trips the draft and omits an empty number', () => {
    expect(toSettings(toDraft(SETTINGS))).toEqual({
      ...SETTINGS,
      whatsappNumber: '+61 412 345 678',
    });
    const empty = toSettings({ ...toDraft(SETTINGS), phone: ' ' });
    expect(empty).not.toHaveProperty('whatsappNumber');
  });
});
