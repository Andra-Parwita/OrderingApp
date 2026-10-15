import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { AboutScreen } from './AboutScreen';

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

function setUp() {
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
        <AboutScreen logo={<span>logo</span>} wideQuery="(min-width: 600px)" />
      </MemoryRouter>
    </AppThemeProvider>,
  );
  return { view, listeners, goToAndStop };
}

describe('AboutScreen', () => {
  it('plays the calm Lottie, and destroys it when the page closes', async () => {
    const { view } = setUp();
    await waitFor(() => expect(loadAnimation).toHaveBeenCalledTimes(1));
    const options = loadAnimation.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.autoplay).toBe(true);
    expect(options.renderer).toBe('svg');
    expect(String(options.path)).toContain('/brand/lottie/shaggybobo-');
    expect(options.rendererSettings).toEqual({ preserveAspectRatio: 'xMidYMid slice' });
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

  it('names the release and, smaller, the build', () => {
    setUp();
    expect(screen.getByText('Release 1.0.36')).toBeInTheDocument();
    expect(screen.getByText('build dev')).toBeInTheDocument();
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
});
