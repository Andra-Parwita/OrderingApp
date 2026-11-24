import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { keepPortion } from '../../components/pack';
import { Icon } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { useLang } from './orderText';

// Plan 132: the order's items only read (packing is done on the pack sheet). A ✓ marks a line that is
// ticked. The total is in the pinned top, not here. Shared columns: mark, count, name, price.

const Row = styled.div`
  display: grid;
  grid-template-columns: 1.25rem 2.25rem minmax(0, 1fr) auto;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;

  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;
const Mark = styled.span`
  color: ${({ theme }) => theme.c.conf};

  svg {
    width: 1rem;
    height: 1rem;
  }
`;
const Qty = styled.span`
  font-weight: 700;
`;
const LineNote = styled.span`
  display: block;
  color: ${({ theme }) => theme.c.warn};
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
`;

export function OrderItemsList({ order }: Readonly<{ order: Order }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  return (
    <div>
      {order.lines.map((line) => {
        const size = pickText(line.size, lang);
        const ticked = line.ticked === true;
        return (
          <Row key={line.itemId}>
            <Mark {...(ticked ? { role: 'img', 'aria-label': t('pack.ticked') } : {})}>
              {ticked ? <Icon name="check" /> : null}
            </Mark>
            <Qty>{line.qty}×</Qty>
            <span>
              {pickText(line.name, lang)}
              {size ? <small> · {keepPortion(size)}</small> : null}
              {line.note ? <LineNote>{line.note}</LineNote> : null}
            </span>
            <span>{formatMoney(line.priceCents * line.qty, lang)}</span>
          </Row>
        );
      })}
    </div>
  );
}
