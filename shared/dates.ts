import type { Language } from './domain';

// Pure date/time formatting for both apps. All times show in the cook's zone, whatever the
// device zone is.
const ZONE = 'Australia/Melbourne';
const LOCALE: Record<Language, string> = { en: 'en-AU', id: 'id-ID' };

type Parts = Partial<Record<Intl.DateTimeFormatPartTypes, string>>;

function partsOf(date: Date, lang: Language, options: Intl.DateTimeFormatOptions): Parts {
  const parts: Parts = {};
  for (const part of new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: ZONE,
    ...options,
  }).formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return parts;
}

function dayText(parts: Parts, lang: Language): string {
  const day = `${parts.day ?? ''} ${(parts.month ?? '').replace(/\.$/, '')}`;
  // EN "Sat 10 Oct"; ID "Sabtu, 10 Okt"
  return lang === 'en' ? `${parts.weekday ?? ''} ${day}` : `${parts.weekday ?? ''}, ${day}`;
}

const DAY: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

// ---- Customer side ----

/** A local cooking date (YYYY-MM-DD) as "Sat 10 Oct" / "Sabtu, 10 Okt". */
export function formatCookingDate(cookingDate: string, lang: Language): string {
  const [year, month, day] = cookingDate.split('-').map(Number);
  // 00:00 UTC on that date is still the same date in Melbourne (UTC+10/+11).
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return dayText(partsOf(date, lang, lang === 'id' ? { ...DAY, weekday: 'long' } : DAY), lang);
}

function clock(hour: number, minute: number, lang: Language): string {
  if (lang === 'id') return `${String(hour).padStart(2, '0')}.${String(minute).padStart(2, '0')}`;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const time = minute === 0 ? `${h12}` : `${h12}:${String(minute).padStart(2, '0')}`;
  return `${time} ${hour < 12 ? 'am' : 'pm'}`;
}

/** An instant in Melbourne time: "Fri 9 Oct, 8 pm" / "Jumat, 9 Okt, 20.00". */
export function formatCutoff(iso: string, lang: Language): string {
  const date = new Date(iso);
  const day = partsOf(date, lang, lang === 'id' ? { ...DAY, weekday: 'long' } : DAY);
  const time = partsOf(date, lang, { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  return `${dayText(day, lang)}, ${clock(Number(time.hour), Number(time.minute), lang)}`;
}

/** Local "HH:MM" times: "2–5 pm" / "14.00–17.00". */
export function formatWindow(start: string, end: string, lang: Language): string {
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  const from = clock(sh, sm, lang);
  const to = clock(eh, em, lang);
  if (lang === 'id') return `${from}–${to}`;
  const samePeriod = from.slice(-2) === to.slice(-2);
  return samePeriod ? `${from.slice(0, -3)}–${to}` : `${from}–${to}`;
}

// ---- Seller side (compact: short weekday in both languages) ----

function part(parts: Parts, type: Intl.DateTimeFormatPartTypes): string {
  return (parts[type] ?? '').replace(/\.$/, '');
}

/** "Sat 10 Oct" for a local date "2026-10-10" or an instant (shown in Melbourne time). */
export function formatDay(value: string, lang: Language): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  // A date-only value has no time zone: pin it to noon UTC and format it as UTC.
  const date = new Date(dateOnly ? `${value}T12:00:00Z` : value);
  const parts = partsOf(date, lang, { ...DAY, ...(dateOnly ? { timeZone: 'UTC' } : {}) });
  return `${part(parts, 'weekday')} ${part(parts, 'day')} ${part(parts, 'month')}`;
}

/** "7:12 pm" (EN) or "19.12" (ID), Melbourne time. */
export function formatTime(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: lang === 'en',
  }).format(new Date(iso));
}

/** "Wed 8 Oct 7:12 pm". */
export function formatDayTime(iso: string, lang: Language): string {
  return `${formatDay(iso, lang)} ${formatTime(iso, lang)}`;
}
