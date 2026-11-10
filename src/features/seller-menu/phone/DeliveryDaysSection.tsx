import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate } from '../../../../shared/dates';
import { EXTRA_DAYS_SOFT, dayOffset, stripDays } from '../../../../shared/deliveryDays';
import type { Language } from '../../../../shared/domain';
import { DayChip, SoftWarn, type DayKind } from '../../../components/dayChips/DayChips';
import { Button } from '../../../ui';
import { MENU_NS } from '../i18n/register';
import { KeepOpenRow } from '../KeepOpenRow';
import { Muted } from '../menuShared';
import { DefaultDayBottomSheet } from './DefaultDayBottomSheet';
import { PHONE_MENU_NS } from './i18n/register';
import type { DaysDraft } from './useDeliveryDaysDraft';

// Plan 127: the Delivery days section of the phone's menu view: the four days as two rows of two
// (a full date on one line each), the warning and hint of the tablet, then the keep-open switch.

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Label = styled.h3`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Cell = styled(DayChip)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  line-height: 1.2;
  text-align: start;
`;
const Glyph = styled.span`
  flex: none;
  width: 1.25em;
  text-align: center;
`;
const Words = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;

  small {
    font-size: 0.75rem;
    font-weight: 400;
  }
`;
const Warnings = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Rule = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Bar = styled.footer`
  display: flex;
  flex: none;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.surf};
`;
const Pair = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Problem = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
  font-weight: 600;
`;
const Done = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.size.pagePadPhone}px;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
  text-align: center;
`;

export function DeliveryDaysSection({
  cookingDate,
  lang,
  draft,
}: Readonly<{ cookingDate: string; lang: Language; draft: DaysDraft }>) {
  const { t } = useTranslation(MENU_NS);
  const [choosing, setChoosing] = useState(false);
  const { days, defaultDay } = draft;
  const toggle = (day: string) =>
    draft.setDays({
      days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
      defaultDay,
    });
  const soft = [...days].sort().filter((day) => dayOffset(cookingDate, day) < -EXTRA_DAYS_SOFT);
  return (
    <>
      <Section aria-label={t('details.deliveryDays.title')}>
        <Label>{t('details.deliveryDays.title')}</Label>
        <Grid role="group" aria-label={t('details.deliveryDays.title')}>
          {stripDays(cookingDate).map((day) => {
            const event = day === cookingDate;
            const ticked = days.includes(day);
            const isDefault = ticked && day === defaultDay;
            const kind: DayKind = event ? (ticked ? 'event' : 'eventOff') : ticked ? 'on' : 'off';
            return (
              <Cell
                key={day}
                type="button"
                $kind={kind}
                $ring={isDefault}
                aria-pressed={ticked}
                aria-haspopup={isDefault ? 'dialog' : undefined}
                onClick={() => (isDefault ? setChoosing(true) : toggle(day))}
              >
                <Glyph aria-hidden="true">{isDefault ? '🔒' : ticked ? '✓' : '＋'}</Glyph>
                <Words>
                  <span>{formatCookingDate(day, lang)}</span>
                  {isDefault ? <small>{t('details.deliveryDays.default')}</small> : null}
                </Words>
              </Cell>
            );
          })}
        </Grid>
        {soft.length > 0 ? (
          <Warnings>
            {soft.map((day) => (
              <SoftWarn key={day} role="status">
                {t('details.deliveryDays.warnBefore', {
                  day: formatCookingDate(day, lang),
                  count: Math.abs(dayOffset(cookingDate, day)),
                })}
              </SoftWarn>
            ))}
          </Warnings>
        ) : null}
        <Muted>{t('details.deliveryDays.hint')}</Muted>
      </Section>
      <Rule>
        <KeepOpenRow
          on={draft.keepOpen}
          busy={draft.busy}
          lastDay={draft.lastDay}
          lang={lang}
          onToggle={() => draft.setKeepOpen(!draft.keepOpen)}
        />
      </Rule>
      {choosing ? (
        <DefaultDayBottomSheet
          cookingDate={cookingDate}
          days={days}
          current={defaultDay}
          lang={lang}
          onClose={() => setChoosing(false)}
          onPick={(day) => {
            setChoosing(false);
            if (day !== defaultDay) draft.setDays({ days: [...days], defaultDay: day });
          }}
        />
      ) : null}
    </>
  );
}

/** Replaces the Share / Notice footer while something is changed and not saved. */
export function DeliveryDaysSaveBar({ draft }: Readonly<{ draft: DaysDraft }>) {
  const { t } = useTranslation(PHONE_MENU_NS);
  return (
    <Bar>
      {draft.failed ? <Problem role="alert">{t('days.error')}</Problem> : null}
      <Muted>{t('days.keep')}</Muted>
      <Pair>
        <Button fullWidth disabled={draft.busy} onClick={draft.discard}>
          {t('days.discard')}
        </Button>
        <Button variant="primary" fullWidth disabled={draft.busy} onClick={() => void draft.save()}>
          {draft.busy ? t('days.saving') : t('days.save')}
        </Button>
      </Pair>
    </Bar>
  );
}

/** The short "Saved" line shown above the footer after a successful save. */
export function DeliveryDaysSaved() {
  const { t } = useTranslation(PHONE_MENU_NS);
  return <Done role="status">{t('days.saved')}</Done>;
}
