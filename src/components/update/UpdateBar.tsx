// "A new version is ready" bar (plan 059, look from plan 095): a solid green pill at the top. It never
// reloads by itself, so nothing typed is lost. Tapping the bar reloads; the cross only hides it until
// the next check.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoticeSlot, Pill, PillButton, PillClose, PillLink } from '../notice/NoticePill';
import { PillBody } from '../notice/NoticePill';
import { useTopBar } from '../../theme/topBars';
import { UPDATE_NS } from './i18n/register';
import { UPDATE_BAR_HEIGHT_VAR, watchForUpdate, type WatchOptions } from './updateCheck';

export function UpdateBar({
  watch,
  reload = () => window.location.reload(),
}: {
  watch?: WatchOptions;
  reload?: () => void;
}) {
  const { t } = useTranslation(UPDATE_NS);
  const [newer, setNewer] = useState(false);
  // Every check sets the state again, so a hidden bar comes back at the next check.
  useEffect(() => watchForUpdate(setNewer, watch), [watch]);
  // The notice and the offline banner sit below this bar (plan 080): the height goes to CSS variables.
  const bar = useRef<HTMLDivElement>(null);
  useTopBar('update', bar, newer, UPDATE_BAR_HEIGHT_VAR);
  if (!newer) return null;
  return (
    <NoticeSlot ref={bar} role="status" $top="0" $z={1000}>
      <Pill $kind="update">
        <PillButton type="button" aria-label={`${t('message')}. ${t('refresh')}`} onClick={reload}>
          <PillBody text={t('message')} />
          <PillLink>{t('refresh')}</PillLink>
        </PillButton>
        <PillClose
          type="button"
          $kind="update"
          aria-label={t('dismiss')}
          onClick={() => setNewer(false)}
        >
          ✕
        </PillClose>
      </Pill>
    </NoticeSlot>
  );
}
