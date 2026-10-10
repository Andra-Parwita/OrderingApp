// Seller calls for menus, dishes, saved sets, pickup places and preferences (plan 001, stages 3 and 7).
// Same shape as client.ts: each call ends with `(actor?, seller?)`.
import type { StaffActor } from '../../shared/domain';
import {
  parseDeleteDishResponse,
  parseDeletePickupPlaceResponse,
  parseDishResponse,
  parseDishSetResponse,
  parseDishSetsResponse,
  parseDishesResponse,
  parseFinishMenuResponse,
  parseMenuViewResponse,
  parsePickupPlaceResponse,
  parsePickupPlacesResponse,
  parsePreferencesResponse,
  parseUpdateMenuResponse,
  type CreateDishRequest,
  type CreateDishSetRequest,
  type DeleteDishResponse,
  type DeletePickupPlaceResponse,
  type DishResponse,
  type DishSetResponse,
  type DishSetsResponse,
  type DishesResponse,
  type FinishMenuResponse,
  type MenuViewResponse,
  type PickupPlaceResponse,
  type PickupPlacesResponse,
  type PreferencesResponse,
  type UpdateDishRequest,
  type UpdateMenuRequest,
  type UpdateMenuResponse,
  type UpdatePickupPlaceRequest,
} from '../../shared/menusContract';
import type { PickupPointInput } from '../../shared/setupContract';
import { request } from './http';
import type { ApiResult } from './http';

const enc = encodeURIComponent;

function who(actor?: StaffActor, seller?: string) {
  return { ...(actor ? { actor } : {}), ...(seller ? { seller } : {}) };
}

// ---- The menu ----

/** Only once the current menu is finished. `cookingDate` defaults to the coming Saturday. */
export function createMenu(
  cookingDate?: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<MenuViewResponse>> {
  return request('/api/seller/menus', parseMenuViewResponse, {
    method: 'POST',
    body: cookingDate ? { cookingDate } : {},
    ...who(actor, seller),
  });
}

/** Any of the details, the places or the dishes; allowed while live (instant). */
export function updateCurrentMenu(
  input: UpdateMenuRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<UpdateMenuResponse>> {
  return request('/api/seller/menus/current', parseUpdateMenuResponse, {
    method: 'PUT',
    body: input,
    ...who(actor, seller),
  });
}

/** An empty menu answers 409 `no_items` with a `no_dishes` warning; `force` goes ahead (D-062). */
export function publishMenu(
  force?: boolean,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<MenuViewResponse>> {
  return request('/api/seller/menus/current/publish', parseMenuViewResponse, {
    method: 'POST',
    ...(force ? { body: { force } } : {}),
    ...who(actor, seller),
  });
}

export function unpublishMenu(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<MenuViewResponse>> {
  return request('/api/seller/menus/current/unpublish', parseMenuViewResponse, {
    method: 'POST',
    ...who(actor, seller),
  });
}

/** Throws away a menu that is not published (the screen warns first). */
export function deleteMenu(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<MenuViewResponse>> {
  return request('/api/seller/menus/current', parseMenuViewResponse, {
    method: 'DELETE',
    ...who(actor, seller),
  });
}

/** Finish now (D-069 Q5): the open orders are closed. */
export function finishMenu(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<FinishMenuResponse>> {
  return request('/api/seller/menus/current/finish', parseFinishMenuResponse, {
    method: 'POST',
    ...who(actor, seller),
  });
}

/** `dataUrl` is already resized to slotSpec('menuPicture'). */
export function uploadMenuPicture(
  dataUrl: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<MenuViewResponse>> {
  return request('/api/seller/menus/current/picture', parseMenuViewResponse, {
    method: 'PUT',
    body: { dataUrl },
    ...who(actor, seller),
  });
}

export function removeMenuPicture(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<MenuViewResponse>> {
  return request('/api/seller/menus/current/picture', parseMenuViewResponse, {
    method: 'DELETE',
    ...who(actor, seller),
  });
}

// ---- Your dishes ----

export function fetchDishes(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<DishesResponse>> {
  return request('/api/seller/dishes', parseDishesResponse, who(actor, seller));
}

export function createDish(
  input: CreateDishRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<DishResponse>> {
  return request('/api/seller/dishes', parseDishResponse, {
    method: 'POST',
    body: input,
    ...who(actor, seller),
  });
}

export function updateDish(
  id: string,
  patch: UpdateDishRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<DishResponse>> {
  return request(`/api/seller/dishes/${enc(id)}`, parseDishResponse, {
    method: 'PATCH',
    body: patch,
    ...who(actor, seller),
  });
}

/** Always allowed; `usedOnLiveMenu` tells the screen to say so. */
export function deleteDish(
  id: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<DeleteDishResponse>> {
  return request(`/api/seller/dishes/${enc(id)}`, parseDeleteDishResponse, {
    method: 'DELETE',
    ...who(actor, seller),
  });
}

// ---- Saved sets ----

export function fetchSavedSets(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<DishSetsResponse>> {
  return request('/api/seller/saved-sets', parseDishSetsResponse, who(actor, seller));
}

export function createSavedSet(
  input: CreateDishSetRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<DishSetResponse>> {
  return request('/api/seller/saved-sets', parseDishSetResponse, {
    method: 'POST',
    body: input,
    ...who(actor, seller),
  });
}

// ---- Pickup places ----

export function fetchPickupPlaces(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<PickupPlacesResponse>> {
  return request('/api/seller/pickup-places', parsePickupPlacesResponse, who(actor, seller));
}

export function createPickupPlace(
  input: PickupPointInput,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<PickupPlaceResponse>> {
  return request('/api/seller/pickup-places', parsePickupPlaceResponse, {
    method: 'POST',
    body: input,
    ...who(actor, seller),
  });
}

export function updatePickupPlace(
  id: string,
  patch: UpdatePickupPlaceRequest,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<PickupPlaceResponse>> {
  return request(`/api/seller/pickup-places/${enc(id)}`, parsePickupPlaceResponse, {
    method: 'PATCH',
    body: patch,
    ...who(actor, seller),
  });
}

export function deletePickupPlace(
  id: string,
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<DeletePickupPlaceResponse>> {
  return request(`/api/seller/pickup-places/${enc(id)}`, parseDeletePickupPlaceResponse, {
    method: 'DELETE',
    ...who(actor, seller),
  });
}

// ---- Preferences ----

export function fetchPreferences(
  actor?: StaffActor,
  seller?: string,
): Promise<ApiResult<PreferencesResponse>> {
  return request('/api/seller/preferences', parsePreferencesResponse, who(actor, seller));
}
