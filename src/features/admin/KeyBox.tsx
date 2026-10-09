import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { Message, Muted, Row } from './shared';

export type KeyBoxProps = Readonly<{
  title: string;
  keyText: string;
  onDone: () => void;
}>;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  align-self: stretch;
  padding: ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
`;
const Heading = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
`;
const KeyText = styled.code`
  align-self: flex-start;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colour.bg};
  font-size: ${({ theme }) => theme.type.size.lg};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  letter-spacing: 0.05em;
  user-select: all;
`;
const WhatsApp = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.text};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  text-decoration: none;

  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.colour.focus};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;

/** A key, shown once, to copy or send on WhatsApp (no phone number: the admin picks the chat). */
export function KeyBox({ title, keyText, onDone }: KeyBoxProps) {
  const { t } = useTranslation(ADMIN_NS);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const message = t('home.key.message', { key: keyText, interpolation: { escapeValue: false } });

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(keyText);
      setNote({ text: t('home.key.copied'), bad: false });
    } catch {
      setNote({ text: t('home.key.copyFailed'), bad: true });
    }
  }, [keyText, t]);

  return (
    <Box role="region" aria-label={title}>
      <Heading>{title}</Heading>
      <KeyText>{keyText}</KeyText>
      <Muted>{t('home.key.rule')}</Muted>
      <Muted>{t('home.key.once')}</Muted>
      <Row>
        <Button variant="primary" onClick={() => void copy()}>
          {t('home.key.copy')}
        </Button>
        <WhatsApp
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('home.key.whatsapp')}
        </WhatsApp>
        <Button variant="quiet" onClick={onDone}>
          {t('home.key.done')}
        </Button>
      </Row>
      <div role="status">{note ? <Message $bad={note.bad}>{note.text}</Message> : null}</div>
    </Box>
  );
}
