// @vitest-environment node
// Hotfix 1.0.43.3: /splash.js (a render-blocking script in the head), /brand/* and /startup/* are cached for a day,
// so a cold start does not wait on a revalidation round trip. A day-old copy is fine: splash.js tolerates any app
// version. The Worker passes non-HTML files through untouched, so public/_headers is what applies.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rules = new Map<string, Array<string>>();
let current = '';
for (const line of readFileSync('public/_headers', 'utf8').split('\n')) {
  if (line.trim() === '' || line.trim().startsWith('#')) continue;
  if (!/^\s/.test(line)) {
    current = line.trim();
    rules.set(current, []);
  } else rules.get(current)?.push(line.trim());
}

const cacheControl = (path: string): string =>
  (rules.get(path) ?? [])
    .find((l) => l.startsWith('Cache-Control:'))
    ?.slice(14)
    .trim() ?? '';

describe('public/_headers caching', () => {
  it.each(['/splash.js', '/brand/*', '/startup/*'])('%s is cached for at least a day', (path) => {
    const value = cacheControl(path);
    expect(value).toContain('public');
    expect(Number(/max-age=(\d+)/.exec(value)?.[1])).toBeGreaterThanOrEqual(86400);
  });

  it('/version.json is still no-store', () => {
    expect(cacheControl('/version.json')).toBe('no-store');
  });
});
