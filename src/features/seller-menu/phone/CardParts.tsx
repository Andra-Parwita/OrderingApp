import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button, Icon, Pill } from '../../../ui';
import type { StatusTone } from '../../../theme/tokens';
import type { CardState } from './cardState';
import { PHONE_MENU_NS } from './i18n/register';

// Small pieces the Menu card and the read-only menu share (plan 124).

// Tones: 'ready' is the amber one, 'ordered' the accent (positive) one, 'done' the grey one.
const PILL: Readonly<Record<string, readonly [string, StatusTone]>> = {
  ready: ['card.pill.ready', 'ready'],
  notReady: ['card.pill.notReady', 'ready'],
  live: ['card.pill.live', 'ordered'],
  closed: ['card.pill.closed', 'done'],
  finished: ['card.pill.finished', 'done'],
};

export function StatusPill({ state }: Readonly<{ state: CardState }>) {
  const { t } = useTranslation(PHONE_MENU_NS);
  const key = state.kind === 'closed' && state.finished ? 'finished' : state.kind;
  const entry = PILL[key];
  return entry ? <Pill tone={entry[1]}>{t(entry[0])}</Pill> : null;
}

const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};

  button {
    flex: 1;
    white-space: nowrap;
  }
`;

/** Share on WhatsApp, and 🔔 Notice when the notice may be sent (orders open). */
export function ShareButtons({
  onShare,
  onNotice,
}: Readonly<{ onShare: () => void; onNotice: (() => void) | undefined }>) {
  const { t } = useTranslation(PHONE_MENU_NS);
  return (
    <Row>
      <Button variant="primary" onClick={onShare}>
        <Icon name="chat" />
        {t('card.share')}
      </Button>
      {onNotice ? <Button onClick={onNotice}>{t('card.notice')}</Button> : null}
    </Row>
  );
}
