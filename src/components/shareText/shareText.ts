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
    more: (count: number) => string;
  }
> = {
  en: {
    menu: 'Menu',
    orderBefore: 'Order before',
    pickup: 'Pickup',
    at: 'at',
    delivery: 'delivery available',
    orderHere: 'Order here',
    more: (count) => `+ ${String(count)} more on the menu`,
  },
  id: {
    menu: 'Menu',
    orderBefore: 'Pesan sebelum',
    pickup: 'Ambil',
    at: 'di',
    delivery: 'bisa diantar',
    orderHere: 'Pesan di sini',
    more: (count) => `+ ${String(count)} lainnya di menu`,
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

/**
 * The most characters the dish list of one language's post holds (plan 066). Large enough that a
 * usual menu is never cut (it wasn't before plan 066); only a very long menu ends with "+ N more".
 */
export const POST_DISHES_MAX = 3000;

/**
 * The numbered dish lines, whole lines only, until the budget is used; the rest become
 * "+ N more on the menu" (the link follows in the post). The first dish always shows.
 */
function dishList(items: ReadonlyArray<ShareItem>, lang: Language): string {
  const lines: Array<string> = [];
  let used = 0;
  for (const [index, item] of items.entries()) {
    const line = itemLine(item, index, lang);
    const cost = line.length + (lines.length > 0 ? 1 : 0);
    if (lines.length > 0 && used + cost > POST_DISHES_MAX) break;
    lines.push(line);
    used += cost;
  }
  const rest = items.length - lines.length;
  if (rest > 0) lines.push(WORDS[lang].more(rest));
  return lines.join('\n');
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
  slug: string,
): string {
  const words = WORDS[lang];
  const parts: Array<string> = [
    settings.postGreeting[lang].trim(),
    `${words.menu} ${formatCookingDate(menu.cookingDate, lang)}`,
    dishList(menu.items, lang),
    [`${words.orderBefore} ${formatCutoff(menu.cutoffAt, lang)}`, ...pickupLines(menu, lang)].join(
      '\n',
    ),
    `${words.orderHere}: ${origin}/${slug}`,
    fillPhone(settings.postClosing[lang], settings.whatsappNumber),
  ];
  return parts.filter((part) => part !== '').join('\n\n');
}

export function buildShareText(
  menu: ShareMenu,
  settings: ShareSettings,
  post: PostLanguage,
  origin: string,
  slug: string,
): string {
  if (post === 'both') {
    return [
      oneLanguage(menu, settings, 'id', origin, slug),
      SEPARATOR,
      oneLanguage(menu, settings, 'en', origin, slug),
    ].join('\n\n');
  }
  return oneLanguage(menu, settings, post, origin, slug);
}
