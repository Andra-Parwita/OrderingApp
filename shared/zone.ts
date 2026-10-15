// Plan 077 (D-101): every moment is stored as an instant; screens show it in the viewer's device
// zone. This is the one place that knows about time zones. Pure functions, no imports.

/** The zone of every kitchen until the owner says otherwise (D-101: "for now they are all in Adelaide"). */
export const DEFAULT_ZONE = 'Australia/Adelaide';

/** Whether `name` is an IANA zone this runtime knows. */
export function isValidZone(name: unknown): name is string {
  if (typeof name !== 'string' || name === '' || name.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** The device's own zone (falls back to the default where the runtime does not say). */
export function deviceZone(): string {
  try {
    const name = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidZone(name) ? name : DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
}

/** "Australia/Adelaide" as "Adelaide"; "America/Argentina/Buenos_Aires" as "Buenos Aires". */
export function zoneCity(zone: string): string {
  const last = zone.split('/').pop() ?? zone;
  return last.replace(/_/g, ' ');
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  let found = formatters.get(zone);
  if (!found) {
    found = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(zone, found);
  }
  return found;
}

function wallClock(ms: number, zone: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(zone).formatToParts(new Date(ms))) parts[part.type] = part.value;
  return parts;
}

/** Minutes the zone is ahead of UTC at that instant (Adelaide 570 or 630, Jakarta 420). */
export function offsetMinutes(ms: number, zone: string): number {
  const p = wallClock(ms, zone);
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

function offsetText(minutes: number): string {
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** An instant as the zone's wall-clock date ("YYYY-MM-DD") and time ("HH:MM"). */
export function splitInstant(iso: string, zone: string): { date: string; time: string } {
  const p = wallClock(Date.parse(iso), zone);
  return {
    date: `${p['year']}-${p['month']}-${p['day']}`,
    time: `${String(Number(p['hour']) % 24).padStart(2, '0')}:${p['minute']}`,
  };
}

/** The zone's wall-clock date and time as an ISO instant with its offset, e.g. …T21:00:00+10:30. */
export function toInstant(date: string, time: string, zone: string): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  const offset = offsetMinutes(asUtc - offsetMinutes(asUtc, zone) * 60_000, zone);
  return `${date}T${time}:00${offsetText(offset)}`;
}

/** The zone's UTC offset on that local date (taken at noon, after any change at night), "+10:30". */
export function zoneOffset(date: string, zone: string): string {
  return toInstant(date, '12:00', zone).slice(-6);
}

/**
 * A pickup window is the kitchen's wall-clock "HH:MM" on its cooking date. The same moments as the
 * `to` zone's wall clock (identity when the zones match). A window that crosses midnight in `to`
 * keeps the clock times only.
 */
export function convertWindow(
  window: Readonly<{ start: string; end: string }>,
  cookingDate: string,
  from: string,
  to: string,
): { start: string; end: string } {
  if (from === to) return { start: window.start, end: window.end };
  return {
    start: splitInstant(toInstant(cookingDate, window.start, from), to).time,
    end: splitInstant(toInstant(cookingDate, window.end, from), to).time,
  };
}

// ---- The kitchen being viewed (screens only) ----
// A screen shows one kitchen at a time. The API layer notes its zone from any payload that carries
// it (`kitchen.timeZone`), so every pickup window on screen can be converted without passing the
// zone through each component. The Worker never uses this.
let viewedZone = DEFAULT_ZONE;

/** The zone of the kitchen on screen (the default until a payload says otherwise). */
export function viewedKitchenZone(): string {
  return viewedZone;
}

export function setViewedKitchenZone(zone: string): void {
  if (isValidZone(zone)) viewedZone = zone;
}

/** Notes the zone from an API payload that has `kitchen.timeZone`. */
export function noteKitchenZone(data: unknown): void {
  if (typeof data !== 'object' || data === null) return;
  const kitchen = (data as { kitchen?: unknown }).kitchen;
  if (typeof kitchen !== 'object' || kitchen === null) return;
  const zone = (kitchen as { timeZone?: unknown }).timeZone;
  if (typeof zone === 'string') setViewedKitchenZone(zone);
}

/** A pickup window stored in the kitchen's clock, as the device's clock (identity when they match). */
export function windowToDevice(
  window: Readonly<{ start: string; end: string }>,
  cookingDate: string,
): { start: string; end: string } {
  return convertWindow(window, cookingDate, viewedZone, deviceZone());
}

/** A window typed in the device's clock, as the kitchen's clock for saving. */
export function windowToKitchen(
  window: Readonly<{ start: string; end: string }>,
  cookingDate: string,
): { start: string; end: string } {
  return convertWindow(window, cookingDate, deviceZone(), viewedZone);
}

/** Whether the device's zone differs from the kitchen's (the "your time" label shows then). */
export function zonesDiffer(kitchenZone: string = viewedZone): boolean {
  return kitchenZone !== deviceZone();
}
