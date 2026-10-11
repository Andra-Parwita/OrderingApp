import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import type { PastWeekSummary } from '../../../shared/pastWeeks';
import { pickText } from '../../../shared/text';
import { Button, SlideOver } from '../../ui';
import { HOME_NS, registerSellerHomeI18n } from './i18n/register';

// An earlier menu in a side panel (440 px, from the right): its numbers and the dishes sold. Home
// stays where it is; "New menu with these dishes" opens the New menu dialog on top.

const Head = styled.div`
  padding: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  p {
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
  .eyebrow {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  h2 {
    margin: ${({ theme }) => theme.spacing.xs} 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
  .ok {
    color: ${({ theme }) => theme.c.conf};
    font-weight: 600;
  }
  .owed {
    color: ${({ theme }) => theme.c.warn};
    font-weight: 600;
  }
`;
const Sold = styled.section`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};

  h3 {
    margin: 0 0 ${({ theme }) => theme.spacing.sm};
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.sm} 0;
    border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    font-variant-numeric: tabular-nums;
  }
`;
const Footer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
`;

export type PastMenuPanelProps = Readonly<{
  week: PastWeekSummary;
  lang: Language;
  onClose: () => void;
  onUseDishes: () => void;
  onGoOrders: () => void;
}>;

export function PastMenuPanel({
  week,
  lang,
  onClose,
  onUseDishes,
  onGoOrders,
}: PastMenuPanelProps) {
  registerSellerHomeI18n();
  const { t } = useTranslation(HOME_NS);
  const { totals } = week;
  const owed = totals.unpaidCents > 0;
  return (
    <SlideOver
      label={t('panel.label')}
      closeLabel={t('close')}
      onClose={onClose}
      width="27.5rem"
      footer={
        <Footer>
          <Button
            variant="primary"
            fullWidth
            disabled={totals.items.length === 0}
            onClick={onUseDishes}
          >
            {t('panel.useDishes')}
          </Button>
          <Button fullWidth onClick={onGoOrders}>
            {t('panel.goOrders')}
          </Button>
        </Footer>
      }
    >
      <Head>
        <p className="eyebrow">{t('panel.eyebrow')}</p>
        <h2>{formatDay(week.cookingDate, lang)}</h2>
        <p>
          {t('panel.summary', {
            orders: totals.orders,
            total: formatMoney(totals.incomeCents, lang),
          })}{' '}
          ·{' '}
          <span className={owed ? 'owed' : 'ok'}>
            {owed
              ? t('quiet.unpaidAmount', { amount: formatMoney(totals.unpaidCents, lang) })
              : t('quiet.allPaid')}
          </span>
        </p>
      </Head>
      <Sold>
        <h3>{t('panel.dishesSold')}</h3>
        <ul>
          {totals.items.map((item) => (
            <li key={item.itemId}>
              <span>{pickText(item.name, lang)}</span>
              <strong>{item.qty}</strong>
            </li>
          ))}
        </ul>
      </Sold>
    </SlideOver>
  );
}
