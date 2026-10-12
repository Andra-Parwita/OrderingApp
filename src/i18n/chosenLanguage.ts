/**
 * Plan 060: "has chosen" = the customer switched language on this device. A separate flag from the
 * shared `lang` key, so the seller app on the same device is not affected.
 */
const CHOSEN_KEY = 'langChosen';

export function hasChosenLanguage(): boolean {
  try {
    return localStorage.getItem(CHOSEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLanguageChosen(): void {
  try {
    localStorage.setItem(CHOSEN_KEY, '1');
  } catch {
    // storage unavailable: the choice still applies for this visit
  }
}
