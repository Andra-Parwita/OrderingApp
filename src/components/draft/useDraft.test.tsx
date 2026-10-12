import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import {
  DRAFT_MAX_AGE_MS,
  clearDraft,
  draftKey,
  fingerprint,
  readDraft,
  writeDraft,
} from './draftStore';
import { DraftNotice } from './DraftNotice';
import { registerDraftI18n } from './i18n/register';
import { DRAFT_DEBOUNCE_MS, useDraft } from './useDraft';

const KEY = draftKey('home', 'dish', 'new');
const INITIAL = { name: '' };

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerDraftI18n();
});
beforeEach(async () => {
  localStorage.clear();
  vi.useFakeTimers();
  await i18n.changeLanguage('en');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const typeAndWait = (set: (v: { name: string }) => void, name: string) => {
  act(() => set({ name }));
  act(() => {
    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS + 10);
  });
};

describe('draftKey', () => {
  it('keeps kitchens and items apart', () => {
    expect(draftKey('a', 'dish', 'new')).not.toBe(draftKey('b', 'dish', 'new'));
    expect(draftKey('a', 'dish', 'x')).not.toBe(draftKey('a', 'dish', 'y'));
    expect(draftKey('a', 'dish')).toBe(draftKey('a', 'dish', 'new'));
  });
});

describe('useDraft', () => {
  it('saves after 400 ms, not before', () => {
    const { result } = renderHook(() => useDraft(KEY, INITIAL));
    act(() => result.current[1]({ name: 'Rendang' }));
    act(() => {
      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS - 50);
    });
    expect(localStorage.getItem(KEY)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(readDraft<{ name: string }>(KEY)?.value).toEqual({ name: 'Rendang' });
  });

  it('restores on a new mount (a reload) and says so', () => {
    const first = renderHook(() => useDraft(KEY, INITIAL));
    typeAndWait(first.result.current[1], 'Rendang');
    first.unmount();
    const second = renderHook(() => useDraft(KEY, INITIAL));
    expect(second.result.current[0]).toEqual({ name: 'Rendang' });
    expect(second.result.current[2].restored).toBe(true);
  });

  it('keeps what was typed when closed within the debounce', () => {
    const first = renderHook(() => useDraft(KEY, INITIAL));
    act(() => first.result.current[1]({ name: 'Quick' }));
    first.unmount();
    expect(readDraft<{ name: string }>(KEY)?.value).toEqual({ name: 'Quick' });
  });

  it('flushes on pagehide', () => {
    const { result } = renderHook(() => useDraft(KEY, INITIAL));
    act(() => result.current[1]({ name: 'Phone' }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(readDraft<{ name: string }>(KEY)?.value).toEqual({ name: 'Phone' });
  });

  it('clear forgets the draft and does not write it back on unmount', () => {
    const first = renderHook(() => useDraft(KEY, INITIAL));
    typeAndWait(first.result.current[1], 'Rendang');
    act(() => first.result.current[2].clear());
    first.unmount();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('clear right after typing cancels the pending save', () => {
    const { result, unmount } = renderHook(() => useDraft(KEY, INITIAL));
    act(() => result.current[1]({ name: 'Saved now' }));
    act(() => result.current[2].clear());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    unmount();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('discard resets to the server values and forgets the draft', () => {
    writeDraft(KEY, { name: 'Old' }, '');
    const { result } = renderHook(() => useDraft(KEY, INITIAL));
    expect(result.current[0]).toEqual({ name: 'Old' });
    act(() => result.current[2].discard());
    expect(result.current[0]).toEqual(INITIAL);
    expect(result.current[2].restored).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('ignores and deletes a draft older than 7 days', () => {
    writeDraft(KEY, { name: 'Old' }, '', Date.now() - DRAFT_MAX_AGE_MS - 1000);
    const { result } = renderHook(() => useDraft(KEY, INITIAL));
    expect(result.current[0]).toEqual(INITIAL);
    expect(result.current[2].restored).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps a draft just under 7 days old', () => {
    writeDraft(KEY, { name: 'Fresh' }, '', Date.now() - DRAFT_MAX_AGE_MS + 60_000);
    expect(readDraft(KEY)).not.toBeNull();
  });

  it('does not store an empty draft (equal to the initial values)', () => {
    const { result } = renderHook(() => useDraft(KEY, INITIAL));
    typeAndWait(result.current[1], 'A');
    expect(localStorage.getItem(KEY)).not.toBeNull();
    typeAndWait(result.current[1], '');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('survives a throwing localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result, unmount } = renderHook(() => useDraft(KEY, INITIAL));
    typeAndWait(result.current[1], 'Still works');
    expect(result.current[0]).toEqual({ name: 'Still works' });
    act(() => result.current[2].clear());
    expect(() => unmount()).not.toThrow();
  });

  it('drops a corrupt stored value', () => {
    localStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() => useDraft(KEY, INITIAL));
    expect(result.current[0]).toEqual(INITIAL);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('does not mix two kitchens or two items', () => {
    const a = draftKey('a', 'dish', 'x');
    const b = draftKey('b', 'dish', 'x');
    writeDraft(a, { name: 'In A' }, '');
    const { result } = renderHook(() => useDraft(b, INITIAL));
    expect(result.current[0]).toEqual(INITIAL);
    clearDraft(a);
  });

  it('flags a conflict when the server version changed, and Keep mine clears the flag', () => {
    writeDraft(KEY, { name: 'Mine' }, fingerprint({ v: 1 }));
    const { result } = renderHook(() =>
      useDraft(KEY, INITIAL, { baseline: fingerprint({ v: 2 }) }),
    );
    expect(result.current[2].conflict).toBe(true);
    expect(result.current[0]).toEqual({ name: 'Mine' });
    act(() => result.current[2].keepMine());
    expect(result.current[2].conflict).toBe(false);
    expect(readDraft(KEY)?.baseline).toBe(fingerprint({ v: 2 }));
  });

  it('Use saved takes the server version', () => {
    writeDraft(KEY, { name: 'Mine' }, 'old');
    const { result } = renderHook(() => useDraft(KEY, INITIAL, { baseline: 'new' }));
    act(() => result.current[2].useSaved());
    expect(result.current[0]).toEqual(INITIAL);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('no conflict when the server version is the same', () => {
    writeDraft(KEY, { name: 'Mine' }, 'same');
    const { result } = renderHook(() => useDraft(KEY, INITIAL, { baseline: 'same' }));
    expect(result.current[2].conflict).toBe(false);
  });
});

describe('DraftNotice', () => {
  const host = (ui: React.ReactElement) => render(<AppThemeProvider>{ui}</AppThemeProvider>);
  const controls = {
    restored: true,
    conflict: false,
    discard: vi.fn(),
    clear: vi.fn(),
    keepMine: vi.fn(),
    useSaved: vi.fn(),
  };

  it('shows the restored line with Discard, in English and Indonesian', async () => {
    host(<DraftNotice draft={controls} />);
    expect(screen.getByText('Restored what you typed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(controls.discard).toHaveBeenCalledOnce();
    await act(() => i18n.changeLanguage('id'));
    expect(screen.getByRole('button', { name: 'Buang' })).toBeInTheDocument();
  });

  it('shows nothing without a draft, and the choice on a conflict', () => {
    const { container, rerender } = host(<DraftNotice draft={{ ...controls, restored: false }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <AppThemeProvider>
        <DraftNotice draft={{ ...controls, conflict: true }} />
      </AppThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep my version' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use the saved version' }));
    expect(controls.keepMine).toHaveBeenCalledOnce();
    expect(controls.useSaved).toHaveBeenCalledOnce();
  });
});
