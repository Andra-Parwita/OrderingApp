import { useEffect, useState } from 'react';
import { fetchHealth } from './health';

// Whether the server runs with DEV_TOOLS on (a local dev server). The app asks the server once
// per page load instead of guessing from its own build: production answers false.
let known: Promise<boolean> | undefined;
let answer: boolean | undefined;

export function devToolsEnabled(): Promise<boolean> {
  known ??= fetchHealth()
    .then((health) => {
      answer = health.devTools;
      return health.devTools;
    })
    .catch(() => {
      known = undefined; // ask again next time: the server may just have been unreachable
      return false;
    });
  return known;
}

/** Forgets the answer (tests that change what the server says). */
export function forgetDevTools(): void {
  known = undefined;
  answer = undefined;
}

/** `undefined` until the server has answered; once it has, every screen knows at its first render. */
export function useDevTools(): boolean | undefined {
  const [on, setOn] = useState<boolean | undefined>(answer);
  useEffect(() => {
    let live = true;
    void devToolsEnabled().then((value) => {
      if (live) setOn(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return on;
}
