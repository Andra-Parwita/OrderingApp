import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button } from '../Button';
import { Segmented, type SegmentedOption } from '../Segmented';

export type ComposeLanguage = 'en' | 'id';

export type ComposeAndSendProps = Readonly<{
  /** The exact text that will be sent. */
  text: string;
  language: ComposeLanguage;
  onLanguage: (next: ComposeLanguage) => void;
  /** Name of the one send button: "Share on WhatsApp", "Send to Pickup A". */
  sendLabel: string;
  onSend: () => void;
  /** Options above the preview (which place, how many minutes). */
  children?: ReactNode;
}>;

const LANGS: ReadonlyArray<SegmentedOption<ComposeLanguage>> = [
  { value: 'en', label: 'EN' },
  { value: 'id', label: 'ID' },
];

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const Preview = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

/** Shows the exact text before sending, a language choice and one send button. */
export function ComposeAndSend({
  text,
  language,
  onLanguage,
  sendLabel,
  onSend,
  children,
}: ComposeAndSendProps) {
  const { t } = useTranslation();
  return (
    <Wrap>
      {children}
      <Row>
        <span>{t('patterns.preview')}</span>
        <Segmented
          options={LANGS}
          value={language}
          onChange={onLanguage}
          label={t('patterns.language')}
          compact
        />
      </Row>
      <Preview aria-label={t('patterns.preview')}>{text}</Preview>
      <Button variant="primary" fullWidth onClick={onSend}>
        {sendLabel}
      </Button>
    </Wrap>
  );
}
