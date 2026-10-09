import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakePng, pngFor } from '../../../mocks/images';
import { mockStore } from '../../../mocks/handlers';
import { ImageReadError, type ResizeFn } from './imageResize';
import { ImagesScreen } from './ImagesScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
afterEach(() => i18n.changeLanguage('en'));

const ICON = 'Small icon (closed menu)';
const file = () => new File(['x'], 'picture.png', { type: 'image/png' });

describe('ImagesScreen', () => {
  beforeEach(() => mockStore.reset());

  async function renderImages(resize: ResizeFn) {
    renderWithStore(<ImagesScreen resize={resize} />, createTestStore());
    await screen.findByRole('heading', { name: ICON });
  }
  const pick = (name: string) =>
    fireEvent.change(screen.getByLabelText(`Choose a picture for ${name}`), {
      target: { files: [file()] },
    });
  const card = (name: string) => screen.getByRole('heading', { name }).parentElement as HTMLElement;

  it('shows five slots with size guides and a live preview', async () => {
    await renderImages(vi.fn());
    for (const name of [
      'Wide banner (tablet and computer)',
      'Phone banner',
      'Menu image (left menu)',
      ICON,
      'Background (wide screens)',
    ]) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(
      screen.getByText(
        'Best size 2000 × 400 px. Keep faces and the logo in the middle 1500 × 350 px.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Best size 512 × 512 px')).toBeInTheDocument();
    expect(screen.getByAltText(`Preview of ${ICON}`)).toHaveAttribute(
      'src',
      (await mockStore.getImages()).railIcon,
    );
    expect(screen.getByAltText('Preview of Phone banner')).toBeInTheDocument();
  });

  it('uploads the resized picture to the chosen slot', async () => {
    const dataUrl = pngFor('railIcon');
    const resize = vi.fn<ResizeFn>().mockResolvedValue({
      dataUrl,
      offRatio: false,
      sourceWidth: 128,
      sourceHeight: 128,
    });
    await renderImages(resize);
    pick(ICON);
    await waitFor(async () => expect((await mockStore.getImages()).railIcon).toBe(dataUrl));
    expect(resize).toHaveBeenCalledWith(expect.any(File), 'railIcon', '#835937');
    await waitFor(() => expect(screen.getByAltText(ICON)).toHaveAttribute('src', dataUrl));
    expect(screen.getByAltText(`Preview of ${ICON}`)).toHaveAttribute('src', dataUrl);
  });

  it('warns about a different shape with a preview, and uploads only after "Use this picture"', async () => {
    const dataUrl = pngFor('phoneBanner');
    const resize = vi.fn<ResizeFn>().mockResolvedValue({
      dataUrl,
      offRatio: true,
      sourceWidth: 1000,
      sourceHeight: 1000,
    });
    await renderImages(resize);
    const before = (await mockStore.getImages()).phoneBanner;
    pick('Phone banner');
    expect(await screen.findByText('This picture is a different shape')).toBeInTheDocument();
    expect(screen.getByText(/Your picture is 1000 × 1000 px/)).toBeInTheDocument();
    expect((await mockStore.getImages()).phoneBanner).toBe(before);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('This picture is a different shape')).not.toBeInTheDocument();
    expect((await mockStore.getImages()).phoneBanner).toBe(before);

    pick('Phone banner');
    fireEvent.click(await screen.findByRole('button', { name: 'Use this picture' }));
    await waitFor(async () => expect((await mockStore.getImages()).phoneBanner).toBe(dataUrl));
  });

  it('shows a too-big refusal from the server in plain words', async () => {
    const resize: ResizeFn = () =>
      Promise.resolve({
        dataUrl: pngFor('railIcon', 700 * 1024),
        offRatio: false,
        sourceWidth: 128,
        sourceHeight: 128,
      });
    await renderImages(resize);
    const before = (await mockStore.getImages()).railIcon;
    pick(ICON);
    expect(
      await within(card(ICON)).findByText(
        'That picture is too big, even after making it smaller. Try a simpler picture.',
      ),
    ).toBeInTheDocument();
    expect((await mockStore.getImages()).railIcon).toBe(before);
  });

  it('shows a wrong-shape refusal and an unreadable file in plain words', async () => {
    const wrong: ResizeFn = () =>
      Promise.resolve({
        dataUrl: fakePng(300, 300),
        offRatio: false,
        sourceWidth: 300,
        sourceHeight: 300,
      });
    const { unmount } = renderWithStore(<ImagesScreen resize={wrong} />, createTestStore());
    await screen.findByRole('heading', { name: ICON });
    pick('Phone banner');
    expect(
      await screen.findByText(
        'The shape of that picture does not fit this place. Try another picture.',
      ),
    ).toBeInTheDocument();
    unmount();

    const unreadable: ResizeFn = () => Promise.reject(new ImageReadError('image_type'));
    await renderImages(unreadable);
    pick(ICON);
    expect(
      await screen.findByText('We cannot use that file. Choose a JPEG, PNG or WebP picture.'),
    ).toBeInTheDocument();
  });

  it('removes a picture only on the second tap', async () => {
    await renderImages(vi.fn());
    expect((await mockStore.getImages()).railIcon).toBeDefined();
    fireEvent.click(within(card(ICON)).getByRole('button', { name: 'Remove' }));
    expect((await mockStore.getImages()).railIcon).toBeDefined();
    fireEvent.click(within(card(ICON)).getByRole('button', { name: 'Tap again to remove' }));
    await waitFor(async () => expect((await mockStore.getImages()).railIcon).toBeUndefined());
    expect(within(card(ICON)).getByText('No picture yet')).toBeInTheDocument();
    expect(within(card(ICON)).getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });

  it('checks the colour, then saves colour and picture text', async () => {
    await renderImages(vi.fn());
    const hex = screen.getByLabelText('Background colour');
    fireEvent.change(hex, { target: { value: 'red' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save colour and text' }));
    expect(await screen.findByText('Write a colour like #835937.')).toBeInTheDocument();
    expect((await mockStore.getImages()).bannerBackground).toBe('#835937');

    fireEvent.change(hex, { target: { value: '#112233' } });
    fireEvent.change(screen.getByLabelText('Picture text (English)'), {
      target: { value: 'Our kitchen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save colour and text' }));
    await waitFor(async () =>
      expect((await mockStore.getImages()).bannerBackground).toBe('#112233'),
    );
    expect((await mockStore.getImages()).alt?.en).toBe('Our kitchen');
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderWithStore(<ImagesScreen resize={vi.fn()} />, createTestStore());
    expect(
      await screen.findByRole('heading', { name: 'Spanduk lebar (tablet dan komputer)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan warna dan teks' })).toBeInTheDocument();
    expect(screen.getByText('Ukuran terbaik 512 × 512 px')).toBeInTheDocument();
  });
});
