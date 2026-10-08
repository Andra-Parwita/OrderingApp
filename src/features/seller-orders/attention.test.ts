import { describe, expect, it } from 'vitest';
import { attentionFlag } from './customerKind';
import { makeOrder } from './testSupport';

describe('attentionFlag', () => {
  it('is null when there is nothing to do', () => {
    expect(attentionFlag(makeOrder({ status: 'confirmed' }))).toBeNull();
  });

  it('puts New customer before Edited, Note and Locked', () => {
    const order = makeOrder({
      status: 'ordered',
      changed: true,
      note: 'No chilli',
      locked: true,
    });
    expect(attentionFlag(order)).toBe('new');
  });

  it('puts Edited by customer before Note and Locked', () => {
    const order = makeOrder({ status: 'confirmed', changed: true, note: 'x', locked: true });
    expect(attentionFlag(order)).toBe('edited');
  });

  it('puts Note before Locked, and shows Locked on its own', () => {
    expect(attentionFlag(makeOrder({ note: 'x', locked: true }))).toBe('note');
    expect(attentionFlag(makeOrder({ locked: true }))).toBe('locked');
  });

  it('does not call a returning or WhatsApp-received customer new', () => {
    expect(attentionFlag(makeOrder({ status: 'ordered', returning: true }))).toBeNull();
    expect(attentionFlag(makeOrder({ status: 'ordered', waReceived: true }))).toBeNull();
  });

  it('shows nothing for a finished order', () => {
    expect(attentionFlag(makeOrder({ status: 'collected', note: 'x', changed: true }))).toBeNull();
    expect(attentionFlag(makeOrder({ status: 'cancelled', locked: true }))).toBeNull();
  });
});
