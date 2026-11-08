import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate } from '../../../shared/dates';
import { EXTRA_DAYS_SOFT, dayOffset, deliveryPlan, stripDays } from '../../../shared/deliveryDays';
import type { Delivery, Language } from '../../../shared/domain';
import { ChipRow, DayChip, SoftWarn, type DayKind } from '../../components/dayChips/DayChips';
import { DefaultDaySheet } from './DefaultDaySheet';
import { MENU_NS } from './i18n/register';
import { GroupLabel, Muted } from './menuShared';

// Plan 126: under the Delivery switch, "Delivery days": 2 days before, the event day (the cooking
// day, soft blue) and 1 day after, as chips. The lock day is the default customers see first;
// tapping it opens a sheet to pick another default. A day 2 before gets a soft warning, never a block.

// A band across the whole Details step (a full-width row of its grid, right under the delivery
// section) so all four chips fit on one row.
const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  grid-column: 1 / -1;
  min-width: 0;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Warnings = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Inner = styled.span`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.xs} 0;
  line-height: 1.25;
`;
const Small = styled.span`
  font-size: 0.75rem;
  font-weight: 400;
`;
/** "Fri 13 Nov" as "Fri 13": the month is in the cooking day above. */
const shortDay = (day: string, lang: Language) =>
  formatCookingDate(day, lang).replace(/\s+\S+$/, '');

export type DaysChange = { days: Array<string>; defaultDay: string };

export function DeliveryDaysField({
  cookingDate,
  delivery,
  lang,
  onChange,
}: Readonly<{
  cookingDate: string;
  delivery: Delivery;
  lang: Language;
  onChange: (next: DaysChange) => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const [choosing, setChoosing] = useState(false);
  const plan = deliveryPlan(cookingDate, delivery);
  const toggle = (day: string) =>
    onChange({
      days: plan.days.includes(day) ? plan.days.filter((d) => d !== day) : [...plan.days, day],
      defaultDay: plan.defaultDay,
    });
  const soft = plan.days.filter((day) => dayOffset(cookingDate, day) < -EXTRA_DAYS_SOFT);
  return (
    <Wrap aria-label={t('details.deliveryDays.title')}>
      <GroupLabel>{t('details.deliveryDays.title')}</GroupLabel>
      <ChipRow role="group" aria-label={t('details.deliveryDays.title')}>
        {stripDays(cookingDate).map((day) => {
          const event = day === cookingDate;
          const ticked = plan.days.includes(day);
          const isDefault = ticked && day === plan.defaultDay;
          const kind: DayKind = event ? (ticked ? 'event' : 'eventOff') : ticked ? 'on' : 'off';
          const notes = [
            event ? t('details.deliveryDays.eventDay') : null,
            isDefault ? t('details.deliveryDays.default') : null,
          ].filter(Boolean);
          return (
            <DayChip
              key={day}
              type="button"
              $kind={kind}
              $ring={isDefault}
              aria-pressed={ticked}
              aria-haspopup={isDefault ? 'dialog' : undefined}
              onClick={() => (isDefault ? setChoosing(true) : toggle(day))}
            >
              <Inner>
                <span>
                  {isDefault ? '🔒 ' : ticked && !event ? '✓ ' : ''}
                  {shortDay(day, lang)}
                </span>
                {notes.length > 0 ? <Small>{notes.join(' · ')}</Small> : null}
              </Inner>
            </DayChip>
          );
        })}
      </ChipRow>
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
      {choosing ? (
        <DefaultDaySheet
          days={plan.days}
          current={plan.defaultDay}
          lang={lang}
          onClose={() => setChoosing(false)}
          onPick={(day) => {
            setChoosing(false);
            if (day !== plan.defaultDay) onChange({ days: plan.days, defaultDay: day });
          }}
        />
      ) : null}
    </Wrap>
  );
}
