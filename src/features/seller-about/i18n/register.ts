import i18n from 'i18next';
import en from './en.json';
import id from './id.json';

export const ABOUT_NS = 'sellerAbout';

let registered = false;

/** Adds the About strings to the app's i18n instance (after i18n is initialised). Safe to call twice. */
export function registerAboutI18n(): void {
  if (registered) return;
  registered = true;
  i18n.addResourceBundle('en', ABOUT_NS, en, true, true);
  i18n.addResourceBundle('id', ABOUT_NS, id, true, true);
}

// The seller rail and the More list read the label before any screen of this feature mounts, so the
// strings register themselves as soon as i18n is ready (no change to main.tsx needed).
if (i18n.isInitialized) registerAboutI18n();
else i18n.on('initialized', registerAboutI18n);
