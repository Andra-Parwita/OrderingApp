/** The Make-a-menu wizard has four steps; a live menu has three tabs and no Publish step. */
export const STEPS = ['dishes', 'details', 'check', 'publish'] as const;
export type Step = (typeof STEPS)[number];

export const TABS = ['dishes', 'details', 'prices'] as const;
export type Tab = (typeof TABS)[number];

export type Mode = 'make' | 'edit';

export function stepPath(mode: Mode, step: Step | Tab): string {
  return `/seller/menu/${mode}/${step}`;
}

export function parseStep(value: string | undefined): Step | null {
  return STEPS.find((step) => step === value) ?? null;
}

export function parseTab(value: string | undefined): Tab | null {
  return TABS.find((tab) => tab === value) ?? null;
}
