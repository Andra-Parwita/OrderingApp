import type { TFunction } from 'i18next';
import { css, styled } from 'styled-components';
import type { ApiFailure } from '../../api/http';

export const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
  max-width: 64rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xl};
`;
export const Narrow = styled(Page)`
  max-width: 32rem;
`;
export const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
`;
const sectionStyle = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
export const Section = styled.section`
  ${sectionStyle}
`;
export const FormSection = styled.form`
  ${sectionStyle}
`;
export const Sub = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
`;
export const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
`;
export const Message = styled.p<{ $bad?: boolean }>`
  margin: 0;
  color: ${({ theme, $bad }) => ($bad ? theme.status.cancelled.fg : theme.colour.text)};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
export const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

/** One plain sentence for a failed call. */
export function failureText(t: TFunction, failure: ApiFailure): string {
  switch (failure.error) {
    case 'network':
      return t('error.network');
    case 'admin_exists':
      return t('error.adminExists');
    case 'invalid_credentials':
      return failure.triesLeft !== undefined
        ? `${t('error.badKey')} ${t('error.triesLeft', { count: failure.triesLeft })}`
        : t('error.badKey');
    case 'locked_out':
      return t('error.lockedOut', {
        minutes: Math.max(1, Math.ceil((failure.retryAfterSeconds ?? 60) / 60)),
      });
    case 'unauthorized':
      return t('error.unauthorized');
    case 'forbidden':
      return t('error.forbidden');
    case 'passkey_cancelled':
      return t('error.passkeyCancelled');
    case 'passkey_failed':
      return t('error.passkeyFailed');
    default:
      return t('error.generic');
  }
}
