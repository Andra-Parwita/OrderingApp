import { useLayoutEffect, useRef, useState } from 'react';
import { isTallPhoneBanner } from '../../shared/imageSlots';

export type PictureShape = 'unknown' | 'wide' | 'tall';

/**
 * Plan 123: whether a loaded phone banner is the tall (2:1) kind, read from the picture's own pixel size once it
 * has loaded (or at mount, when the browser already holds it). Until then the shape is 'unknown'. No address
 * marker and no stored flag: the picture file is the single source of truth.
 */
export function useTallPicture(onShape?: (tall: boolean) => void) {
  const ref = useRef<HTMLImageElement>(null);
  const [shape, setShape] = useState<PictureShape>('unknown');
  const read = () => {
    const img = ref.current;
    if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) return;
    const tall = isTallPhoneBanner(img.naturalWidth, img.naturalHeight);
    setShape(tall ? 'tall' : 'wide');
    onShape?.(tall);
  };
  useLayoutEffect(() => {
    if (ref.current?.complete) read();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once at mount; later reads come from onLoad
  }, []);
  return { ref, shape, read };
}
