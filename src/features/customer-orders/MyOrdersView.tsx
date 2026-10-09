import { memo, useCallback, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, OrderStatus } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode, parseOrderCode } from '../../../shared/orderCode';
import { Icon } from '../../ui';
import type { CurrentRow, EarlierRow } from './myOrdersModel';
import { ORDERS_NS } from './i18n/register';
import { OfflineNote, StateMessage, VisuallyHidden } from './layout';
import { OrderIcon, type OrderIconName } from './orderIcons';
import { Chip, type ChipTone, MainButton, OutlineButton, SectionLabel } from './orderParts';

// My orders (spec §4.5): the "Have an order code?" field, Current rows, Earlier rows, the footnote;
// or the empty state. Presentational: MyOrdersScreen feeds it from the store, the fixtures page
// feeds it from fixtures.json.

const Page = styled.main`
  max-width: 32rem;
  margin: 0 auto;
  /* Leaves room for the customer tab bar when the app shell shows one. */
  min-height: calc(100dvh - var(--customer-tabbar-height, 0rem));
  display: flex;
  flex-direction: column;
`;
const Title = styled.h1`
  margin: 0;
  padding: calc(var(--sat) + ${({ theme }) => theme.spacing.sm}) ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.md};
  font-size: 1.75rem;
  line-height: 1.2;
  font-weight: 700;
`;

// ---- The code field ----

const CodeForm = styled.form`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
`;
const CodeInput = styled.input`
  flex: 1;
  min-width: 0;
  min-height: 3rem;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-size: 1rem; /* 16 px: iPhone does not zoom into the field */

  &::placeholder {
    color: ${({ theme }) => theme.c.muted};
  }
`;
const OpenButton = styled(OutlineButton)`
  width: auto;
  min-height: 3rem;
`;
const NotFound = styled.p`
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.danger};
  font-size: ${({ theme }) => theme.type.size.md};
`;

// ---- Rows ----

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.surf};
`;
const RowButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: none;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;
  cursor: pointer;

  svg.chevron {
    color: ${({ theme }) => theme.c.muted};
  }
`;
const Body = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;
const Top = styled.span`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 ${({ theme }) => theme.spacing.sm};
`;
const Code = styled.span<{ $small?: boolean }>`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ $small }) => ($small ? '0.9375rem' : '1.0625rem')};
  font-weight: 600;
  letter-spacing: 0.06em;
`;
const Dot = styled.span`
  align-self: center;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.warn};
`;
const Total = styled.span`
  margin-left: auto;
  font-weight: 700;
`;
const Line = styled.span`
  overflow-wrap: anywhere;
`;
const Dim = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Pills = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;
/** Paid / Not paid: a word (never colour alone), smaller than the status chip. */
const Tag = styled.span<{ $tone: 'conf' | 'warn' }>`
  padding: 0.25rem ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: 700;
  line-height: 1.3;
  background: ${({ theme, $tone }) => ($tone === 'conf' ? `${theme.c.conf}24` : theme.c.warnTint)};
  color: ${({ theme, $tone }) => ($tone === 'conf' ? theme.c.conf : theme.c.warn)};
`;
const Result = styled.span<{ $tone: ChipTone }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: 600;
  color: ${({ theme, $tone }) =>
    $tone === 'conf' ? theme.c.conf : $tone === 'danger' ? theme.c.danger : theme.c.muted};

  svg {
    width: 1rem;
    height: 1rem;
  }
`;

type StatusLook = Readonly<{ tone: ChipTone; icon: OrderIconName }>;

/** Status as icon plus word: the colour only backs it up. */
function lookOf(status: OrderStatus | 'archived'): StatusLook {
  switch (status) {
    case 'ready_for_pickup':
    case 'collected':
    case 'delivered':
      return { tone: 'conf', icon: 'check' };
    case 'out_for_delivery':
      return { tone: 'ready', icon: 'truck' };
    case 'cancelled':
      return { tone: 'danger', icon: 'ban' };
    case 'confirmed':
      return { tone: 'muted', icon: 'check' };
    case 'archived':
      return { tone: 'muted', icon: 'archive' };
    case 'ordered':
      return { tone: 'muted', icon: 'clock' };
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

type CurrentRowProps = Readonly<{
  row: CurrentRow;
  lang: Language;
  onOpen: (token: string) => void;
}>;

const CurrentItem = memo(function CurrentItem({ row, lang, onOpen }: CurrentRowProps) {
  const { t } = useTranslation(ORDERS_NS);
  const open = useCallback(() => onOpen(row.token), [onOpen, row.token]);
  const how =
    row.fulfilment === 'delivery'
      ? t('list.delivery')
      : row.place
        ? `${t('list.pickup')}, ${row.place}`
        : t('list.pickup');
  const look = lookOf(row.status);
  return (
    <li>
      <RowButton type="button" onClick={open}>
        <Body>
          <Top>
            <Code translate="no">{formatOrderCode(row.code)}</Code>
            {row.unseen ? (
              <>
                <Dot aria-hidden="true" />
                <VisuallyHidden>{t('list.newUpdate')}</VisuallyHidden>
              </>
            ) : null}
            <Total>{formatMoney(row.totalCents, lang)}</Total>
          </Top>
          <Line>
            {row.kitchen} · {row.summary}
          </Line>
          <Dim>
            {row.dayText} · {how}
          </Dim>
          <Pills>
            <Chip tone={look.tone} icon={look.icon}>
              {t(`status.${row.status}`)}
            </Chip>
            {row.locked ? (
              <Chip tone="muted" icon="lock">
                {t('list.locked')}
              </Chip>
            ) : null}
            {row.paid === undefined ? null : (
              <Tag $tone={row.paid ? 'conf' : 'warn'}>
                {row.paid ? t('list.paid') : t('list.notPaid')}
              </Tag>
            )}
          </Pills>
        </Body>
        <Icon name="forward" />
      </RowButton>
    </li>
  );
});

type EarlierRowProps = Readonly<{
  row: EarlierRow;
  lang: Language;
  onOpen: (token: string) => void;
}>;

const EarlierItem = memo(function EarlierItem({ row, lang, onOpen }: EarlierRowProps) {
  const { t } = useTranslation(ORDERS_NS);
  const open = useCallback(() => onOpen(row.token), [onOpen, row.token]);
  const look = lookOf(row.status);
  const word = row.status === 'archived' ? t('list.archived') : t(`status.${row.status}`);
  return (
    <li>
      <RowButton type="button" onClick={open}>
        <Body>
          <Top>
            {row.code ? (
              <Code $small translate="no">
                {formatOrderCode(row.code)}
              </Code>
            ) : null}
            <Dim>
              {row.kitchen} · {row.dayText}
            </Dim>
            {row.totalCents === undefined ? null : (
              <Total>{formatMoney(row.totalCents, lang)}</Total>
            )}
          </Top>
          <Result $tone={look.tone}>
            <OrderIcon name={look.icon} />
            {word}
          </Result>
        </Body>
        <Icon name="forward" />
      </RowButton>
    </li>
  );
});

// ---- Empty state and footnote ----

const Empty = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: calc(3 * ${({ theme }) => theme.spacing.xl}) ${({ theme }) => theme.spacing.xl}
    ${({ theme }) => theme.spacing.xl};
  text-align: center;

  h2 {
    margin: 0;
    font-size: 1.25rem;
    line-height: 1.2;
  }
  p {
    max-width: 18rem;
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
  }
`;
const Disc = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 5rem;
  height: 5rem;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  border-radius: 50%;
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.atext};

  svg {
    width: 2.25rem;
    height: 2.25rem;
  }
`;
const Pad = styled.div`
  margin-top: ${({ theme }) => theme.spacing.sm};

  button {
    width: auto;
    min-width: 11rem;
  }
`;
const Foot = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  text-align: center;
`;
export type MyOrdersViewProps = Readonly<{
  lang: Language;
  /** `idle` counts as loading. */
  status: 'loading' | 'error' | 'ready';
  current: ReadonlyArray<CurrentRow>;
  earlier: ReadonlyArray<EarlierRow>;
  /** The last refresh failed: the rows are from the last good load. */
  stale: boolean;
  /** The failure was for want of a network ("You're offline"). */
  offline: boolean;
  /** The saved order's token for a code (any case, spacing or dashes), if this phone has it. */
  findToken: (code: string) => string | undefined;
  onOpenOrder: (token: string) => void;
  /** Empty state: the last kitchen's menu, or the home page. */
  onOpenMenu: () => void;
  onRetry: () => void;
}>;

/** My orders (my-orders, my-orders-empty). */
export function MyOrdersView({
  lang,
  status,
  current,
  earlier,
  stale,
  offline,
  findToken,
  onOpenOrder,
  onOpenMenu,
  onRetry,
}: MyOrdersViewProps) {
  const { t } = useTranslation(ORDERS_NS);
  const [typed, setTyped] = useState('');
  const [notFound, setNotFound] = useState(false);

  const tryOpen = useCallback(
    (value: string, atSixth: boolean) => {
      const parsed = parseOrderCode(value);
      if (parsed === null) {
        // Typing: wait for the 6th character. Pressing Open on anything else is "not saved".
        setNotFound(!atSixth && value.trim() !== '');
        return;
      }
      const token = findToken(parsed);
      if (token === undefined) setNotFound(true);
      else onOpenOrder(token);
    },
    [findToken, onOpenOrder],
  );
  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setTyped(event.target.value);
      setNotFound(false);
      // Typing a saved code opens that order on the 6th character.
      tryOpen(event.target.value, true);
    },
    [tryOpen],
  );
  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      tryOpen(typed, false);
    },
    [tryOpen, typed],
  );

  const empty = status === 'ready' && current.length === 0 && earlier.length === 0;
  return (
    <Page>
      <Title>{t('list.title')}</Title>
      <CodeForm onSubmit={onSubmit}>
        <CodeInput
          type="text"
          aria-label={t('list.codeLabel')}
          aria-invalid={notFound}
          aria-describedby={notFound ? 'my-orders-not-found' : undefined}
          placeholder={t('list.codePlaceholder')}
          value={typed}
          onChange={onChange}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <OpenButton type="submit">{t('list.open')}</OpenButton>
      </CodeForm>
      {notFound ? (
        <NotFound id="my-orders-not-found" role="alert">
          {t('list.codeNotFound')}
        </NotFound>
      ) : null}
      {stale ? <OfflineNote offline={offline} onRetry={onRetry} /> : null}
      {status === 'error' ? (
        <StateMessage alert text={t('list.loadError')} onRetry={onRetry} />
      ) : status === 'loading' ? (
        <StateMessage text={t('common.loading')} />
      ) : empty ? (
        <Empty>
          <Disc>
            <Icon name="bag" />
          </Disc>
          <h2>{t('list.emptyTitle')}</h2>
          <p>{t('list.emptyBody')}</p>
          <Pad>
            <MainButton type="button" onClick={onOpenMenu}>
              {t('list.toMenu')}
            </MainButton>
          </Pad>
        </Empty>
      ) : (
        <>
          {current.length > 0 ? (
            <section>
              <SectionLabel>{t('list.thisWeek')}</SectionLabel>
              <List>
                {current.map((row) => (
                  <CurrentItem key={row.token} row={row} lang={lang} onOpen={onOpenOrder} />
                ))}
              </List>
            </section>
          ) : null}
          {earlier.length > 0 ? (
            <section>
              <SectionLabel>{t('list.earlier')}</SectionLabel>
              <List>
                {earlier.map((row) => (
                  <EarlierItem key={row.token} row={row} lang={lang} onOpen={onOpenOrder} />
                ))}
              </List>
            </section>
          ) : null}
        </>
      )}
      {status === 'ready' ? (
        <Foot>
          {t('list.footnote')}
          {empty ? null : ` ${t('list.footnoteKept')}`}
        </Foot>
      ) : null}
    </Page>
  );
}
