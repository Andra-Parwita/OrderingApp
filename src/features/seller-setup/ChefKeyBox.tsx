import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { APP_NAME } from '../../../shared/appName';
import { Button } from '../../ui';
import { SETUP_NS } from './i18n/register';
import { Actions, Hint } from './parts';

export type ChefKeyBoxProps = Readonly<{
  chefName: string;
  keyText: string;
  onDone: () => void;
}>;

// Same look as the admin's key box (a feature may not import another feature, so it is repeated).
const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
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

/** A chef's sign-in key, shown once, to copy or send on WhatsApp (the seller picks the chat). */
export function ChefKeyBox({ chefName, keyText, onDone }: ChefKeyBoxProps) {
  const { t } = useTranslation(SETUP_NS);
  const [note, setNote] = useState<string | null>(null);
  const title = t('chefs.inviteTitle', { name: chefName });
  const message = t('chefs.inviteMessage', {
    key: keyText,
    app: APP_NAME,
    interpolation: { escapeValue: false },
  });

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(keyText);
      setNote(t('chefs.inviteCopied'));
    } catch {
      setNote(t('chefs.inviteCopyFailed'));
    }
  }, [keyText, t]);

  return (
    <Box role="region" aria-label={title}>
      <Heading>{title}</Heading>
      <KeyText>{keyText}</KeyText>
      <Hint>{t('chefs.inviteRule')}</Hint>
      <Hint>{t('chefs.inviteOnce')}</Hint>
      <Actions>
        <Button variant="primary" onClick={() => void copy()}>
          {t('chefs.inviteCopy')}
        </Button>
        <WhatsApp
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('chefs.inviteWhatsapp')}
        </WhatsApp>
        <Button variant="quiet" onClick={onDone}>
          {t('chefs.inviteDone')}
        </Button>
      </Actions>
      <div role="status">{note ? <Hint>{note}</Hint> : null}</div>
    </Box>
  );
}
