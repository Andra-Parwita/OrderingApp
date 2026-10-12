import { describe, expect, it } from 'vitest';
import { POST_DISHES_MAX, buildShareText, fillPhone, priceText } from './shareText';
import { MENU, SETTINGS } from './testSupport';

const ORIGIN = 'https://orders.example';
const SLUG = 'onde-onde';

describe('priceText', () => {
  it('shows cents only when they are not zero', () => {
    expect(priceText(1500, 'id')).toBe('$15');
    expect(priceText(1250, 'id')).toBe('$12.50');
    expect(priceText(1005, 'en')).toBe('$10.05');
  });
});

describe('phone', () => {
  it('replaces {phone}, or drops it with no number', () => {
    expect(fillPhone('Call {phone}', '61412345678')).toBe('Call +61 412 345 678');
    expect(fillPhone('Call {phone}', undefined)).toBe('Call');
  });
});

describe('buildShareText', () => {
  it('builds the Indonesian post', () => {
    expect(buildShareText(MENU, SETTINGS, 'id', ORIGIN, SLUG)).toBe(
      [
        'Halo semuanya!',
        'Menu Sabtu, 10 Okt',
        '1. Nasi campur daun jeruk (lauk: ayam goreng), 1 box – $15\n2. Tempe mendoan, 4 biji – $12.50',
        'Pesan sebelum Jumat, 9 Okt, 21.00\nAmbil Sabtu, 10 Okt, 14.00–17.00 di Glen Waverley, bisa diantar',
        'Pesan di sini: https://orders.example/onde-onde',
        'Ada pertanyaan? WhatsApp +61 412 345 678',
      ].join('\n\n'),
    );
  });

  it('builds the English post', () => {
    expect(buildShareText(MENU, SETTINGS, 'en', ORIGIN, SLUG)).toBe(
      [
        'Hi everyone!',
        'Menu Sat 10 Oct',
        '1. Lime-leaf mixed rice (with fried chicken), 1 box – $15\n2. Thin battered tempeh, 4 pieces – $12.50',
        'Order before Fri 9 Oct, 9 pm\nPickup Sat 10 Oct, 2–5 pm at Glen Waverley, delivery available',
        'Order here: https://orders.example/onde-onde',
        'Questions? WhatsApp me on +61 412 345 678',
      ].join('\n\n'),
    );
  });

  it('stacks Indonesian then English for Both, with the link in each', () => {
    const text = buildShareText(MENU, SETTINGS, 'both', ORIGIN, SLUG);
    expect(text.indexOf('Halo semuanya!')).toBeLessThan(text.indexOf('Hi everyone!'));
    expect(text.match(/https:\/\/orders\.example\/onde-onde/g)).toHaveLength(2);
    expect(text).not.toMatch(/orders\.example\/(\s|$)/);
    expect(text).toContain('Pesan di sini:');
    expect(text).toContain('Order here:');
  });

  it('lists whole dish lines up to the budget, then "+ N more on the menu" before the link', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      ...MENU.items[0]!,
      name: {
        en: `Dish number ${i + 1} with a long name, slow-cooked in coconut milk and spices`,
        id: `Hidangan nomor ${i + 1} dengan nama panjang, dimasak lama dengan santan dan bumbu`,
      },
    }));
    const big = { ...MENU, items };
    for (const lang of ['en', 'id'] as const) {
      const text = buildShareText(big, SETTINGS, lang, ORIGIN, SLUG);
      const lines = text.split('\n').filter((l) => /^\d+\. /.test(l));
      const more = text.match(/^\+ (\d+) (more on the menu|lainnya di menu)$/m);
      expect(lines.length).toBeGreaterThan(3);
      expect(lines.length).toBeLessThan(50);
      expect(lines.join('\n').length).toBeLessThanOrEqual(POST_DISHES_MAX);
      expect(Number(more?.[1])).toBe(50 - lines.length);
      expect(text.indexOf(more?.[0] ?? '#')).toBeLessThan(text.indexOf(ORIGIN));
    }
    expect(buildShareText(MENU, SETTINGS, 'en', ORIGIN, SLUG)).not.toContain('more on the menu');
  });

  it('leaves out an empty description and drops {phone} with no number', () => {
    const noPhone = { ...SETTINGS };
    delete noPhone.whatsappNumber;
    const text = buildShareText(MENU, noPhone, 'en', ORIGIN, SLUG);
    expect(text).toContain('2. Thin battered tempeh, 4 pieces');
    expect(text).not.toContain('{phone}');
    expect(text.endsWith('Questions? WhatsApp me on')).toBe(true);
  });

  it('handles delivery only and no delivery', () => {
    const deliveryOnly = { ...MENU, pickupPoints: [] };
    expect(buildShareText(deliveryOnly, SETTINGS, 'en', ORIGIN, SLUG)).toContain(
      '\nDelivery available\n',
    );
    const pickupOnly = { ...MENU, delivery: { ...MENU.delivery, available: false } };
    const text = buildShareText(pickupOnly, SETTINGS, 'en', ORIGIN, SLUG);
    expect(text).toContain('2–5 pm at Glen Waverley\n');
    expect(text).not.toContain('delivery available');
  });

  it('never carries a chef name (D-012)', () => {
    // The post item type has no chef field; a chef-like word only appears if the seller wrote it.
    for (const post of ['id', 'en', 'both'] as const) {
      expect(buildShareText(MENU, SETTINGS, post, ORIGIN, SLUG)).not.toMatch(/wati|chef|koki/i);
    }
  });
});
