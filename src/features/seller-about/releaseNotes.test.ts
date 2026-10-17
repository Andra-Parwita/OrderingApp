import { describe, expect, it } from 'vitest';
import {
  currentRelease,
  RELEASES,
  RELEASES_SHOWN,
  visibleReleases,
  type ReleaseNote,
} from './releaseNotes';

const note = (version: string): ReleaseNote => ({
  version,
  date: '2026-10-15',
  lines: { en: ['x'], id: ['y'] },
});

describe('release notes', () => {
  it('shows at most five releases, newest first', () => {
    const seven = ['1.0.42', '1.0.41', '1.0.40', '1.0.39', '1.0.38', '1.0.37', '1.0.36'].map(note);
    const shown = visibleReleases(seven);
    expect(RELEASES_SHOWN).toBe(5);
    expect(shown.map((r) => r.version)).toEqual(['1.0.42', '1.0.41', '1.0.40', '1.0.39', '1.0.38']);
  });

  it('names the newest entry as the current release', () => {
    expect(currentRelease([note('1.0.42'), note('1.0.41')])?.version).toBe('1.0.42');
    expect(currentRelease()).toBe(RELEASES[0]);
  });

  it('starts at the newest release, 1.0.40, with the same number of lines in English and Indonesian', () => {
    expect(RELEASES[0]?.version).toBe('1.0.40');
    for (const release of RELEASES) {
      expect(release.lines.en.length).toBeGreaterThan(0);
      expect(release.lines.id).toHaveLength(release.lines.en.length);
    }
  });
});
