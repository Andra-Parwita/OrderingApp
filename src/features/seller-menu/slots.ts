import type { ReactNode } from 'react';
import type { Language } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import type { DishSet, MenuDefaults } from '../../../shared/menusContract';
import type { PastWeekSummary } from '../../../shared/pastWeeks';
import type { NewMenuRequest, NewMenuSource } from './useMenuWizard';

/** Screens of other features, made by the app (a feature may not import another feature). */
export type MenuSlots = Readonly<{
  /** The customer's menu screen, read-only, for "what customers see". */
  preview: (props: { slug: string; menu: MenuResponse }) => ReactNode;
  /** The WhatsApp post composer shown once the menu is live. */
  share: (props: { onGoToOrders: () => void }) => ReactNode;
  /** The New menu dialog (Home's), so Home and the Menu screen start a menu the same way. */
  newMenu: (props: {
    lang: Language;
    firstTime?: boolean;
    defaults: MenuDefaults;
    past: ReadonlyArray<PastWeekSummary>;
    sets: ReadonlyArray<DishSet>;
    initialSource?: NewMenuSource;
    onCreate: (input: NewMenuRequest) => void;
    onClose: () => void;
  }) => ReactNode;
}>;
