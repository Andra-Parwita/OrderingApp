import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { TOKENS_MAX } from '../../../shared/limits';
import { readMyOrders } from '../../api/device/myOrders';
import {
  chooseFlow,
  pushStatus,
  readEnvironment,
  type Environment,
  type FlowKind,
  type Permission,
  type PushStatus,
} from './detect';
import {
  CLOSED,
  canGoBack,
  entryFor,
  flowReducer,
  stepOf,
  type FlowState,
  type GuideVariant,
  type ScreenId,
} from './flow';
import {
  browserPushDeps,
  currentSubscription,
  disablePush,
  enablePush,
  type PushDeps,
} from './pushBrowser';

// The install and notification flow for one place on screen (an order page, the order-placed page,
// Settings): detection, the state machine, and the browser work (permission, subscribe,
// unsubscribe). Notification permission is only ever asked for from a tap: `start` (Android and
// desktop) and `enable` (the iPhone "Turn on notifications" button) are tap handlers.

export type InstallOptions = Readonly<{
  /** The orders to subscribe or unsubscribe: the one on show, or all saved on this phone. Read at tap time. */
  tokens: () => ReadonlyArray<string>;
  /** Where "Copy link" points; the current page by default. */
  linkUrl?: () => string;
  /** Send this browser's existing subscription to the orders on show when the page opens. Default true. */
  syncOnMount?: boolean;
  /** Fixtures and tests: a fixed environment instead of the browser's own (nothing is read or sent). */
  env?: Environment;
  /** Fixtures and tests: the starting state. */
  subscribed?: boolean;
  screen?: ScreenId;
  variant?: GuideVariant;
  deps?: PushDeps;
}>;

export type InstallController = Readonly<{
  env: Environment;
  kind: FlowKind;
  status: PushStatus;
  flow: FlowState;
  /** The iPhone step shown, as "n of total"; null on other screens. */
  step: { n: number; total: number } | null;
  showBack: boolean;
  /** Waiting for the phone's prompt or the server. */
  busy: boolean;
  /** "Turn on updates": what happens depends on the device (spec 6.1). */
  start: () => void;
  /** Opens the guide at its first step (Settings → "Show me how"). */
  startGuide: () => void;
  /** "Turn on notifications": asks for permission, then subscribes. */
  enable: () => void;
  /** "I turned them on": looks at the permission again. */
  recheck: () => void;
  /** Settings switch off. */
  disable: () => void;
  /** The installed-iPhone "Last step" card was dismissed with Not now: the quiet line takes over. */
  cardDismissed: boolean;
  dismissCard: () => void;
  next: () => void;
  back: () => void;
  close: () => void;
  copyLink: () => void;
  showCantFind: () => void;
}>;

/** What a fixture or a test may fix, in place of what the browser reports. */
export type InstallOverride = Pick<
  InstallOptions,
  'env' | 'subscribed' | 'screen' | 'variant' | 'deps'
>;

/** The flow for one order (the order page and "order placed"): subscribes just that order. */
export function useOrderInstall(token: string, override?: InstallOverride): InstallController {
  const tokens = useCallback(() => [token], [token]);
  const linkUrl = useCallback(
    () => `${window.location.origin}/o/${encodeURIComponent(token)}`,
    [token],
  );
  return useInstallFlow({ tokens, linkUrl, ...override });
}

/** The flow for Settings: every order saved on this phone (the server skips ones already closed). */
export function useSavedOrdersInstall(override?: InstallOverride): InstallController {
  const tokens = useCallback(
    () =>
      readMyOrders()
        .slice(0, TOKENS_MAX)
        .map((entry) => entry.token),
    [],
  );
  return useInstallFlow({ tokens, syncOnMount: false, ...override });
}

const withPermission = (env: Environment, permission: Permission): Environment => ({
  ...env,
  permission,
});

function currentPermission(): Permission {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function useInstallFlow(options: InstallOptions): InstallController {
  const fixed = options.env !== undefined;
  const [env, setEnv] = useState<Environment>(() => options.env ?? readEnvironment());
  const [subscribed, setSubscribed] = useState(options.subscribed ?? false);
  const [flow, dispatch] = useReducer(flowReducer, options, (initial): FlowState =>
    initial.screen === undefined
      ? CLOSED
      : { ...CLOSED, screen: initial.screen, variant: initial.variant ?? 'safari' },
  );
  const [working, setWorking] = useState(false);
  const [cardDismissed, setCardDismissed] = useState(false);
  const latest = useRef({ options, env, flow });
  // Handlers and effects read the newest values through this; it is set after each render.
  useEffect(() => {
    latest.current = { options, env, flow };
  });
  const deps = options.deps ?? browserPushDeps;

  // A browser that already has a subscription (the customer turned notifications on earlier): note
  // it, and quietly give it to the orders on this page. The server keeps one row per browser and
  // order, so repeating this is harmless.
  useEffect(() => {
    if (fixed || chooseFlow(latest.current.env) !== 'notify') return undefined;
    if (latest.current.env.permission !== 'granted') return undefined;
    let cancelled = false;
    void currentSubscription(deps).then((subscription) => {
      if (cancelled || !subscription) return;
      setSubscribed(true);
      if (latest.current.options.syncOnMount === false) return;
      for (const token of latest.current.options.tokens()) {
        void deps.subscribeOrder(token, subscription);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fixed, deps]);

  /** Permission is granted: subscribe, then show the result. */
  const subscribeNow = useCallback(async () => {
    const result = await enablePush(latest.current.options.tokens(), deps);
    if (result.ok) {
      setSubscribed(true);
      setEnv((current) => withPermission(current, 'granted'));
      // Done: the sheet closes and the page behind it now says "Notifications are on".
      dispatch({ type: 'close' });
      return;
    }
    dispatch({ type: 'show', screen: result.reason === 'not-set-up' ? 'not-set-up' : 'failed' });
  }, [deps]);

  const afterPermission = useCallback(
    async (permission: Permission) => {
      setEnv((current) => withPermission(current, permission));
      if (permission === 'granted') {
        await subscribeNow();
      } else if (permission === 'denied') {
        dispatch({ type: 'show', screen: 'notify-blocked' });
      } else {
        // The prompt was dismissed without an answer: stay where we were.
        dispatch({ type: 'busy', busy: false });
      }
    },
    [subscribeNow],
  );

  const enable = useCallback(() => {
    if (!('Notification' in window)) {
      dispatch({ type: 'show', screen: 'unsupported' });
      return;
    }
    dispatch({ type: 'busy', busy: true });
    // Asked for here, in the tap, and nowhere else. Older Safari answers through the permission
    // property only, so a missing result is read from there.
    let asked: Promise<NotificationPermission | undefined>;
    try {
      asked = Promise.resolve(Notification.requestPermission());
    } catch {
      asked = Promise.resolve(undefined);
    }
    void asked.then((result) => afterPermission(result ?? currentPermission()));
  }, [afterPermission]);

  const start = useCallback(() => {
    const entry = entryFor(latest.current.env);
    if (entry.screen === null) dispatch({ type: 'busy', busy: true });
    else dispatch({ type: 'open', screen: entry.screen, variant: entry.variant });
    if (entry.immediate) enable();
  }, [enable]);

  const startGuide = useCallback(() => {
    const entry = entryFor(latest.current.env);
    const first: ScreenId = entry.variant === 'safari' ? 'ios-step-1' : 'ios-step-2';
    dispatch({
      type: 'open',
      screen: entry.screen === 'ios-ask' ? first : (entry.screen ?? first),
      variant: entry.variant,
    });
  }, []);

  const recheck = useCallback(() => {
    const permission = currentPermission();
    if (permission === 'granted') {
      dispatch({ type: 'busy', busy: true });
      void afterPermission('granted');
    } else if (permission === 'default') {
      setEnv((current) => withPermission(current, 'default'));
      dispatch({ type: 'show', screen: 'notify-off' });
    } else {
      dispatch({ type: 'hint', hint: 'still-blocked' });
    }
  }, [afterPermission]);

  const disable = useCallback(() => {
    setWorking(true);
    void disablePush(latest.current.options.tokens(), deps).then((ok) => {
      if (ok) setSubscribed(false);
      setWorking(false);
    });
  }, [deps]);

  const copyLink = useCallback(() => {
    const link = latest.current.options.linkUrl?.() ?? window.location.href;
    const done = (hint: 'copied' | 'copy-failed') => dispatch({ type: 'hint', hint });
    try {
      void navigator.clipboard.writeText(link).then(
        () => done('copied'),
        () => done('copy-failed'),
      );
    } catch {
      done('copy-failed');
    }
  }, []);

  return {
    env,
    kind: chooseFlow(env),
    status: pushStatus(env, subscribed),
    flow,
    step: flow.screen === null ? null : stepOf(flow.screen, flow.variant),
    showBack: flow.screen !== null && canGoBack(flow.screen, flow.variant),
    busy: flow.busy || working,
    start,
    startGuide,
    enable,
    recheck,
    disable,
    cardDismissed,
    dismissCard: useCallback(() => setCardDismissed(true), []),
    next: useCallback(() => dispatch({ type: 'next' }), []),
    back: useCallback(() => dispatch({ type: 'back' }), []),
    close: useCallback(() => dispatch({ type: 'close' }), []),
    copyLink,
    showCantFind: useCallback(() => dispatch({ type: 'hint', hint: 'cant-find' }), []),
  };
}
