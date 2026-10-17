import type { SavedOrder } from '../device/myOrders';

/**
 * Plan 087: the phone's My orders joined with the list from Remember me. Union by order link
 * (token); where both have it, the phone's own fields win (code, last status, seen marker). An
 * order only the server knows is added without a code; the list fills it in when it is opened.
 */
export function mergeSavedOrders(
  local: ReadonlyArray<SavedOrder>,
  remote: ReadonlyArray<{ token: string; slug: string }>,
  now: Date = new Date(),
): Array<SavedOrder> {
  const known = new Set(local.map((entry) => entry.token));
  const added: Array<SavedOrder> = [];
  for (const item of remote) {
    if (known.has(item.token)) continue;
    known.add(item.token);
    added.push({
      code: '',
      token: item.token,
      placedAt: now.toISOString(),
      sellerSlug: item.slug,
    });
  }
  // Local entries that lack their kitchen learn it from the server's list.
  const slugOf = new Map(remote.map((item) => [item.token, item.slug]));
  const kept = local.map((entry) => {
    const slug = slugOf.get(entry.token);
    return entry.sellerSlug === undefined && slug !== undefined
      ? { ...entry, sellerSlug: slug }
      : entry;
  });
  return [...kept, ...added];
}
