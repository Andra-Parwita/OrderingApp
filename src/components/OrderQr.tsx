import { useMemo } from 'react';
import { correction, generate } from 'lean-qr';
import { toSvgPath } from 'lean-qr/extras/svg';

// The order QR (plan 004 stage 4). It encodes the order code itself, the same value the seller's
// hand-over search accepts. It is always dark on white, even in dark mode: scanners need the
// contrast, so these two colours are deliberately not theme tokens.

const INK = '#141414';
const PAPER = '#FFFFFF';
/** Modules of white around the code (the QR standard asks for 4; 2 scans fine on a white card). */
const QUIET = 2;

type Props = Readonly<{
  /** The raw order code, e.g. "K7F2QX". */
  code: string;
  /** Side of the square in px. */
  size: number;
  label: string;
}>;

export function OrderQr({ code, size, label }: Props) {
  const { path, side } = useMemo(() => {
    const bitmap = generate(code, { minCorrectionLevel: correction.M });
    return { path: toSvgPath(bitmap), side: bitmap.size + QUIET * 2 };
  }, [code]);
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`${-QUIET} ${-QUIET} ${side} ${side}`}
      shapeRendering="crispEdges"
      data-testid="order-qr"
    >
      <rect x={-QUIET} y={-QUIET} width={side} height={side} fill={PAPER} />
      <path d={path} fill={INK} />
    </svg>
  );
}
