import { useTranslation } from 'react-i18next';
import { formatCookingDate } from '../../../shared/dates';
import { deliveryPlan } from '../../../shared/deliveryDays';
import type { Delivery, Language } from '../../../shared/domain';
import { ChipRow, DayChip } from '../../components/dayChips/DayChips';
import { SELLER_NS } from './i18n/register';
import { Field, Label } from './orderFormParts';

// Plan 126: "Delivery day" chips on the seller's New order, for a delivery order on a menu that has
// more than the event day. The menu's default day is pre-selected.

/** The days to offer, or [] when the row should not show (not delivery, or only the event day). */
export function newOrderDays(
  cookingDate: string | undefined,
  delivery: Delivery | undefined,
  isDelivery: boolean,
): { days: Array<string>; defaultDay: string } {
  if (!isDelivery || !cookingDate || !delivery?.available) return { days: [], defaultDay: '' };
  const plan = deliveryPlan(cookingDate, delivery);
  return plan.custom
    ? { days: plan.days, defaultDay: plan.defaultDay }
    : { days: [], defaultDay: '' };
}

export function NewOrderDayRow({
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
  const { t } = useTranslation(SELLER_NS);
  return (
    <Field>
      <Label>{t('new.deliveryDay')}</Label>
      <ChipRow role="radiogroup" aria-label={t('new.deliveryDay')}>
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
    </Field>
  );
}
