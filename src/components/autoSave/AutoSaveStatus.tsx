import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { AutoSaveState } from './autoSave';

const Line = styled.p<{ $warn?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: 1.5rem;
  margin: 0;
  color: ${({ $warn, theme }) => ($warn ? theme.c.warn : theme.c.muted)};
  font-size: 0.875rem;
`;
const Again = styled.button`
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
`;

export type AutoSaveStatusProps = Readonly<{
  state: AutoSaveState<unknown>;
  onRetry: () => void;
  max?: number;
  /** The i18n namespace holding the `autosave.*` texts. */
  ns: string;
}>;

/** "Saving…" → "Saved ✓", or "Not saved yet · Try again", or why a change was undone (plan 072). */
export function AutoSaveStatus({ state, onRetry, max, ns }: AutoSaveStatusProps) {
  const { t, i18n } = useTranslation(ns);
  // The line is always there (a live region must exist before its text changes).
  let text = '';
  if (state.status === 'saving') text = t('autosave.saving');
  else if (state.status === 'saved') text = t('autosave.saved');
  else if (state.status === 'refused') {
    const code = state.code ?? '';
    // A text named for the refusal when the namespace has one, else the general one.
    text = i18n.exists(`autosave.${code}`, { ns })
      ? t(`autosave.${code}`, { max })
      : t('autosave.other');
  }
  if (state.status === 'failed') {
    return (
      <Line $warn role="status">
        <span>{t('autosave.notSaved')}</span>
        <span aria-hidden="true">·</span>
        <Again type="button" onClick={onRetry}>
          {t('autosave.tryAgain')}
        </Again>
      </Line>
    );
  }
  return (
    <Line $warn={state.status === 'refused'} role="status">
      {text}
    </Line>
  );
}
