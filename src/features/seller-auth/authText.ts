import type { TFunction } from 'i18next';
import type { ApiFailure } from '../../api/http';

/** Forgiving key input: spaces, dashes and small letters are all fine. */
export function cleanKey(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** The 6-digit add-device code: digits only, spaces ignored. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

export type DeviceKind = 'iphone' | 'ipad' | 'android' | 'computer';

/** A first guess at what this device is, from the browser's user agent. */
export function guessDevice(userAgent: string = navigator.userAgent): DeviceKind {
  if (/iPad/i.test(userAgent)) return 'ipad';
  if (/iPhone|iPod/i.test(userAgent)) return 'iphone';
  if (/Android/i.test(userAgent)) return 'android';
  return 'computer';
}

/** The three device tabs on the passkey help: an iPad reads the iPhone steps. */
export type HelpTab = 'iphone' | 'android' | 'computer';
export function helpTabFor(kind: DeviceKind): HelpTab {
  return kind === 'ipad' ? 'iphone' : kind;
}

/** One plain sentence for a failed call; never says which part of a key or password was wrong. */
export function failureMessage(t: TFunction, failure: ApiFailure): string {
  switch (failure.error) {
    case 'network':
      return t('errors.network');
    case 'locked_out':
      return t('errors.locked', {
        count: Math.max(1, Math.ceil((failure.retryAfterSeconds ?? 60) / 60)),
      });
    case 'invalid_credentials':
      return failure.triesLeft === undefined
        ? t('errors.wrong')
        : `${t('errors.wrong')} ${t('errors.triesLeft', { count: failure.triesLeft })}`;
    case 'unauthorized':
      return t('errors.setupExpired');
    case 'passkey_cancelled':
      return t('errors.passkeyCancelled');
    case 'passkey_failed':
      return t('errors.passkeyFailed');
    default:
      return t('errors.generic');
  }
}

/** mm:ss for the add-device countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
