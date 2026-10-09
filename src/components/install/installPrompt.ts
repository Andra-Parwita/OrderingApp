import { useSyncExternalStore } from 'react';

// Android Chrome's own "Install" (plan 004 stage 7, spec 6.1 and the Settings card). The browser
// fires `beforeinstallprompt` once, early; it is kept here until the customer taps Install.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let saved: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Starts listening; call once at startup. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    saved = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    saved = null;
    notify();
  });
}

/** Shows the browser's install dialog. Resolves true when the customer accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = saved;
  if (!event) return false;
  saved = null;
  notify();
  try {
    await event.prompt();
    return (await event.userChoice).outcome === 'accepted';
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** True while the browser is offering to install the app. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => saved !== null,
    () => false,
  );
}

/** For tests. */
export function setSavedInstallPrompt(event: InstallPromptEvent | null): void {
  saved = event;
  notify();
}
