import { styled } from 'styled-components';
import type { Language, Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { PaidTag } from './PaidTag';
import { orderSumCents } from './packModel';

// Plan 132: the pinned top of a bag in the pack sheet and in Kitchen -> Pack: code, name, the big total,
// where and when with Paid / Not paid, and how much is ticked (with a bar). Wraps, never clips.

const Pin = styled.div`
  display: flex;
  flex: none;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.surf2};
`;
const Top = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Who = styled.h3`
  display: flex;
  flex: 1 1 8rem;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 ${({ theme }) => theme.spacing.sm};
  min-width: 0;
  margin: 0;
  font-size: 1.25rem;

  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.9375rem;
    font-weight: 600;
    color: ${({ theme }) => theme.c.muted};
    white-space: nowrap;
  }
  span {
    flex: 1 1 9rem;
    min-width: 0;
    overflow-wrap: break-word;
  }
`;
const Total = styled.strong`
  flex: none;
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
`;
const Sub = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;

  > span:first-child {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;
const Progress = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`;
const Bar = styled.span`
  display: block;
  height: 0.375rem;
  overflow: hidden;
  border-radius: 0.1875rem;
  background: ${({ theme }) => theme.c.line};

  i {
    display: block;
    height: 100%;
    background: ${({ theme }) => theme.c.fill};
  }
`;

export function PackHead({
  order,
  lang,
  where,
  progressText,
  ticked,
  total,
  className,
}: Readonly<{
  order: Order;
  lang: Language;
  where: string;
  progressText: string;
  ticked: number;
  total: number;
  className?: string;
}>) {
  const percent = total === 0 ? 0 : Math.round((ticked / total) * 100);
  return (
    <Pin className={className}>
      <Top>
        <Who>
          <code>{formatOrderCode(order.code)}</code>
          <span>{order.firstName}</span>
        </Who>
        <Total>{formatMoney(orderSumCents(order), lang)}</Total>
      </Top>
      <Sub>
        <span>{where}</span>
        <PaidTag paid={order.paid} pill />
      </Sub>
      <Progress>
        <span>{progressText}</span>
        <Bar aria-hidden="true">
          <i style={{ width: `${percent}%` }} />
        </Bar>
      </Progress>
    </Pin>
  );
}
