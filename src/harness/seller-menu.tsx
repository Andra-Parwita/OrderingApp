import { configureStore } from '@reduxjs/toolkit';
import { useMemo, useState } from 'react';
import { Provider } from 'react-redux';
import createSagaMiddleware from 'redux-saga';
import { useMediaQuery } from '../components/useMediaQuery';
import {
  ItemEditor,
  MenuScreen,
  PastePostScreen,
  SavedSetsScreen,
  menuReducer,
  menuSaga,
  registerSellerMenuI18n,
} from '../features/seller-menu';
import { AppThemeProvider } from '../theme/AppThemeProvider';

// ?harness=seller-menu&screen=menu|item|sets|paste (item: &item=<id> edits, none adds); talks to
// the dev Worker mock API. Own store, theme and strings; the screens move between each other
// here with local state, because the app's routes come in 6.3.

registerSellerMenuI18n();

type View =
  { name: 'menu' } | { name: 'item'; id: string | null } | { name: 'sets' } | { name: 'paste' };

function createHarnessStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    middleware: (getDefault) => getDefault({ thunk: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(menuSaga);
  return store;
}

function initialView(): View {
  const params = new URLSearchParams(window.location.search);
  const screen = params.get('screen');
  if (screen === 'item') return { name: 'item', id: params.get('item') };
  if (screen === 'sets') return { name: 'sets' };
  if (screen === 'paste') return { name: 'paste' };
  return { name: 'menu' };
}

function Screens() {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [view, setView] = useState<View>(initialView);
  const [preview, setPreview] = useState(false);
  const toMenu = () => setView({ name: 'menu' });
  // On a desktop the editor opens over the menu; on a phone it is a screen of its own.
  const showMenu = view.name === 'menu' || (view.name === 'item' && desktop);
  return (
    <>
      {showMenu ? (
        <MenuScreen
          desktop={desktop}
          onPreview={() => setPreview(true)}
          onEditItem={(id) => setView({ name: 'item', id })}
          onSavedSets={() => setView({ name: 'sets' })}
          onPastePost={() => setView({ name: 'paste' })}
        />
      ) : null}
      {preview ? <p role="status">Preview as customer opens here (stage 6.3).</p> : null}
      {view.name === 'item' ? (
        <ItemEditor itemId={view.id} desktop={desktop} onClose={toMenu} />
      ) : null}
      {view.name === 'sets' ? <SavedSetsScreen onBack={toMenu} /> : null}
      {view.name === 'paste' ? <PastePostScreen onBack={toMenu} onDone={toMenu} /> : null}
    </>
  );
}

export function SellerMenuHarness() {
  const store = useMemo(() => createHarnessStore(), []);
  return (
    <Provider store={store}>
      <AppThemeProvider>
        <Screens />
      </AppThemeProvider>
    </Provider>
  );
}

export const Harness = SellerMenuHarness;
