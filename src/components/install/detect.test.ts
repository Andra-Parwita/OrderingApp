import { describe, expect, it } from 'vitest';
import {
  chooseFlow,
  detectEnvironment,
  pushStatus,
  type EnvironmentInput,
  type FlowKind,
} from './detect';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const IPHONE_WHATSAPP =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/24.10.80 Safari/604.1';
/** A web view with no Safari token at all (what WKWebView in other apps sends). */
const IPHONE_WEBVIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36';
const ANDROID_FACEBOOK =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const PUSH = { hasPushManager: true, hasServiceWorker: true } as const;

type Row = [name: string, input: EnvironmentInput, flow: FlowKind];

const rows: Array<Row> = [
  ['iPhone Safari, not installed', { userAgent: IPHONE_SAFARI }, 'ios-guide'],
  ['iPhone Chrome, not installed', { userAgent: IPHONE_CHROME }, 'ios-guide'],
  ['iPhone inside WhatsApp', { userAgent: IPHONE_WHATSAPP }, 'ios-in-app'],
  ['iPhone inside Instagram', { userAgent: IPHONE_INSTAGRAM }, 'ios-in-app'],
  ['iPhone web view without a Safari token', { userAgent: IPHONE_WEBVIEW }, 'ios-in-app'],
  [
    'iPhone installed (navigator.standalone)',
    { userAgent: IPHONE_WEBVIEW, navigatorStandalone: true, ...PUSH },
    'notify',
  ],
  [
    'iPhone installed (display-mode)',
    { userAgent: IPHONE_SAFARI, standaloneMedia: true, ...PUSH },
    'notify',
  ],
  [
    'iPhone installed on an iOS without web push',
    { userAgent: IPHONE_SAFARI, standaloneMedia: true },
    'unsupported',
  ],
  [
    'iPad that says it is a Mac',
    { userAgent: DESKTOP_CHROME, platform: 'MacIntel', maxTouchPoints: 5 },
    'ios-guide',
  ],
  ['Android Chrome', { userAgent: ANDROID_CHROME, ...PUSH }, 'notify'],
  ['Android Chrome without push', { userAgent: ANDROID_CHROME }, 'unsupported'],
  ['Android web view (wv)', { userAgent: ANDROID_WEBVIEW, ...PUSH }, 'android-in-app'],
  ['Android inside Facebook', { userAgent: ANDROID_FACEBOOK, ...PUSH }, 'android-in-app'],
  ['desktop Chrome', { userAgent: DESKTOP_CHROME, ...PUSH }, 'notify'],
  ['desktop without push', { userAgent: DESKTOP_CHROME }, 'unsupported'],
  ['nothing known', {}, 'unsupported'],
];

describe('detectEnvironment and chooseFlow', () => {
  it.each(rows)('%s', (_name, input, flow) => {
    expect(chooseFlow(detectEnvironment(input))).toBe(flow);
  });

  it('names the in-app browser and tells Safari from other iPhone browsers', () => {
    expect(detectEnvironment({ userAgent: IPHONE_WHATSAPP })).toMatchObject({
      inApp: true,
      inAppName: 'WhatsApp',
      safari: false,
    });
    expect(detectEnvironment({ userAgent: IPHONE_INSTAGRAM }).inAppName).toBe('Instagram');
    expect(detectEnvironment({ userAgent: ANDROID_FACEBOOK }).inAppName).toBe('Facebook');
    expect(detectEnvironment({ userAgent: IPHONE_WEBVIEW }).inAppName).toBeNull();
    expect(detectEnvironment({ userAgent: IPHONE_SAFARI }).safari).toBe(true);
    expect(detectEnvironment({ userAgent: IPHONE_CHROME }).safari).toBe(false);
  });

  it('reads the permission, and says unsupported when there is no Notification', () => {
    expect(detectEnvironment({ permission: 'denied' }).permission).toBe('denied');
    expect(detectEnvironment({ permission: 'granted' }).permission).toBe('granted');
    expect(detectEnvironment({}).permission).toBe('unsupported');
  });

  it('never calls an installed app an in-app browser', () => {
    const env = detectEnvironment({ userAgent: IPHONE_WHATSAPP, navigatorStandalone: true });
    expect(env.inApp).toBe(false);
    expect(env.installed).toBe(true);
  });
});

describe('pushStatus', () => {
  const android = detectEnvironment({ userAgent: ANDROID_CHROME, ...PUSH, permission: 'default' });
  it('is on only with permission and a subscription', () => {
    expect(pushStatus({ ...android, permission: 'granted' }, true)).toBe('on');
    expect(pushStatus({ ...android, permission: 'granted' }, false)).toBe('off');
    expect(pushStatus(android, false)).toBe('off');
  });
  it('is blocked when the permission is denied', () => {
    expect(pushStatus({ ...android, permission: 'denied' }, false)).toBe('blocked');
  });
  it('is off (not unsupported) on an iPhone that still has to install, and unsupported when push cannot work', () => {
    expect(pushStatus(detectEnvironment({ userAgent: IPHONE_SAFARI }), false)).toBe('off');
    expect(pushStatus(detectEnvironment({ userAgent: DESKTOP_CHROME }), false)).toBe('unsupported');
  });
});
