import { useCallback, useState } from 'react';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { APP_NAME } from '../../../shared/appName';
import type { MembershipRole } from '../../../shared/authContract';
import { whatsAppUrl } from '../../api/device/whatsapp';
import { Button, Segmented, TextArea } from '../../ui';
import { SETUP_NS } from './i18n/register';
import { Actions, Hint } from './parts';

export type InviteBoxProps = Readonly<{
  name: string;
  slug: string;
  /** The kitchen's name and the role the person is invited as, both said in the message. */
  kitchen: string;
  role: MembershipRole;
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

type MessageLang = 'en' | 'id';
const LANGS: ReadonlyArray<{ value: MessageLang; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' },
];
const MESSAGE_KEY = {
  owner: 'team.messageOwner',
  chef: 'team.messageChef',
  helper: 'team.messageHelper',
} as const;

/** An invite, shown once: copy the link with the key, or the key alone, or send the link on WhatsApp. */
export function InviteBox({ name, slug, kitchen, role, keyText, onDone }: InviteBoxProps) {
  const { t } = useTranslation(SETUP_NS);
  const [note, setNote] = useState<string | null>(null);
  const title = t('team.inviteTitle', { name });
  const link = inviteLink(slug, keyText);
  // The message has its own language (the page may be in the other); no edit = the text as written.
  const [lang, setLang] = useState<MessageLang>(i18n.language.startsWith('id') ? 'id' : 'en');
  const [edited, setEdited] = useState<string | null>(null);
  const say = i18n.getFixedT(lang, SETUP_NS);
  const person = name.trim();
  const message =
    edited ??
    say(MESSAGE_KEY[role], {
      greet: person ? say('team.greet', { name: person }) : say('team.greetAnon'),
      kitchen,
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
      <Segmented
        label={t('team.messageLang')}
        options={LANGS}
        value={lang}
        onChange={(next) => {
          setLang(next);
          setEdited(null);
        }}
      />
      <TextArea
        label={t('team.messagePreview')}
        value={message}
        rows={9}
        onChange={(event) => setEdited(event.target.value)}
      />
      <Actions>
        <Button variant="primary" onClick={() => void copy(link)}>
          {t('team.inviteCopyLink')}
        </Button>
        <Button variant="secondary" onClick={() => void copy(message)}>
          {t('team.inviteCopyMessage')}
        </Button>
        <Button variant="secondary" onClick={() => void copy(keyText)}>
          {t('team.inviteCopyKey')}
        </Button>
        <WhatsApp href={whatsAppUrl(message)} target="_blank" rel="noopener noreferrer">
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
