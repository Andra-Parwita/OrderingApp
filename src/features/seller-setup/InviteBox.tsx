import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { APP_NAME } from '../../../shared/appName';
import { Button } from '../../ui';
import { SETUP_NS } from './i18n/register';
import { Actions, Hint } from './parts';

export type InviteBoxProps = Readonly<{
  name: string;
  slug: string;
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

/** The link a new person opens; the key rides in the `#` so it never reaches a server log. */
export const inviteLink = (slug: string, key: string): string =>
  `https://${window.location.host}/seller/setup?kitchen=${encodeURIComponent(slug)}#key=${encodeURIComponent(key)}`;

/** An invite, shown once: copy the link with the key, or the key alone, or send the link on WhatsApp. */
export function InviteBox({ name, slug, keyText, onDone }: InviteBoxProps) {
  const { t } = useTranslation(SETUP_NS);
  const [note, setNote] = useState<string | null>(null);
  const title = t('team.inviteTitle', { name });
  const link = inviteLink(slug, keyText);
  const message = t('team.inviteMessage', {
    link,
    app: APP_NAME,
    interpolation: { escapeValue: false },
  });

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setNote(t('team.inviteCopied'));
      } catch {
        setNote(t('team.inviteCopyFailed'));
      }
    },
    [t],
  );

  return (
    <Box role="region" aria-label={title}>
      <Heading>{title}</Heading>
      <KeyText>{keyText}</KeyText>
      <Hint>{t('team.inviteRule')}</Hint>
      <Hint>{t('team.inviteOnce')}</Hint>
      <Actions>
        <Button variant="primary" onClick={() => void copy(link)}>
          {t('team.inviteCopyLink')}
        </Button>
        <Button variant="secondary" onClick={() => void copy(keyText)}>
          {t('team.inviteCopyKey')}
        </Button>
        <WhatsApp
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('team.inviteWhatsapp')}
        </WhatsApp>
        <Button variant="quiet" onClick={onDone}>
          {t('team.inviteDone')}
        </Button>
      </Actions>
      <div role="status">{note ? <Hint>{note}</Hint> : null}</div>
    </Box>
  );
}
