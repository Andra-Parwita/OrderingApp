import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon } from './menuIcons';
import { MainButton, RoundButton } from './menuParts';

// The full menu picture, full screen (spec §3, §4.1): the whole picture, pinch to zoom, swipe
// down or the ✕ to close. Two fingers scale it (touch-action: none lets us read them); when it is
// zoomed, one finger moves it; when it is not, a drag down past a threshold closes it.

const MAX_SCALE = 4;
const CLOSE_DRAG = 90; // px

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
  padding-top: var(--sat);
`;
const Top = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md};
  font-weight: 700;
`;
const Stage = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  touch-action: none;
`;
const Picture = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  will-change: transform;
`;
const Hint = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  text-align: center;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Foot = styled.div`
  padding: 0 ${({ theme }) => theme.spacing.lg}
    calc(${({ theme }) => theme.spacing.lg} + var(--sab));
`;

type Point = Readonly<{ x: number; y: number }>;

type Props = Readonly<{
  src: string;
  /** Shown beside the ✕, e.g. "Menu for Sat 17 Oct". */
  title: string;
  onClose: () => void;
  /** Offers the main button under the picture; leave out in the seller's preview. */
  onSeeDishes?: () => void;
}>;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function FullPictureViewer({ src, title, onClose, onSeeDishes }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragDown, setDragDown] = useState(0);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ start: number; scale: number } | null>(null);
  const last = useRef<Point | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = { x: event.clientX, y: event.clientY };
      pointers.current.set(event.pointerId, point);
      last.current = point;
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        if (a && b) pinch.current = { start: distance(a, b), scale };
      }
    },
    [scale],
  );

  const onMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(event.pointerId)) return;
      const point = { x: event.clientX, y: event.clientY };
      pointers.current.set(event.pointerId, point);
      if (pointers.current.size >= 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        if (a && b && pinch.current.start > 0) {
          const next = (pinch.current.scale * distance(a, b)) / pinch.current.start;
          setScale(Math.min(MAX_SCALE, Math.max(1, next)));
        }
        return;
      }
      const from = last.current;
      last.current = point;
      if (!from) return;
      const dx = point.x - from.x;
      const dy = point.y - from.y;
      if (scale > 1) setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
      else setDragDown((d) => Math.max(0, d + dy));
    },
    [scale],
  );

  const onUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size === 0) {
        last.current = null;
        if (scale <= 1.02) {
          setScale(1);
          setOffset({ x: 0, y: 0 });
          if (dragDown > CLOSE_DRAG) onClose();
          setDragDown(0);
        }
      }
    },
    [scale, dragDown, onClose],
  );

  const transform =
    scale > 1
      ? `translate(${String(offset.x)}px, ${String(offset.y)}px) scale(${String(scale)})`
      : `translateY(${String(dragDown)}px)`;

  return (
    <Overlay role="dialog" aria-modal="true" aria-label={t('home.pictureViewer')}>
      <Top>
        <RoundButton
          ref={closeRef}
          type="button"
          aria-label={t('home.closePicture')}
          onClick={onClose}
        >
          <MenuIcon name="x" />
        </RoundButton>
        <span>{title}</span>
      </Top>
      <Stage
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <Picture src={src} alt={title} draggable={false} style={{ transform }} />
      </Stage>
      <Hint>{t('home.pictureHint')}</Hint>
      {onSeeDishes ? (
        <Foot>
          <MainButton type="button" onClick={onSeeDishes}>
            {t('home.seeDishes')}
          </MainButton>
        </Foot>
      ) : null}
    </Overlay>
  );
}
