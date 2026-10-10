import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { InboxEntry, Language } from '../../../shared/domain';
import { formatDayTime } from '../../../shared/dates';
import { formatOrderCode } from '../../../shared/orderCode';
import { orderCodeLabel } from '../../components/orderCodeLabel';
import { inboxNewestFirst, inboxText } from './helpers';
import { ORDERS_NS } from './i18n/register';
import { OrderIcon, type OrderIconName } from './orderIcons';

// Building blocks shared by the order page, the earlier-order view and the QR page (spec §4.3-4.5).
// Presentational only. One filled button per screen: everything here but `MainButton` is outlined.

export const MainButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-height: 3.25rem;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const OutlineButton = styled(MainButton)<{ $danger?: boolean }>`
  background: transparent;
  color: ${({ theme, $danger }) => ($danger ? theme.c.danger : theme.c.text)};
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $danger }) => ($danger ? theme.c.danger : theme.c.ctrl)};
`;

/** A text link that is a button: at least 44 px tall. */
export const TextLink = styled.button`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`;

export const Section = styled.section`
  display: flex;
  flex-direction: column;
`;

export const SectionLabel = styled.h2`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

export const Hint = styled.p`
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  text-align: center;
`;

export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
`;

// ---- Header: kitchen · date, the code and the QR button ----

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.md};
`;
const Eyebrow = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
export const CodeText = styled.span<{ $size?: string }>`
  display: block;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ $size }) => $size ?? '1.75rem'};
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1.2;
  color: ${({ theme }) => theme.c.text};
`;
const QrButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  flex: none;
  min-width: 4rem;
  min-height: 3.5rem;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 0.75rem;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
`;

/** The code, large and in mono; a screen reader gets it character by character. */
export function OrderCode({ code, size }: Readonly<{ code: string; size?: string }>) {
  return (
    <CodeText role="img" aria-label={orderCodeLabel(code)} data-testid="order-code" $size={size}>
      {formatOrderCode(code)}
    </CodeText>
  );
}

export function OrderHead({
  eyebrow,
  code,
  onShowQr,
}: Readonly<{ eyebrow: string; code: string; onShowQr?: () => void }>) {
  const { t } = useTranslation(ORDERS_NS);
  return (
    <Head>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <OrderCode code={code} />
      </div>
      {onShowQr ? (
        <QrButton type="button" onClick={onShowQr} aria-label={t('order.showQr')}>
          <OrderIcon name="qr" />
          <span aria-hidden="true">{t('order.qrShort')}</span>
        </QrButton>
      ) : null}
    </Head>
  );
}

// ---- Status chips (icon + word, never colour alone) ----

export type ChipTone = 'conf' | 'ready' | 'warn' | 'danger' | 'muted';

const ChipRoot = styled.span<{ $tone: ChipTone }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 0.25rem ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: 700;
  line-height: 1.3;
  background: ${({ theme, $tone }) =>
    $tone === 'conf'
      ? `${theme.c.conf}24`
      : $tone === 'ready'
        ? `${theme.c.ready}24`
        : $tone === 'warn'
          ? theme.c.warnTint
          : $tone === 'danger'
            ? `${theme.c.danger}24`
            : theme.c.surf2};
  color: ${({ theme, $tone }) =>
    $tone === 'conf'
      ? theme.c.conf
      : $tone === 'ready'
        ? theme.c.ready
        : $tone === 'warn'
          ? theme.c.warn
          : $tone === 'danger'
            ? theme.c.danger
            : theme.c.muted};

  svg {
    width: 1rem;
    height: 1rem;
  }
`;

export function Chip({
  tone,
  icon,
  children,
}: Readonly<{ tone: ChipTone; icon: OrderIconName; children: ReactNode }>) {
  return (
    <ChipRoot $tone={tone}>
      <OrderIcon name={icon} />
      {children}
    </ChipRoot>
  );
}

export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
`;

// ---- Order details ----

export const Rows = styled.dl`
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: ${({ theme }) => theme.spacing.lg};
  row-gap: ${({ theme }) => theme.spacing.sm};

  dt {
    min-width: 0;
  }
  dd {
    margin: 0;
    text-align: right;
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;
export const Muted = styled.span`
  color: ${({ theme }) => theme.c.muted};
`;
export const Bold = styled.b`
  font-weight: 700;
`;

// ---- Updates from the seller ----

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Item = styled.li`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  b {
    font-weight: 700;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.sm};
  }
`;
const Empty = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;

/** The seller's messages, newest first. The list is a polite live region: a new one is announced. */
export function Updates({
  inbox,
  lang,
  place,
  cook,
}: Readonly<{ inbox: ReadonlyArray<InboxEntry>; lang: Language; place?: string; cook: string }>) {
  const { t } = useTranslation(ORDERS_NS);
  return (
    <Section aria-live="polite" data-testid="updates-section">
      <SectionLabel>{t('order.updates')}</SectionLabel>
      {inbox.length === 0 ? (
        <Empty>{t('order.noUpdates')}</Empty>
      ) : (
        <List data-testid="updates">
          {inboxNewestFirst(inbox).map((entry) => {
            const text = inboxText(entry);
            const own = text.kind === 'own';
            return (
              <Item key={`${entry.at}-${entry.kind}-${entry.textKey ?? entry.status ?? ''}`}>
                <b>
                  {own
                    ? `“${text.text}”`
                    : t(text.key === 'inbox.ready' && place ? 'inbox.readyAt' : text.key, {
                        minutes: text.minutes,
                        place: place ?? '',
                        defaultValue: t('inbox.other'),
                      })}
                </b>
                <small>
                  {own ? `${cook} · ` : ''}
                  {formatDayTime(entry.at, lang)}
                </small>
              </Item>
            );
          })}
        </List>
      )}
    </Section>
  );
}
