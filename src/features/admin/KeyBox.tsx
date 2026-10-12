import { DraftNotice, draftKey, useDraft } from '../../components/draft';
import { useCallback, useState, type FormEvent } from 'react';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { APP_NAME } from '../../../shared/appName';
import { DISPLAY_NAME_MAX } from '../../../shared/authContract';
import { whatsAppUrl } from '../../api/device/whatsapp';
import { Button, Segmented, TextArea, TextField } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { Message, Muted, Row } from './shared';

export type KeyBoxProps = Readonly<{
  title: string;
  /** The kitchen the invite is for (it goes in the link as `?kitchen=`). */
  slug: string;
  /** The kitchen's name, said in the message. */
  kitchen: string;
  /** Makes the key for the typed name (may be empty); null means it failed. */
  create: (displayName: string) => Promise<string | null>;
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
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
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

type MessageLang = 'en' | 'id';
const LANGS: ReadonlyArray<{ value: MessageLang; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' },
];

/**
 * An invite: first a name for the person, then the key, shown once, to copy as a link or on its
 * own, or to send on WhatsApp (no phone number: the admin picks the chat). The key works once, on
 * one device, within 24 hours (D-085).
 */
export function KeyBox({ title, slug, kitchen, create, onDone }: KeyBoxProps) {
  const { t } = useTranslation(ADMIN_NS);
  // Plan 061: the person's name survives a reload until the key is made. The key, the link and the
  // edited message (which holds the link) are never stored.
  const [displayName, setDisplayName, nameDraft] = useDraft(draftKey('admin', 'invite', slug), '');
  const [keyText, setKeyText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The message has its own language (the page may be in the other); no edit = the text as written.
  const [lang, setLang] = useState<MessageLang>(i18n.language.startsWith('id') ? 'id' : 'en');
  const [edited, setEdited] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const make = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setNote(null);
      const made = await create(displayName.trim());
      setBusy(false);
      if (made !== null) {
        nameDraft.clear();
        setKeyText(made);
      }
    },
    [create, displayName, nameDraft],
  );

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote({ text: t('home.key.copied'), bad: false });
    } catch {
      setNote({ text: t('home.key.copyFailed'), bad: true });
    }
  };

  if (keyText === null) {
    return (
      <Box role="region" aria-label={title}>
        <Heading>{title}</Heading>
        <form onSubmit={(event) => void make(event)}>
          <Stack>
            <DraftNotice draft={nameDraft} />
            <TextField
              label={t('home.key.nameLabel')}
              helper={t('home.key.nameHelper')}
              value={displayName}
              maxLength={DISPLAY_NAME_MAX}
              autoComplete="off"
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <Row>
              <Button type="submit" variant="primary" disabled={busy}>
                {t('home.key.create')}
              </Button>
              <Button variant="quiet" onClick={onDone}>
                {t('home.key.cancel')}
              </Button>
            </Row>
          </Stack>
        </form>
      </Box>
    );
  }

  const link = `https://${location.host}/seller/setup?kitchen=${encodeURIComponent(slug)}#key=${keyText}`;
  const say = i18n.getFixedT(lang, ADMIN_NS);
  const name = displayName.trim();
  const message =
    edited ??
    say('home.key.message', {
      greet: name ? say('home.key.greet', { name }) : say('home.key.greetAnon'),
      kitchen,
      link,
      app: APP_NAME,
      interpolation: { escapeValue: false },
    });
  return (
    <Box role="region" aria-label={title}>
      <Heading>{title}</Heading>
      <KeyText>{keyText}</KeyText>
      <Muted>{t('home.key.rule')}</Muted>
      <Muted>{t('home.key.once')}</Muted>
      <Segmented
        label={t('home.key.messageLang')}
        options={LANGS}
        value={lang}
        onChange={(next) => {
          setLang(next);
          setEdited(null);
        }}
      />
      <TextArea
        label={t('home.key.messagePreview')}
        value={message}
        rows={9}
        onChange={(event) => setEdited(event.target.value)}
      />
      <Row>
        <Button variant="primary" onClick={() => void copy(link)}>
          {t('home.key.copyLink')}
        </Button>
        <Button onClick={() => void copy(message)}>{t('home.key.copyMessage')}</Button>
        <Button onClick={() => void copy(keyText)}>{t('home.key.copy')}</Button>
        <WhatsApp href={whatsAppUrl(message)} target="_blank" rel="noopener noreferrer">
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
