import { all } from 'redux-saga/effects';
import { helloSaga } from '../features/hello/helloSaga';

export function* rootSaga() {
  yield all([helloSaga()]);
}
