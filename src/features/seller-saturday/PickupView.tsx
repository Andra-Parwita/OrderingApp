import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, PickupPoint, SellerOrder } from '../../../shared/domain';
import type { MessageLogEntry, MessagePlaceResponse } from '../../../shared/handoverContract';
import { formatOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';
import { Icon } from '../../ui';
import { describeMessage, MessageDialog } from './MessageDialog';
import { SATURDAY_NS } from './i18n/register';
import {
  clock,
  isClosed,
  itemsShort,
  money,
  Mono,
  Muted,
  OrderRowRoot,
  PackedTag,
  StatusMark,
  totalCents,
} from './parts';

const Columns = styled.div<{ $single?: boolean }>`
  display: grid;
  grid-auto-columns: ${({ $single }) => ($single ? '100%' : 'minmax(20rem, 1fr)')};
  grid-auto-flow: column;
  flex: 1;
  min-height: 0;
  overflow-x: auto;
`;
const Column = styled.section`
  min-width: 0;
  border-right: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  &:last-child {
    border-right: 0;
  }
`;
const Head = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const HeadText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
`;
const Counts = styled.span`
  font-weight: 600;
`;
const LastSent = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.conf};
  font-size: 0.875rem;

  svg {
    width: 1rem;
    height: 1rem;
  }
`;
const MessageButton = styled.button`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`;
const Chooser = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-size: 0.8125rem;
  font-weight: 700;

  select {
    min-height: ${({ theme }) => theme.size.tap}px;
    padding: 0 ${({ theme }) => theme.spacing.md};
    border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
    border-radius: ${({ theme }) => theme.size.radiusControl}px;
    background: ${({ theme }) => theme.c.surf};
    color: ${({ theme }) => theme.c.text};
    font: inherit;
    font-weight: 400;
  }
`;
const List = styled.ul`
  margin: 0;
  padding: 0;
`;
const Name = styled.b<{ $struck: boolean }>`
  margin-left: ${({ theme }) => theme.spacing.sm};
  text-decoration: ${({ $struck }) => ($struck ? 'line-through' : 'none')};
`;
const Right = styled.span`
  grid-column: 2;
  grid-row: 1;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-weight: 600;
`;
const Unpaid = styled.span`
  color: ${({ theme }) => theme.c.warn};
`;
const Sub = styled.span`
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: 0.875rem;
`;

type Props = Readonly<{
  places: ReadonlyArray<PickupPoint>;
  /** Pickup orders after the search. */
  orders: ReadonlyArray<SellerOrder>;
  messages: ReadonlyArray<MessageLogEntry>;
  lang: Language;
  onSent: (result: MessagePlaceResponse, place: PickupPoint) => void;
  /** Phone: one place at a time, chosen from a select. */
  single?: boolean;
}>;

/** Which column an order belongs to: its place, else the menu's first (as the server counts it). */
function placeOf(order: SellerOrder, places: ReadonlyArray<PickupPoint>): string | undefined {
  const own = places.find((p) => p.id === order.pickupPlaceId);
  return (own ?? places[0])?.id;
}

/** Pickup: one column per place of the current menu. No per-row buttons (D-066, handoff). */
export function PickupView({ places, orders, messages, lang, onSent, single = false }: Props) {
  const { t } = useTranslation(SATURDAY_NS);
  const [open, setOpen] = useState<PickupPoint | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  if (places.length === 0) return <Muted role="status">{t('pickup.noPlaces')}</Muted>;

  const chosenId = places.find((p) => p.id === chosen)?.id ?? places[0]?.id;
  const shown = single ? places.filter((p) => p.id === chosenId) : places;

  return (
    <>
      {single && places.length > 1 ? (
        <Chooser>
          {t('pickup.place')}
          <select value={chosenId} onChange={(event) => setChosen(event.target.value)}>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.place} · {place.window.start}–{place.window.end}
              </option>
            ))}
          </select>
        </Chooser>
      ) : null}
      <Columns $single={single}>
        {shown.map((place) => {
          const mine = orders.filter((o) => placeOf(o, places) === place.id);
          const waiting = mine.filter((o) => !isClosed(o.status)).length;
          const collected = mine.filter((o) => o.status === 'collected').length;
          const last = messages.find((m) => m.group === `place:${place.id}`);
          return (
            <Column key={place.id} aria-label={place.place}>
              <Head>
                <HeadText>
                  <h2>{place.place}</h2>
                  <Muted>
                    {place.window.start}–{place.window.end}
                    {pickText(place.directions, lang)
                      ? ` · ${pickText(place.directions, lang)}`
                      : ''}
                  </Muted>
                  <Counts>{t('pickup.counts', { toCollect: waiting, collected })}</Counts>
                  {last ? (
                    <LastSent>
                      <Icon name="check" />
                      {t('message.sentLine', {
                        text: describeMessage(last, t, lang),
                        time: clock(last.at),
                      })}
                    </LastSent>
                  ) : null}
                </HeadText>
                <MessageButton
                  type="button"
                  aria-label={t('pickup.messageLabel', { place: place.place })}
                  onClick={() => setOpen(place)}
                >
                  <Icon name="bell" />
                  {t('pickup.message')}
                  <span>{waiting}</span>
                </MessageButton>
              </Head>
              {mine.length === 0 ? (
                <Muted role="status">{t('pickup.empty')}</Muted>
              ) : (
                <List>
                  {mine.map((order) => (
                    <PickupRow key={order.code} order={order} lang={lang} />
                  ))}
                </List>
              )}
            </Column>
          );
        })}
      </Columns>
      {open ? (
        <MessageDialog
          place={open}
          reach={orders.filter((o) => placeOf(o, places) === open.id && !isClosed(o.status)).length}
          sent={messages.filter((m) => m.group === `place:${open.id}`)}
          lang={lang}
          onClose={() => setOpen(null)}
          onSent={(result) => {
            onSent(result, open);
            setOpen(null);
          }}
        />
      ) : null}
    </>
  );
}

function PickupRow({ order, lang }: Readonly<{ order: SellerOrder; lang: Language }>) {
  const { t } = useTranslation(SATURDAY_NS);
  const closed = isClosed(order.status);
  const code = formatOrderCode(order.code);
  return (
    <OrderRowRoot $dim={closed} aria-label={t('pickup.rowLabel', { code, name: order.firstName })}>
      <span>
        <Mono>{code}</Mono>
        <Name $struck={order.status === 'collected' || order.status === 'cancelled'}>
          {order.firstName}
        </Name>
      </span>
      <Right>
        {order.paid ? (
          <span>{t('common.paid')}</span>
        ) : (
          <Unpaid>{t('common.notPaid', { amount: money(totalCents(order), lang) })}</Unpaid>
        )}
      </Right>
      <Sub>
        <span>{itemsShort(order.lines, lang)}</span>
        <StatusMark status={order.status} />
        {order.packed === true ? <PackedTag>{t('common.packed')}</PackedTag> : null}
      </Sub>
    </OrderRowRoot>
  );
}
