import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { Button } from '../../ui';
import { CUSTOMER_NS } from './i18n/register';

/** The language the UI is currently in. */
export function useLang(): Language {
  const { i18n } = useTranslation(CUSTOMER_NS);
  return i18n.language.startsWith('id') ? 'id' : 'en';
}

export const Page = styled.main`
  max-width: 32rem;
  margin: 0 auto;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
`;

export const Block = styled.section`
  padding: ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
`;

export const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;

export const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

export const Strong = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

const Message = styled.div`
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
`;

/** Loading or error text; with `onRetry` it shows a retry button. Never a blank screen. */
export function StateMessage({
  text,
  onRetry,
  alert = false,
}: Readonly<{ text: string; onRetry?: () => void; alert?: boolean }>) {
  const { t } = useTranslation(CUSTOMER_NS);
  return (
    <Message role={alert ? 'alert' : 'status'}>
      <span>{text}</span>
      {onRetry ? <Button onClick={onRetry}>{t('common.retry')}</Button> : null}
    </Message>
  );
}
