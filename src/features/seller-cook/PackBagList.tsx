import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { orderSumCents, PaidTag } from '../../components/pack';
import { PrivateTag } from '../../components/PrivateTag';
import { Icon } from '../../ui';
import { COOK_NS } from './i18n/register';
import type { Bag } from './packModel';

// Kitchen · Pack, the bag list (plan 132). Every row uses the same grid tracks: tick dot, name + code,
// total with Paid / Not paid under it (right aligned), progress. Time and place share ONE line under
// them, cut with an ellipsis when long.

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Row = styled.button<{ $open: boolean }>`
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) 5rem 3.75rem;
  column-gap: ${({ theme }) => theme.spacing.sm};
  row-gap: 0;
  align-items: center;
  width: 100%;
  min-height: ${({ theme }) => theme.size.rowOrder}px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme, $open }) => ($open ? theme.c.tint : 'transparent')};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;
  cursor: pointer;
`;
const Dot = styled.span<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  grid-area: 1 / 1 / span 2;
  width: 1.5rem;
  height: 1.5rem;
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $on }) => ($on ? theme.c.fill : theme.c.ctrl)};
  border-radius: 50%;
  background: ${({ theme, $on }) => ($on ? theme.c.fill : 'transparent')};
  color: ${({ theme }) => theme.c.on};

  svg {
    width: 1rem;
    height: 1rem;
  }
`;
const Name = styled.span`
  display: flex;
  grid-area: 1 / 2;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
  font-weight: 600;

  > b {
    min-width: 0;
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
const Mono = styled.span`
  flex: none;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.c.muted};
`;
const Amount = styled.span`
  display: flex;
  grid-area: 1 / 3 / span 2;
  flex-direction: column;
  align-items: flex-end;
  font-variant-numeric: tabular-nums;
  text-align: right;

  > b {
    font-weight: 700;
  }
`;
const State = styled.span<{ $done: boolean }>`
  grid-area: 1 / 4 / span 2;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: ${({ theme, $done }) => ($done ? theme.c.atext : theme.c.text)};
`;
const Where = styled.span`
  grid-area: 2 / 2;
  min-width: 0;
  overflow: hidden;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** "11:00 · Goodwood Community Center 34 Rosa st": one line; a delivery says Delivery. */
export function bagWhere(bag: Bag, deliveryLabel: string): string {
  if (bag.place) return bag.time ? `${bag.time} · ${bag.place}` : bag.place;
  return bag.private && bag.time ? `${deliveryLabel} · ${bag.time}` : deliveryLabel;
}

export function PackBagList({
  bags,
  openCode,
  lang,
  onOpen,
}: Readonly<{
  bags: ReadonlyArray<Bag>;
  openCode: string;
  lang: Language;
  onOpen: (code: string) => void;
}>) {
  const { t } = useTranslation(COOK_NS);
  return (
    <List aria-label={t('pack.list')}>
      {bags.map((bag) => {
        const open = bag.order.code === openCode;
        const where = bagWhere(bag, t('pack.delivery'));
        return (
          <li key={bag.order.id}>
            <Row
              type="button"
              $open={open}
              aria-current={open ? 'true' : undefined}
              onClick={() => onOpen(bag.order.code)}
            >
              <Dot $on={bag.packed}>{bag.packed ? <Icon name="check" /> : null}</Dot>
              <Name>
                <b>{bag.order.firstName}</b> <Mono>{bag.code}</Mono>
                {bag.private ? <PrivateTag label={t('privateTag')} /> : null}
              </Name>
              <Amount>
                <b>{formatMoney(orderSumCents(bag.order), lang)}</b>
                <PaidTag paid={bag.order.paid} />
              </Amount>
              <State $done={bag.packed}>
                {bag.packed ? t('pack.packed') : `${bag.ticked}/${bag.total}`}
              </State>
              <Where title={where}>{where}</Where>
            </Row>
          </li>
        );
      })}
    </List>
  );
}
