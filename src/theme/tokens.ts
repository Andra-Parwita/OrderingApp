export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
} as const;

export const type = {
  family: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
  size: {
    sm: '0.8125rem',
    md: '0.9375rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.5rem',
    xxl: '2rem',
  },
  weight: { regular: 400, strong: 600 },
  lineHeight: { tight: 1.25, normal: 1.5 },
} as const;

export const radius = { sm: '4px', md: '8px', pill: '999px' } as const;

export const motion = {
  fast: '120ms',
  normal: '200ms',
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export const minTapTarget = '44px';

export const border = { hairline: '1px', focus: '2px', tab: '2px' } as const;

export const statusTones = [
  'ordered',
  'confirmed',
  'ready',
  'outForDelivery',
  'cancelled',
  'done',
] as const;
export type StatusTone = (typeof statusTones)[number];
