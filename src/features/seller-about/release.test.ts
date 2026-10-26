import { describe, expect, it } from 'vitest';

import { RELEASE_VERSION, versionLabel } from '../../../shared/release';
import { currentRelease } from './releaseNotes';

describe('RELEASE_VERSION', () => {
  it('matches the newest release note', () => {
    expect(RELEASE_VERSION).toBe(currentRelease()?.version);
  });
});

describe('versionLabel', () => {
  it('adds the hotfix number, and shows the release alone without one', () => {
    expect(versionLabel('1.0.45', 1)).toBe('1.0.45.1');
    expect(versionLabel('1.0.45', null)).toBe('1.0.45');
  });
});
