import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { DraftControls } from './useDraft';
import { DRAFT_NS } from './i18n/register';

const Line = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
`;
const Action = styled.button`
  padding: ${({ theme }) => theme.spacing.xs} 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
`;

/** "Restored what you typed · Discard", or the conflict choice when the saved version changed. */
export function DraftNotice({ draft }: Readonly<{ draft: DraftControls }>) {
  const { t } = useTranslation(DRAFT_NS);
  if (draft.conflict) {
    return (
      <Line role="status">
        <span>{t('conflict')}</span>
        <Action type="button" onClick={draft.keepMine}>
          {t('keepMine')}
        </Action>
        <span aria-hidden="true">·</span>
        <Action type="button" onClick={draft.useSaved}>
          {t('useSaved')}
        </Action>
      </Line>
    );
  }
  if (!draft.restored) return null;
  return (
    <Line role="status">
      <span>{t('restored')}</span>
      <span aria-hidden="true">·</span>
      <Action type="button" onClick={draft.discard}>
        {t('discard')}
      </Action>
    </Line>
  );
}
