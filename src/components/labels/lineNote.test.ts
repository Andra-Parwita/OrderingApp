import { describe, expect, it } from 'vitest';
import { itemText, LABEL_NOTE_MAX } from './labelModel';

// Plan 111: a line note follows its item text in brackets, cut like the order note.

describe('label item text with a line note', () => {
  const name = { en: 'Snacks · Sweet', id: 'Snacks · Manis' };
  it('adds the note in brackets after the item', () => {
    expect(itemText({ qty: 1, name, note: 'extra crispy' })).toBe(
      '1× Snacks · Manis / Snacks · Sweet (extra crispy)',
    );
  });
  it('is unchanged without a note', () => {
    expect(itemText({ qty: 2, name: { en: 'Soto', id: 'Soto' } })).toBe('2× Soto');
  });
  it('cuts a long note to the label note limit', () => {
    const text = itemText({ qty: 1, name: { en: 'A', id: 'A' }, note: 'x'.repeat(200) });
    expect(text.length).toBeLessThanOrEqual('1× A ()'.length + LABEL_NOTE_MAX);
    expect(text.endsWith('…)')).toBe(true);
  });
});
