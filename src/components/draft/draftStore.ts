// Plan 061: drafts of half-typed forms, kept on this device only (localStorage). Every call is in
// try/catch: with storage blocked or full the form still works, it just forgets.

/** Bump when the shape of a stored draft changes: old drafts are then simply never read. */
const PREFIX = 'draft:v1:';
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** `draft:v1:<kitchen slug>:<form>:<item id | "new">`: two kitchens or two items never mix. */
export function draftKey(slug: string, form: string, id = 'new'): string {
  return `${PREFIX}${slug}:${form}:${id}`;
}

export type StoredDraft<T> = Readonly<{ value: T; baseline: string; savedAt: number }>;

export function readDraft<T>(key: string, now = Date.now()): StoredDraft<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('bad draft');
    const { value, baseline, savedAt } = parsed as Record<string, unknown>;
    if (typeof savedAt !== 'number' || value === undefined || now - savedAt > DRAFT_MAX_AGE_MS) {
      clearDraft(key);
      return null;
    }
    return { value: value as T, baseline: typeof baseline === 'string' ? baseline : '', savedAt };
  } catch {
    clearDraft(key);
    return null;
  }
}

export function writeDraft<T>(key: string, value: T, baseline: string, now = Date.now()): void {
  try {
    localStorage.setItem(key, JSON.stringify({ value, baseline, savedAt: now }));
  } catch {
    // storage unavailable or full: the draft just is not kept
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
}

/** A short stable fingerprint of what the server held when typing began (no `updatedAt` needed). */
export function fingerprint(value: unknown): string {
  const text = JSON.stringify(value) ?? '';
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}
