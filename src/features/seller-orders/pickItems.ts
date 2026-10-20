import type { LocalText, SellerMenuItemView } from '../../../shared/domain';

// Plan 111: what a seller can add to an order. A dish with choices cannot be ordered itself: its
// choices are listed as "Dish · Choice" (the name the order line gets), sold out with the dish.

const joined = (dish: LocalText, choice: LocalText): LocalText => ({
  en: `${dish.en || dish.id} · ${choice.en || choice.id}`,
  id: `${dish.id || dish.en} · ${choice.id || choice.en}`,
});

export function pickableItems(items: ReadonlyArray<SellerMenuItemView>): Array<SellerMenuItemView> {
  const parents = new Set(items.flatMap((item) => (item.groupId ? [item.groupId] : [])));
  return items
    .filter((item) => !parents.has(item.id))
    .map((item) => {
      const dish = item.groupId ? items.find((candidate) => candidate.id === item.groupId) : null;
      if (!dish) return item;
      return {
        ...item,
        name: joined(dish.name, item.name),
        soldOut: item.soldOut || dish.soldOut,
        ...(dish.manualSoldOut === true ? { manualSoldOut: true } : {}),
      };
    });
}
