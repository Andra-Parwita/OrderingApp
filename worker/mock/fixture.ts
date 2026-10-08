import type { Chef, Kitchen, KitchenSettings, MenuItem, Seller, Week } from '../../shared/domain';

/** Everything one seller owns in the mock (D-036). */
export type SellerFixture = {
  seller: Seller;
  kitchen: Kitchen;
  week: Week;
  chefs: Array<Chef>;
  items: Array<MenuItem>;
  settings: KitchenSettings;
};

export const ONDE_ID = 'seller-onde-onde';
export const DEMO_ID = 'seller-dapur-demo';

const ondeKitchen: Kitchen = {
  sellerId: ONDE_ID,
  name: 'Onde Onde',
  tagline: { en: 'Indonesian homemade food', id: 'Masakan rumahan Indonesia' },
  // Dev-only copies of the owner's five Onde Onde images (D-040): banners shown whole, never
  // cropped; the blurred background image sits behind the wide banner, the brown is its fallback.
  images: {
    desktopBanner: '/samples/banner-wide.jpg',
    phoneBanner: '/samples/banner-phone.jpg',
    railImage: '/samples/rail.png',
    railIcon: '/samples/rail-icon.png',
    bannerBackgroundImage: '/samples/banner-bg.jpg',
    bannerBackground: '#835937',
    alt: {
      en: 'Onde Onde — Indonesian homemade food',
      id: 'Onde Onde — masakan rumahan Indonesia',
    },
  },
};

// Dates are as given in the brief (cooking Sat 10 Oct 2026, cut-off Fri 9 Oct 21:00 Melbourne, AEDT = +11:00).
const ondeWeek: Week = {
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

const ondeChefs: Array<Chef> = [{ id: 'wati', sellerId: ONDE_ID, name: 'Chef Wati' }];

const none = { en: '', id: '' };
const portion = { en: '1 portion', id: '1 porsi' };
const pieces = { en: '4 pieces', id: '4 biji' };

const ondeItems: Array<MenuItem> = [
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

const ondeSettings: KitchenSettings = {
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

const demoKitchen: Kitchen = {
  sellerId: DEMO_ID,
  name: 'Dapur Demo',
  tagline: { en: 'A small second kitchen', id: 'Dapur kecil kedua' },
};

const demoWeek: Week = {
  cookingDate: '2026-10-10',
  cutoffAt: '2026-10-09T21:00:00+11:00',
  status: 'published',
  pickupPoints: [
    {
      id: 'clayton',
      place: 'Clayton',
      directions: { en: 'Side gate', id: 'Pintu samping' },
      window: { start: '10:00', end: '12:00' },
    },
  ],
  delivery: { available: false, note: { en: '', id: '' } },
};

const demoChefs: Array<Chef> = [{ id: 'rudi', sellerId: DEMO_ID, name: 'Chef Rudi' }];

const demoItems: Array<MenuItem> = [
  {
    id: 'soto-ayam',
    name: { en: 'Chicken soto', id: 'Soto ayam' },
    description: { en: 'turmeric broth with rice', id: 'kuah kuning dengan nasi' },
    size: { en: '1 bowl', id: '1 mangkuk' },
    priceCents: 1400,
    limit: 12,
    chefId: 'rudi',
  },
  {
    id: 'martabak',
    name: { en: 'Sweet martabak', id: 'Martabak manis' },
    description: none,
    size: { en: '1 tray', id: '1 loyang' },
    priceCents: 1800,
    limit: 6,
    chefId: 'rudi',
  },
  {
    id: 'es-teh',
    name: { en: 'Iced sweet tea', id: 'Es teh manis' },
    description: none,
    size: { en: '500 ml', id: '500 ml' },
    priceCents: 500,
  },
];

const demoSettings: KitchenSettings = {
  whatsappNumber: '61400000002',
  postGreeting: {
    en: 'Hello from Dapur Demo! This week we cook soto and martabak.',
    id: 'Halo dari Dapur Demo! Minggu ini kami masak soto dan martabak.',
  },
  postClosing: { en: 'See you Saturday!', id: 'Sampai jumpa hari Sabtu!' },
  orderingOpen: true,
};

/** The two sample sellers; the first is the dev default (shared/seller.ts). */
export const fixtureSellers: ReadonlyArray<SellerFixture> = [
  {
    seller: { id: ONDE_ID, slug: 'onde-onde', name: 'Onde Onde' },
    kitchen: ondeKitchen,
    week: ondeWeek,
    chefs: ondeChefs,
    items: ondeItems,
    settings: ondeSettings,
  },
  {
    seller: { id: DEMO_ID, slug: 'dapur-demo', name: 'Dapur Demo' },
    kitchen: demoKitchen,
    week: demoWeek,
    chefs: demoChefs,
    items: demoItems,
    settings: demoSettings,
  },
];
