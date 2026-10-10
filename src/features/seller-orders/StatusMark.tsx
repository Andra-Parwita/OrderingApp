import { useTranslation } from 'react-i18next';
import { styled, type DefaultTheme } from 'styled-components';
import type { OrderStatus } from '../../../shared/domain';
import { Icon, type IconName } from '../../ui';
import { SELLER_NS } from './i18n/register';

// Status is always an icon plus a word, never colour alone (handoff, Principles).

const Root = styled.span<{ $color: (theme: DefaultTheme) => string }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme, $color }) => $color(theme)};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  white-space: nowrap;

  svg {
    width: 1rem;
    height: 1rem;
  }
`;
// "Ordered" has no icon in the set: an empty ring says "waiting".
const Ring = styled.span`
  width: 0.875rem;
  height: 0.875rem;
  border: ${({ theme }) => theme.border.focus} solid currentColor;
  border-radius: 50%;
`;

const ICON: Readonly<Record<OrderStatus, IconName | null>> = {
  ordered: null,
  confirmed: 'check',
  ready_for_pickup: 'bag',
  out_for_delivery: 'truck',
  collected: 'check',
  delivered: 'check',
  cancelled: 'x',
};

const COLOR: Readonly<Record<OrderStatus, (theme: DefaultTheme) => string>> = {
  ordered: (theme) => theme.c.text,
  confirmed: (theme) => theme.c.conf,
  ready_for_pickup: (theme) => theme.c.conf,
  out_for_delivery: (theme) => theme.c.ready,
  collected: (theme) => theme.c.muted,
  delivered: (theme) => theme.c.muted,
  cancelled: (theme) => theme.c.danger,
};

export function StatusMark({ status }: Readonly<{ status: OrderStatus }>) {
  const { t } = useTranslation(SELLER_NS);
  const icon = ICON[status];
  return (
    <Root $color={COLOR[status]}>
      {icon ? <Icon name={icon} /> : <Ring aria-hidden="true" />}
      {t(`status.${status}`)}
    </Root>
  );
}
