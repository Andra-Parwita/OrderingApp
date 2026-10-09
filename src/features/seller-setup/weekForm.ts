import type { Week } from '../../../shared/domain';
import type { WeekSettingsRequest } from '../../../shared/setupContract';

const ZONE = 'Australia/Melbourne';
const TEXT_MAX = 200;
const PLACE_MAX = 80;

const zoned = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function wallClock(ms: number): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of zoned.formatToParts(new Date(ms))) parts[part.type] = part.value;
  return parts;
}

/** Minutes Melbourne is ahead of UTC at that instant (600 or 660). */
function offsetMinutes(ms: number): number {
  const p = wallClock(ms);
  const asUtc = Date.UTC(
    Number(p['year']),
    Number(p['month']) - 1,
    Number(p['day']),
    Number(p['hour']) % 24,
    Number(p['minute']),
    Number(p['second']),
  );
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

/** An instant as Melbourne wall-clock date ("YYYY-MM-DD") and time ("HH:MM"). */
export function splitInstant(iso: string): { date: string; time: string } {
  const p = wallClock(Date.parse(iso));
  return {
    date: `${p['year']}-${p['month']}-${p['day']}`,
    time: `${String(Number(p['hour']) % 24).padStart(2, '0')}:${p['minute']}`,
  };
}

/** Melbourne wall-clock date and time as an ISO instant with its offset, e.g. …T21:00:00+11:00. */
export function toInstant(date: string, time: string): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  const offset = offsetMinutes(asUtc - offsetMinutes(asUtc) * 60_000);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const zone = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return `${date}T${time}:00${zone}`;
}

export type WeekDraft = {
  cookingDate: string;
  cutoffDate: string;
  cutoffTime: string;
  place: string;
  directionsEn: string;
  directionsId: string;
  start: string;
  end: string;
  delivery: boolean;
  noteEn: string;
  noteId: string;
};

export function toDraft(week: Week): WeekDraft {
  const cutoff = splitInstant(week.cutoffAt);
  const point = week.pickupPoints[0];
  return {
    cookingDate: week.cookingDate,
    cutoffDate: cutoff.date,
    cutoffTime: cutoff.time,
    place: point?.place ?? '',
    directionsEn: point?.directions.en ?? '',
    directionsId: point?.directions.id ?? '',
    start: point?.window.start ?? '14:00',
    end: point?.window.end ?? '17:00',
    delivery: week.delivery.available,
    noteEn: week.delivery.note.en,
    noteId: week.delivery.note.id,
  };
}

export type WeekErrors = Partial<
  Record<
    | 'cookingDate'
    | 'cutoffDate'
    | 'cutoffTime'
    | 'place'
    | 'window'
    | 'directionsEn'
    | 'directionsId'
    | 'noteEn'
    | 'noteId',
    'required' | 'cutoffLate' | 'window' | 'tooLong'
  >
>;

export function validate(draft: WeekDraft): WeekErrors {
  const errors: WeekErrors = {};
  if (draft.cookingDate === '') errors.cookingDate = 'required';
  if (draft.cutoffDate === '') errors.cutoffDate = 'required';
  else if (draft.cookingDate !== '' && draft.cutoffDate > draft.cookingDate) {
    errors.cutoffDate = 'cutoffLate';
  }
  if (draft.cutoffTime === '') errors.cutoffTime = 'required';
  const place = draft.place.trim();
  if (place === '') errors.place = 'required';
  else if (place.length > PLACE_MAX) errors.place = 'tooLong';
  if (draft.start === '' || draft.end === '' || draft.end <= draft.start) errors.window = 'window';
  const texts = ['directionsEn', 'directionsId', 'noteEn', 'noteId'] as const;
  for (const key of texts) if (draft[key].trim().length > TEXT_MAX) errors[key] = 'tooLong';
  return errors;
}

export const TEXT_LIMIT = TEXT_MAX;
export const PLACE_LIMIT = PLACE_MAX;

/** The request to save; call only when `validate` found nothing. `pickupId` keeps the current point. */
export function toRequest(draft: WeekDraft, pickupId: string | undefined): WeekSettingsRequest {
  return {
    cookingDate: draft.cookingDate,
    cutoffAt: toInstant(draft.cutoffDate, draft.cutoffTime),
    pickupPoints: [
      {
        ...(pickupId ? { id: pickupId } : {}),
        place: draft.place.trim(),
        directions: { en: draft.directionsEn.trim(), id: draft.directionsId.trim() },
        window: { start: draft.start, end: draft.end },
      },
    ],
    delivery: {
      available: draft.delivery,
      note: { en: draft.noteEn.trim(), id: draft.noteId.trim() },
    },
  };
}
