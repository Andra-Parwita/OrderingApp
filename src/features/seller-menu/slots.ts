import type { ReactNode } from 'react';
import type { MenuResponse } from '../../../shared/menuContract';

/** Screens of other features, made by the app (a feature may not import another feature). */
export type MenuSlots = Readonly<{
  /** The customer's menu screen, read-only, for "what customers see". */
  preview: (props: { slug: string; menu: MenuResponse }) => ReactNode;
  /** The WhatsApp post composer shown once the menu is live. */
  share: (props: { onGoToOrders: () => void }) => ReactNode;
}>;
