// Plan 086 (D-106): "Short message". A compact list of the last messages (like the Sellers list);
// "New message" or a row opens a panel from the right. A new message is written there (EN + ID,
// kitchens, who sees it, how long it stays active) and sent; an old one shows its details with
// "Stop now" (while active) and "Send again as new". The note itself shows for 30 s on each device.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { AdminSeller } from '../../../shared/authContract';
import type { Language } from '../../../shared/domain';
import { formatDayTime, formatTime } from '../../../shared/dates';
import {
  MESSAGE_MAX,
  isActive,
  type MessageAudience,
  type MessageWindow,
  type ShortMessage,
} from '../../../shared/shortMessage';
import { fetchMessages, sendMessage, stopMessage } from '../../api/auth';
import type { ApiFailure } from '../../api/http';
import { NotePreview } from '../../components/maintenance';
import { Button, Pill, Segmented, SlideOver, SlideOverEditor, TextField } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { MessageCounter, PillPreview } from './MessagePreview';
import { failureText, Message, Muted, SmallHeading, Sub } from './shared';

const Panel = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-width: 0;
`;
const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Grow = styled.div`
  flex: 1;
  min-width: 0;
`;
const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  /* Long lists scroll inside, so the page itself does not. */
  max-height: 24rem;
  overflow-y: auto;
`;
const RowButton = styled.button`
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: 2.75rem;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.c.surf2};
  }
  &:focus-visible {
    outline-offset: -${({ theme }) => theme.border.focus};
  }
`;
const RowText = styled.strong`
  flex: 1 1 10rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const RowMeta = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
`;
const Label = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  align-items: flex-start;
`;
const Check = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.minTapTarget};
  input {
    width: 1.125rem;
    height: 1.125rem;
    accent-color: ${({ theme }) => theme.c.fill};
  }
`;
const Kitchens = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0 ${({ theme }) => theme.spacing.lg};
`;
const Sent = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.text};
`;
const Detail = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
`;
const DetailFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;

type Draft = {
  en: string;
  id: string;
  same: boolean;
  all: boolean;
  picked: ReadonlyArray<string>;
  audience: MessageAudience;
  window: MessageWindow;
};
const EMPTY: Draft = {
  en: '',
  id: '',
  same: false,
  all: true,
  picked: [],
  audience: 'everyone',
  window: '15m',
};
const AUDIENCES: ReadonlyArray<MessageAudience> = ['everyone', 'sellers', 'customers'];
const WINDOWS: ReadonlyArray<MessageWindow> = ['15m', '1h', 'today'];

type Open = { kind: 'new'; draft: Draft } | { kind: 'view'; id: string };

export type MessagesPanelProps = Readonly<{
  /** The kitchens to pick from (the Sellers list the page already loaded). */
  sellers: ReadonlyArray<AdminSeller> | null;
  /** The call was refused for a missing admin session: the page sends the visitor to sign-in. */
  refused?: (failure: ApiFailure) => string;
  now?: () => number;
}>;

export function MessagesPanel({ sellers, refused, now = () => Date.now() }: MessagesPanelProps) {
  const { t, i18n } = useTranslation(ADMIN_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [messages, setMessages] = useState<Array<ShortMessage> | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justSent, setJustSent] = useState<ShortMessage | null>(null);

  const explain = useCallback(
    (failure: ApiFailure) => (refused ? refused(failure) : failureText(t, failure)),
    [refused, t],
  );

  useEffect(() => {
    let live = true;
    void fetchMessages().then((result) => {
      if (!live) return;
      if (result.ok) setMessages(result.data.messages);
      else setProblem(explain(result));
    });
    return () => {
      live = false;
    };
  }, [explain]);

  const kitchenNames = (message: ShortMessage): string => {
    if (message.sellerIds === null) return t('home.message.allKitchens');
    const names = message.sellerIds.map(
      (id) => (sellers ?? []).find((row) => row.id === id)?.name ?? '?',
    );
    return names.length > 2
      ? `${names.slice(0, 2).join(', ')} +${names.length - 2}`
      : names.join(', ');
  };
  const state = (message: ShortMessage): 'active' | 'stopped' | 'ended' =>
    message.stoppedAt !== null
      ? 'stopped'
      : isActive(message, new Date(now()))
        ? 'active'
        : 'ended';
  const pill = (message: ShortMessage) => {
    const s = state(message);
    return (
      <Pill tone={s === 'active' ? 'ordered' : s === 'stopped' ? 'cancelled' : 'done'}>
        {s === 'active'
          ? t('home.message.activeUntil', { time: formatTime(message.expiresAt, lang) })
          : t(`home.message.${s}`)}
      </Pill>
    );
  };

  async function send(draft: Draft) {
    setBusy(true);
    setProblem(null);
    const result = await sendMessage({
      textEn: draft.en,
      textId: draft.same ? draft.en : draft.id,
      sameText: draft.same,
      audience: draft.audience,
      sellerIds: draft.all ? null : [...draft.picked],
      window: draft.window,
    });
    setBusy(false);
    if (!result.ok) {
      setProblem(explain(result));
      return;
    }
    setMessages((current) => [result.data, ...(current ?? [])].slice(0, 20));
    setJustSent(result.data);
    setOpen(null);
  }

  async function stop(id: string) {
    setProblem(null);
    const result = await stopMessage(id);
    if (!result.ok) {
      setProblem(explain(result));
      return;
    }
    setMessages(result.data.messages);
    setJustSent((current) => (current?.id === id ? null : current));
    setOpen(null);
  }

  const viewing = open?.kind === 'view' ? messages?.find((m) => m.id === open.id) : undefined;
  const again = (message: ShortMessage): Draft => ({
    en: message.textEn,
    id: message.textId,
    same: message.textEn === message.textId,
    all: message.sellerIds === null,
    picked: message.sellerIds ?? [],
    audience: message.audience,
    window: '15m',
  });

  return (
    <Panel>
      <Head>
        <Grow>
          <Sub>{t('home.message.title')}</Sub>
          <Muted>{t('home.message.text')}</Muted>
        </Grow>
        <Button variant="primary" onClick={() => setOpen({ kind: 'new', draft: EMPTY })}>
          {t('home.message.new')}
        </Button>
      </Head>
      {justSent && state(justSent) === 'active' ? (
        <Sent role="status">
          <span>
            <strong>{t('home.message.sent')}</strong> ·{' '}
            {t('home.message.activeUntil', { time: formatTime(justSent.expiresAt, lang) })}
          </span>
          <Button variant="secondary" onClick={() => void stop(justSent.id)}>
            {t('home.message.stop')}
          </Button>
        </Sent>
      ) : null}
      {problem ? (
        <Message $bad role="alert">
          {problem}
        </Message>
      ) : null}
      {messages === null && !problem ? <Muted>{t('loading')}</Muted> : null}
      {messages && messages.length === 0 ? <Muted>{t('home.message.none')}</Muted> : null}
      {messages && messages.length > 0 ? (
        <List aria-label={t('home.message.listLabel')}>
          {messages.map((message) => (
            <li key={message.id}>
              <RowButton
                type="button"
                aria-haspopup="dialog"
                onClick={() => setOpen({ kind: 'view', id: message.id })}
              >
                <RowText>
                  {[...(lang === 'id' ? message.textId : message.textEn)].slice(0, 40).join('')}
                </RowText>
                <RowMeta>{kitchenNames(message)}</RowMeta>
                <RowMeta>{t(`home.message.audience.${message.audience}`)}</RowMeta>
                {pill(message)}
                <RowMeta>{formatDayTime(message.createdAt, lang)}</RowMeta>
              </RowButton>
            </li>
          ))}
        </List>
      ) : null}

      {open?.kind === 'new' ? (
        <NewMessage
          key={JSON.stringify(open.draft)}
          start={open.draft}
          sellers={sellers ?? []}
          busy={busy}
          problem={problem}
          onCancel={() => {
            setProblem(null);
            setOpen(null);
          }}
          onSend={(draft) => void send(draft)}
        />
      ) : null}
      {viewing ? (
        <SlideOver
          label={t('home.message.title')}
          closeLabel={t('home.close')}
          onClose={() => setOpen(null)}
          width="560px"
        >
          <Detail>
            <SmallHeading>{t('home.message.detailTitle')}</SmallHeading>
            <NotePreview text={lang === 'id' ? viewing.textId : viewing.textEn} />
            <Group>
              <Label>{t('home.message.textEn')}</Label>
              <span>{viewing.textEn}</span>
            </Group>
            <Group>
              <Label>{t('home.message.textId')}</Label>
              <span>{viewing.textId}</span>
            </Group>
            <Group>
              <Label>{t('home.message.kitchens')}</Label>
              <span>{kitchenNames(viewing)}</span>
            </Group>
            <Group>
              <Label>{t('home.message.audienceLabel')}</Label>
              <span>{t(`home.message.audience.${viewing.audience}`)}</span>
            </Group>
            <Group>
              <Label>{t('home.message.sentAt')}</Label>
              <span>{formatDayTime(viewing.createdAt, lang)}</span>
              {pill(viewing)}
            </Group>
            <DetailFooter>
              {state(viewing) === 'active' ? (
                <Button onClick={() => void stop(viewing.id)}>{t('home.message.stop')}</Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => setOpen({ kind: 'new', draft: again(viewing) })}
              >
                {t('home.message.again')}
              </Button>
            </DetailFooter>
          </Detail>
        </SlideOver>
      ) : null}
    </Panel>
  );
}

function NewMessage({
  start,
  sellers,
  busy,
  problem,
  onCancel,
  onSend,
}: Readonly<{
  start: Draft;
  sellers: ReadonlyArray<AdminSeller>;
  busy: boolean;
  problem: string | null;
  onCancel: () => void;
  onSend: (draft: Draft) => void;
}>) {
  const { t } = useTranslation(ADMIN_NS);
  const [draft, setDraft] = useState<Draft>(start);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const sample = t('home.message.sample');
  const idText = draft.same ? draft.en : draft.id;
  const tooLong = [...draft.en].length > MESSAGE_MAX || [...idText].length > MESSAGE_MAX;
  const ready =
    draft.en.trim() !== '' &&
    (draft.same || draft.id.trim() !== '') &&
    (draft.all || draft.picked.length > 0) &&
    !tooLong;
  return (
    <SlideOverEditor
      title={t('home.message.title')}
      dirty={draft.en !== '' || draft.id !== ''}
      saveLabel={t('home.message.send')}
      saving={busy || !ready}
      onCancel={onCancel}
      onSave={() => onSend(draft)}
    >
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !busy) onSend(draft);
        }}
      >
        <SmallHeading>{t('home.message.new')}</SmallHeading>
        <TextField
          label={t('home.message.textEn')}
          value={draft.en}
          onChange={(event) => set({ en: event.target.value })}
        />
        <MessageCounter text={draft.en} />
        <Check>
          <input
            type="checkbox"
            checked={draft.same}
            onChange={(event) => set({ same: event.target.checked })}
          />
          {t('home.message.same')}
        </Check>
        {draft.same ? null : (
          <TextField
            label={t('home.message.textId')}
            value={draft.id}
            onChange={(event) => set({ id: event.target.value })}
          />
        )}
        {draft.same ? null : <MessageCounter text={draft.id} />}
        <Muted>{t('home.message.emojiNote')}</Muted>
        <Group>
          <Label>{t('home.message.kitchens')}</Label>
          <Segmented
            label={t('home.message.kitchens')}
            value={draft.all ? 'all' : 'pick'}
            options={[
              { value: 'all', label: t('home.message.allKitchens') },
              { value: 'pick', label: t('home.message.pick') },
            ]}
            onChange={(next) => set({ all: next === 'all' })}
          />
          {draft.all ? null : (
            <Kitchens>
              {sellers.map((seller) => (
                <Check key={seller.id}>
                  <input
                    type="checkbox"
                    checked={draft.picked.includes(seller.id)}
                    onChange={(event) =>
                      set({
                        picked: event.target.checked
                          ? [...draft.picked, seller.id]
                          : draft.picked.filter((id) => id !== seller.id),
                      })
                    }
                  />
                  {seller.name}
                </Check>
              ))}
            </Kitchens>
          )}
        </Group>
        <Group>
          <Label>{t('home.message.audienceLabel')}</Label>
          <Segmented
            label={t('home.message.audienceLabel')}
            value={draft.audience}
            options={AUDIENCES.map((value) => ({
              value,
              label: t(`home.message.audience.${value}`),
            }))}
            onChange={(audience) => set({ audience })}
          />
        </Group>
        <Group>
          <Label>{t('home.message.window')}</Label>
          <Segmented
            label={t('home.message.window')}
            value={draft.window}
            options={WINDOWS.map((value) => ({ value, label: t(`home.message.windows.${value}`) }))}
            onChange={(window) => set({ window })}
          />
          <Muted>{t('home.message.windowHelp')}</Muted>
        </Group>
        <Group>
          <Label>{t('home.message.preview')}</Label>
          <PillPreview text={draft.en.trim() || sample} language={t('home.message.textEnShort')} />
          <PillPreview text={idText.trim() || sample} language={t('home.message.textIdShort')} />
        </Group>
        <Muted>{t('home.message.fine')}</Muted>
        {problem ? (
          <Message $bad role="alert">
            {problem}
          </Message>
        ) : null}
      </Form>
    </SlideOverEditor>
  );
}
