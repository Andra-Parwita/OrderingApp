import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakePng, pngFor } from '../../../mocks/images';
import { mockStore } from '../../../mocks/handlers';
import { slotSpec } from '../../../shared/imageSlots';
import { ImageReadError, type ResizeFn } from './imageResize';
import { ImagesScreen } from './ImagesScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
afterEach(() => i18n.changeLanguage('en'));

const ICON = 'App icon (phone home screen and closed menu)';
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
    const types = 'JPEG, PNG or WebP · up to 600 KB';
    for (const line of [
      /^1200 × 400, or 1200 × 600 for the iPhone app top · /,
      /^1200 × 600 px · keep faces and the logo in the middle 1000 × 500 px · /,
      /^512 × 512 px · keep the mark in the middle 410 × 410 · square, no transparency, no rounded corners · /,
      /^1280 × 256 px · JPEG/,
    ]) {
      expect(screen.getByText(line)).toHaveTextContent(types);
    }
    // The wide banner size is read from shared/imageSlots, its middle zone is the iPad area.
    const wide = slotSpec('desktopBanner');
    expect(
      screen.getByText(new RegExp(`^${wide.width} × ${wide.height} px · keep .* 1896 × 328 px · `)),
    ).toHaveTextContent(types);
    expect(screen.getByAltText(`Preview of ${ICON}`)).toHaveAttribute(
      'src',
      (await mockStore.getImages()).railIcon,
    );
    expect(screen.getByAltText('Preview of Phone banner')).toBeInTheDocument();
  });

  it('opens the how-to guide in place with the template and its download', async () => {
    await renderImages(vi.fn());
    const buttons = screen.getAllByRole('button', { name: 'How to make this picture' });
    expect(buttons).toHaveLength(5);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(buttons[0] as HTMLElement);
    const dialog = screen.getByRole('dialog', { name: /How to make: Wide banner/ });
    expect(within(dialog).getByRole('img')).toHaveAttribute(
      'src',
      '/guides/template-desktop-banner.png',
    );
    expect(within(dialog).getByRole('link', { name: 'Download template' })).toHaveAttribute(
      'download',
      'template-desktop-banner.png',
    );
    expect(within(dialog).getByText(/iPad \(landscape\) shows exactly the middle/)).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

  it('takes a 2:1 phone banner with no different-shape sheet, and shows the new hint and guide', async () => {
    const dataUrl = fakePng(1200, 600, 5);
    const resize = vi.fn<ResizeFn>().mockResolvedValue({
      dataUrl,
      offRatio: false,
      sourceWidth: 2400,
      sourceHeight: 1200,
    });
    await renderImages(resize);
    pick('Phone banner');
    await waitFor(async () => expect((await mockStore.getImages()).phoneBanner).toBe(dataUrl));
    expect(screen.queryByText('This picture is a different shape')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this picture' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/^1200 × 400, or 1200 × 600 for the iPhone app top · JPEG/),
    ).toBeInTheDocument();

    const buttons = screen.getAllByRole('button', { name: 'How to make this picture' });
    fireEvent.click(buttons[1] as HTMLElement);
    const dialog = screen.getByRole('dialog', { name: /How to make: Phone banner/ });
    expect(within(dialog).getByRole('img')).toHaveAttribute(
      'src',
      '/guides/template-phone-banner-tall.svg',
    );
    expect(within(dialog).getByRole('link', { name: 'Download template' })).toHaveAttribute(
      'download',
      'template-phone-banner-tall.svg',
    );
    for (const line of [
      /^Bottom 1200 × 400: the banner everyone sees\./,
      /^Optional top 200 px \(1200 × 600 in total\): shown only in the iPhone app, behind the clock\./,
      /^Keep the area of the time, camera and battery calm and fairly dark/,
    ]) {
      expect(within(dialog).getByText(line)).toBeInTheDocument();
    }
  });

  it('marks the seam on a saved tall banner, and none on a 3:1 one', async () => {
    await renderImages(vi.fn());
    const picture = within(card('Phone banner')).getByAltText('Phone banner');
    Object.defineProperty(picture, 'naturalWidth', { value: 1200, configurable: true });
    Object.defineProperty(picture, 'naturalHeight', { value: 400, configurable: true });
    fireEvent.load(picture);
    expect(screen.queryByTestId('phone-banner-seam')).not.toBeInTheDocument();

    Object.defineProperty(picture, 'naturalHeight', { value: 600, configurable: true });
    fireEvent.load(picture);
    expect(await screen.findByTestId('phone-banner-seam')).toBeInTheDocument();
    expect(screen.getByText('iPhone app only (behind the clock)')).toBeInTheDocument();
    expect(screen.getByText('Everyone sees this')).toBeInTheDocument();
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
    expect(
      screen.getByText(
        /^1200 × 400, atau 1200 × 600 untuk bagian atas aplikasi iPhone · JPEG, PNG atau WebP/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Cara membuat gambar ini' })[1] as HTMLElement,
    );
    const dialog = screen.getByRole('dialog', { name: /Cara membuat: Spanduk HP/ });
    expect(
      within(dialog).getByText(/^Bawah 1200 × 400: banner yang dilihat semua orang/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/^Opsional 200 px di atas \(total 1200 × 600\)/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/^Buat area jam, kamera, dan baterai tenang/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /^512 × 512 px · taruh logo di tengah, 410 × 410 · persegi, .* · JPEG, PNG atau WebP · maksimal 600 KB/,
      ),
    ).toBeInTheDocument();
  });
});
