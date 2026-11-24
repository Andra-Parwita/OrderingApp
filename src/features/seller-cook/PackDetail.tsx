import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useInRouterContext, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import type { Language, OrderLine } from '../../../shared/domain';
import { pickText } from '../../../shared/text';
import { PACK_NS, PackHead, keepPortion } from '../../components/pack';
import { PrivateTag } from '../../components/PrivateTag';
import { TOP_BARS } from '../../theme/screen';
import { Button, Icon } from '../../ui';
import { COOK_NS } from './i18n/register';
import type { Bag } from './packModel';

// Kitchen · Pack, the open bag (plan 132): pinned header, the items, and the buttons pinned at the
// bottom. Ticks are local to the page until a button saves them (the owner: "treat it like a modal").

/** The phone's bottom tab bar (3.5rem tabs) that the pinned buttons sit above. */
const PHONE_BAR = '3.5rem';

const Root = styled.section`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;
const Pinned = styled(PackHead)`
  position: sticky;
  top: calc(${TOP_BARS} + var(--sat, 0rem));
  z-index: 2;
`;
const Where = styled.p`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl} 0;
  color: ${({ theme }) => theme.c.muted};
`;
const Note = styled.p`
  margin: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl} 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
`;
const LineNote = styled.span`
  display: block;
  color: ${({ theme }) => theme.c.warn};
  font-size: 0.875rem;
`;
const Sub = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const Items = styled.ul`
  margin: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl} 0;
  padding: 0;
  list-style: none;
`;
const ItemButton = styled.button<{ $on: boolean; $other: boolean }>`
  opacity: ${({ $other }) => ($other ? 0.5 : 1)};
  display: grid;
  grid-template-columns: 1.75rem 2.5rem minmax(0, 1fr);
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: ${({ theme }) => theme.size.rowOrder}px;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: ${({ theme, $on }) => ($on ? theme.c.muted : theme.c.text)};
  font: inherit;
  font-size: 1.125rem;
  text-align: left;
  text-decoration: ${({ $on }) => ($on ? 'line-through' : 'none')};
  cursor: ${({ $other }) => ($other ? 'default' : 'pointer')};
`;
const Box = styled.span<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: ${({ theme }) => theme.border.focus} solid
    ${({ theme, $on }) => ($on ? theme.c.fill : theme.c.ctrl)};
  border-radius: 0.375rem;
  background: ${({ theme, $on }) => ($on ? theme.c.fill : 'transparent')};
  color: ${({ theme }) => theme.c.on};
`;
const Qty = styled.span`
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;
const Foot = styled.footer<{ $phone: boolean }>`
  position: sticky;
  bottom: ${({ $phone }) => ($phone ? `calc(${PHONE_BAR} + env(safe-area-inset-bottom))` : '0')};
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: auto;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.bg};

  @media (max-width: 40rem) {
    padding-inline: ${({ theme }) => theme.size.pagePadPhone}px;
  }
`;
const Failed = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
  font-size: 0.875rem;
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};

  > button {
    flex: 0 1 auto;
  }

  @media (max-width: 40rem) {
    > button {
      flex: 1 1 8rem;
    }
    > :first-child {
      flex-basis: 100%;
    }
  }
`;

/** Plan 084: the Labels page shows the preview, the paper and Print for this one order. */
function PrintLabelButton({ code }: Readonly<{ code: string }>) {
  const { t } = useTranslation(COOK_NS);
  const navigate = useNavigate();
  const go = useCallback(
    () => void navigate(`/seller/labels?order=${encodeURIComponent(code)}`),
    [navigate, code],
  );
  return (
    <Button onClick={go} aria-label={t('pack.printLabel')} title={t('pack.printLabel')}>
      <Icon name="print" />
    </Button>
  );
}

export type PackBusy = 'save' | 'ready' | 'next' | null;

export function PackDetail({
  bag,
  ticks,
  lang,
  phone,
  busy,
  failed,
  isOther,
  onToggle,
  onSave,
  onReady,
  onUnpack,
}: Readonly<{
  bag: Bag;
  ticks: ReadonlySet<string>;
  lang: Language;
  phone: boolean;
  busy: PackBusy;
  failed: boolean;
  isOther: (line: OrderLine) => boolean;
  onToggle: (itemId: string) => void;
  onSave: () => void;
  /** `next`: open the next unpacked bag after it worked. */
  onReady: (next: boolean) => void;
  onUnpack: () => void;
}>) {
  const { t } = useTranslation(COOK_NS);
  const { t: tp } = useTranslation(PACK_NS);
  const inRouter = useInRouterContext();
  const { order } = bag;
  const mine = order.lines.filter((line) => !isOther(line));
  const tickedMine = mine.filter((line) => ticks.has(line.itemId)).length;
  const where = bag.place
    ? [t('pack.pickup'), bag.place, ...(bag.time ? [bag.time] : [])].join(' · ')
    : [t('pack.delivery'), ...(bag.private && bag.time ? [bag.time] : [])].join(' · ');
  const delivery = order.fulfilment !== 'pickup';
  const off = busy !== null;
  return (
    <Root aria-label={`${order.firstName} ${bag.code}`}>
      <Pinned
        order={order}
        lang={lang}
        where={where}
        progressText={t('pack.inBag', {
          ticked: tickedMine,
          total: mine.length,
          count: mine.length,
        })}
        ticked={tickedMine}
        total={mine.length}
      />
      {bag.private ? (
        <Where>
          <PrivateTag label={t('privateTag')} />
          <Link to={`/seller/private/${order.code}`}>{t('pack.openPrivate')}</Link>
        </Where>
      ) : null}
      {order.note ? (
        <Note>
          <b>{t('pack.note')}:</b> {order.note}
        </Note>
      ) : null}
      <Items>
        {order.lines.map((line) => {
          const on = ticks.has(line.itemId);
          const other = isOther(line);
          return (
            <li key={line.itemId}>
              <ItemButton
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={
                  other ? `${pickText(line.name, lang)} · ${t('pack.otherChef')}` : undefined
                }
                disabled={other}
                $on={on}
                $other={other}
                onClick={() => onToggle(line.itemId)}
              >
                <Box $on={on}>{on ? <Icon name="check" /> : null}</Box>
                <Qty>{line.qty}×</Qty>
                <span>
                  {pickText(line.name, lang)} <Sub>· {keepPortion(pickText(line.size, lang))}</Sub>
                  {line.note ? <LineNote>{line.note}</LineNote> : null}
                </span>
              </ItemButton>
            </li>
          );
        })}
      </Items>
      <Foot $phone={phone}>
        {failed ? <Failed role="alert">{t('pack.saveError')}</Failed> : null}
        <Actions>
          {bag.packed ? (
            <Button variant="quiet" disabled={off} onClick={onUnpack}>
              {t('pack.unpack')}
            </Button>
          ) : (
            <>
              <Button variant="primary" disabled={off} onClick={() => onReady(true)}>
                <Icon name="check" />
                {busy === 'next'
                  ? tp('saving')
                  : tp(delivery ? 'readyNextBagDelivery' : 'readyNextBag')}
              </Button>
              <Button disabled={off} onClick={() => onReady(false)}>
                {busy === 'ready' ? tp('saving') : tp(delivery ? 'readyDelivery' : 'readyPickup')}
              </Button>
            </>
          )}
          <Button disabled={off} onClick={onSave}>
            {busy === 'save' ? tp('saving') : tp('save')}
          </Button>
          {inRouter ? <PrintLabelButton code={order.code} /> : null}
        </Actions>
      </Foot>
    </Root>
  );
}
