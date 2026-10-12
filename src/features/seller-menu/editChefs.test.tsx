import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { DishEditor } from './DishEditor';
import { registerSellerMenuI18n } from './i18n/register';
import { loaded, menuReducer, type MenuData, type MenuRootState } from './menuSlice';

// Plan 049: Edit chefs opens the cook list over the dish editor; the dish is never lost.

const DATA = {
  view: {
    menu: { id: 'm1', state: 'live', cookingDate: '2026-10-10', wizardStep: 4 },
    dishes: [],
    pickupPoints: [],
  },
  dishes: [],
  sets: [],
  places: [],
  chefs: [{ id: 'wati', sellerId: 's1', name: 'Wati' }],
  prefs: {},
  past: [],
} as unknown as MenuData;

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerSellerMenuI18n();
  await i18n.changeLanguage('en');
});

// Stands in for the app's Chefs modal: "adding" a cook puts them in the menu data, as the reload does.
function FakeChefs({ onClose }: Readonly<{ onClose: () => void }>) {
  const dispatch = useDispatch();
  return (
    <div role="dialog" aria-label="Chefs">
      <button
        type="button"
        onClick={() =>
          dispatch(
            loaded({
              ...DATA,
              chefs: [...DATA.chefs, { id: 'budi', sellerId: 's1', name: 'Budi' }],
            }),
          )
        }
      >
        add Budi
      </button>
      <button type="button" onClick={onClose}>
        done
      </button>
    </div>
  );
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

describe('Edit chefs in the dish editor', () => {
  it('keeps the dish, selects the new cook and never navigates', () => {
    const store = configureStore({
      reducer: { sellerMenu: menuReducer },
      preloadedState: {
        sellerMenu: { load: 'ready' as const, data: DATA, busy: false, result: null, seq: 0 },
      },
    });
    const Editor = () => (
      <DishEditor
        data={useSelector((state: MenuRootState) => state.sellerMenu.data) as MenuData}
        target={{ kind: 'library', dishId: null }}
        onClose={() => undefined}
        renderChefs={(props) => <FakeChefs {...props} />}
      />
    );
    const ui = (
      <Provider store={store}>
        <AppThemeProvider>
          <MemoryRouter initialEntries={['/seller/menu/dishes']}>
            <Editor />
            <Where />
          </MemoryRouter>
        </AppThemeProvider>
      </Provider>
    );
    render(ui);
    fireEvent.change(screen.getByLabelText('Name (English)'), { target: { value: 'Lemper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit chefs' }));
    fireEvent.click(screen.getByRole('button', { name: 'add Budi' }));
    fireEvent.click(screen.getByRole('button', { name: 'done' }));
    expect(screen.queryByRole('dialog', { name: 'Chefs' })).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Name (English)').value).toBe('Lemper');
    expect(screen.getByLabelText<HTMLSelectElement>('Chef').value).toBe('budi');
    expect(screen.getByTestId('where').textContent).toBe('/seller/menu/dishes');
  });
});
