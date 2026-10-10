import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerScanI18n } from './i18n/register';
import { ScanEntry } from './ScanEntry';

const ORDERS = [
  { code: 'K7F2QX', status: 'confirmed' },
  { code: 'M3N4PR', status: 'cancelled' },
];

function fakeCamera(withTorch = false) {
  const stop = vi.fn();
  const track = {
    stop,
    getCapabilities: () => (withTorch ? { torch: true } : {}),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
  };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  return { stop, track, open: vi.fn().mockResolvedValue(stream) };
}

function setup(decoded: string | null, camera = fakeCamera()) {
  const onOpen = vi.fn();
  const onTypeCode = vi.fn();
  const decode = vi.fn().mockResolvedValue(decoded);
  render(
    <AppThemeProvider>
      <input type="search" aria-label="typed" />
      <ScanEntry
        find={(code) => ORDERS.find((o) => o.code === code)}
        onOpen={onOpen}
        onTypeCode={onTypeCode}
        decode={decode}
        openCamera={camera.open}
      />
    </AppThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: "Scan the customer's QR code" }));
  return { onOpen, onTypeCode, decode, camera };
}

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerScanI18n();
  // jsdom has no media: pretend a frame is always ready, and let play() succeed.
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4 });
  HTMLMediaElement.prototype.play = () => Promise.resolve();
});
beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(() => vi.restoreAllMocks());

describe('ScanEntry', () => {
  it('opens the camera sheet with a heading, Cancel and the Scan Text hint', async () => {
    const { camera } = setup(null);
    expect(
      await screen.findByRole('heading', { name: "Scan the customer's QR code" }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(screen.getByText(/Tap the search box, then Scan Text/)).toBeVisible();
    expect(camera.open).toHaveBeenCalledTimes(1);
  });

  it('opens the order that was found, formatted or not, and stops the camera', async () => {
    const { onOpen, camera } = setup('k7f-2qx');
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('K7F2QX'));
    expect(camera.stop).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says so for an unknown code, a cancelled order and text that is not a code', async () => {
    const unknown = setup('ZZZZZZ');
    expect(await screen.findByText(/No order .* in this list/)).toBeVisible();
    expect(unknown.onOpen).not.toHaveBeenCalled();
  });

  it('says so for a cancelled order', async () => {
    const { onOpen } = setup('M3N4PR');
    expect(await screen.findByText(/is cancelled/)).toBeVisible();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not look up text that is not an order code', async () => {
    const { onOpen } = setup('https://example.com/x');
    expect(await screen.findByText('That QR code is not an order code.')).toBeVisible();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('falls back to the typed-code search when the camera is refused', async () => {
    const camera = fakeCamera();
    camera.open.mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    const { onTypeCode } = setup(null, camera);
    expect(await screen.findByRole('alert')).toHaveTextContent(/camera is blocked/);
    fireEvent.click(screen.getByRole('button', { name: 'Type the code' }));
    expect(onTypeCode).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText('typed')).toHaveFocus());
  });

  it('stops every track on Cancel and shows the torch only where supported', async () => {
    const camera = fakeCamera(true);
    setup(null, camera);
    const torch = await screen.findByRole('button', { name: 'Turn the light on' });
    fireEvent.click(torch);
    await waitFor(() => expect(camera.track.applyConstraints).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(camera.stop).toHaveBeenCalled();
  });

  it('shows no torch button on a camera without a torch', async () => {
    setup(null);
    await screen.findByRole('heading');
    await waitFor(() => expect(screen.queryByRole('button', { name: /light/ })).toBeNull());
  });
});
