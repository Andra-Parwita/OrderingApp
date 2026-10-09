import { call, put, takeLatest } from 'redux-saga/effects';
import type { ApiResult } from '../../api/http';
import { currentSellerSlug } from '../../api/device/sellerContext';
import {
  createChef,
  deleteChef,
  fetchImages,
  fetchSellerMenu,
  fetchWeek,
  removeImage,
  renameChef,
  saveImageStyle,
  saveWeek,
  uploadImage,
} from '../../api/client';
import type { SellerMenuResponse } from '../../../shared/menuContract';
import type {
  ChefResponse,
  ImagesResponse,
  OkResponse,
  WeekResponse,
} from '../../../shared/setupContract';
import {
  chefAddRequested,
  chefChangeFailed,
  chefDeleteRequested,
  chefRenameRequested,
  chefsLoaded,
  chefsLoadFailed,
  chefsRequested,
  imagesChanged,
  imagesChangeFailed,
  imagesLoaded,
  imagesLoadFailed,
  imagesRequested,
  removeRequested,
  styleRequested,
  styleSaved,
  uploadRequested,
  weekLoaded,
  weekLoadFailed,
  weekRequested,
  weekSaved,
  weekSaveFailed,
  weekSaveRequested,
} from './setupSlice';

export function* loadWeek() {
  const result = (yield call(fetchWeek, undefined, currentSellerSlug())) as ApiResult<WeekResponse>;
  if (result.ok) yield put(weekLoaded(result.data.week));
  else yield put(weekLoadFailed());
}

export function* saveWeekSaga(action: ReturnType<typeof weekSaveRequested>) {
  const result = (yield call(
    saveWeek,
    action.payload,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<WeekResponse>;
  if (result.ok) yield put(weekSaved(result.data.week));
  else yield put(weekSaveFailed({ code: result.error, message: result.message }));
}

export function* loadImages() {
  const result = (yield call(
    fetchImages,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<ImagesResponse>;
  if (result.ok) yield put(imagesLoaded(result.data.images));
  else yield put(imagesLoadFailed());
}

export function* uploadSaga(action: ReturnType<typeof uploadRequested>) {
  const result = (yield call(
    uploadImage,
    action.payload.slot,
    action.payload.dataUrl,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<ImagesResponse>;
  if (result.ok) yield put(imagesChanged(result.data.images));
  else yield put(imagesChangeFailed({ code: result.error, message: result.message }));
}

export function* removeSaga(action: ReturnType<typeof removeRequested>) {
  const result = (yield call(
    removeImage,
    action.payload,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<ImagesResponse>;
  if (result.ok) yield put(imagesChanged(result.data.images));
  else yield put(imagesChangeFailed({ code: result.error, message: result.message }));
}

export function* styleSaga(action: ReturnType<typeof styleRequested>) {
  const result = (yield call(
    saveImageStyle,
    action.payload,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<ImagesResponse>;
  if (result.ok) yield put(styleSaved(result.data.images));
  else yield put(imagesChangeFailed({ code: result.error, message: result.message }));
}

/** Chefs, how many items each has this week, and the kitchen name (where deleted chefs' items go). */
export function* loadChefs() {
  const result = (yield call(
    fetchSellerMenu,
    undefined,
    currentSellerSlug(),
  )) as ApiResult<SellerMenuResponse>;
  if (!result.ok) {
    yield put(chefsLoadFailed());
    return;
  }
  const counts: Record<string, number> = {};
  for (const item of result.data.items) {
    if (item.chefId) counts[item.chefId] = (counts[item.chefId] ?? 0) + 1;
  }
  yield put(chefsLoaded({ chefs: result.data.chefs, counts, kitchen: result.data.kitchen.name }));
}

type ChefAction =
  | ReturnType<typeof chefAddRequested>
  | ReturnType<typeof chefRenameRequested>
  | ReturnType<typeof chefDeleteRequested>;

export function* chefChangeSaga(action: ChefAction) {
  const slug = currentSellerSlug();
  let result: ApiResult<ChefResponse | OkResponse>;
  if (chefAddRequested.match(action)) {
    result = (yield call(createChef, action.payload, undefined, slug)) as ApiResult<ChefResponse>;
  } else if (chefRenameRequested.match(action)) {
    result = (yield call(
      renameChef,
      action.payload.id,
      action.payload.name,
      undefined,
      slug,
    )) as ApiResult<ChefResponse>;
  } else {
    result = (yield call(deleteChef, action.payload, undefined, slug)) as ApiResult<OkResponse>;
  }
  if (result.ok) yield call(loadChefs);
  else yield put(chefChangeFailed({ code: result.error, message: result.message }));
}

export function* setupSaga() {
  yield takeLatest(weekRequested.type, loadWeek);
  yield takeLatest(weekSaveRequested.type, saveWeekSaga);
  yield takeLatest(imagesRequested.type, loadImages);
  yield takeLatest(uploadRequested.type, uploadSaga);
  yield takeLatest(removeRequested.type, removeSaga);
  yield takeLatest(styleRequested.type, styleSaga);
  yield takeLatest(chefsRequested.type, loadChefs);
  yield takeLatest(
    [chefAddRequested.type, chefRenameRequested.type, chefDeleteRequested.type],
    chefChangeSaga,
  );
}
