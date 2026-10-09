import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatOrderCode } from '../../../shared/orderCode';
import {
  needsMinutes,
  recipientCodes,
  statusOfTemplate,
  UPDATE_MINUTE_CHOICES,
  UPDATE_TEMPLATES,
  UPDATE_TEXT_MAX,
  type RecipientGroup,
  type SendUpdatesResponse,
  type UpdateTemplate,
} from '../../../shared/updateContract';
import type { SellerOrder } from '../../../shared/domain';
import { sendUpdates } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, TextArea } from '../../ui';
import { SATURDAY_NS } from './i18n/register';
import {
  Chip,
  Chips,
  itemsShort,
  LoadState,
  Muted,
  Notice,
  Page,
  Section,
  Small,
  Sub,
  Title,
  useLang,
  useSaturdayData,
} from './parts';

const GROUPS: ReadonlyArray<RecipientGroup> = ['open', 'pickup', 'delivery', 'notDone'];

const Check = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  cursor: pointer;

  input {
    flex: none;
    width: ${({ theme }) => theme.spacing.xl};
    height: ${({ theme }) => theme.spacing.xl};
    accent-color: ${({ theme }) => theme.colour.accent};
  }
`;

const Who = styled.span`
  display: flex;
  flex-direction: column;
`;

const Toggle = styled(Check)`
  border-bottom: none;
`;

type Outcome = Readonly<{
  response: SendUpdatesResponse;
  total: number;
  alsoAsked: boolean;
  names: ReadonlyMap<string, string>;
}>;

function skipKey(error: string | undefined): string {
  return error === 'not_found' || error === 'invalid_status'
    ? `update.skip.${error}`
    : 'update.skip.other';
}

/** Send an update to many customers' order pages at once (D-027). Route-agnostic. */
export function SendUpdateScreen() {
  const { t } = useTranslation(SATURDAY_NS);
  const lang = useLang();
  const slug = currentSellerSlug();
  const { data, reload } = useSaturdayData();
  const [template, setTemplate] = useState<UpdateTemplate>('readyIn');
  const [minutes, setMinutes] = useState<number>(15);
  const [text, setText] = useState('');
  const [alsoStatus, setAlsoStatus] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const open = useMemo<Array<SellerOrder>>(
    () => (data.status === 'ready' ? data.orders.filter((o) => o.status !== 'cancelled') : []),
    [data],
  );
  const target = statusOfTemplate(template);
  const activeGroup = useMemo(
    () =>
      selected.size === 0
        ? null
        : (GROUPS.find((group) => {
            const codes = recipientCodes(open, group);
            return codes.length === selected.size && codes.every((code) => selected.has(code));
          }) ?? null),
    [open, selected],
  );

  const pickGroup = useCallback(
    (group: RecipientGroup) => setSelected(new Set(recipientCodes(open, group))),
    [open],
  );
  const clear = useCallback(() => setSelected(new Set()), []);
  const toggle = useCallback((code: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  }, []);

  const customReady = template !== 'custom' || text.trim().length > 0;
  const canSend = selected.size > 0 && customReady && !sending;

  const send = useCallback(async () => {
    const codes = [...selected];
    setSending(true);
    setFailed(false);
    setOutcome(null);
    const asked = target !== null && alsoStatus;
    const result = await sendUpdates(
      {
        template,
        codes,
        ...(needsMinutes(template) ? { minutes } : {}),
        ...(template === 'custom' ? { text: text.trim() } : {}),
        ...(asked ? { alsoSetStatus: true } : {}),
      },
      undefined,
      slug,
    );
    setSending(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    const names = new Map(open.map((order) => [order.code, order.firstName] as const));
    setOutcome({ response: result.data, total: codes.length, alsoAsked: asked, names });
    setSelected(new Set());
    await reload();
  }, [selected, template, minutes, text, alsoStatus, target, slug, open, reload]);

  const response = outcome?.response;
  const skipped = response?.results.filter((r) => !r.ok) ?? [];
  const moved = response?.results.filter((r) => r.ok && r.statusChanged === true).length ?? 0;
  const kept = (response?.sent ?? 0) - moved;

  return (
    <Page>
      <Title>{t('update.title')}</Title>
      <LoadState data={data} onRetry={() => void reload()} />

      <Section>
        <Sub>{t('update.messageTitle')}</Sub>
        <Chips role="group" aria-label={t('update.messageTitle')}>
          {UPDATE_TEMPLATES.map((id) => (
            <Chip
              key={id}
              label={t(`update.template.${id}`)}
              pressed={template === id}
              onSelect={() => setTemplate(id)}
            />
          ))}
        </Chips>
        {needsMinutes(template) ? (
          <Chips role="group" aria-label={t('update.minutesTitle')}>
            {UPDATE_MINUTE_CHOICES.map((choice) => (
              <Chip
                key={choice}
                label={t('update.minutes', { count: choice })}
                pressed={minutes === choice}
                onSelect={() => setMinutes(choice)}
              />
            ))}
          </Chips>
        ) : null}
        {template === 'custom' ? (
          <TextArea
            label={t('update.customLabel')}
            helper={t('update.customHelp')}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={UPDATE_TEXT_MAX}
            showCounter
          />
        ) : null}
        {target !== null ? (
          <Toggle>
            <input
              type="checkbox"
              aria-label={t('update.alsoStatus')}
              checked={alsoStatus}
              onChange={(event) => setAlsoStatus(event.target.checked)}
            />
            <Who>
              <span>{t('update.alsoStatus')}</span>
              <Muted>{t('update.alsoStatusHelp', { status: t(`status.${target}`) })}</Muted>
            </Who>
          </Toggle>
        ) : null}
      </Section>

      <Section>
        <Sub>{t('update.recipientsTitle')}</Sub>
        <Chips role="group" aria-label={t('update.groupsLabel')}>
          {GROUPS.map((group) => (
            <Chip
              key={group}
              label={t(`update.group.${group}`)}
              pressed={activeGroup === group}
              onSelect={() => pickGroup(group)}
            />
          ))}
          <Chip label={t('update.group.clear')} onSelect={clear} />
        </Chips>
        {data.status === 'ready' && open.length === 0 ? <Muted>{t('update.none')}</Muted> : null}
        <div role="group" aria-label={t('update.listLabel')}>
          {open.map((order) => {
            const code = formatOrderCode(order.code);
            return (
              <Check key={order.code}>
                <input
                  type="checkbox"
                  checked={selected.has(order.code)}
                  onChange={() => toggle(order.code)}
                  aria-label={`${order.firstName} ${code}`}
                />
                <Who>
                  <span>
                    <b>{order.firstName}</b> · {code} ·{' '}
                    {t(order.fulfilment === 'pickup' ? 'common.pickup' : 'common.delivery')}
                  </span>
                  <Small>{itemsShort(order.lines, lang)}</Small>
                </Who>
              </Check>
            );
          })}
        </div>
        {selected.size === 0 && open.length > 0 ? <Muted>{t('update.pickNone')}</Muted> : null}
      </Section>

      <Section>
        <Button variant="primary" fullWidth disabled={!canSend} onClick={() => void send()}>
          {sending ? t('update.sending') : t('update.send', { count: selected.size })}
        </Button>
        <Muted>{t('update.info')}</Muted>
        {failed ? (
          <Notice $bad role="alert">
            {t('update.failed')}
          </Notice>
        ) : null}
        {outcome && response ? (
          <div role="status" aria-label={t('update.resultTitle')}>
            <Notice>{t('update.resultSent', { sent: response.sent, total: outcome.total })}</Notice>
            {outcome.alsoAsked ? <Muted>{t('update.resultStatus', { moved, kept })}</Muted> : null}
            {skipped.length > 0 ? (
              <>
                <Muted>{t('update.resultSkipped')}</Muted>
                <ul>
                  {skipped.map((result) => (
                    <li key={result.code}>
                      {t('update.skipped', {
                        name: outcome.names.get(result.code) ?? result.code,
                        code: formatOrderCode(result.code),
                        reason: t(skipKey(result.error)),
                      })}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </Section>
    </Page>
  );
}
