import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { useMenuTestSetup } from './testKit';
import { useMenuData } from './menuShared';
import { loadRequested, menuReducer, type MenuData } from './menuSlice';

// Plan 103: opening a menu screen with the data already in the store asks for nothing.

function Probe() {
  useMenuData();
  return null;
}

function mount(preloaded: { load: 'ready' | 'loading'; data: MenuData | null }) {
  const requested: Array<string> = [];
  const spy: Middleware = () => (next) => (action) => {
    if (loadRequested.match(action)) requested.push(action.type);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: { sellerMenu: { ...preloaded, busy: false, result: null, seq: 0 } },
    middleware: (getDefault) => getDefault().concat(spy),
  });
  render(
    <Provider store={store}>
      <Probe />
    </Provider>,
  );
  return requested;
}

describe('useMenuData (plan 103)', () => {
  useMenuTestSetup();

  it('does not load again when the data is already there', () => {
    expect(mount({ load: 'ready', data: {} as unknown as MenuData })).toEqual([]);
  });

  it('loads when nothing is loaded yet', () => {
    expect(mount({ load: 'loading', data: null })).toHaveLength(1);
  });
});
