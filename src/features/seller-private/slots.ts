import type { ReactNode } from 'react';
import type { Language } from '../../../shared/domain';
import type { Dish } from '../../../shared/menusContract';

/** What the private editor reads of the menu feature's data: the dish library and the places. */
export type PrivateMenuData = Readonly<{
  dishes: ReadonlyArray<Dish>;
  places: ReadonlyArray<{ id: string; place: string }>;
}>;

export type PrivateDishPickerProps = Readonly<{
  dishes: ReadonlyArray<Dish>;
  lang: Language;
  selected: ReadonlyArray<string>;
  full: boolean;
  onToggle: (dish: Dish) => void;
  renderSelected: (dish: Dish) => ReactNode;
  tickLabel: (name: string) => string;
}>;

/** The dish library (picker with a New dish button, editor dialog), made by the app (a feature may not import another feature). */
export type PrivateMenuSlots = Readonly<{
  useMenuData: () => { data: PrivateMenuData | null; status: ReactNode };
  /** `onCreated` hears the id of a dish made from the picker. */
  useDishTools: (onCreated: (dishId: string) => void) => {
    picker: (props: PrivateDishPickerProps) => ReactNode;
    /** The dish editor dialog, null while closed. */
    editor: ReactNode;
  };
}>;
