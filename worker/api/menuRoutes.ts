// /api/seller/*: the menu, the dishes, saved sets and pickup places. Split out of routes.ts
// (plan 098 C1); roles are the allow-list (C2). Plan 001 stage 3, plan 030 (chef dishes).
import {
  parseAddMenuDishRequest,
  parseCreateDishRequest,
  parseCreateDishSetRequest,
  parseCreateMenuRequest,
  parseImportDishesRequest,
  parsePublishRequest,
  parseUpdateDishRequest,
  parseUpdateMenuRequest,
  parseUpdatePickupPlaceRequest,
  parseUsePastMenuPictureRequest,
  type DeleteDishResponse,
  type DeletePickupPlaceResponse,
  type DishesResponse,
  type DishResponse,
  type DishSetResponse,
  type DishSetsResponse,
  type FinishMenuResponse,
  type ImportDishesResponse,
  type MenuViewResponse,
  type PickupPlaceResponse,
  type PickupPlacesResponse,
  type UpdateMenuResponse,
  type UseDishSetResponse,
} from '../../shared/menusContract';
import type { ChefSummaryResponse } from '../../shared/chefSummaryContract';
import {
  parsePickupPointInput,
  parseUpdateItemRequest,
  parseUploadImageRequest,
} from '../../shared/setupContract';
import { dropUnusedImageRefs, putUploadedImage } from '../images/r2';
import { error, readJson } from './respond';
import { itemResult, refusal, safeParse, signal } from './routeKit';
import {
  chefAddsOwnDish,
  chefIsKnown,
  chefOwnsDish,
  chefOwnsItem,
  helperSoldOutOnly,
} from './sellerGuards';
import { EVERYONE, OWNER, OWNER_CHEF, route, type SellerRoute } from './sellerRoute';

export const MENU_ROUTES: ReadonlyArray<SellerRoute> = [
  route('GET', 'menu', EVERYONE, async ({ store }) => Response.json(await store.getSellerMenu())),

  // The legacy item edit (PATCH /menu/items/:id, used by the live Dishes panel). A chef may only
  // touch their own item, a helper only the sold-out switch alone.
  route(
    'PATCH',
    'menu/items/:id',
    EVERYONE,
    async ({ store, request, c, bad, menuChanged }) => {
      const input = parseUpdateItemRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.patchItem(c as string, input);
      if (result.ok) await menuChanged();
      return itemResult(result);
    },
    { only: { chef: chefOwnsItem, helper: helperSoldOutOnly } },
  ),

  // The one menu: not published -> live -> finished (D-063). A new one only after it finished.
  route('POST', 'menus', OWNER, async ({ store, request, bad, menuChanged }) => {
    const text = await request.text();
    const input = parseCreateMenuRequest(text === '' ? undefined : safeParse(text));
    if (!input) return bad();
    const result = await store.createMenu(input);
    if (!result.ok) return error(result.error, result.message);
    await menuChanged();
    return Response.json({ menu: result.value } satisfies MenuViewResponse, { status: 201 });
  }),
  // Plan 069: portions and income per chef. Owners see every chef; a chef only her own line, and
  // only while the kitchen setting is on (a helper is not on the list).
  route('GET', 'menus/:id/chef-summary', OWNER_CHEF, async ({ store, b, chefId }) => {
    const summary = await store.getChefSummary(b as string, chefId);
    if (summary === 'private') return error('forbidden', 'The kitchen keeps income private');
    if (!summary) return error('not_found', 'No per-chef figures for this menu');
    return Response.json(summary satisfies ChefSummaryResponse);
  }),
  route('GET', 'menus/current', EVERYONE, async ({ store }) =>
    Response.json({ menu: await store.getCurrentMenu() } satisfies MenuViewResponse),
  ),
  route('PUT', 'menus/current', OWNER, async ({ store, request, bad, menuChanged }) => {
    const input = parseUpdateMenuRequest(await readJson(request));
    if (!input) return bad();
    const result = await store.updateMenu(input);
    if (!result.ok) return error(result.error, result.message);
    await menuChanged();
    return Response.json(result.value satisfies UpdateMenuResponse);
  }),
  // D-094: a chef appends her own library dish to the current menu.
  route(
    'POST',
    'menus/current/items',
    OWNER_CHEF,
    async ({ store, request, bad, menuChanged }) => {
      const input = parseAddMenuDishRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.addDishToMenu(input.dishId);
      if (!result.ok) return error(result.error, result.message);
      await menuChanged();
      return Response.json({ menu: result.value } satisfies MenuViewResponse, { status: 201 });
    },
    { only: { chef: chefAddsOwnDish } },
  ),
  route('POST', 'menus/current/publish', OWNER, async ({ store, request, bad, menuChanged }) => {
    const asked = parsePublishRequest(await readJson(request));
    if (asked === null) return bad();
    const result = await store.publishMenu(asked.force, asked.takingOrders);
    if (!result.ok) return refusal(result);
    await menuChanged();
    return Response.json({ menu: result.value } satisfies MenuViewResponse);
  }),
  route('DELETE', 'menus/current', OWNER, async ({ store, context, sellerId, menuChanged }) => {
    const result = await store.deleteMenu();
    if (!result.ok) return error(result.error, result.message);
    if (context.images) {
      await dropUnusedImageRefs(context.images, store, [result.value.before], sellerId);
    }
    await menuChanged();
    return Response.json({ menu: result.value.view } satisfies MenuViewResponse);
  }),
  route('POST', 'menus/current/unpublish', OWNER, async ({ store, menuChanged }) => {
    const result = await store.unpublishMenu();
    if (!result.ok) return error(result.error, result.message);
    await menuChanged();
    return Response.json({ menu: result.value } satisfies MenuViewResponse);
  }),
  // The menu picture (D-060): R2 with a bucket, the same pattern as the kitchen images.
  route('PUT', 'menus/current/picture', OWNER, async (call) => {
    const { store, request, bad, context, sellerId, menuChanged } = call;
    const body = await readJson(request);
    // Plan 064: reuse the picture a past menu kept, no upload.
    const reuse = parseUsePastMenuPictureRequest(body);
    if (reuse) {
      const reused = await store.usePastMenuPicture(reuse.pastMenuId);
      if (!reused.ok) return error(reused.error, reused.message);
      if (context.images) {
        await dropUnusedImageRefs(context.images, store, [reused.value.before], sellerId);
      }
      await menuChanged();
      return Response.json({ menu: reused.value.view } satisfies MenuViewResponse);
    }
    const input = parseUploadImageRequest(body);
    if (!input) return bad();
    const stored = context.images
      ? await putUploadedImage(context.images, sellerId, 'menuPicture', input.dataUrl)
      : null;
    const result = await store.setMenuPicture(input.dataUrl, stored?.ref);
    if (!result.ok) {
      if (stored && context.images) {
        await dropUnusedImageRefs(context.images, store, [stored.ref], sellerId);
      }
      return error(result.error, result.message);
    }
    if (context.images) {
      await dropUnusedImageRefs(context.images, store, [result.value.before], sellerId);
    }
    await menuChanged();
    return Response.json({ menu: result.value.view } satisfies MenuViewResponse);
  }),
  route('DELETE', 'menus/current/picture', OWNER, async (call) => {
    const { store, context, sellerId, menuChanged } = call;
    const removed = await store.removeMenuPicture();
    if (context.images)
      await dropUnusedImageRefs(context.images, store, [removed.before], sellerId);
    await menuChanged();
    return Response.json({ menu: removed.view } satisfies MenuViewResponse);
  }),
  route(
    'POST',
    'menus/current/finish',
    OWNER,
    async ({ store, context, sellerId, menuChanged }) => {
      const result = await store.finishMenuNow();
      if (!result.ok) return error(result.error, result.message);
      // The open orders were closed and archived: the order screens refetch too.
      await signal(context, sellerId, 'order.changed');
      await menuChanged();
      // Plan 064: past menus beyond the newest 10 lost their picture; the file goes if unused.
      const { prunedPictures, ...finished } = result.value;
      if (context.images) {
        await dropUnusedImageRefs(context.images, store, prunedPictures, sellerId);
      }
      return Response.json(finished satisfies FinishMenuResponse);
    },
  ),

  // "Your dishes". Deleting one is always allowed; `usedOnLiveMenu` is the warning (D-062).
  route('GET', 'dishes', OWNER_CHEF, async ({ store }) =>
    Response.json({ dishes: await store.listDishes() } satisfies DishesResponse),
  ),
  // A chef imports or adds a dish: the handler forces chef = self (plan 030, plan 050).
  route(
    'POST',
    'dishes/import',
    OWNER_CHEF,
    async ({ store, request, bad, chefId }) => {
      const input = parseImportDishesRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.importDishes(input, chefId);
      if (!result.ok) return error(result.error, result.message);
      return Response.json(result.value satisfies ImportDishesResponse);
    },
    { only: { chef: chefIsKnown } },
  ),
  route(
    'POST',
    'dishes',
    OWNER_CHEF,
    async ({ store, request, bad, chefId }) => {
      const input = parseCreateDishRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.createDish(chefId ? { ...input, chefId } : input);
      if (!result.ok) return error(result.error, result.message);
      return Response.json({ dish: result.value } satisfies DishResponse, { status: 201 });
    },
    { only: { chef: chefIsKnown } },
  ),
  route(
    'PATCH',
    'dishes/:id',
    OWNER_CHEF,
    async ({ store, request, b, bad }) => {
      const input = parseUpdateDishRequest(await readJson(request));
      if (!input) return bad();
      const result = await store.updateDish(b as string, input);
      if (!result.ok) return error(result.error, result.message);
      return Response.json({ dish: result.value } satisfies DishResponse);
    },
    { only: { chef: chefOwnsDish } },
  ),
  // Plan 067: the dish's picture. A chef may change it only on their own dish.
  route(
    'PUT',
    'dishes/:id/picture',
    OWNER_CHEF,
    async ({ store, request, b, bad, context, sellerId, menuChanged }) => {
      const input = parseUploadImageRequest(await readJson(request));
      if (!input) return bad();
      const stored = context.images
        ? await putUploadedImage(context.images, sellerId, 'dishPicture', input.dataUrl)
        : null;
      const result = await store.setDishPicture(b as string, input.dataUrl, stored?.ref);
      if (!result.ok) {
        if (stored && context.images) {
          await dropUnusedImageRefs(context.images, store, [stored.ref], sellerId);
        }
        return error(result.error, result.message);
      }
      if (context.images) {
        await dropUnusedImageRefs(context.images, store, [result.value.before], sellerId);
      }
      await menuChanged();
      return Response.json({ dish: result.value.dish } satisfies DishResponse);
    },
    { only: { chef: chefOwnsDish } },
  ),
  route(
    'DELETE',
    'dishes/:id/picture',
    OWNER_CHEF,
    async ({ store, b, context, sellerId, menuChanged }) => {
      const result = await store.removeDishPicture(b as string);
      if (!result.ok) return error(result.error, result.message);
      if (context.images) {
        await dropUnusedImageRefs(context.images, store, [result.value.before], sellerId);
      }
      await menuChanged();
      return Response.json({ dish: result.value.dish } satisfies DishResponse);
    },
    { only: { chef: chefOwnsDish } },
  ),
  route('DELETE', 'dishes/:id', OWNER, async ({ store, b, context, sellerId, menuChanged }) => {
    const pictureRef = context.images
      ? (await store.listDishes()).find((dish) => dish.id === b)?.pictureRef
      : undefined;
    const result = await store.deleteDish(b as string);
    if (!result.ok) return error(result.error, result.message);
    // The file goes unless a menu copy of the dish still shows it.
    if (context.images) await dropUnusedImageRefs(context.images, store, [pictureRef], sellerId);
    if (result.value.usedOnLiveMenu) await menuChanged();
    return Response.json({
      ok: true,
      usedOnLiveMenu: result.value.usedOnLiveMenu,
    } satisfies DeleteDishResponse);
  }),

  // Saved sets as lists of dishes.
  route('GET', 'saved-sets', OWNER_CHEF, async ({ store }) =>
    Response.json({ sets: await store.listDishSets() } satisfies DishSetsResponse),
  ),
  route('POST', 'saved-sets', OWNER, async ({ store, request, bad }) => {
    const input = parseCreateDishSetRequest(await readJson(request));
    if (!input) return bad();
    const result = await store.createDishSet(input);
    if (!result.ok) return error(result.error, result.message);
    return Response.json({ set: result.value } satisfies DishSetResponse, { status: 201 });
  }),
  route('POST', 'saved-sets/:id/use', OWNER, async ({ store, b, menuChanged }) => {
    const result = await store.useDishSet(b as string);
    if (!result.ok) return error(result.error, result.message);
    await menuChanged();
    return Response.json(result.value satisfies UseDishSetResponse);
  }),

  // Saved pickup places: at most 5 (`pickup_place_limit`).
  route('GET', 'pickup-places', OWNER_CHEF, async ({ store }) =>
    Response.json({ places: await store.listPickupPlaces() } satisfies PickupPlacesResponse),
  ),
  route('POST', 'pickup-places', OWNER, async ({ store, request, bad }) => {
    const input = parsePickupPointInput(await readJson(request));
    if (!input) return bad();
    const result = await store.createPickupPlace(input);
    if (!result.ok) return error(result.error, result.message);
    return Response.json({ place: result.value } satisfies PickupPlaceResponse, { status: 201 });
  }),
  route('PATCH', 'pickup-places/:id', OWNER, async ({ store, request, b, bad, menuChanged }) => {
    const input = parseUpdatePickupPlaceRequest(await readJson(request));
    if (!input) return bad();
    const result = await store.updatePickupPlace(b as string, input);
    if (!result.ok) return error(result.error, result.message);
    await menuChanged();
    return Response.json({ place: result.value } satisfies PickupPlaceResponse);
  }),
  route('DELETE', 'pickup-places/:id', OWNER, async ({ store, b, menuChanged }) => {
    const result = await store.deletePickupPlace(b as string);
    if (!result.ok) return error(result.error, result.message);
    await menuChanged();
    return Response.json({
      ok: true,
      usedOnLiveMenu: result.value.usedOnLiveMenu,
    } satisfies DeletePickupPlaceResponse);
  }),
];
