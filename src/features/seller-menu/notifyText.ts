import type { TFunction } from 'i18next';
import { formatDayTime, formatTime, localDate } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { deviceZone } from '../../../shared/zone';

// Plan 112: the words of the Notify window and the bell's tooltip, from the sends of one menu.

/** "twice", "3 times". */
export function howMany(t: TFunction, count: number): string {
  return count === 2 ? t('notify.twice') : t('notify.nTimes', { count });
}

/** "today 8:10 am" for a send made today, else "Wed 8 Oct 8:10 am". */
export function sentWhen(t: TFunction, iso: string, lang: Language, now: Date): string {
  const zone = deviceZone();
  return localDate(new Date(iso), zone) === localDate(now, zone)
    ? t('notify.today', { time: formatTime(iso, lang, zone) })
    : formatDayTime(iso, lang, zone);
}

/** The times of several sends as one list: "8:10 am and 12:30 pm". */
export function sentTimes(isos: ReadonlyArray<string>, lang: Language, now: Date): string {
  const zone = deviceZone();
  const today = localDate(now, zone);
  return new Intl.ListFormat(lang, { type: 'conjunction' }).format(
    isos.map((iso) =>
      localDate(new Date(iso), zone) === today
        ? formatTime(iso, lang, zone)
        : formatDayTime(iso, lang, zone),
    ),
  );
}
