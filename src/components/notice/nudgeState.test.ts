import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countRememberNudgeShown,
  hideHomeNudge,
  hideRememberNudge,
  homeNudgeHidden,
  rememberNudgeAllowed,
} from './nudgeState';

const DAY = 24 * 60 * 60 * 1000;
beforeEach(() => localStorage.clear());

describe('the home-screen pill', () => {
  it('the cross hides it for 14 days', () => {
    const now = Date.now();
    expect(homeNudgeHidden(now)).toBe(false);
    hideHomeNudge(now);
    expect(homeNudgeHidden(now + 13 * DAY)).toBe(true);
    expect(homeNudgeHidden(now + 14 * DAY + 1)).toBe(false);
  });
});

describe('the Remember me pill', () => {
  it('the cross asks again after 30 days', () => {
    const now = Date.now();
    expect(rememberNudgeAllowed(now)).toBe(true);
    hideRememberNudge(now);
    expect(rememberNudgeAllowed(now + 29 * DAY)).toBe(false);
    expect(rememberNudgeAllowed(now + 30 * DAY + 1)).toBe(true);
  });

  it('shows at most 3 times in total, then never', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(rememberNudgeAllowed()).toBe(true);
      countRememberNudgeShown();
    }
    expect(rememberNudgeAllowed(Date.now() + 365 * DAY)).toBe(false);
  });

  it('works without storage', () => {
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      expect(rememberNudgeAllowed()).toBe(true);
      expect(homeNudgeHidden()).toBe(false);
    } finally {
      blocked.mockRestore();
    }
  });
});
