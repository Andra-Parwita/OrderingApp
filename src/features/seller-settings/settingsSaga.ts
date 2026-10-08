import { all, call, put, takeLatest } from 'redux-saga/effects';
import type { ApiResult } from '../../api/http';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchSellerMenu, fetchSettings, saveSettings } from '../../api/client';
import type { SellerMenuResponse } from '../../../shared/menuContract';
import type { SettingsResponse } from '../../../shared/sellerContract';
import {
  loaded,
  loadFailed,
  loadRequested,
  saved,
  saveFailed,
  saveRequested,
} from './settingsSlice';

export function* loadSettings() {
  const [settings, menu] = (yield all([
    call(fetchSettings, undefined, currentSellerSlug()),
    call(fetchSellerMenu, undefined, currentSellerSlug()),
  ])) as [ApiResult<SettingsResponse>, ApiResult<SellerMenuResponse>];
  if (settings.ok && menu.ok) {
    yield put(loaded({ settings: settings.data.settings, cutoffAt: menu.data.week.cutoffAt }));
  } else {
    yield put(loadFailed());
  }
}

export function* save(action: ReturnType<typeof saveRequested>) {
  const result = (yield call(
    saveSettings,
    action.payload,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SettingsResponse>;
  if (result.ok) yield put(saved({ settings: result.data.settings }));
  else yield put(saveFailed({ code: result.error, message: result.message }));
}

export function* settingsSaga() {
  yield takeLatest(loadRequested.type, loadSettings);
  yield takeLatest(saveRequested.type, save);
}
