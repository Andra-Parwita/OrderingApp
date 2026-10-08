import type { Chef, Kitchen, KitchenSettings, MenuItem, Week } from '../../shared/domain';

export const fixtureKitchen: Kitchen = {
  name: 'Delave',
  tagline: {
    en: 'Home cooking, made fresh every Saturday',
    id: 'Masakan rumahan, segar tiap Sabtu',
  },
  // Dev-only copies of the owner's sample banner (D-035, D-038): whole image, never cropped, on a
  // brown sampled from its edges. No rail icon, so the collapsed rail shows the initial.
  images: {
    desktopBanner: '/samples/banner-desktop.jpg',
    phoneBanner: '/samples/banner-phone.jpg',
    railImage: '/samples/rail.jpg',
    bannerBackground: '#835937',
    alt: {
      en: 'Onde Onde — Indonesian homemade food',
      id: 'Onde Onde — masakan rumahan Indonesia',
    },
  },
};

// Dates are as given in the brief (cooking Sat 10 Oct 2026, cut-off Fri 9 Oct 21:00 Melbourne, AEDT = +11:00).
export const fixtureWeek: Week = {
  cookingDate: '2026-10-10',
  cutoffAt: '2026-10-09T21:00:00+11:00',
  status: 'published',
  pickupPoints: [
    {
      id: 'glen-waverley',
      place: 'Glen Waverley',
      directions: { en: '', id: '' },
      window: { start: '14:00', end: '17:00' },
    },
  ],
  delivery: { available: true, note: { en: '', id: '' } },
};

export const fixtureChefs: Array<Chef> = [{ id: 'wati', name: 'Chef Wati' }];

const none = { en: '', id: '' };
const portion = { en: '1 portion', id: '1 porsi' };
const pieces = { en: '4 pieces', id: '4 biji' };

export const fixtureItems: Array<MenuItem> = [
  {
    id: 'nasi-campur',
    name: { en: 'Lime-leaf mixed rice', id: 'Nasi campur daun jeruk' },
    description: {
      en: 'with salt-and-chilli fried chicken, crispy tempeh and stir-fried cabbage',
      id: 'lauk: ayam goreng tepung tumis cabe garam, tempe mendoan, tumis kubis',
    },
    size: { en: '1 box', id: '1 box' },
    priceCents: 1500,
  },
  {
    id: 'pesmol',
    name: { en: 'Tilapia pesmol', id: 'Pesmol ikan nila' },
    description: { en: 'turmeric pesmol sauce', id: '' },
    size: portion,
    priceCents: 1500,
  },
  {
    id: 'lemper',
    name: { en: 'Chicken lemper', id: 'Lemper ayam' },
    description: { en: 'sticky rice rolls in banana leaf', id: '' },
    size: pieces,
    priceCents: 1000,
    limit: 20,
    chefId: 'wati',
  },
  {
    id: 'empek-empek',
    name: { en: 'Palembang fish cake with egg', id: 'Empek-empek kapal selam' },
    description: { en: '"submarine"', id: '' },
    size: portion,
    priceCents: 1000,
    limit: 10,
    chefId: 'wati',
  },
  {
    id: 'ayam-goreng',
    name: {
      en: 'Salt-and-chilli battered fried chicken',
      id: 'Ayam goreng tepung tumis cabe garam',
    },
    description: none,
    size: { en: '250 g', id: '250 g' },
    priceCents: 1250,
  },
  {
    id: 'tempe-mendoan',
    name: { en: 'Thin battered tempeh', id: 'Tempe mendoan' },
    description: none,
    size: pieces,
    priceCents: 1000,
    chefId: 'wati',
  },
];

export const fixtureSettings: KitchenSettings = {
  postGreeting: {
    en: "Hi everyone! Here is this week's menu. Reply with your order number to confirm.",
    id: 'Halo semuanya! Ini menu minggu ini. Kirim nomor pesanan kamu untuk konfirmasi.',
  },
  postClosing: {
    en: 'Thank you for supporting our home kitchen!',
    id: 'Terima kasih sudah mendukung dapur rumahan kami!',
  },
  orderingOpen: true,
};
