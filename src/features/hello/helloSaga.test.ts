import { http, HttpResponse } from 'msw';
import { runSaga } from 'redux-saga';
import { describe, expect, it } from 'vitest';
import { healthFixture } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { loadHealth } from './helloSaga';

async function collect(): Promise<Array<unknown>> {
  const dispatched: Array<unknown> = [];
  await runSaga({ dispatch: (action: unknown) => dispatched.push(action) }, loadHealth).toPromise();
  return dispatched;
}

describe('loadHealth saga', () => {
  it('dispatches healthLoaded with the server time', async () => {
    expect(await collect()).toEqual([
      { type: 'hello/healthLoaded', payload: { time: healthFixture.time } },
    ]);
  });

  it('dispatches healthFailed on a server error', async () => {
    server.use(http.get('*/api/health', () => new HttpResponse(null, { status: 500 })));
    expect(await collect()).toEqual([{ type: 'hello/healthFailed', payload: undefined }]);
  });

  it('dispatches healthFailed on a malformed body', async () => {
    server.use(http.get('*/api/health', () => HttpResponse.json({ status: 'nope' })));
    expect(await collect()).toEqual([{ type: 'hello/healthFailed', payload: undefined }]);
  });
});
