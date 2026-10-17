import { describe, expect, it } from 'vitest';

import { RELEASE_VERSION } from '../../../shared/release';
import { currentRelease } from './releaseNotes';

describe('RELEASE_VERSION', () => {
  it('matches the newest release note', () => {
    expect(RELEASE_VERSION).toBe(currentRelease()?.version);
  });
});
