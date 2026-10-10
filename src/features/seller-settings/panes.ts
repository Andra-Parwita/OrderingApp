// The Settings panes, in the order the list shows them (handoff: Settings, tablet, owner).

export const PANE_IDS = [
  'link',
  'kitchen',
  'post',
  'pickup',
  'defaults',
  'look',
  'chefs',
  'devices',
  'backup',
] as const;
export type PaneId = (typeof PANE_IDS)[number];

/** Chefs, Devices and Backup sit below a hairline: they are about people and data, not the menu. */
export const SECOND_GROUP: ReadonlyArray<PaneId> = ['chefs', 'devices', 'backup'];

export function parsePane(value: string | undefined): PaneId | null {
  return PANE_IDS.find((id) => id === value) ?? null;
}

export const paneHref = (id: PaneId) => `/seller/settings/${id}`;
