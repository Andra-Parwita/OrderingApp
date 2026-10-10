import { RATIO_TOLERANCE, slotSpec, type UploadSlot } from '../../shared/imageSlots';

export type ResizeResult = {
  /** Exactly the slot's size, already small enough to upload. */
  dataUrl: string;
  /** True when the picture's shape is more than 5% off the slot's, so it was fitted inside. */
  offRatio: boolean;
  sourceWidth: number;
  sourceHeight: number;
};

/** `image_type`: not a picture the browser can read. `image_too_big`: still over the limit when smallest. */
export class ImageReadError extends Error {
  readonly code: 'image_type' | 'image_too_big';
  constructor(code: 'image_type' | 'image_too_big') {
    super(code);
    this.code = code;
  }
}

/** Injectable so tests need no real canvas. `background` is the colour behind a fitted picture. */
export type ResizeFn = (file: File, slot: UploadSlot, background: string) => Promise<ResizeResult>;

const QUALITIES = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4, 0.3];

function bytesOf(dataUrl: string): number {
  return Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
}

function readPicture(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageReadError('image_type'));
    };
    img.src = url;
  });
}

function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number) {
  const { data } = context.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) if ((data[i] as number) < 250) return true;
  return false;
}

/**
 * Draws the picture at the slot's exact size and encodes it under the size limit: JPEG with the
 * quality stepped down, or PNG for a small icon that has see-through parts. A picture whose shape
 * is more than 5% off is fitted whole inside (never cropped), on `background`.
 */
export const resizeImage: ResizeFn = async (file, slot, background) => {
  if (!file.type.startsWith('image/')) throw new ImageReadError('image_type');
  const img = await readPicture(file);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (sw === 0 || sh === 0) throw new ImageReadError('image_type');

  const spec = slotSpec(slot);
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageReadError('image_type');

  const offRatio = Math.abs(sw / sh - spec.ratio) / spec.ratio > RATIO_TOLERANCE;
  const scale = Math.min(spec.width / sw, spec.height / sh);
  const fitted = { w: sw * scale, h: sh * scale };
  const draw = (fill: boolean) => {
    context.clearRect(0, 0, spec.width, spec.height);
    if (!offRatio) {
      if (fill) {
        context.fillStyle = background;
        context.fillRect(0, 0, spec.width, spec.height);
      }
      context.drawImage(img, 0, 0, spec.width, spec.height);
      return;
    }
    if (fill) {
      context.fillStyle = background;
      context.fillRect(0, 0, spec.width, spec.height);
    }
    context.drawImage(
      img,
      (spec.width - fitted.w) / 2,
      (spec.height - fitted.h) / 2,
      fitted.w,
      fitted.h,
    );
  };

  if (slot === 'railIcon' && file.type !== 'image/jpeg') {
    draw(false);
    if (hasTransparency(context, spec.width, spec.height)) {
      const png = canvas.toDataURL('image/png');
      if (bytesOf(png) <= spec.maxKB * 1024) {
        return { dataUrl: png, offRatio, sourceWidth: sw, sourceHeight: sh };
      }
    }
  }

  draw(true);
  for (const quality of QUALITIES) {
    const jpeg = canvas.toDataURL('image/jpeg', quality);
    if (bytesOf(jpeg) <= spec.maxKB * 1024) {
      return { dataUrl: jpeg, offRatio, sourceWidth: sw, sourceHeight: sh };
    }
  }
  throw new ImageReadError('image_too_big');
};
