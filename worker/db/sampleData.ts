import type {
  Chef,
  Kitchen,
  KitchenImages,
  KitchenSettings,
  MenuItem,
  PickupPoint,
  Seller,
  Week,
} from '../../shared/domain';
import { comingSaturday, defaultCutoffAt } from '../../shared/dates';
import {
  DEFAULT_MENU_DEFAULTS,
  DEFAULT_THEME,
  type Dish,
  type Menu,
  type Preferences,
} from '../../shared/menusContract';
import type { StoredSet } from './write';

/** Everything one seller owns (D-036). */
export type SellerFixture = {
  seller: Seller;
  /** When the admin added the seller (ISO); the admin list shows it. */
  createdAt: string;
  kitchen: Kitchen;
  /** The menu in the shape the first app reads; `menuOfFixture` turns it into the stored menu. */
  week: Week;
  chefs: Array<Chef>;
  /** The dishes on the menu (each is also a library dish with the same id). */
  items: Array<MenuItem>;
  settings: KitchenSettings;
  // ---- plan 001 stage 3 ----
  /** The stored menu's id. */
  menuId: string;
  /** Saved pickup places (up to 5); the menu uses those in `week.pickupPoints`. */
  pickupPlaces: Array<PickupPoint>;
  /** "Your dishes": the sample items. */
  dishes: Array<Dish>;
  savedSets: Array<StoredSet>;
  preferences: Preferences;
};

const dishesOf = (items: ReadonlyArray<MenuItem>): Array<Dish> =>
  items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    size: item.size,
    priceCents: item.priceCents,
    ...(item.limit !== undefined ? { limit: item.limit } : {}),
    ...(item.chefId !== undefined ? { chefId: item.chefId } : {}),
  }));

const defaultPreferences: Preferences = {
  theme: DEFAULT_THEME,
  menuDefaults: DEFAULT_MENU_DEFAULTS,
};

/** The stored menu for a fixture: a published week is live, a draft one is not published. */
export function menuOfFixture(fixture: SellerFixture): Menu {
  const live = fixture.week.status === 'published';
  return {
    id: fixture.menuId,
    state: live ? 'live' : 'not_published',
    cookingDate: fixture.week.cookingDate,
    cutoffAt: fixture.week.cutoffAt,
    delivery: fixture.week.delivery,
    wizardStep: live ? 3 : 0,
    takingOrders: fixture.settings.orderingOpen,
    placeUses: fixture.week.pickupPoints.map((point) => ({ placeId: point.id })),
    ...(live ? { publishedAt: fixture.createdAt } : {}),
  };
}

export const ONDE_ID = 'seller-onde-onde';
export const DEMO_ID = 'seller-dapur-demo';

/**
 * Dev-only copies of the owner's five Onde Onde images (D-040, D-054): banners shown whole, never
 * cropped; the blurred background image sits behind the wide banner, the brown is its fallback.
 * `alt` names the kitchen the pictures are shown for.
 */
export function sampleImages(altEn: string, altId: string): KitchenImages {
  return {
    desktopBanner: '/samples/banner-wide.jpg',
    phoneBanner: '/samples/banner-phone.jpg',
    railImage: '/samples/rail.png',
    railIcon: '/samples/rail-icon.png',
    bannerBackgroundImage: '/samples/banner-bg.jpg',
    bannerBackground: '#835937',
    alt: { en: altEn, id: altId },
  };
}

const ondeKitchen: Kitchen = {
  sellerId: ONDE_ID,
  name: 'Onde Onde',
  tagline: { en: 'Indonesian homemade food', id: 'Masakan rumahan Indonesia' },
  images: sampleImages(
    'Onde Onde — Indonesian homemade food',
    'Onde Onde — masakan rumahan Indonesia',
  ),
};

// The sample week is computed from `now`: cooking the coming Saturday, cut-off the evening before.
function sampleWeekDates(now: Date): Pick<Week, 'cookingDate' | 'cutoffAt'> {
  const cookingDate = comingSaturday(now);
  return { cookingDate, cutoffAt: defaultCutoffAt(cookingDate) };
}

const ondeWeek = (now: Date): Week => ({
  ...sampleWeekDates(now),
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
});

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
  images: sampleImages('Dapur Demo — a small second kitchen', 'Dapur Demo — dapur kecil kedua'),
};

const demoWeek = (now: Date): Week => ({
  ...sampleWeekDates(now),
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
});

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

/** The second saved place of each sample kitchen (the menu itself uses the first). */
const ondeSecondPlace: PickupPoint = {
  id: 'box-hill',
  place: 'Box Hill',
  directions: { en: 'By the station entrance', id: 'Dekat pintu stasiun' },
  window: { start: '10:00', end: '12:00' },
};
const demoSecondPlace: PickupPoint = {
  id: 'oakleigh',
  place: 'Oakleigh',
  directions: { en: '', id: '' },
  window: { start: '16:00', end: '18:00' },
};

/** The two sample sellers, their week computed from `now`; the first is the dev default (shared/seller.ts). */
export const fixtureSellers = (now: Date): ReadonlyArray<SellerFixture> => {
  const onde = ondeWeek(now);
  const demo = demoWeek(now);
  return [
    {
      seller: { id: ONDE_ID, slug: 'onde-onde', name: 'Onde Onde' },
      createdAt: '2026-08-15T09:00:00.000Z',
      kitchen: ondeKitchen,
      week: onde,
      chefs: ondeChefs,
      items: ondeItems,
      settings: ondeSettings,
      menuId: 'menu-onde-onde-1',
      pickupPlaces: [...onde.pickupPoints, ondeSecondPlace],
      dishes: dishesOf(ondeItems),
      savedSets: [
        {
          id: 'set-onde-classic',
          name: 'Classic',
          dishIds: ['nasi-campur', 'pesmol', 'lemper'],
          timesUsed: 3,
          images: {},
        },
      ],
      preferences: defaultPreferences,
    },
    {
      seller: { id: DEMO_ID, slug: 'dapur-demo', name: 'Dapur Demo' },
      createdAt: '2026-09-20T09:00:00.000Z',
      kitchen: demoKitchen,
      week: demo,
      chefs: demoChefs,
      items: demoItems,
      settings: demoSettings,
      menuId: 'menu-dapur-demo-1',
      pickupPlaces: [...demo.pickupPoints, demoSecondPlace],
      dishes: dishesOf(demoItems),
      savedSets: [
        {
          id: 'set-demo-soto',
          name: 'Soto and martabak',
          dishIds: ['soto-ayam', 'martabak'],
          timesUsed: 1,
          images: {},
        },
      ],
      preferences: defaultPreferences,
    },
  ];
};

/**
 * An empty kitchen for a seller the admin just created (stage 7.1): no items, no chefs. Its first
 * week is the coming Saturday, with the sample default cut-off (the evening before, 21:00); the
 * pickup point, with its times, is the seller's to add. `createdAt` is the moment of creation.
 */
export function blankFixture(
  seller: Seller,
  createdAt: string,
  sampleImagesOn = false,
): SellerFixture {
  const cookingDate = comingSaturday(new Date(createdAt));
  const week: Week = {
    ...(fixtureSellers(new Date(createdAt))[0] as SellerFixture).week,
    status: 'draft',
    cookingDate,
    cutoffAt: defaultCutoffAt(cookingDate),
    pickupPoints: [],
    delivery: { available: false, note: { en: '', id: '' } },
  };
  return {
    seller: { ...seller },
    createdAt,
    kitchen: {
      sellerId: seller.id,
      name: seller.name,
      tagline: { en: '', id: '' },
      ...(sampleImagesOn ? { images: sampleImages(seller.name, seller.name) } : {}),
    },
    week,
    chefs: [],
    items: [],
    settings: {
      postGreeting: { en: '', id: '' },
      postClosing: { en: '', id: '' },
      orderingOpen: true,
    },
    menuId: `menu-${seller.slug}-1`,
    pickupPlaces: [],
    dishes: [],
    savedSets: [],
    preferences: defaultPreferences,
  };
}
