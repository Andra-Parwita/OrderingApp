import type { Chef, Kitchen, MenuItem, Week } from '../../shared/domain';

export const fixtureKitchen: Kitchen = {
  name: 'Delave',
  tagline: {
    en: 'Home cooking, made fresh every Saturday',
    id: 'Masakan rumahan, segar tiap Sabtu',
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
