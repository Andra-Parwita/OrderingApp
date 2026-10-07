import { call, put, takeLatest } from 'redux-saga/effects';
import type { HealthResponse } from '../../../shared/health';
import { fetchHealth } from '../../api/health';
import { healthFailed, healthLoaded, healthRequested } from './helloSlice';

export function* loadHealth() {
  try {
    const health = (yield call(fetchHealth)) as HealthResponse;
    yield put(healthLoaded({ time: health.time }));
  } catch {
    yield put(healthFailed());
  }
}

export function* helloSaga() {
  yield takeLatest(healthRequested.type, loadHealth);
}
