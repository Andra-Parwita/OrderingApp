// Menus and dishes on D1 (plan 001, stage 3): the one menu a seller has, "Your dishes", saved sets of
// dishes, saved pickup places, the theme and menu defaults, and finishing a menu (by hand or at
// midnight after its cooking day). Every query filters by `seller_id` (D-036). Rules that write
// several rows send them as one batch, which D1 runs as one transaction.
import type { SellerRepository } from '../repo/Repository';
import { createMenuContext, type MenuDeps } from './menuContext';
import { lifecyclePart } from './menuLifecycle';
import { dishesPart } from './menuDishes';
import { placesPart } from './menuPlaces';

export type { CustomerNotice, MenuDeps } from './menuContext';
export {
  deleteUnusedPictures,
  finishDueMenus,
  finishMenu,
  MAX_FINISH_PER_RUN,
  planFinish,
  type FinishPlan,
} from './menuFinish';

/** The repository methods this file implements. */
export type MenuOps = Pick<
  SellerRepository,
  | 'getCurrentMenu'
  | 'createMenu'
  | 'updateMenu'
  | 'publishMenu'
  | 'unpublishMenu'
  | 'deleteMenu'
  | 'setMenuPicture'
  | 'removeMenuPicture'
  | 'usePastMenuPicture'
  | 'finishMenuNow'
  | 'listDishes'
  | 'createDish'
  | 'updateDish'
  | 'importDishes'
  | 'deleteDish'
  | 'setDishPicture'
  | 'removeDishPicture'
  | 'listDishSets'
  | 'createDishSet'
  | 'useDishSet'
  | 'addDishToMenu'
  | 'listPickupPlaces'
  | 'createPickupPlace'
  | 'updatePickupPlace'
  | 'deletePickupPlace'
  | 'getPreferences'
  | 'setPreferences'
  | 'getChefSummary'
>;

export function createMenuOps(deps: MenuDeps, sid: string): MenuOps {
  const c = createMenuContext(deps, sid);
  return {
    ...lifecyclePart(c),
    ...dishesPart(c),
    ...placesPart(c),
  };
}
