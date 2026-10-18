import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { lightTheme } from '../../theme/themes';
import { BottomSheet } from './BottomSheet';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});
afterEach(() => vi.restoreAllMocks());

const sheet = () => (
  <ThemeProvider theme={lightTheme}>
    <BottomSheet title="Privacy" onClose={vi.fn()}>
      <p>Body</p>
    </BottomSheet>
  </ThemeProvider>
);

describe('BottomSheet page scroll lock', () => {
  it('fixes the body while open and restores styles and scroll position on close', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.defineProperty(window, 'scrollY', { value: 240, configurable: true });
    document.body.style.overflow = 'auto';
    const { unmount } = render(sheet());
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-240px');
    expect(document.body.style.width).toBe('100%');
    unmount();
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.body.style.width).toBe('');
    expect(document.body.style.overflow).toBe('auto');
    expect(scrollTo).toHaveBeenCalledWith(0, 240);
    document.body.style.overflow = '';
  });

  it('keeps the lock until the last of two sheets closes', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const a = render(sheet());
    const b = render(sheet());
    a.unmount();
    expect(document.body.style.position).toBe('fixed');
    b.unmount();
    expect(document.body.style.position).toBe('');
  });
});

describe('BottomSheet swipe down', () => {
  const setup = () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const onClose = vi.fn();
    render(
      <ThemeProvider theme={lightTheme}>
        <BottomSheet title="Privacy" onClose={onClose}>
          <p>Body</p>
        </BottomSheet>
      </ThemeProvider>,
    );
    const dialog = screen.getByRole('dialog');
    Object.defineProperty(dialog, 'offsetHeight', { value: 300, configurable: true });
    return { onClose, dialog };
  };
  const swipe = (el: Element, from: Element, dy: number) => {
    fireEvent.pointerDown(from, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(el, { clientY: 100 + dy, pointerId: 1 });
    fireEvent.pointerUp(el, { clientY: 100 + dy, pointerId: 1 });
  };
  afterEach(() => vi.useRealTimers());

  it('closes after a drag past a third of the height, once the slide-down ends', () => {
    const { onClose, dialog } = setup();
    swipe(dialog, screen.getByText('Privacy'), 150);
    expect(onClose).not.toHaveBeenCalled();
    void act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('springs back after a short drag', () => {
    const { onClose, dialog } = setup();
    fireEvent.pointerDown(screen.getByText('Privacy'), { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(dialog, { clientY: 140, pointerId: 1 });
    expect(dialog.style.transform).toBe('translateY(40px)');
    fireEvent.pointerUp(dialog, { clientY: 140, pointerId: 1 });
    void act(() => vi.advanceTimersByTime(300));
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe('');
  });

  it('does not drag from scrolled content', () => {
    const { onClose, dialog } = setup();
    dialog.scrollTop = 20;
    swipe(dialog, screen.getByText('Body'), 250);
    void act(() => vi.advanceTimersByTime(300));
    expect(dialog.style.transform).toBe('');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('drags from content at the top', () => {
    const { onClose, dialog } = setup();
    swipe(dialog, screen.getByText('Body'), 250);
    void act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
