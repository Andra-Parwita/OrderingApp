import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { versionLabel } from '../../../shared/release';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { AboutScreen } from './AboutScreen';
import { RELEASES } from './releaseNotes';

// Plan 075: the player is mocked, so no real Lottie runs in jsdom.
const loadAnimation = vi.fn<(options: unknown) => unknown>();
const destroy = vi.fn();
vi.mock('lottie-web/build/player/lottie_light', () => ({
  default: { loadAnimation: (options: unknown) => loadAnimation(options) },
}));

let reduced = false;

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return query.includes('reduce') ? reduced : query.includes('min-width');
      },
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
});

afterEach(() => {
  reduced = false;
  loadAnimation.mockClear();
  destroy.mockClear();
});

function setUp(
  check: () => Promise<'newer' | 'same' | 'error'> = () => Promise.resolve('same'),
  reload: () => void = () => undefined,
) {
  const listeners: Record<string, () => void> = {};
  const goToAndStop = vi.fn();
  loadAnimation.mockReturnValue({
    destroy,
    goToAndStop,
    addEventListener: (name: string, fn: () => void) => {
      listeners[name] = fn;
    },
  });
  const view = render(
    <AppThemeProvider>
      <MemoryRouter>
        <AboutScreen
          logo={<span>logo</span>}
          wideQuery="(min-width: 600px)"
          check={check}
          reload={reload}
        />
      </MemoryRouter>
    </AppThemeProvider>,
  );
  return { view, listeners, goToAndStop };
}

describe('AboutScreen', () => {
  it('plays the pop-out Lottie, and destroys it when the page closes', async () => {
    const { view } = setUp();
    await waitFor(() => expect(loadAnimation).toHaveBeenCalledTimes(1));
    const options = loadAnimation.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.autoplay).toBe(true);
    expect(options.renderer).toBe('svg');
    expect(options.path).toBe('/brand/lottie/shaggybobo-tablet-popout.json');
    expect(options.rendererSettings).toEqual({ preserveAspectRatio: 'xMidYMid meet' });
    view.unmount();
    expect(destroy).toHaveBeenCalled();
  });

  it('does not autoplay with reduced motion: it shows frame 0', async () => {
    reduced = true;
    const { listeners, goToAndStop } = setUp();
    await waitFor(() => expect(loadAnimation).toHaveBeenCalledTimes(1));
    expect((loadAnimation.mock.calls[0]?.[0] as { autoplay: boolean }).autoplay).toBe(false);
    act(() => listeners['DOMLoaded']?.());
    expect(goToAndStop).toHaveBeenCalledWith(0, true);
  });

  it('shows the CSS mascot when the file fails', async () => {
    const { listeners } = setUp();
    await waitFor(() => expect(loadAnimation).toHaveBeenCalled());
    expect(screen.queryByTestId('about-mascot')).toBeNull();
    act(() => listeners['data_failed']?.());
    expect(screen.getByTestId('about-mascot')).toBeInTheDocument();
  });

  it('names the version with the hotfix number only', () => {
    setUp();
    expect(screen.getByText(`Version ${versionLabel()}`)).toBeInTheDocument();
    expect(screen.queryByText(/build/)).toBeNull();
  });

  describe('check for update (plan 125)', () => {
    it('checks when it opens and says the newest version is in use', async () => {
      const check = vi.fn(() => Promise.resolve('same' as const));
      setUp(check);
      expect(screen.getByRole('status')).toHaveTextContent('Checking…');
      expect(screen.getByRole('button', { name: 'Check for update' })).toBeDisabled();
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('You have the newest version'),
      );
      expect(check).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Check for update' })).toBeEnabled();
    });

    it('reloads when a newer version is out', async () => {
      const reload = vi.fn();
      setUp(() => Promise.resolve('newer'), reload);
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Updating…'));
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('says it could not check, and the button checks again', async () => {
      const check = vi
        .fn<() => Promise<'newer' | 'same' | 'error'>>()
        .mockResolvedValueOnce('error')
        .mockResolvedValueOnce('same');
      setUp(check);
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('Could not check. Try again later.'),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check for update' }));
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('You have the newest version'),
      );
      expect(check).toHaveBeenCalledTimes(2);
    });
  });

  it('opens the releases panel (current release open) and closes it with Escape', () => {
    setUp();
    const button = screen.getByRole('button', { name: /what's new/i });
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Releases' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('We show the last 5 releases.')).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('opens the releases with the newest marked New when it comes from the pill', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // The day the newest release came out, so "New" shows whatever that release is.
    vi.setSystemTime(new Date(`${RELEASES[0]?.date ?? ''}T10:00:00`));
    loadAnimation.mockReturnValue({ destroy, goToAndStop: vi.fn(), addEventListener: vi.fn() });
    render(
      <AppThemeProvider>
        <MemoryRouter
          initialEntries={[{ pathname: '/seller/about', state: { showReleases: true } }]}
        >
          <AboutScreen
            logo={<span>logo</span>}
            wideQuery="(min-width: 600px)"
            check={() => Promise.resolve('same')}
            reload={() => undefined}
          />
        </MemoryRouter>
      </AppThemeProvider>,
    );
    expect(screen.getByText('New')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
