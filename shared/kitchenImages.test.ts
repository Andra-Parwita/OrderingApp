import { describe, expect, it } from 'vitest';
import { bannerAlt, phoneBannerSrc } from './kitchenImages';
import { parseMenuResponse } from './menuContract';

describe('phoneBannerSrc', () => {
  it('prefers the phone banner, then the desktop banner, then nothing', () => {
    expect(phoneBannerSrc({ phoneBanner: '/p.jpg', desktopBanner: '/d.jpg' })).toBe('/p.jpg');
    expect(phoneBannerSrc({ desktopBanner: '/d.jpg' })).toBe('/d.jpg');
    expect(phoneBannerSrc({ railImage: '/r.jpg' })).toBeUndefined();
    expect(phoneBannerSrc(undefined)).toBeUndefined();
  });
});

describe('bannerAlt', () => {
  const alt = { en: 'Hello', id: 'Halo' };
  it('uses the alt text in the current language', () => {
    expect(bannerAlt({ name: 'Delave', images: { alt } }, 'id')).toBe('Halo');
  });
  it('defaults to "<kitchen name> banner"', () => {
    expect(bannerAlt({ name: 'Delave' }, 'en')).toBe('Delave banner');
  });
});

describe('kitchen images in the menu', () => {
  const base = {
    seller: { id: 's1', slug: 'onde-onde', name: 'K' },
    kitchen: { sellerId: 's1', name: 'K', tagline: { en: 'a', id: 'b' } },
    week: {
      cookingDate: '2026-10-10',
      cutoffAt: '2026-10-09T21:00:00+11:00',
      status: 'published',
      pickupPoints: [],
      delivery: { available: false, note: { en: 'a', id: 'b' } },
    },
    items: [],
    ordering: { open: true },
  };
  const withImages = (images: unknown) => ({
    ...base,
    kitchen: { ...base.kitchen, images },
  });

  it('accepts images and keeps them', () => {
    const images = { desktopBanner: '/d.jpg', alt: { en: 'a', id: 'b' } };
    expect(parseMenuResponse(withImages(images))?.kitchen.images).toEqual(images);
  });
  it('accepts the rail image, rail icon and a #rrggbb banner background', () => {
    const images = {
      railImage: '/r.jpg',
      railIcon: '/i.png',
      bannerBackground: '#835937',
    };
    expect(parseMenuResponse(withImages(images))?.kitchen.images).toEqual(images);
  });
  it('rejects a banner background that is not #rrggbb', () => {
    for (const bad of ['835937', '#83593', '#83593g', '#835937ff', 'red', 5, null]) {
      expect(parseMenuResponse(withImages({ bannerBackground: bad }))).toBeNull();
    }
  });
  it('accepts a kitchen with no images', () => {
    expect(parseMenuResponse(base)?.kitchen.images).toBeUndefined();
  });
  it('rejects malformed images', () => {
    expect(parseMenuResponse(withImages({ railImage: 5 }))).toBeNull();
    expect(parseMenuResponse(withImages({ railIcon: 5 }))).toBeNull();
    expect(parseMenuResponse(withImages({ alt: 'x' }))).toBeNull();
    expect(parseMenuResponse(withImages('x'))).toBeNull();
  });
});
