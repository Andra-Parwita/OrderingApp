import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGE_SHOW_MS, NOTE_NUDGE_EVENT, type PublicNote } from '../../../shared/shortMessage';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { FADE_MS, NoteHost, SEEN_KEY } from './NoteHost';
import { registerMaintenanceI18n } from './i18n/register';

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerMaintenanceI18n();
});
beforeEach(async () => {
  vi.useFakeTimers();
  localStorage.clear();
  await i18n.changeLanguage('en');
});
afterEach(() => {
  vi.useRealTimers();
});

const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const note = (id: string, text: string): PublicNote => ({
  id,
  textEn: text,
  textId: `${text} (id)`,
  expiresAt: '2026-10-17T12:15:00.000Z',
});

let answer: Array<PublicNote> = [];
const calls: Array<string> = [];
const fetchImpl = vi.fn((url: string) => {
  calls.push(url);
  return Promise.resolve(new Response(JSON.stringify({ notes: answer })));
}) as unknown as typeof fetch;

async function mount(pathname = '/onde-onde') {
  render(
    <AppThemeProvider>
      <NoteHost fetchImpl={fetchImpl} now={() => NOW} pathname={() => pathname} />
    </AppThemeProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('NoteHost (plan 086)', () => {
  beforeEach(() => {
    calls.length = 0;
    answer = [];
  });

  it('shows a new message with Bobo and a cross, and never shows the same id twice', async () => {
    answer = [note('m1', 'All good now')];
    await mount();
    expect(screen.getByRole('status')).toHaveTextContent('All good now');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')).toHaveProperty('m1');

    // A reload (a new host) does not show it again.
    document.body.innerHTML = '';
    await mount();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides itself after 30 seconds, with a short fade', async () => {
    answer = [note('m1', 'All good now')];
    await mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MESSAGE_SHOW_MS - 1);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1 + FADE_MS);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('the cross closes it at once', async () => {
    answer = [note('m1', 'All good now')];
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the receiver language', async () => {
    await i18n.changeLanguage('id');
    answer = [note('m1', 'All good now')];
    await mount();
    expect(screen.getByRole('status')).toHaveTextContent('All good now (id)');
  });

  it('asks again when the live connection nudges', async () => {
    await mount();
    expect(screen.queryByRole('status')).toBeNull();
    answer = [note('m2', 'Back online')];
    await act(async () => {
      window.dispatchEvent(new Event(NOTE_NUDGE_EVENT));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Back online');
  });

  it('asks as the right side: sellers on /seller, customers elsewhere; never on /admin', async () => {
    await mount('/seller/orders');
    expect(calls.at(-1)).toContain('audience=sellers');
    document.body.innerHTML = '';
    await mount('/onde-onde');
    expect(calls.at(-1)).toContain('audience=customers');
    expect(calls.at(-1)).toContain('onde-onde');
    document.body.innerHTML = '';
    calls.length = 0;
    answer = [note('m3', 'Hidden from admin')];
    await mount('/admin');
    expect(calls).toHaveLength(0);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('forgets seen messages that ended long ago', async () => {
    localStorage.setItem(
      SEEN_KEY,
      JSON.stringify({ old: '2026-10-10T00:00:00.000Z', recent: '2026-10-17T11:00:00.000Z' }),
    );
    answer = [note('m4', 'Fresh')];
    await mount();
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, string>;
    expect(Object.keys(seen).sort()).toEqual(['m4', 'recent']);
  });
});
