import { memo } from 'react';
import { styled } from 'styled-components';

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
}>;

// The box keeps its shape before the image loads, so nothing jumps.
const Box = styled.div<{ $ratio: string; $background?: string; $width?: string; $round: boolean }>`
  position: relative;
  box-sizing: border-box;
  width: ${({ $width }) => $width ?? '100%'};
  aspect-ratio: ${({ $ratio }) => $ratio};
  overflow: hidden;
  flex: none;
  border-radius: ${({ $round }) => ($round ? '50%' : '0')};
  background: ${({ theme, $background }) => $background ?? theme.colour.surfaceAlt};
`;
const Img = styled.img<{ $fit: 'contain' | 'cover' }>`
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: ${({ $fit }) => $fit};
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

export const ImageSlot = memo(function ImageSlot({
  aspectRatio,
  src,
  alt,
  placeholder,
  fit = 'contain',
  background,
  width,
  round = false,
}: ImageSlotProps) {
  return (
    <Box
      data-ratio={aspectRatio}
      data-fit={fit}
      $ratio={aspectRatio}
      $background={background}
      $width={width}
      $round={round}
    >
      {src ? (
        <Img src={src} alt={alt} loading="lazy" decoding="async" $fit={fit} />
      ) : (
        <Label role="img" aria-label={alt}>
          <span aria-hidden="true">{placeholder}</span>
        </Label>
      )}
    </Box>
  );
});
