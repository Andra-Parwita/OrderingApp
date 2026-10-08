import { all, call, put, takeLatest } from 'redux-saga/effects';
import type { ApiResult } from '../../api/http';
import { fetchSellerMenu, fetchSettings } from '../../api/client';
import type { SellerMenuResponse } from '../../../shared/menuContract';
import type { SettingsResponse } from '../../../shared/sellerContract';
import { loaded, loadFailed, loadRequested } from './shareSlice';

export function* loadShare() {
  const [menu, settings] = (yield all([call(fetchSellerMenu), call(fetchSettings)])) as [
    ApiResult<SellerMenuResponse>,
    ApiResult<SettingsResponse>,
  ];
  if (!menu.ok || !settings.ok) {
    yield put(loadFailed());
    return;
  }
  yield put(
    loaded({
      menu: {
        cookingDate: menu.data.week.cookingDate,
        cutoffAt: menu.data.week.cutoffAt,
        pickupPoints: menu.data.week.pickupPoints,
        delivery: menu.data.week.delivery,
        // Only the fields the post needs: no chef id can reach the text (D-012).
        items: menu.data.items.map(({ name, description, size, priceCents }) => ({
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
