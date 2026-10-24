import { memo, useLayoutEffect, useRef, useState } from 'react';
import { css, keyframes, styled } from 'styled-components';

export type ImageSlotProps = Readonly<{
  /** Width / height, as a CSS ratio such as "5 / 1" or "1 / 1". */
  aspectRatio: string;
  /** The image address; without it the slot shows the placeholder label. */
  src?: string;
  /** Always required: describes the image, or names the slot while it is empty. */
  alt: string;
  /** Visible text in the empty slot, for example "Banner image — coming soon". */
  placeholder: string;
  /**
   * "contain" (the default) shows the whole image and never cuts anything off; "cover" fills the
   * slot and crops. The image is never stretched.
   */
  fit?: 'contain' | 'cover';
  /** A colour behind the image, visible where "contain" leaves room; default is a quiet surface. */
  background?: string;
  /** Fixed width, for a small square; the default is the full width of the parent. */
  width?: string;
  /** Round the slot into a circle (use with a square ratio). */
  round?: boolean;
  /** Fill the parent's box (its height decides the shape); the ratio then only labels the slot. */
  fill?: boolean;
  /** Load at once instead of when it nears the screen: for a picture at the top of every page. */
  eager?: boolean;
  /**
   * Keep the quiet box until the picture has fully loaded and decoded, then show it (a short fade;
   * none when it was already in the cache). Stops a half-downloaded picture drawing as a strip.
   */
  reveal?: boolean;
}>;

// The box keeps its shape before the image loads, so nothing jumps.
const Box = styled.div<{
  $ratio: string;
  $background?: string;
  $width?: string;
  $round: boolean;
  $fill: boolean;
}>`
  position: relative;
  box-sizing: border-box;
  width: ${({ $width }) => $width ?? '100%'};
  ${({ $fill, $ratio }) => ($fill ? 'height: 100%;' : `aspect-ratio: ${$ratio};`)}
  overflow: hidden;
  flex: none;
  border-radius: ${({ $round }) => ($round ? '50%' : '0')};
  background: ${({ theme, $background }) => $background ?? theme.colour.surfaceAlt};
`;
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;
const Img = styled.img<{ $fit: 'contain' | 'cover'; $reveal?: 'hidden' | 'shown' | 'fade' }>`
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: ${({ $fit }) => $fit};
  ${({ $reveal }) => ($reveal === 'hidden' ? 'opacity: 0;' : '')}
  ${({ $reveal }) =>
    $reveal === 'fade' &&
    css`
      @media (prefers-reduced-motion: no-preference) {
        animation: ${fadeIn} 120ms ease-out;
      }
    `}
`;
const Label = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.xs};
  overflow: hidden;
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
  text-align: center;
`;

/** The picture stays invisible until it has loaded and decoded; already complete at mount: shown at once. */
function RevealImg(
  props: Readonly<{ src: string; alt: string; eager: boolean; fit: 'contain' | 'cover' }>,
) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<'hidden' | 'shown' | 'fade'>('hidden');
  useLayoutEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setState('shown');
  }, []);
  const onLoad = () => {
    const img = ref.current;
    const show = () => setState((now) => (now === 'hidden' ? 'fade' : now));
    if (img && typeof img.decode === 'function') img.decode().then(show, show);
    else show();
  };
  return (
    <Img
      ref={ref}
      src={props.src}
      alt={props.alt}
      loading={props.eager ? 'eager' : 'lazy'}
      decoding="async"
      $fit={props.fit}
      $reveal={state}
      data-reveal={state}
      onLoad={onLoad}
    />
  );
}

export const ImageSlot = memo(function ImageSlot({
  aspectRatio,
  src,
  alt,
  placeholder,
  fit = 'contain',
  background,
  width,
  round = false,
  fill = false,
  eager = false,
  reveal = false,
}: ImageSlotProps) {
  return (
    <Box
      data-ratio={aspectRatio}
      data-fit={fit}
      $ratio={aspectRatio}
      $background={background}
      $width={width}
      $round={round}
      $fill={fill}
    >
      {src && reveal ? (
        <RevealImg key={src} src={src} alt={alt} eager={eager} fit={fit} />
      ) : src ? (
        <Img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" $fit={fit} />
      ) : (
        <Label role="img" aria-label={alt}>
          <span aria-hidden="true">{placeholder}</span>
        </Label>
      )}
    </Box>
  );
});
