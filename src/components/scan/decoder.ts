// Reads a QR code from a camera frame. BarcodeDetector where the browser has it (Chrome on Android);
// jsQR everywhere else (iPad and iPhone Safari), loaded only when scanning starts (plan 018, D-078).

/** Looks at the current frame of a playing video; returns the QR text, or null if there is none. */
export type Decoder = (video: HTMLVideoElement) => Promise<string | null>;

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<ReadonlyArray<{ rawValue: string }>>;
};
type DetectorClass = {
  new (options: { formats: Array<string> }): Detector;
  getSupportedFormats?: () => Promise<Array<string>>;
};

/** jsQR on raw RGBA pixels. */
export async function decodePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  return jsQR(data, width, height, { inversionAttempts: 'dontInvert' })?.data ?? null;
}

export async function createDecoder(): Promise<Decoder> {
  const Native = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (Native) {
    const formats = (await Native.getSupportedFormats?.()) ?? [];
    if (formats.includes('qr_code')) {
      const detector = new Native({ formats: ['qr_code'] });
      return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
    }
  }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return (video) => {
    if (!context || video.videoWidth === 0) return Promise.resolve(null);
    // Scaled down: a phone frame is large and the QR is big on screen.
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    return decodePixels(frame.data, frame.width, frame.height);
  };
}
