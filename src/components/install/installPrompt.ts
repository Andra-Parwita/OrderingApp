import { useSyncExternalStore } from 'react';

// Android Chrome's own "Install" (plan 004 stage 7, spec 6.1 and the Settings card). The browser
// fires `beforeinstallprompt` once, early; it is kept here until the customer taps Install.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Saved = Readonly<{ event: InstallPromptEvent; href: string }>;

let saved: Saved | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** The page's own `<link rel="manifest">` href: the kitchen an install prompt belongs to (plan 102). */
function pageManifestHref(): string {
  try {
    return document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '';
  } catch {
    return '';
  }
}

const matchesPage = (value: Saved): boolean => value.href === pageManifestHref();

/** Starts listening; call once at startup. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    saved = { event: event as InstallPromptEvent, href: pageManifestHref() };
    notify();
  });
  window.addEventListener('appinstalled', () => {
    saved = null;
    notify();
  });
}

/**
 * True when the browser's own install dialog can be shown for this page. A saved event made for
 * another kitchen's manifest is dropped here: the caller then shows the by-hand screen instead.
 */
export function hasInstallPrompt(): boolean {
  if (saved === null) return false;
  if (matchesPage(saved)) return true;
  saved = null;
  notify();
  return false;
}

/** Shows the browser's install dialog. Resolves true when the customer accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!hasInstallPrompt() || saved === null) return false;
  const { event } = saved;
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
    () => saved !== null && matchesPage(saved),
    () => false,
  );
}

/** For tests. */
export function setSavedInstallPrompt(event: InstallPromptEvent | null): void {
  saved = event === null ? null : { event, href: pageManifestHref() };
  notify();
}
