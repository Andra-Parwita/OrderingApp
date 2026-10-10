const ZONE = 'Australia/Melbourne';

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
