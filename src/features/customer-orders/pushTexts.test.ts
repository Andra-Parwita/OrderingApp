import { describe, expect, it } from 'vitest';
import { PUSH_TEXTS } from '../../../shared/pushText';
import en from './i18n/en.json';
import id from './i18n/id.json';

// The push texts (shared/pushText.ts) repeat the order page's inbox texts: this fails if they drift.
describe('push texts', () => {
  it.each([
    ['en', en],
    ['id', id],
  ] as const)('repeat the inbox texts in %s', (lang, file) => {
    const { inbox } = file;
    const texts = PUSH_TEXTS[lang];
    for (const key of [
      'readyIn',
      'ready',
      'arrived',
      'arrivingIn',
      'arrivingSoon',
      'outForDelivery',
      'delivered',
      'collected',
      'other',
    ] as const) {
      expect(texts[key]).toBe(inbox[key]);
    }
    expect(texts.nudge).toBe(inbox.nudge);
    expect(texts.nudgeReturning).toBe(inbox.nudgeReturning);
    expect(texts.status).toEqual(inbox.status);
  });
});
