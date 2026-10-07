import { describe, expect, it } from 'vitest';
import { healthFailed, healthLoaded, healthRequested, helloReducer } from './helloSlice';

describe('helloReducer', () => {
  it('starts in loading', () => {
    expect(helloReducer(undefined, { type: 'init' })).toEqual({ health: { status: 'loading' } });
  });

  it('moves to ready with the server time', () => {
    const state = helloReducer(undefined, healthLoaded({ time: '2026-10-07T10:00:00.000Z' }));
    expect(state.health).toEqual({ status: 'ready', time: '2026-10-07T10:00:00.000Z' });
  });

  it('moves to error, and back to loading on a new request', () => {
    const failed = helloReducer(undefined, healthFailed());
    expect(failed.health).toEqual({ status: 'error' });
    expect(helloReducer(failed, healthRequested()).health).toEqual({ status: 'loading' });
  });
});
