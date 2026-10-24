import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Me } from '../../shared/authContract';
import { Button } from '../ui';
import {
  activeKitchenSlug,
  markReloaded,
  rememberLaunchKitchen,
  reloadSeller,
  reloadedFor,
  switchToKitchen,
} from './launchKitchen';
import { useSession } from './session';

// Plan 101 stages 3 and 4: opening a kitchen's own seller app (`/seller?k=<slug>`) shows that kitchen.
// Any failure shows the app as it was before this plan. At most one reload per launch: the kitchen a
// reload was made for is kept in sessionStorage, and a second mismatch for it does nothing.

const Screen = styled.main`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
`;
const Text = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
`;

type Phase =
  | Readonly<{ kind: 'checking' }>
  | Readonly<{ kind: 'pass' }>
  | Readonly<{ kind: 'opening'; name: string }>
  | Readonly<{ kind: 'not-member'; name: string }>
  | Readonly<{ kind: 'paused'; name: string }>;

export type LaunchGateProps = Readonly<{
  /** The signed-in person (staff). */
  me: Me;
  /** The kitchen this window was launched for. */
  target: string;
  /** The clean full load after a switch; replaced in tests. */
  reload?: (slug: string | null) => void;
  children: ReactNode;
}>;

export function LaunchGate({ me, target, reload = reloadSeller, children }: LaunchGateProps) {
  const { t } = useTranslation();
  const { adopt } = useSession();
  const match = me.slug === target;
  // Matching when the page opened (not because of our own switch, which reloads next).
  const [arrived] = useState(match);
  // A reload was already made for this kitchen and it still did not match: show today's app, no loop.
  const [blocked] = useState(() => reloadedFor() === target);
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });

  useEffect(() => {
    if (!arrived) return undefined;
    markReloaded(null); // arrived: a later mismatch may reload once again
    // Stage 4: another seller app on this phone shares the cookie and may have switched the kitchen.
    let live = true;
    let busy = false;
    const resume = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      const active = await activeKitchenSlug();
      if (live && active !== null && active !== target && reloadedFor() !== target) {
        const outcome = await switchToKitchen(target);
        if (live && outcome.kind === 'switched') {
          markReloaded(target);
          adopt(outcome.me);
          reload(target);
        }
      }
      busy = false;
    };
    const onEvent = () => void resume();
    document.addEventListener('visibilitychange', onEvent);
    window.addEventListener('focus', onEvent);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onEvent);
      window.removeEventListener('focus', onEvent);
    };
  }, [arrived, target, adopt, reload]);

  useEffect(() => {
    if (match || blocked) return undefined;
    let live = true;
    void switchToKitchen(target).then((outcome) => {
      if (!live) return;
      if (outcome.kind === 'switched') {
        markReloaded(target);
        setPhase({ kind: 'opening', name: outcome.me.sellerName ?? target });
        adopt(outcome.me);
        reload(target);
      } else if (outcome.kind === 'not-member')
        setPhase({ kind: 'not-member', name: outcome.name ?? t('sellerLaunch.thisKitchen') });
      else if (outcome.kind === 'paused') setPhase({ kind: 'paused', name: outcome.name });
      else setPhase({ kind: 'pass' });
    });
    return () => {
      live = false;
    };
  }, [match, blocked, target, adopt, reload, t]);

  const openOther = () => {
    // The other kitchen is the one that is active: remember it as this window's kitchen.
    rememberLaunchKitchen(me.slug ?? null);
    markReloaded(null);
    reload(me.slug ?? null);
  };
  const other = me.sellerName ?? t('sellerLaunch.yourKitchen');

  if (phase.kind === 'opening') {
    return (
      <Screen role="status">
        <Title>{t('sellerLaunch.opening', { name: phase.name })}</Title>
        <Text>{t('sellerLaunch.openingBody')}</Text>
      </Screen>
    );
  }
  if (match || blocked || phase.kind === 'pass') return <>{children}</>;
  if (phase.kind === 'not-member') {
    return (
      <Screen>
        <Title>{t('sellerLaunch.notMember', { name: phase.name })}</Title>
        <Text>{t('sellerLaunch.notMemberBody')}</Text>
        <Button variant="primary" onClick={openOther}>
          {t('sellerLaunch.openOther', { name: other })}
        </Button>
        <Text>{t('sellerLaunch.removeIcon')}</Text>
      </Screen>
    );
  }
  if (phase.kind === 'paused') {
    return (
      <Screen>
        <Title>{t('sellerLaunch.paused', { name: phase.name })}</Title>
        <Text>{t('sellerLaunch.pausedBody')}</Text>
        <Button variant="primary" onClick={openOther}>
          {t('sellerLaunch.openOther', { name: other })}
        </Button>
      </Screen>
    );
  }
  return null; // checking: a moment
}
