import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate } from '../../../../shared/dates';
import type { Language } from '../../../../shared/domain';
import { BottomSheet, Button } from '../../../ui';
import { MENU_NS } from '../i18n/register';

// Plan 127: the "Default delivery day" choice of the tablet (DefaultDaySheet), as a bottom sheet.

const Help = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
`;
const Choice = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.minTapTarget};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  cursor: pointer;

  input {
    flex: none;
    width: 1.25rem;
    height: 1.25rem;
    accent-color: ${({ theme }) => theme.c.fill};
  }
`;
const Actions = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

export function DefaultDayBottomSheet({
  cookingDate,
  days,
  current,
  lang,
  onPick,
  onClose,
}: Readonly<{
  cookingDate: string;
  /** The ticked days. */
  days: ReadonlyArray<string>;
  current: string;
  lang: Language;
  onPick: (day: string) => void;
  onClose: () => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const [picked, setPicked] = useState(current);
  return (
    <BottomSheet title={t('details.defaultDay.title')} onClose={onClose}>
      <Help>{t('details.defaultDay.help')}</Help>
      <div role="radiogroup" aria-label={t('details.defaultDay.title')}>
        {[...days].sort().map((day) => (
          <Choice key={day}>
            <input
              type="radio"
              name="phone-default-delivery-day"
              checked={picked === day}
              onChange={() => setPicked(day)}
            />
            {formatCookingDate(day, lang)}
            {day === cookingDate ? ` · ${t('details.deliveryDays.eventDay')}` : ''}
          </Choice>
        ))}
      </div>
      {days.length < 2 ? <Help>{t('details.defaultDay.tickFirst')}</Help> : null}
      <Actions>
        <Button fullWidth onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button variant="primary" fullWidth onClick={() => onPick(picked)}>
          {t('details.defaultDay.save')}
        </Button>
      </Actions>
    </BottomSheet>
  );
}
