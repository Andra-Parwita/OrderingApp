import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button } from '../Button';
import { Icon } from '../Icon';

export const PAGE_SIZE = 20;

/** The items on a zero-based page. */
export function pageItems<T>(items: ReadonlyArray<T>, page: number): ReadonlyArray<T> {
  return items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}

export type PagerProps = Readonly<{
  /** Zero-based page. */
  page: number;
  total: number;
  onPage: (page: number) => void;
}>;

const Bar = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
`;
const Buttons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

/** "21–40 of 64" with Previous / Next. Renders nothing when everything fits on one page. */
export function Pager({ page, total, onPage }: PagerProps) {
  const { t } = useTranslation();
  if (total <= PAGE_SIZE) return null;
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const last = Math.ceil(total / PAGE_SIZE) - 1;
  return (
    <Bar aria-label={t('patterns.pagerLabel')}>
      <span aria-live="polite">{t('patterns.pageOf', { from, to, total })}</span>
      <Buttons>
        <Button disabled={page <= 0} onClick={() => onPage(page - 1)}>
          <Icon name="back" />
          {t('patterns.previous')}
        </Button>
        <Button disabled={page >= last} onClick={() => onPage(page + 1)}>
          {t('patterns.next')}
          <Icon name="forward" />
        </Button>
      </Buttons>
    </Bar>
  );
}
