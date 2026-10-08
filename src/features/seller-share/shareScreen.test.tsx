import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { ShareScreen } from './ShareScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);

async function previewText(): Promise<string> {
  const preview = await screen.findByLabelText('Text preview');
  return preview.textContent ?? '';
}

describe('ShareScreen', () => {
  beforeEach(() => mockStore.reset());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderShare() {
    renderWithStore(
      <ShareScreen origin="https://orders.example" />,
      createTestStore({ saga: true }),
    );
  }

  it('loads the menu and settings and previews the Indonesian post first, without a chef name', async () => {
    renderShare();
    const text = await previewText();
    expect(text).toContain('Menu Sabtu, 10 Okt');
    expect(text).toContain('Pesan di sini: https://orders.example/');
    // Lemper has a chef (Chef Wati) in the mock menu; the post must not say so.
    expect(text).toContain('Lemper ayam');
    expect(text).not.toMatch(/wati/i);
    expect(screen.getByRole('radio', { name: 'Indonesian' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('switches the post language, including Both', async () => {
    renderShare();
    await previewText();
    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(await previewText()).toContain('Order here:');
    expect(await previewText()).not.toContain('Pesan di sini');
    fireEvent.click(screen.getByRole('radio', { name: 'Both' }));
    const both = await previewText();
    expect(both).toContain('Pesan di sini');
    expect(both).toContain('Order here');
  });

  it('shares with the share sheet when the phone has one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share });
    renderShare();
    const text = await previewText();
    fireEvent.click(screen.getByRole('button', { name: 'Share to WhatsApp' }));
    expect(share).toHaveBeenCalledWith({ text });
  });

  it('opens a wa.me link when there is no share sheet', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderShare();
    const text = await previewText();
    fireEvent.click(screen.getByRole('button', { name: 'Share to WhatsApp' }));
    expect(open).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    );
  });

  it('copies the text and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderShare();
    const text = await previewText();
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
    expect(writeText).toHaveBeenCalledWith(text);
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });
});
