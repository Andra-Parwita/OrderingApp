// What this phone knows about Remember me. Nothing secret: whether it is on, which passkey, and
// whether the quiet offers were dismissed. Components follow it with useSyncExternalStore.
const ON_KEY = 'rememberMe';
const CHIP_KEY = 'rememberMe:chipHidden';
const NUDGE_KEY = 'rememberMe:nudgeHidden';
export const REMEMBER_ME_CHANGED = 'rememberme:changed';

export type RememberMeLocal = Readonly<{
  /** The passkey this phone signed in with. */
  credentialId: string | null;
  /** The passkey can seal the address and this phone holds the key. */
  sealing: boolean;
  /** Joined by code and has not added its own passkey yet. */
  setup: boolean;
}>;

function changed(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REMEMBER_ME_CHANGED));
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the offer just shows again
  }
  changed();
}

/** The raw string is the snapshot, so useSyncExternalStore sees a stable value. */
export const rememberMeSnapshot = (): string => read(ON_KEY) ?? '';
export const chipHiddenSnapshot = (): boolean => read(CHIP_KEY) === '1';
export const nudgeHiddenSnapshot = (): boolean => read(NUDGE_KEY) === '1';

export function parseLocal(raw: string): RememberMeLocal | null {
  if (raw === '') return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const id = value['credentialId'];
    return {
      credentialId: typeof id === 'string' ? id : null,
      sealing: value['sealing'] === true,
      setup: value['setup'] === true,
    };
  } catch {
    return null;
  }
}

export const rememberMeLocal = (): RememberMeLocal | null => parseLocal(rememberMeSnapshot());
export const setRememberMeLocal = (value: RememberMeLocal): void => {
  write(ON_KEY, JSON.stringify(value));
};
export const clearRememberMeLocal = (): void => {
  write(ON_KEY, null);
};
export const hideChip = (): void => {
  write(CHIP_KEY, '1');
};
export const hideNudge = (): void => {
  write(NUDGE_KEY, '1');
};

export function watchRememberMe(onChange: () => void): () => void {
  window.addEventListener(REMEMBER_ME_CHANGED, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(REMEMBER_ME_CHANGED, onChange);
    window.removeEventListener('storage', onChange);
  };
}
