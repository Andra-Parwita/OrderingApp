import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { WHATS_NEW_KEY_PREFIX, WhatsNewPill } from './WhatsNewPill';

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
});
beforeEach(() => localStorage.clear());
afterEach(() => document.documentElement.style.removeProperty('--update-bar-height'));

function pill(version = '1.0.43', onSee = vi.fn()) {
  return (
    <AppThemeProvider>
      <WhatsNewPill
        version={version}
        note="Dishes with choices."
        title={`What's new in ${version}:`}
        see="See"
        hide="Hide what's new"
        onSee={onSee}
      />
    </AppThemeProvider>
  );
}

describe('WhatsNewPill', () => {
  it('shows for an unseen version with the note, See and the cross', () => {
    render(pill());
    expect(screen.getByText("What's new in 1.0.43:")).toBeInTheDocument();
    expect(screen.getByText(/Dishes with choices/)).toBeInTheDocument();
    expect(screen.getByText('See')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Hide what's new" })).toBeInTheDocument();
  });

  it('hides after the cross and stays hidden for the same version', () => {
    const view = render(pill());
    fireEvent.click(screen.getByRole('button', { name: "Hide what's new" }));
    expect(screen.queryByText('See')).toBeNull();
    expect(localStorage.getItem(`${WHATS_NEW_KEY_PREFIX}1.0.43`)).not.toBeNull();
    view.unmount();
    render(pill());
    expect(screen.queryByText('See')).toBeNull();
  });

  it('hides after See, and calls onSee', () => {
    const onSee = vi.fn();
    render(pill('1.0.43', onSee));
    fireEvent.click(screen.getByText('See'));
    expect(onSee).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('See')).toBeNull();
  });

  it('comes back for a new version', () => {
    localStorage.setItem(`${WHATS_NEW_KEY_PREFIX}1.0.43`, '1');
    render(pill('1.0.44'));
    expect(screen.getByText("What's new in 1.0.44:")).toBeInTheDocument();
  });

  it('is not shown while the new-version pill shows, and appears when it goes', async () => {
    document.documentElement.style.setProperty('--update-bar-height', '52px');
    render(pill());
    expect(screen.queryByText('See')).toBeNull();
    await act(async () => {
      document.documentElement.style.removeProperty('--update-bar-height');
      await Promise.resolve();
    });
    expect(screen.getByText('See')).toBeInTheDocument();
  });

  it('is not shown when storage fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(pill());
    expect(screen.queryByText('See')).toBeNull();
    vi.restoreAllMocks();
  });
});
