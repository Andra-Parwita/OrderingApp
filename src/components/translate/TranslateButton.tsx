import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { translateText, type TranslateLang } from '../../api/translate';
import { Button } from '../../ui';
import { TRANSLATE_NS } from './i18n/register';

const Note = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
`;

type Props = Readonly<{
  /** The text typed in the other language. */
  text: string;
  /** The language `text` is in; the result is for the other one. */
  from: TranslateLang;
  to: TranslateLang;
  /** Receives the translation; the caller puts it in the field (nothing is saved here). */
  onResult: (text: string) => void;
}>;

/** Plan 057: "⇄ From Indonesian". One tap per translation; a failure is one calm line, never retried. */
export function TranslateButton({ text, from, to, onResult }: Props) {
  const { t } = useTranslation(TRANSLATE_NS);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<'limit' | 'unavailable' | null>(null);

  async function run() {
    setBusy(true);
    setProblem(null);
    const result = await translateText(text, from, to);
    setBusy(false);
    if (result.ok) onResult(result.data.text);
    else setProblem(result.error === 'translate_limit' ? 'limit' : 'unavailable');
  }

  return (
    <>
      <Button
        type="button"
        variant="quiet"
        disabled={busy || text.trim() === ''}
        aria-busy={busy}
        onClick={() => void run()}
      >
        {busy ? t('busy') : t(from === 'id' ? 'fromId' : 'fromEn')}
      </Button>
      {problem && <Note role="status">{t(problem)}</Note>}
    </>
  );
}
