// Where the customer is, for the notification and install flows (plan 004 stage 7, spec 6.1). Pure:
// `detectEnvironment` takes what the browser reports and `readEnvironment` reads it from `window`.
// When unsure the answer is the generic one ("unknown" / "unsupported"): the flow then explains and
// keeps Skip.

export type Permission = 'default' | 'granted' | 'denied' | 'unsupported';
export type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

export type Environment = Readonly<{
  platform: Platform;
  /** Inside WhatsApp, Instagram, Facebook, Line or another in-app browser. */
  inApp: boolean;
  /** Which one, when the user agent says ("WhatsApp"); null if it is just some web view. */
  inAppName: string | null;
  /** iPhone only: the real Safari (not Chrome, Edge or Firefox for iOS). */
  safari: boolean;
  /** Opened from the home screen. */
  installed: boolean;
  /** The browser can receive web push (`PushManager` and a service worker). */
  pushSupported: boolean;
  permission: Permission;
}>;

/** What the browser reports; every field optional so a test or a fixture can give just what matters. */
export type EnvironmentInput = Readonly<{
  userAgent?: string;
  /** `navigator.platform`. */
  platform?: string;
  maxTouchPoints?: number;
  /** `matchMedia('(display-mode: standalone)').matches`. */
  standaloneMedia?: boolean;
  /** `navigator.standalone` (iOS Safari only). */
  navigatorStandalone?: boolean;
  hasPushManager?: boolean;
  hasServiceWorker?: boolean;
  /** `Notification.permission`; undefined when there is no `Notification`. */
  permission?: string;
}>;

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|\bLine\//i;
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo/i;

function isIos(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  // iPadOS 13+ says it is a Mac; a Mac has no touch screen.
  return platform === 'MacIntel' && maxTouchPoints > 1;
}

/** The name for the in-app browser's screen, or null when it is some other web view. */
function inAppNameOf(userAgent: string): string | null {
  if (/WhatsApp/i.test(userAgent)) return 'WhatsApp';
  if (/Instagram/i.test(userAgent)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(userAgent)) return 'Facebook';
  if (/\bLine\//i.test(userAgent)) return 'Line';
  return null;
}

function toPermission(value: string | undefined): Permission {
  return value === 'default' || value === 'granted' || value === 'denied' ? value : 'unsupported';
}

export function detectEnvironment(input: EnvironmentInput): Environment {
  const userAgent = input.userAgent ?? '';
  const ios = isIos(userAgent, input.platform ?? '', input.maxTouchPoints ?? 0);
  const android = /Android/i.test(userAgent);
  const platform: Platform = ios
    ? 'ios'
    : android
      ? 'android'
      : userAgent === ''
        ? 'unknown'
        : 'desktop';
  const installed = input.standaloneMedia === true || input.navigatorStandalone === true;
  // An iPhone web view (WhatsApp, Instagram...) has no "Safari/" token in its user agent, but neither
  // does an installed web app, which is why the installed flag comes first.
  const iosWebView = ios && !installed && !/Safari\//.test(userAgent);
  const androidWebView = android && /;\s*wv\)/.test(userAgent);
  const inApp = !installed && (IN_APP.test(userAgent) || iosWebView || androidWebView);
  return {
    platform,
    inApp,
    inAppName: inApp ? inAppNameOf(userAgent) : null,
    safari: ios && !inApp && /Safari\//.test(userAgent) && !IOS_OTHER_BROWSER.test(userAgent),
    installed,
    pushSupported: input.hasPushManager === true && input.hasServiceWorker === true,
    permission: toPermission(input.permission),
  };
}

/** The phone or computer this page is open on. */
export function readEnvironment(): Environment {
  const nav = navigator as Navigator & { standalone?: boolean };
  let standaloneMedia = false;
  try {
    standaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    // no matchMedia (a very old browser): treated as not installed
  }
  return detectEnvironment({
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    standaloneMedia,
    ...(nav.standalone !== undefined ? { navigatorStandalone: nav.standalone } : {}),
    hasPushManager: 'PushManager' in window,
    hasServiceWorker: 'serviceWorker' in nav,
    ...('Notification' in window ? { permission: Notification.permission } : {}),
  });
}

/** What "Turn on updates" does here (spec 6.1). */
export type FlowKind =
  /** iPhone in a browser: add to the Home Screen first (4 steps). */
  | 'ios-guide'
  /** iPhone inside WhatsApp and the like: open Safari first. */
  | 'ios-in-app'
  /** Android inside WhatsApp and the like: open Chrome first. */
  | 'android-in-app'
  /** Push works here: ask for permission from the tap. */
  | 'notify'
  /** No way to get push here (an old browser, or one that cannot): say so, keep Skip. */
  | 'unsupported';

export function chooseFlow(env: Environment): FlowKind {
  if (env.platform === 'ios') {
    if (env.installed) return env.pushSupported ? 'notify' : 'unsupported';
    return env.inApp ? 'ios-in-app' : 'ios-guide';
  }
  if (env.platform === 'android' && env.inApp) return 'android-in-app';
  return env.pushSupported ? 'notify' : 'unsupported';
}

/** The state of notifications for this order, as the entry points show it. */
export type PushStatus = 'on' | 'off' | 'blocked' | 'unsupported';

export function pushStatus(env: Environment, subscribed: boolean): PushStatus {
  const kind = chooseFlow(env);
  if (kind === 'unsupported') return 'unsupported';
  if (kind !== 'notify') return 'off';
  if (env.permission === 'denied') return 'blocked';
  if (env.permission === 'granted' && subscribed) return 'on';
  return 'off';
}
