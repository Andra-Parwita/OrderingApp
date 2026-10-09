import { all, call, put, takeLatest } from 'redux-saga/effects';
import type { ApiResult } from '../../api/http';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchCurrentMenu, fetchSettings } from '../../api/client';
import type { MenuViewResponse } from '../../../shared/menusContract';
import type { SettingsResponse } from '../../../shared/sellerContract';
import { loaded, loadFailed, loadRequested } from './shareSlice';

export function* loadShare() {
  const [menu, settings] = (yield all([
    call(fetchCurrentMenu, undefined, currentSellerSlug()),
    call(fetchSettings, undefined, currentSellerSlug()),
  ])) as [ApiResult<MenuViewResponse>, ApiResult<SettingsResponse>];
  if (!menu.ok || !settings.ok) {
    yield put(loadFailed());
    return;
  }
  yield put(
    loaded({
      menu: {
        cookingDate: menu.data.menu.menu.cookingDate,
        cutoffAt: menu.data.menu.menu.cutoffAt,
        pickupPoints: menu.data.menu.pickupPoints,
        delivery: menu.data.menu.menu.delivery,
        // Only the fields the post needs: no chef id can reach the text (D-012).
        items: menu.data.menu.dishes.map(({ name, description, size, priceCents }) => ({
          name,
          description,
          size,
          priceCents,
        })),
      },
      settings: {
        ...(settings.data.settings.whatsappNumber !== undefined
          ? { whatsappNumber: settings.data.settings.whatsappNumber }
          : {}),
        postGreeting: settings.data.settings.postGreeting,
        postClosing: settings.data.settings.postClosing,
      },
    }),
  );
}

export function* shareSaga() {
  yield takeLatest(loadRequested.type, loadShare);
}
