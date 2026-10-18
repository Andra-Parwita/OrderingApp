import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { SELLER_NS } from './i18n/register';

// Cells that the live (tablet) and phone order rows share. Only the byte-identical ones live here:
// the others (code, name, total, items) differ in size or weight between the two rows.

// Plan 021: the highlight is never colour alone; this word goes with it.
const NewTagRoot = styled.span`
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.atext};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  color: ${({ theme }) => theme.c.atext};
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
`;

export function NewTag() {
  const { t } = useTranslation(SELLER_NS);
  return <NewTagRoot>{t('live.new')}</NewTagRoot>;
}
