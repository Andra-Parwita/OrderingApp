import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotPublished } from '../app/useNotPublished';
import { fetchPreferencesCached, fetchSettingsCached, noteCurrentMenu } from './cachedReads';
import { saveSettings } from './client';
import { updatePreferences } from './settings';
import { useSellerLanguages } from './useSellerLanguages';

// Plan 073: short caches for the seller's small repeated reads.

const urls: Array<string> = [];
vi.mock('./device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));
vi.mock('./http', () => ({
  request: (url: string, _parse: unknown, init?: { method?: string }) => {
    urls.push(`${init?.method ?? 'GET'} ${url}`);
    let data: unknown = { menu: { menu: { state: 'not_published' } } };
    if (url.includes('settings')) data = { settings: { languages: 'id' } };
    else if (url.includes('preferences')) data = { preferences: { theme: 'onde' } };
    return Promise.resolve({ ok: true, data });
  },
}));

beforeEach(() => {
  urls.length = 0;
});

describe('short caches (plan 073)', () => {
  it('opening the dish editor 3 times within a minute reads settings once', async () => {
    for (let i = 0; i < 3; i += 1) {
      const view = renderHook(() => useSellerLanguages());
      await vi.waitFor(() => expect(view.result.current).toBe('id'));
      view.unmount();
    }
    expect(urls.filter((u) => u.includes('settings'))).toHaveLength(1);
  });

  it('saving settings clears the cache, so the next read is fresh', async () => {
    await fetchSettingsCached();
    await fetchSettingsCached();
    expect(urls).toEqual(['GET /api/seller/settings']);
    await saveSettings({} as never);
    await fetchSettingsCached();
    expect(urls.filter((u) => u === 'GET /api/seller/settings')).toHaveLength(2);
  });

  it('saving preferences clears the preferences cache', async () => {
    await fetchPreferencesCached();
    await fetchPreferencesCached();
    await updatePreferences({ theme: 'onde' } as never);
    await fetchPreferencesCached();
    expect(urls.filter((u) => u === 'GET /api/seller/preferences')).toHaveLength(2);
  });

  it('switching 5 seller pages asks for the menu once', async () => {
    const view = renderHook(({ path }) => useNotPublished(true, path), {
      initialProps: { path: '/seller' },
    });
    for (const path of ['/seller/a', '/seller/b', '/seller/c', '/seller/d']) {
      view.rerender({ path });
    }
    await vi.waitFor(() => expect(view.result.current).toBe(true));
    expect(urls.filter((u) => u.startsWith('GET') && !u.includes('settings'))).toHaveLength(1);
  });

  it('a publish puts the new menu in the cache: no read, badge follows', async () => {
    noteCurrentMenu({ menu: { state: 'published' } } as never);
    const view = renderHook(() => useNotPublished(true, '/seller'));
    await Promise.resolve();
    expect(urls).toEqual([]);
    expect(view.result.current).toBe(false);
  });
});
