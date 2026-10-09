import { Trans, useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { INSTALL_NS } from './i18n/register';
import { InstallIcon } from './installIcons';
import type { InstallController } from './useInstallFlow';

// The notification entry points on the order page and on "order placed" (spec 6.1, 6.3). They read
// one InstallController and show what fits this device: a quiet line, the "Last step" card on an
// installed iPhone, the green "on" banner, or the "Get a message" card. The sheets they open are
// drawn by InstallOverlay.

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: 1rem;
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.conf};

  span {
    display: flex;
    flex-direction: column;
  }
  b {
    color: ${({ theme }) => theme.c.text};
    font-weight: 700;
  }
`;
const LastStep = styled.section`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  border-radius: 1.25rem;
  background: ${({ theme }) => theme.c.surf2};

  h2 {
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.lg};
    line-height: 1.25;
    font-weight: 700;
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
  }
  b {
    color: ${({ theme }) => theme.c.text};
  }
  button {
    align-self: stretch;
  }
`;
const Line = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.sm} 0;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  min-height: ${({ theme }) => theme.size.tap}px;
  color: ${({ theme }) => theme.c.muted};

  span {
    flex: 1;
  }
`;
const Disc = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.muted};
`;
const LastStepDisc = styled(Disc)`
  width: 3.5rem;
  height: 3.5rem;
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};
`;
const Filled = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 3.25rem;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
`;
const Outlined = styled(Filled)`
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
`;
const TextLink = styled.button`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    cursor: wait;
    opacity: 0.6;
  }
`;
const NotNow = styled(TextLink)`
  align-self: center;
`;
const CardBox = styled.section`
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: ${({ theme }) => theme.spacing.md};
  row-gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 1.25rem;
  background: ${({ theme }) => theme.c.surf};

  h2 {
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.lg};
    line-height: 1.25;
    font-weight: 700;
  }
  p {
    grid-column: 2;
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.md};
  }
  button {
    grid-column: 1 / -1;
    margin-top: ${({ theme }) => theme.spacing.sm};
  }
`;

type Props = Readonly<{ controller: InstallController; code?: string | undefined }>;

/**
 * Above the order's updates: the green "on" banner, or on an installed iPhone the "Last step" card
 * (spec 6.3). Nothing otherwise; the quiet line (NotifyLine) sits below.
 */
export function NotifyCard({ controller, code }: Props) {
  const { t } = useTranslation(INSTALL_NS);
  const { status, env, busy } = controller;
  if (status === 'on') {
    return (
      <Banner role="status" data-testid="notify-on">
        <InstallIcon name="checkCircle" size="1.75rem" />
        <span>
          <b>{t('notify.onTitle')}</b>
          {t('notify.onBody')}
        </span>
      </Banner>
    );
  }
  const lastStep = controller.kind === 'notify' && env.platform === 'ios' && status === 'off';
  if (!lastStep || controller.cardDismissed) return null;
  return (
    <LastStep data-testid="notify-last-step">
      <LastStepDisc>
        <InstallIcon name="bell" size="1.5rem" />
      </LastStepDisc>
      <h2>{t('notify.offTitle')}</h2>
      <p>
        <Trans
          t={t}
          i18nKey={code ? 'notify.offBody' : 'notify.offBodyNoCode'}
          ns={INSTALL_NS}
          values={{ code }}
          components={{ b: <b /> }}
        />
      </p>
      <Filled type="button" disabled={busy} onClick={controller.enable}>
        {busy ? t('notify.working') : t('notify.offButton')}
      </Filled>
      <NotNow type="button" onClick={controller.dismissCard}>
        {t('notNow')}
      </NotNow>
    </LastStep>
  );
}

/** The quiet line under the updates: "Notifications are off · Turn on" (never blocks anything). */
export function NotifyLine({ controller }: Readonly<{ controller: InstallController }>) {
  const { t } = useTranslation(INSTALL_NS);
  const { status, env, busy } = controller;
  if (status === 'on' || status === 'unsupported') return null;
  // The "Last step" card carries the iPhone's own button; the line would repeat it.
  const cardShown = controller.kind === 'notify' && env.platform === 'ios' && status === 'off';
  if (cardShown && !controller.cardDismissed) return null;
  const blocked = status === 'blocked';
  const text = blocked
    ? t('line.blocked')
    : env.platform === 'desktop'
      ? t('line.desktop')
      : t('line.off');
  return (
    <div aria-live="polite">
      <Line>
        <InstallIcon name="bellOff" />
        <span>{busy ? t('line.working') : text}</span>
        {busy ? null : (
          <TextLink type="button" onClick={controller.start}>
            {blocked ? t('line.howTo') : t('line.turnOn')}
          </TextLink>
        )}
      </Line>
    </div>
  );
}

/** "Order placed": the "Get a message when your order is ready" card (spec 4.3). */
export function UpdatesCard({ controller }: Props) {
  const { t } = useTranslation(INSTALL_NS);
  const { status, busy } = controller;
  if (status === 'unsupported') return null;
  const on = status === 'on';
  const blocked = status === 'blocked';
  return (
    <CardBox aria-live="polite" data-testid="updates-card">
      <Disc>
        <InstallIcon name={on ? 'checkCircle' : 'bell'} />
      </Disc>
      <h2>{on ? t('card.onTitle') : blocked ? t('card.blockedTitle') : t('card.title')}</h2>
      <p>{on ? t('card.onBody') : blocked ? t('card.blockedBody') : t('card.body')}</p>
      {on ? null : (
        <Outlined type="button" disabled={busy} onClick={controller.start}>
          {busy ? t('line.working') : blocked ? t('card.blockedButton') : t('card.button')}
        </Outlined>
      )}
    </CardBox>
  );
}
