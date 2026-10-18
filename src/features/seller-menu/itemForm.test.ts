import { describe, expect, it } from 'vitest';
import { pickText } from '../../../shared/text';
import {
  EMPTY_DRAFT,
  changedOnly,
  createRequestOf,
  parsePriceInput,
  priceInputOf,
  updateRequestOf,
  validateDraft,
} from './itemForm';

describe('parsePriceInput', () => {
  it('reads 10, 10.00, 10,50, $10 and 0.5 as cents', () => {
    expect(parsePriceInput('10')).toBe(1000);
    expect(parsePriceInput('10.00')).toBe(1000);
    expect(parsePriceInput('10,50')).toBe(1050);
    expect(parsePriceInput(' $12.5 ')).toBe(1250);
    expect(parsePriceInput('0.5')).toBe(50);
    expect(parsePriceInput('0')).toBe(0);
  });

  it('refuses text, three decimals, negatives and too-big prices', () => {
    for (const bad of ['', 'abc', '10.005', '-5', '1,000.00', '10.', '20000']) {
      expect(parsePriceInput(bad)).toBeNull();
    }
  });

  it('writes cents back as a field value', () => {
    expect(priceInputOf(1050)).toBe('10.50');
    expect(priceInputOf(5)).toBe('0.05');
  });
});

describe('plan 029: preorder and day stock', () => {
  const ok = { ...EMPTY_DRAFT, nameEn: 'Satay', price: '10' };

  it('sends both fields; on the day only needs a stock', () => {
    expect(createRequestOf(ok)).not.toHaveProperty('preorder');
    expect(createRequestOf({ ...ok, onTheDay: true, dayStock: '12' })).toMatchObject({
      dayStock: 12,
    });
    expect(
      createRequestOf({ ...ok, preorder: false, onTheDay: true, dayStock: '0' }),
    ).toMatchObject({
      preorder: false,
      dayStock: 0,
    });
    expect(createRequestOf({ ...ok, preorder: false })).toBeNull();
    expect(validateDraft({ ...ok, preorder: false }).errors.preorder).toBe('needsDay');
    expect(validateDraft({ ...ok, onTheDay: true, dayStock: 'x' }).errors.dayStock).toBe('invalid');
    expect(updateRequestOf(ok)).toMatchObject({ preorder: true, dayStock: null });
    expect(updateRequestOf({ ...ok, onTheDay: true, dayStock: '3' })).toMatchObject({
      dayStock: 3,
    });
  });
});

describe('validateDraft', () => {
  const ok = { ...EMPTY_DRAFT, nameId: 'Lemper', price: '10' };

  it('needs a name in at least one language and a price', () => {
    expect(validateDraft(EMPTY_DRAFT).errors).toEqual({ name: 'required', price: 'invalid' });
    expect(validateDraft(ok).errors).toEqual({});
    expect(validateDraft({ ...ok, nameId: '', nameEn: 'Lemper' }).errors).toEqual({});
  });

  it('saves an Indonesian-only dish, which shows its Indonesian name in English', () => {
    const request = createRequestOf(ok);
    expect(request?.name).toEqual({ en: '', id: 'Lemper' });
    expect(request && pickText(request.name, 'en')).toBe('Lemper');
  });

  it('checks the limit and the lengths', () => {
    expect(validateDraft({ ...ok, limit: '0' }).errors.limit).toBe('invalid');
    expect(validateDraft({ ...ok, limit: '2.5' }).errors.limit).toBe('invalid');
    expect(validateDraft({ ...ok, limit: '20' })).toMatchObject({ errors: {}, limit: 20 });
    expect(validateDraft({ ...ok, nameEn: 'x'.repeat(81) }).errors.name).toBe('tooLong');
    expect(validateDraft({ ...ok, sizeId: 'x'.repeat(41) }).errors.sizeId).toBe('tooLong');
  });
});

describe('requests', () => {
  const draft = { ...EMPTY_DRAFT, nameEn: ' Lemper ', price: '10,50', limit: '20', chefId: 'wati' };

  it('create leaves out what is empty', () => {
    expect(createRequestOf({ ...EMPTY_DRAFT, nameId: 'Tempe', price: '5' })).toEqual({
      name: { en: '', id: 'Tempe' },
      description: { en: '', id: '' },
      size: { en: '', id: '' },
      priceCents: 500,
    });
    expect(createRequestOf(draft)).toMatchObject({
      name: { en: 'Lemper', id: '' },
      priceCents: 1050,
      limit: 20,
      chefId: 'wati',
    });
    expect(createRequestOf(EMPTY_DRAFT)).toBeNull();
  });

  it('update sends null to remove the limit and the chef', () => {
    expect(updateRequestOf({ ...draft, limit: '', chefId: '', soldOut: true })).toMatchObject({
      limit: null,
      chefId: null,
      soldOut: true,
    });
  });
});

describe('changedOnly (plan 103)', () => {
  const start = { ...EMPTY_DRAFT, nameEn: 'Soto', nameId: 'Soto', price: '10', preorder: true };
  const base = updateRequestOf(start);

  it('a chef-only edit sends only the chef', () => {
    const next = updateRequestOf({ ...start, chefId: 'c2' });
    expect(next && changedOnly(next, base)).toEqual({ chefId: 'c2' });
  });

  it('clearing the chef is sent as null; no change is null', () => {
    const had = { ...start, chefId: 'c1' };
    const cleared = updateRequestOf({ ...had, chefId: '' });
    expect(cleared && changedOnly(cleared, updateRequestOf(had))).toEqual({ chefId: null });
    expect(base && changedOnly(base, base)).toBeNull();
  });
});
