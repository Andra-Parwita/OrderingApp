// "How ordering works" is shown by itself once to a first-timer; this remembers, on this phone
// only, that it has been shown. Storage can be blocked (private window), so every call is guarded.
export const HOW_SEEN_KEY = 'howItWorksSeen';

export function hasSeenHowItWorks(): boolean {
  try {
    return localStorage.getItem(HOW_SEEN_KEY) === '1';
  } catch {
    // Storage unavailable: behave as if seen, so the page never reopens on every visit.
    return true;
  }
}

export function markHowItWorksSeen(): void {
  try {
    localStorage.setItem(HOW_SEEN_KEY, '1');
  } catch {
    // Nothing to do: the page is simply not remembered.
  }
}
