import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { MENU_NS } from './i18n/register';

// Plan 103 fix 8: the small word beside a changed row in an edit session (the row itself is tinted).

const Mark = styled.small`
  margin-left: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.c.warn};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

export function ChangeMark({ kind }: Readonly<{ kind: 'added' | 'removed' | 'edited' }>) {
  const { t } = useTranslation(MENU_NS);
  return <Mark>{t(`session.${kind}`)}</Mark>;
}
