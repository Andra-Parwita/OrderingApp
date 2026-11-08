import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { ChipRow, DayChip } from '../../components/dayChips/DayChips';
import { CUSTOMER_NS } from './i18n/register';

// Plan 126: "Delivery day" under the address, only for a delivery order on a menu with extra days.
// The cooking day is pre-selected; tapping another day changes it.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg} 0;
`;
const Label = styled.h2`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

export function DeliveryDayRow({
  days,
  value,
  lang,
  onChange,
}: Readonly<{
  days: ReadonlyArray<string>;
  value: string;
  lang: Language;
  onChange: (day: string) => void;
}>) {
  const { t } = useTranslation(CUSTOMER_NS);
  const labelId = useId();
  return (
    <Wrap>
      <Label id={labelId}>{t('basket.deliveryDay')}</Label>
      <ChipRow role="radiogroup" aria-labelledby={labelId}>
        {days.map((day) => (
          <DayChip
            key={day}
            type="button"
            role="radio"
            aria-checked={day === value}
            $on={day === value}
            onClick={() => onChange(day)}
          >
            {formatCookingDate(day, lang)}
          </DayChip>
        ))}
      </ChipRow>
    </Wrap>
  );
}
