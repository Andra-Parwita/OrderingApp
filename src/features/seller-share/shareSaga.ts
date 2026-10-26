import { call, put, takeLatest } from 'redux-saga/effects';
import { loadShareData, type ShareData } from '../../components/shareText/loadShareData';
import { loaded, loadFailed, loadRequested } from './shareSlice';

export function* loadShare() {
  const data = (yield call(loadShareData)) as ShareData | null;
  yield put(data ? loaded(data) : loadFailed());
}

export function* shareSaga() {
  yield takeLatest(loadRequested.type, loadShare);
}
