export type DeviceKind = 'iphone' | 'ipad' | 'android' | 'computer';

/** A first guess at what this device is, from the browser's user agent. */
export function guessDevice(
  userAgent: string = navigator.userAgent,
  maxTouchPoints: number = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
): DeviceKind {
  if (/iPad/i.test(userAgent)) return 'ipad';
  // iPadOS asks for desktop sites as a Mac; a Mac with a touch screen is an iPad.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ipad';
  if (/iPhone|iPod/i.test(userAgent)) return 'iphone';
  if (/Android/i.test(userAgent)) return 'android';
  return 'computer';
}
