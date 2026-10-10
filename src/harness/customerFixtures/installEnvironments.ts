import type { Environment } from '../../components/install';

// The devices of the install and notification designs, as the detection would report them.

const NO_PUSH = { pushSupported: false, permission: 'default', inAppName: null } as const;

/** iPhone, Safari, not installed (the guide). */
export const IPHONE_SAFARI: Environment = {
  platform: 'ios',
  inApp: false,
  safari: true,
  installed: false,
  ...NO_PUSH,
};
export const IPHONE_WHATSAPP: Environment = {
  ...IPHONE_SAFARI,
  inApp: true,
  inAppName: 'WhatsApp',
  safari: false,
};
/** iPhone opened from the home screen: push works, the permission is still to be asked. */
export const IPHONE_INSTALLED: Environment = {
  ...IPHONE_SAFARI,
  installed: true,
  pushSupported: true,
};
export const ANDROID_CHROME: Environment = {
  platform: 'android',
  inApp: false,
  inAppName: null,
  safari: false,
  installed: false,
  pushSupported: true,
  permission: 'default',
};
export const ANDROID_WHATSAPP: Environment = {
  ...ANDROID_CHROME,
  inApp: true,
  inAppName: 'WhatsApp',
};
export const DESKTOP: Environment = {
  platform: 'desktop',
  inApp: false,
  inAppName: null,
  safari: false,
  installed: false,
  pushSupported: true,
  permission: 'default',
};
