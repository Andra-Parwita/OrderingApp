import type { Language, LocalText } from '../../../shared/domain';
import type { Dish } from '../../../shared/menusContract';
import { pickText } from '../../../shared/text';

/** Past menus keep the dish names, not library ids, so "use these dishes" matches by name. */
const norm = (text: string) => text.trim().toLowerCase();

export function matchPastDishes(
  items: ReadonlyArray<{ name: LocalText }>,
  library: ReadonlyArray<Dish>,
): { ids: Array<string>; missing: number } {
  const ids: Array<string> = [];
  let missing = 0;
  for (const item of items) {
    const en = norm(item.name.en);
    const id = norm(item.name.id);
    const hit = library.find(
      (dish) =>
        (en !== '' && norm(dish.name.en) === en) || (id !== '' && norm(dish.name.id) === id),
    );
    if (!hit) missing += 1;
    else if (!ids.includes(hit.id)) ids.push(hit.id);
  }
  return { ids, missing };
}

/** "Nasi Ayam Bali · Rendang · …" for the Past menus rows. */
export function dishLine(items: ReadonlyArray<{ name: LocalText }>, lang: Language): string {
  return items.map((item) => pickText(item.name, lang)).join(' · ');
}
