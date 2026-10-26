import {
  useEffect,
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { keyframes, styled } from 'styled-components';
import { Button } from '../Button';
import { OVERLAY_Z, useModalFocus } from './modal';

export type BottomSheetProps = Readonly<{
  title: string;
  onClose: () => void;
  /** Rows of 48 px: use `SheetRow` for each. */
  children: ReactNode;
}>;

// Plan 092: the sheet slides up and the backdrop fades in (~250 ms); none with Reduce Motion.
const fadeIn = keyframes`from { opacity: 0; }`;
const slideUp = keyframes`from { transform: translateY(100%); }`;

// Page scroll lock shared by all open sheets: the first open fixes the body, the last close restores it.
// iOS Safari ignores `overflow: hidden` on body, so the body is pinned with position: fixed.
let openSheets = 0;
let savedScrollY = 0;
let savedStyle: Pick<CSSStyleDeclaration, 'position' | 'top' | 'width' | 'overflow'> | null = null;
export function lockPageScroll() {
  openSheets += 1;
  if (openSheets > 1) return;
  const { style } = document.body;
  savedScrollY = window.scrollY;
  savedStyle = {
    position: style.position,
    top: style.top,
    width: style.width,
    overflow: style.overflow,
  };
  style.position = 'fixed';
  style.top = `-${savedScrollY}px`;
  style.width = '100%';
  style.overflow = 'hidden';
}
export function unlockPageScroll() {
  if (openSheets === 0) return;
  openSheets -= 1;
  if (openSheets > 0 || !savedStyle) return;
  Object.assign(document.body.style, savedStyle);
  savedStyle = null;
  window.scrollTo(0, savedScrollY);
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${OVERLAY_Z};
  display: flex;
  align-items: flex-end;
  background: ${({ theme }) => theme.colour.scrim};
  touch-action: none;
  overscroll-behavior: contain;
  animation: ${fadeIn} 250ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
const Sheet = styled.div`
  width: 100%;
  max-height: 85dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px
    calc(${({ theme }) => theme.spacing.lg} + env(safe-area-inset-bottom));
  border-radius: ${({ theme }) => theme.size.radiusSheet}px
    ${({ theme }) => theme.size.radiusSheet}px 0 0;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  animation: ${slideUp} 250ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
  &:focus {
    outline: none;
  }
`;
const Handle = styled.div`
  touch-action: none;
  width: 2.5rem;
  height: 0.25rem;
  margin: 0 auto ${({ theme }) => theme.spacing.sm};
  border-radius: 0.125rem;
  background: ${({ theme }) => theme.c.ctrl};
`;
const Head = styled.div`
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Title = styled.h2`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
`;
/** One 48 px row of a sheet. A selected row is bold and in the accent text colour, plus a tick. */
export const SheetRow = styled.button<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 3rem;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: ${({ $selected, theme }) => ($selected ? theme.c.atext : theme.c.text)};
  font: inherit;
  font-weight: ${({ $selected }) => ($selected ? 700 : 400)};
  text-align: left;
  cursor: pointer;
`;

const MS = 200;
const DRAG_START_PX = 6;
const FLICK_PX_PER_MS = 0.5;
const reduceMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Drag = {
  startY: number;
  fromHead: boolean;
  active: boolean;
  dy: number;
  lastY: number;
  lastT: number;
  v: number;
};

/**
 * Phone: a sheet from the bottom with a handle and a visible Close. Swiping down also closes it
 * (from the handle or header, or from the content when it is scrolled to the top); Close and the
 * backdrop tap stay, so the swipe is never the only way.
 */
export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onClose);
  const overlay = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    lockPageScroll();
    return () => {
      clearTimeout(timer.current);
      unlockPageScroll();
    };
  }, []);

  const paint = (sheet: HTMLElement, dy: number, animate: boolean) => {
    const height = sheet.offsetHeight || 1;
    const move = animate && !reduceMotion() ? `${MS}ms ease-out` : 'none';
    sheet.style.transition = `transform ${move}`;
    sheet.style.transform = dy ? `translateY(${dy}px)` : '';
    if (overlay.current) {
      overlay.current.style.transition = `opacity ${move}`;
      overlay.current.style.opacity = dy ? String(Math.max(0, 1 - dy / height)) : '';
    }
  };
  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (timer.current) return;
    const target = event.target as HTMLElement;
    const fromHead = target.closest('[data-sheet-head]') !== null;
    drag.current = {
      startY: event.clientY,
      fromHead,
      active: false,
      dy: 0,
      lastY: event.clientY,
      lastT: event.timeStamp,
      v: 0,
    };
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const sheet = event.currentTarget;
    if (!d) return;
    const dy = event.clientY - d.startY;
    if (!d.active) {
      if (dy < DRAG_START_PX || (!d.fromHead && sheet.scrollTop > 0)) return;
      d.active = true;
      sheet.setPointerCapture?.(event.pointerId);
    }
    const dt = event.timeStamp - d.lastT;
    if (dt > 0) d.v = (event.clientY - d.lastY) / dt;
    d.lastY = event.clientY;
    d.lastT = event.timeStamp;
    d.dy = Math.max(0, dy);
    paint(sheet, d.dy, false);
  };
  const onUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const sheet = event.currentTarget;
    drag.current = null;
    if (!d?.active) return;
    sheet.releasePointerCapture?.(event.pointerId);
    const height = sheet.offsetHeight;
    if (event.type === 'pointerup' && (d.dy > height / 3 || d.v > FLICK_PX_PER_MS)) {
      paint(sheet, height, true);
      if (reduceMotion()) onClose();
      else timer.current = setTimeout(onClose, MS);
    } else paint(sheet, 0, true);
  };

  return (
    <Overlay ref={overlay} onClick={onClose}>
      <Sheet
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div data-sheet-head>
          <Handle aria-hidden="true" />
          <Head>
            <Title id={titleId}>{title}</Title>
            <Button variant="quiet" onClick={onClose} data-autofocus>
              {t('patterns.close')}
            </Button>
          </Head>
        </div>
        {children}
      </Sheet>
    </Overlay>
  );
}
