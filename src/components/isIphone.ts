/** True on an iPhone or iPad, where Apple Maps is offered next to Google Maps (plan 071). */
export function isIphone(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
}
