// @vitest-environment node
// Stage 8.4b: a seller the admin adds starts on the coming Saturday, not on the sample's dates.
// Runs against a local D1; see mocks/impl.ts.
import { describe, expect, it } from 'vitest';
import { useWorld } from './impl';

describe('a new seller pictures (D-054)', () => {
  const create = useWorld('new-seller-images');

  it('start with the five sample pictures when asked (local dev)', async () => {
    const world = await create({ now: () => new Date('2026-10-11T23:00:00Z') });
    await world.repo.addSeller('Kedai Gambar', 'kedai-gambar', { sampleImages: true });
    const images = await (await world.repo.sellerBySlug('kedai-gambar'))?.getImages();
    expect(images).toMatchObject({
      desktopBanner: '/samples/banner-wide.jpg',
      phoneBanner: '/samples/banner-phone.jpg',
      railImage: '/samples/rail.png',
      railIcon: '/samples/icon-512.jpg',
      bannerBackgroundImage: '/samples/banner-bg.jpg',
      bannerBackground: '#835937',
    });
  });

  it('start with none by default (production)', async () => {
    const world = await create({ now: () => new Date('2026-10-11T23:00:00Z') });
    await world.repo.addSeller('Kedai Kosong', 'kedai-kosong');
    const images = await (await world.repo.sellerBySlug('kedai-kosong'))?.getImages();
    expect(images).toEqual({});
  });
});

describe('a new seller default week', () => {
  const create = useWorld('new-seller');

  it('is the coming Saturday with the Friday 21:00 cut-off, as a draft', async () => {
    // Mon 12 Oct 2026, 10:00 in Melbourne
    const world = await create({ now: () => new Date('2026-10-11T23:00:00Z') });
    await world.repo.addSeller('Kedai Baru', 'kedai-baru');
    const week = await (await world.repo.sellerBySlug('kedai-baru'))?.getCurrentMenu();
    expect(week?.menu).toMatchObject({
      cookingDate: '2026-10-17',
      cutoffAt: '2026-10-16T21:00:00+11:00',
      state: 'not_published',
    });
  });

  it('moves with the clock, and with daylight saving', async () => {
    // Mon 6 Apr 2026, after the clocks went back
    const world = await create({ now: () => new Date('2026-04-06T00:00:00Z') });
    await world.repo.addSeller('Kedai Dua', 'kedai-dua');
    const week = await (await world.repo.sellerBySlug('kedai-dua'))?.getCurrentMenu();
    expect(week?.menu).toMatchObject({
      cookingDate: '2026-04-11',
      cutoffAt: '2026-04-10T21:00:00+10:00',
    });
  });
});
