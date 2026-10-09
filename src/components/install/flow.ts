// The install and notification flow as a small state machine (plan 004 stage 7, spec 6). Pure:
// the hook (useInstallFlow) feeds it events and does the browser work; the screens only draw it.
import { chooseFlow, type Environment } from './detect';

export type ScreenId =
  | 'ios-ask'
  | 'ios-step-1'
  | 'ios-step-2'
  | 'ios-step-3'
  | 'ios-step-4'
  | 'ios-open-from-home'
  | 'ios-inside-whatsapp'
  | 'android-inside-whatsapp'
  | 'android-allow'
  | 'notify-off'
  | 'notify-blocked'
  /** The server has no push keys. */
  | 'not-set-up'
  /** This browser cannot get notifications. */
  | 'unsupported'
  /** Something went wrong while turning them on. */
  | 'failed';

/** Safari has the ••• button first; every other iPhone browser starts at Share (spec 6.1). */
export type GuideVariant = 'safari' | 'other';

const GUIDE: Readonly<Record<GuideVariant, ReadonlyArray<ScreenId>>> = {
  safari: ['ios-ask', 'ios-step-1', 'ios-step-2', 'ios-step-3', 'ios-step-4', 'ios-open-from-home'],
  other: ['ios-ask', 'ios-step-2', 'ios-step-3', 'ios-step-4', 'ios-open-from-home'],
};

/** A one-line note under a screen: "Link copied", "still blocked", "I can't find the icon". */
export type Hint = 'copied' | 'still-blocked' | 'cant-find' | 'copy-failed';

export type FlowState = Readonly<{
  /** The screen on show; null when the flow is closed. */
  screen: ScreenId | null;
  variant: GuideVariant;
  /** Waiting on the phone's permission prompt or the server. */
  busy: boolean;
  hint: Hint | null;
}>;

export const CLOSED: FlowState = { screen: null, variant: 'safari', busy: false, hint: null };

export type FlowEvent =
  | Readonly<{ type: 'open'; screen: ScreenId; variant?: GuideVariant }>
  | Readonly<{ type: 'next' }>
  | Readonly<{ type: 'back' }>
  | Readonly<{ type: 'close' }>
  | Readonly<{ type: 'busy'; busy: boolean }>
  | Readonly<{ type: 'show'; screen: ScreenId }>
  | Readonly<{ type: 'hint'; hint: Hint | null }>;

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'open':
      return {
        screen: event.screen,
        variant: event.variant ?? state.variant,
        busy: false,
        hint: null,
      };
    case 'close':
      return { ...CLOSED, variant: state.variant };
    case 'busy':
      return { ...state, busy: event.busy };
    case 'show':
      return { ...state, screen: event.screen, busy: false, hint: null };
    case 'hint':
      return { ...state, hint: event.hint };
    case 'next':
    case 'back': {
      const steps = GUIDE[state.variant];
      const at = state.screen === null ? -1 : steps.indexOf(state.screen);
      if (at === -1) return state;
      const to = steps[event.type === 'next' ? at + 1 : at - 1];
      return to === undefined ? state : { ...state, screen: to, hint: null };
    }
  }
}

/** The 1-based step number and the step count of an iPhone step screen; null for the other screens. */
export function stepOf(
  screen: ScreenId,
  variant: GuideVariant,
): { n: number; total: number } | null {
  const steps = GUIDE[variant].filter((id) => id.startsWith('ios-step-'));
  const at = steps.indexOf(screen);
  return at === -1 ? null : { n: at + 1, total: steps.length };
}

/** Whether Back is shown: from the second step of the guide on (the design has none on step 1). */
export function canGoBack(screen: ScreenId, variant: GuideVariant): boolean {
  const at = GUIDE[variant].indexOf(screen);
  return at > 1 && screen !== 'ios-open-from-home';
}

/**
 * What "Turn on updates" shows first on this device. `immediate` means the permission prompt is
 * asked for in the same tap (Android and desktop: no install needed, spec 6.1); a screen of null
 * means nothing is drawn while it waits (desktop's quiet line).
 */
export function entryFor(env: Environment): {
  screen: ScreenId | null;
  immediate: boolean;
  variant: GuideVariant;
} {
  const variant: GuideVariant = env.safari ? 'safari' : 'other';
  switch (chooseFlow(env)) {
    case 'ios-guide':
      return { screen: 'ios-ask', immediate: false, variant };
    case 'ios-in-app':
      return { screen: 'ios-inside-whatsapp', immediate: false, variant };
    case 'android-in-app':
      return { screen: 'android-inside-whatsapp', immediate: false, variant };
    case 'unsupported':
      return { screen: 'unsupported', immediate: false, variant };
    case 'notify':
      if (env.permission === 'denied') {
        return { screen: 'notify-blocked', immediate: false, variant };
      }
      // An installed iPhone shows its own "Last step" screen and asks on the tap there.
      if (env.platform === 'ios') return { screen: 'notify-off', immediate: false, variant };
      return {
        screen: env.platform === 'android' ? 'android-allow' : null,
        immediate: true,
        variant,
      };
  }
}
