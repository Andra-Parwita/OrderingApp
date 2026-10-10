import { describe, expect, it } from 'vitest';
import { appVersion, formatVersion } from './buildInfo';

describe('formatVersion', () => {
  it('joins major.minor, the commit count and the commit', () => {
    expect(
      formatVersion({ packageVersion: '1.0.0', count: 18, commit: 'c491a12', draft: false }),
    ).toBe('1.0.18 · c491a12');
  });

  it('marks uncommitted work as draft', () => {
    expect(
      formatVersion({ packageVersion: '1.2.5', count: 3, commit: 'abc1234', draft: true }),
    ).toBe('1.2.3 · abc1234 · draft');
  });

  it('falls back without git', () => {
    expect(
      formatVersion({ packageVersion: '1.0.0', count: null, commit: null, draft: false }),
    ).toBe('1.0.0 · unknown');
  });
});

describe('appVersion', () => {
  it('is "dev" where the build define is absent', () => {
    expect(appVersion()).toBe('dev');
  });
});
