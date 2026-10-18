import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Icon } from '../ui';

// A customer page pushed on top of a root page (spec §3): a top bar with ‹ Back (named after the
// page before) and then a large title. The kitchen's banner above it comes from the shell (plan 094).
// Later stages build their screens from CustomerPage; today's screens are not moved onto it yet.

const Bar = styled.header`
  display: flex;
  align-items: center;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
`;
const BackButton = styled.button`
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.size.tap}px;
  min-width: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm} 0 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  cursor: pointer;
`;
const Title = styled.h1`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.md};
  font-size: 1.75rem;
  line-height: 1.2;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  color: ${({ theme }) => theme.c.text};
`;
const Page = styled.div`
  padding-bottom: calc(var(--customer-tabbar-height, 0rem) + var(--sab));
`;

type TopBarProps = Readonly<{
  /** The previous page's name ("Menu", "Dishes", "Basket"); omit it on a root page. */
  backLabel?: string;
  onBack?: () => void;
}>;

export function PageTopBar({ backLabel, onBack }: TopBarProps) {
  const { t } = useTranslation();
  // Nothing to show on a page with no Back: no empty bar.
  if (!onBack) return null;
  return (
    <Bar>
      <BackButton
        type="button"
        onClick={onBack}
        aria-label={
          backLabel ? t('customerNav.backTo', { page: backLabel }) : t('customerNav.back')
        }
      >
        <Icon name="back" />
        <span>{backLabel ?? t('customerNav.back')}</span>
      </BackButton>
    </Bar>
  );
}

type PageProps = TopBarProps & Readonly<{ title: string; children?: ReactNode }>;

export function CustomerPage({ title, children, ...bar }: PageProps) {
  return (
    <Page>
      <PageTopBar {...bar} />
      <Title>{title}</Title>
      {children}
    </Page>
  );
}
