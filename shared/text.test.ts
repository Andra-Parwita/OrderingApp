import { describe, expect, it } from 'vitest';
import { pickText } from './text';

describe('pickText', () => {
  it('picks the chosen language', () => {
    const text = { en: 'Rice', id: 'Nasi' };
    expect(pickText(text, 'en')).toBe('Rice');
    expect(pickText(text, 'id')).toBe('Nasi');
  });

  it('falls back to the other language when one is empty or blank', () => {
    expect(pickText({ en: 'Rice', id: '' }, 'id')).toBe('Rice');
    expect(pickText({ en: '  ', id: 'Nasi' }, 'en')).toBe('Nasi');
  });

  it('returns an empty string when both are empty', () => {
    expect(pickText({ en: '', id: '' }, 'en')).toBe('');
  });
});
