import { parseNotes, type PublicNote } from '../../shared/shortMessage';

/** Plan 086: the short messages this page may show now. Empty when they cannot be read. */
export async function fetchNotes(
  audience: 'sellers' | 'customers',
  kitchens: ReadonlyArray<string>,
  fetchImpl: typeof fetch = fetch,
): Promise<Array<PublicNote>> {
  try {
    const query = new URLSearchParams({ audience, kitchens: kitchens.join(',') });
    const response = await fetchImpl(`/api/notes?${query.toString()}`, { cache: 'no-store' });
    if (!response.ok) return [];
    return parseNotes(await response.json())?.notes ?? [];
  } catch {
    return [];
  }
}
