import type {
  Delivery,
  KitchenSettings,
  Language,
  LocalText,
  PickupPoint,
} from '../../../shared/domain';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { formatPhone } from '../../../shared/phone';
import { pickText } from '../../../shared/text';

// The text of the group post. It has no chef names anywhere (D-012): the item type below has no
// chef field, so a chef cannot leak in. Menu images come with batch 3.

export type PostLanguage = 'id' | 'en' | 'both';

export type ShareItem = {
  name: LocalText;
  description: LocalText;
  size: LocalText;
  priceCents: number;
};

export type ShareMenu = {
  cookingDate: string;
  cutoffAt: string;
  pickupPoints: Array<PickupPoint>;
  delivery: Delivery;
  items: Array<ShareItem>;
};

export type ShareSettings = Pick<
  KitchenSettings,
  'whatsappNumber' | 'postGreeting' | 'postClosing'
>;

const WORDS: Record<
  Language,
  {
    menu: string;
    orderBefore: string;
    pickup: string;
    at: string;
    delivery: string;
    orderHere: string;
  }
> = {
  en: {
    menu: 'Menu',
    orderBefore: 'Order before',
    pickup: 'Pickup',
    at: 'at',
    delivery: 'delivery available',
    orderHere: 'Order here',
  },
  id: {
    menu: 'Menu',
    orderBefore: 'Pesan sebelum',
    pickup: 'Ambil',
    at: 'di',
    delivery: 'bisa diantar',
    orderHere: 'Pesan di sini',
  },
};

const SEPARATOR = '――――――――';

/** "$15" for whole dollars, "$12.50" otherwise. */
export function priceText(cents: number, lang: Language): string {
  return cents % 100 === 0 ? `$${cents / 100}` : formatMoney(cents, lang);
}

/** Fills `{phone}`; with no number saved, the placeholder is dropped. */
export function fillPhone(text: string, whatsappNumber: string | undefined): string {
  const phone = whatsappNumber ? formatPhone(whatsappNumber) : '';
  return text
    .replaceAll('{phone}', phone)
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function itemLine(item: ShareItem, index: number, lang: Language): string {
  // A description in the other language would make a mixed-language post, so it is left out.
  const description = item.description[lang].trim();
  const name = pickText(item.name, lang);
  const detail = description !== '' ? ` (${description})` : '';
  const size = pickText(item.size, lang);
  return `${index + 1}. ${name}${detail}, ${size} – ${priceText(item.priceCents, lang)}`;
}

function pickupLines(menu: ShareMenu, lang: Language): Array<string> {
  const words = WORDS[lang];
  const day = formatCookingDate(menu.cookingDate, lang);
  const delivery = menu.delivery.available ? `, ${words.delivery}` : '';
  if (menu.pickupPoints.length === 0) {
    return menu.delivery.available
      ? [`${words.delivery[0]?.toUpperCase()}${words.delivery.slice(1)}`]
      : [];
  }
  return menu.pickupPoints.map((point, index) => {
    const when = formatWindow(point.window.start, point.window.end, lang);
    const last = index === menu.pickupPoints.length - 1;
    return `${words.pickup} ${day}, ${when} ${words.at} ${point.place}${last ? delivery : ''}`;
  });
}

function oneLanguage(
  menu: ShareMenu,
  settings: ShareSettings,
  lang: Language,
  origin: string,
): string {
  const words = WORDS[lang];
  const parts: Array<string> = [
    settings.postGreeting[lang].trim(),
    `${words.menu} ${formatCookingDate(menu.cookingDate, lang)}`,
    menu.items.map((item, index) => itemLine(item, index, lang)).join('\n'),
    [`${words.orderBefore} ${formatCutoff(menu.cutoffAt, lang)}`, ...pickupLines(menu, lang)].join(
      '\n',
    ),
    `${words.orderHere}: ${origin}/`,
    fillPhone(settings.postClosing[lang], settings.whatsappNumber),
  ];
  return parts.filter((part) => part !== '').join('\n\n');
}

export function buildShareText(
  menu: ShareMenu,
  settings: ShareSettings,
  post: PostLanguage,
  origin: string,
): string {
  if (post === 'both') {
    return [
      oneLanguage(menu, settings, 'id', origin),
      SEPARATOR,
      oneLanguage(menu, settings, 'en', origin),
    ].join('\n\n');
  }
  return oneLanguage(menu, settings, post, origin);
}
