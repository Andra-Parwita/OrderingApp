// Plan 087: the "✓ C-7K3M" mark for an order placed by a customer with Remember me. Nothing at all
// for any other order. The short code is the per-kitchen one; the account id never reaches here.
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { shortCustomerCode } from '../../../shared/customerCode';
import { Pill } from '../../ui';
import { SELLER_NS } from './i18n/register';

const Gap = styled.span`
  margin-inline-start: ${({ theme }) => theme.spacing.sm};
`;
const Hint = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

const shortOf = (order: Order): string | null =>
  order.confirmed && order.customerCode ? shortCustomerCode(order.customerCode) : null;

/** Short pill next to the first name in a list row. */
export function ConfirmedPill({ order }: Readonly<{ order: Order }>) {
  const { t } = useTranslation(SELLER_NS);
  const code = shortOf(order);
  if (!code) return null;
  return (
    <Gap title={t('confirmed.title')}>
      <Pill tone="done">{`✓ ${code}`}</Pill>
    </Gap>
  );
}

/** Pill and hint in the order detail. */
export function ConfirmedNote({ order }: Readonly<{ order: Order }>) {
  const { t } = useTranslation(SELLER_NS);
  const code = shortOf(order);
  if (!code) return null;
  return (
    <>
      <div>
        <Pill tone="done">{`✓ ${t('confirmed.title')} · ${code}`}</Pill>
      </div>
      <Hint>{t('confirmed.hint')}</Hint>
    </>
  );
}
