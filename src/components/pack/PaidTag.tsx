import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { PACK_NS } from './i18n/register';

// "Paid" (green) or "Not paid" (amber) as small text under a total, or as a pill in a pinned header.
// Always a word, never colour alone.

const Tag = styled.span<{ $paid: boolean; $pill: boolean }>`
  display: inline-block;
  padding: ${({ $pill, theme }) => ($pill ? `0 ${theme.spacing.sm}` : '0')};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ $pill, $paid, theme }) =>
    $pill ? ($paid ? theme.c.tint : theme.c.warnTint) : 'transparent'};
  color: ${({ $paid, theme }) => ($paid ? theme.c.conf : theme.c.warn)};
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
`;

export function PaidTag({ paid, pill = false }: Readonly<{ paid: boolean; pill?: boolean }>) {
  const { t } = useTranslation(PACK_NS);
  return (
    <Tag $paid={paid} $pill={pill}>
      {paid ? t('paid') : t('notPaid')}
    </Tag>
  );
}
