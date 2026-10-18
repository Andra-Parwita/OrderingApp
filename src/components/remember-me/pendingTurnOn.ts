// Plan 096: the "Remember me on all my phones" box on the name step. It lives only until the order is
// placed: the placed page starts the turn-on when the box was ticked a moment ago.
const WINDOW_MS = 10 * 60 * 1000;
let tickedAt: number | null = null;

export const setWantsRememberMe = (wants: boolean): void => {
  tickedAt = wants ? Date.now() : null;
};
export const wantsRememberMe = (now = Date.now()): boolean =>
  tickedAt !== null && now - tickedAt < WINDOW_MS;
export const clearWantsRememberMe = (): void => {
  tickedAt = null;
};
