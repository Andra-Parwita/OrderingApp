// Plan 096: when the two quiet nudges (home screen, Remember me) may show on this phone. Per phone, in
// localStorage; no storage means they show each time (never blocks anything).
const DAY_MS = 24 * 60 * 60 * 1000;
export const HOME_NUDGE_KEY = 'nudge:homeScreenUntil';
export const REMEMBER_NUDGE_KEY = 'nudge:rememberMe';
/** The Remember me nudge shows at most this many times in total. */
export const REMEMBER_NUDGE_MAX = 3;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // no storage: the nudge shows again next time
  }
}

/** The cross hides the home-screen pill for 14 days. */
export const homeNudgeHidden = (now = Date.now()): boolean =>
  now < Number(read(HOME_NUDGE_KEY) ?? 0);
export const hideHomeNudge = (now = Date.now()): void => {
  write(HOME_NUDGE_KEY, String(now + 14 * DAY_MS));
};

type RememberNudge = Readonly<{ until: number; shows: number }>;
function readRemember(): RememberNudge {
  try {
    const value = JSON.parse(read(REMEMBER_NUDGE_KEY) ?? '{}') as Record<string, unknown>;
    return {
      until: typeof value['until'] === 'number' ? value['until'] : 0,
      shows: typeof value['shows'] === 'number' ? value['shows'] : 0,
    };
  } catch {
    return { until: 0, shows: 0 };
  }
}

/** Not hidden by a cross in the last 30 days, and shown fewer than 3 times in total. */
export const rememberNudgeAllowed = (now = Date.now()): boolean => {
  const state = readRemember();
  return state.shows < REMEMBER_NUDGE_MAX && now >= state.until;
};
export const countRememberNudgeShown = (): void => {
  const state = readRemember();
  write(REMEMBER_NUDGE_KEY, JSON.stringify({ ...state, shows: state.shows + 1 }));
};
/** The cross: ask again after 30 days. */
export const hideRememberNudge = (now = Date.now()): void => {
  write(REMEMBER_NUDGE_KEY, JSON.stringify({ ...readRemember(), until: now + 30 * DAY_MS }));
};
