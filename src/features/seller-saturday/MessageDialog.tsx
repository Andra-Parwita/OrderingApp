import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { type TFunction } from 'i18next';
import { styled } from 'styled-components';
import type { Language, PickupPoint } from '../../../shared/domain';
import type {
  MessageLogEntry,
  MessagePlaceRequest,
  MessagePlaceResponse,
} from '../../../shared/handoverContract';
import { UPDATE_MINUTE_CHOICES, UPDATE_TEXT_MAX } from '../../../shared/updateContract';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { messagePlace } from '../../api/handover';
import {
  Button,
  ComposeAndSend,
  Icon,
  Segmented,
  TextArea,
  WarningDialog,
  type SegmentedOption,
} from '../../ui';
import { useModalFocus } from '../../ui/patterns/modal';
import { SATURDAY_NS } from './i18n/register';
import { clock, customText, Notice } from './parts';

type Choice = 'ready_in' | 'ready_now' | 'custom';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colour.scrim};
`;
const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  width: min(32rem, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.xl};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
`;
const Title = styled.h2`
  margin: 0;
  font-size: 1.25rem;
`;
const Sent = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: 0;
  padding: 0;
  color: ${({ theme }) => theme.c.conf};
  font-size: 0.875rem;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
  }
  svg {
    width: 1rem;
    height: 1rem;
  }
`;
const Label = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

/** The warning codes this dialog explains; anything else gets the generic text. */
const KNOWN = ['repeat_message', 'nobody_to_message', 'order_cancelled'] as const;

/** What a logged message says, in the seller's language. */
export function describeMessage(entry: MessageLogEntry, t: TFunction, lang: Language): string {
  if (entry.type === 'ready_in') return t('message.shortReadyIn', { count: entry.minutes ?? 0 });
  if (entry.type === 'ready_now') return t('message.shortReady');
  if (entry.type === 'custom') return customText(entry.text, lang);
  return t(`message.type.${entry.type}`);
}

type Props = Readonly<{
  place: PickupPoint;
  /** Open pickup orders of this place: who the message reaches. */
  reach: number;
  /** The log entries of this place, newest first. */
  sent: ReadonlyArray<MessageLogEntry>;
  lang: Language;
  onClose: () => void;
  onSent: (result: MessagePlaceResponse) => void;
}>;

/** Message a pickup place: Ready in N min, Ready for pickup, or the seller's own text. */
export function MessageDialog({ place, reach, sent, lang, onClose, onSent }: Props) {
  const { t } = useTranslation(SATURDAY_NS);
  const titleId = useId();
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onClose);
  const [choice, setChoice] = useState<Choice>('ready_in');
  const [minutes, setMinutes] = useState<number>(15);
  const [preview, setPreview] = useState<Language>(lang);
  const [text, setText] = useState<Record<Language, string>>({ en: '', id: '' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const choices: ReadonlyArray<SegmentedOption<Choice>> = [
    { value: 'ready_in', label: t('message.readyIn') },
    { value: 'ready_now', label: t('message.ready') },
    { value: 'custom', label: t('message.custom') },
  ];
  const minuteChoices: ReadonlyArray<SegmentedOption<string>> = UPDATE_MINUTE_CHOICES.map((m) => ({
    value: String(m),
    label: t('message.minutes', { count: m }),
  }));

  // The preview is built in the chosen language, whatever the screen language is.
  const fixed = i18n.getFixedT(preview, SATURDAY_NS);
  const previewText =
    choice === 'ready_in'
      ? fixed('message.textReadyIn', { count: minutes })
      : choice === 'ready_now'
        ? fixed('message.textReady')
        : text[preview];

  const customReady = text.en.trim() !== '' || text.id.trim() !== '';
  const canSend = choice !== 'custom' || customReady;

  const request = useCallback(
    (force: boolean): MessagePlaceRequest => {
      const forced = force ? { force } : {};
      if (choice === 'ready_now') return { type: 'ready_now', ...forced };
      if (choice === 'ready_in') return { type: 'ready_in', minutes, ...forced };
      return {
        type: 'custom',
        text: {
          ...(text.en.trim() !== '' ? { en: text.en.trim() } : {}),
          ...(text.id.trim() !== '' ? { id: text.id.trim() } : {}),
        },
        ...forced,
      };
    },
    [choice, minutes, text],
  );

  const send = useCallback(
    async (force: boolean) => {
      if (!canSend || busy) return;
      setBusy(true);
      setFailed(false);
      setWarning(null);
      const result = await messagePlace(place.id, request(force), undefined, currentSellerSlug());
      setBusy(false);
      if (result.ok) {
        onSent(result.data);
        return;
      }
      if (result.status === 409 && result.warning) {
        const code = result.warning.code;
        setWarning((KNOWN as ReadonlyArray<string>).includes(code) ? code : 'other');
        return;
      }
      setFailed(true);
    },
    [canSend, busy, place.id, request, onSent],
  );

  return (
    <Overlay>
      <Box
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <Title id={titleId}>{t('message.title', { place: place.place })}</Title>
        {sent.length > 0 ? (
          <Sent aria-label={t('message.sentLabel')}>
            {sent.map((entry) => (
              <li key={entry.id}>
                <Icon name="check" />
                {t('message.sentLine', {
                  text: describeMessage(entry, t, lang),
                  time: clock(entry.at),
                })}
              </li>
            ))}
          </Sent>
        ) : null}
        <ComposeAndSend
          text={previewText}
          language={preview}
          onLanguage={setPreview}
          sendLabel={busy ? t('message.sending') : t('message.send', { count: reach })}
          onSend={() => void send(false)}
        >
          <Label>{t('message.choose')}</Label>
          <Segmented
            options={choices}
            value={choice}
            onChange={setChoice}
            label={t('message.choose')}
            compact
          />
          {choice === 'ready_in' ? (
            <Segmented
              options={minuteChoices}
              value={String(minutes)}
              onChange={(value) => setMinutes(Number(value))}
              label={t('message.minutesLabel')}
              compact
            />
          ) : null}
          {choice === 'custom' ? (
            <TextArea
              label={t('message.customLabel', { lang: preview.toUpperCase() })}
              helper={t('message.customHelp')}
              value={text[preview]}
              onChange={(event) =>
                setText((current) => ({ ...current, [preview]: event.target.value }))
              }
              maxLength={UPDATE_TEXT_MAX}
              showCounter
            />
          ) : null}
          {choice === 'ready_now' ? (
            <Muted2>{t('message.readyNote', { count: reach })}</Muted2>
          ) : null}
        </ComposeAndSend>
        {choice === 'ready_in' || choice === 'custom' ? (
          <Muted2>{t('message.noStatus')}</Muted2>
        ) : null}
        {failed ? (
          <Notice $bad role="alert">
            {t('common.actionFailed')}
          </Notice>
        ) : null}
        <Button variant="secondary" onClick={onClose}>
          {t('message.close')}
        </Button>
      </Box>
      {warning ? (
        <WarningDialog
          title={t(`warn.${warning}.title`)}
          cancelLabel={t('warn.cancel')}
          continueLabel={t('message.sendAnyway')}
          onCancel={() => setWarning(null)}
          onContinue={() => void send(true)}
        >
          {t(`warn.${warning}.body`, { place: place.place })}
        </WarningDialog>
      ) : null}
    </Overlay>
  );
}

const Muted2 = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
