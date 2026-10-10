import type { AuditDiff, Fulfilment, Language, OrderLine } from './domain';
import { pickText } from './text';

type Editable = { lines: ReadonlyArray<OrderLine>; fulfilment: Fulfilment; note?: string };

/** What changed between two versions of an order, or null if nothing did. */
export function diffOrder(before: Editable, after: Editable): AuditDiff | null {
  const items: AuditDiff['items'] = [];
  for (const line of after.lines) {
    const was = before.lines.find((candidate) => candidate.itemId === line.itemId)?.qty ?? 0;
    if (line.qty !== was)
      items.push({ itemId: line.itemId, name: line.name, delta: line.qty - was });
  }
  for (const line of before.lines) {
    if (!after.lines.some((candidate) => candidate.itemId === line.itemId)) {
      items.push({ itemId: line.itemId, name: line.name, delta: -line.qty });
    }
  }
  const diff: AuditDiff = { items };
  if ((before.note ?? '') !== (after.note ?? '')) diff.note = true;
  if (before.fulfilment !== after.fulfilment) {
    diff.fulfilment = { from: before.fulfilment, to: after.fulfilment };
  }
  return items.length > 0 || diff.note || diff.fulfilment ? diff : null;
}

const WORDS: Record<Language, { note: string; pickup: string; delivery: string }> = {
  en: { note: 'note changed', pickup: 'pickup', delivery: 'delivery' },
  id: { note: 'catatan diubah', pickup: 'ambil', delivery: 'antar' },
};

/** e.g. `+1 Lemper ayam · −1 Tempe mendoan · note changed · pickup → delivery`. */
export function formatAuditDiff(diff: AuditDiff, lang: Language): string {
  const words = WORDS[lang];
  const parts = diff.items.map(
    (item) =>
      `${item.delta > 0 ? '+' : '−'}${String(Math.abs(item.delta))} ${pickText(item.name, lang)}`,
  );
  if (diff.note) parts.push(words.note);
  if (diff.fulfilment) parts.push(`${words[diff.fulfilment.from]} → ${words[diff.fulfilment.to]}`);
  return parts.join(' · ');
}
