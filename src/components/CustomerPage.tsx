import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Icon } from '../ui';

// A customer page pushed on top of a root page (spec §3): a top bar with ‹ Back (named after the
// page before), the kitchen's wide logo centred, nothing on the right, then a large title.
// Later stages build their screens from CustomerPage; today's screens are not moved onto it yet.

const Bar = styled.header`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: calc(var(--sat) + ${({ theme }) => theme.spacing.sm}) ${({ theme }) => theme.spacing.md}
    ${({ theme }) => theme.spacing.sm};
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
const Logo = styled.img`
  grid-column: 2;
  max-width: 9rem;
  max-height: 2rem;
  object-fit: contain;
`;
const KitchenName = styled.span`
  grid-column: 2;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  color: ${({ theme }) => theme.c.text};
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
  /** The kitchen's name: shown when there is no wide logo, and the logo's alt text. */
  kitchenName: string;
  /** The kitchen's wide logo; falls back to the name. */
  logoSrc?: string;
  /** The previous page's name ("Menu", "Dishes", "Basket"); omit it on a root page. */
  backLabel?: string;
  onBack?: () => void;
}>;

export function PageTopBar({ kitchenName, logoSrc, backLabel, onBack }: TopBarProps) {
  const { t } = useTranslation();
  return (
    <Bar>
      {onBack ? (
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
      ) : null}
      {logoSrc ? (
        <Logo src={logoSrc} alt={kitchenName} />
      ) : (
        <KitchenName>{kitchenName}</KitchenName>
      )}
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
