import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { formatOrderCode } from '../../../shared/orderCode';
import { Icon } from '../../ui';
import { SELLER_NS } from './i18n/register';
import type { RepeatOf } from './repeatOrders';
import { selectRepeats } from './sellerOrdersSelectors';
import type { SellerOrdersRootState } from './sellerOrdersSlice';

/** The earlier order this one may repeat, or undefined (no flag). */
export function useRepeatOf(code: string): RepeatOf | undefined {
  return useSelector((state: SellerOrdersRootState) => selectRepeats(state).get(code));
}

function useRepeatText(repeat: RepeatOf): string {
  const { t } = useTranslation(SELLER_NS);
  const base = { code: formatOrderCode(repeat.code) };
  return repeat.seconds >= 60
    ? t('repeat.noteMin', { ...base, minutes: Math.round(repeat.seconds / 60) })
    : t('repeat.note', { ...base, seconds: repeat.seconds });
}

const Notice = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
  font-size: 0.875rem;
  overflow-wrap: anywhere;

  svg {
    flex: none;
    color: ${({ theme }) => theme.c.warn};
  }
`;

/** Order detail: a short amber note on the second of two look-alike orders. */
export function RepeatNote({ code }: Readonly<{ code: string }>) {
  const repeat = useRepeatOf(code);
  if (!repeat) return null;
  return <RepeatNoteBody repeat={repeat} />;
}

function RepeatNoteBody({ repeat }: Readonly<{ repeat: RepeatOf }>) {
  const text = useRepeatText(repeat);
  return (
    <Notice data-testid="repeat-note">
      <Icon name="warning" />
      <div>{text}</div>
    </Notice>
  );
}

const TagRoot = styled.span`
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.warn};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  color: ${({ theme }) => theme.c.warn};
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
`;

/** Order row: a short amber "Repeat?" tag; the full text is its title and label. */
export function RepeatTag({ code }: Readonly<{ code: string }>) {
  const repeat = useRepeatOf(code);
  if (!repeat) return null;
  return <RepeatTagBody repeat={repeat} />;
}

function RepeatTagBody({ repeat }: Readonly<{ repeat: RepeatOf }>) {
  const { t } = useTranslation(SELLER_NS);
  const text = useRepeatText(repeat);
  return (
    <TagRoot data-testid="repeat-tag" title={text} aria-label={text}>
      {t('repeat.tag')}
    </TagRoot>
  );
}
