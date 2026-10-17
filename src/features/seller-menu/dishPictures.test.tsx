import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { DishEditor } from './DishEditor';
import { DishesScreen } from './LibraryScreens';
import { menuReducer, opDone, opFailed, opRequested, type MenuData } from './menuSlice';
import { useMenuTestSetup } from './testKit';

// Plan 067: the dish editor's picture field (states, Remove asks first) and the library's
// thumbnails (no boxes at all when no dish has a picture).

vi.mock('../../api/useSellerLanguages', () => ({ useSellerLanguages: () => 'both' }));
vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));
vi.mock('../../components/imageResize', async (original) => ({
  ...(await original<typeof import('../../components/imageResize')>()),
  resizeImage: () =>
    Promise.resolve({
      dataUrl: 'data:image/jpeg;base64,AAAA',
      offRatio: false,
      sourceWidth: 600,
      sourceHeight: 600,
    }),
}));

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const dish = (id: string, name: string, pictureRef?: string) => ({
  id,
  name: { en: name, id: name },
  description: { en: '', id: '' },
  size: { en: '', id: '' },
  priceCents: 1000,
  ...(pictureRef ? { pictureRef } : {}),
});
const dataOf = (dishes: Array<ReturnType<typeof dish>>) =>
  ({
    view: {
      menu: { id: 'm1', state: 'live', cookingDate: '2026-10-10', wizardStep: 4 },
      dishes: [],
      pickupPoints: [],
    },
    dishes,
    sets: [],
    places: [],
    chefs: [],
    prefs: {},
    past: [],
  }) as unknown as MenuData;

function mount(ui: (data: MenuData) => React.ReactNode, data: MenuData) {
  const sent: Array<{ kind: string }> = [];
  const spy: Middleware = () => (next) => (action) => {
    if (opRequested.match(action)) sent.push(action.payload);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data, busy: false, result: null, seq: 0 },
    },
    middleware: (defaults) => defaults().concat(spy),
  });
  const view = render(
    <Provider store={store}>
      <AppThemeProvider>
        <MemoryRouter>{ui(data)}</MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
  return { store, sent, ...view };
}
const editor = (data: MenuData, dishId: string | null) =>
  mount(
    (d) => <DishEditor data={d} target={{ kind: 'library', dishId }} onClose={() => undefined} />,
    data,
  );

describe('the dish editor picture field', () => {
  useMenuTestSetup();
  it('no picture: Take photo and Choose photo, and the hint', () => {
    editor(dataOf([dish('d1', 'Lemper')]), 'd1');
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeEnabled();
    expect(screen.getByText('Square, shrunk on your phone before upload.')).toBeInTheDocument();
  });

  it('a new dish says to save it first', () => {
    editor(dataOf([]), null);
    expect(screen.getByText('Save the dish first, then you can add a picture.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull();
  });

  it('picking a photo sends the resized picture and shows the uploading state, then fails kindly', async () => {
    const { container, sent, store } = editor(dataOf([dish('d1', 'Lemper')]), 'd1');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] },
      });
      await Promise.resolve();
    });
    expect(sent).toEqual([
      { kind: 'uploadDishPicture', id: 'd1', dataUrl: 'data:image/jpeg;base64,AAAA' },
    ]);
    expect(screen.getByText('Shrinking and uploading…')).toBeVisible();
    act(() => {
      store.dispatch(
        opFailed({ kind: 'uploadDishPicture', code: 'invalid_request', message: 'x' }),
      );
    });
    expect(screen.getByText("Couldn't upload. Try again.")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeEnabled();
  });

  it('a picture is shown with Replace and Remove; Remove asks first', () => {
    const { sent } = editor(dataOf([dish('d1', 'Lemper', '/images/a.jpg')]), 'd1');
    expect(screen.getByRole('img', { name: 'Picture of Lemper' })).toHaveAttribute(
      'src',
      '/images/a.jpg',
    );
    expect(screen.getByRole('button', { name: 'Replace' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(sent).toEqual([]);
    const ask = screen.getByRole('alertdialog');
    expect(within(ask).getByText('Remove this picture?')).toBeVisible();

    // Keep: nothing is sent.
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep picture' }));
    expect(sent).toEqual([]);
    expect(screen.queryByText('Remove this picture?')).toBeNull();

    // Confirm: the remove is sent.
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove picture' }),
    );
    expect(sent).toEqual([{ kind: 'removeDishPicture', id: 'd1' }]);
  });

  it('at the limit: a neutral note and both buttons are off', () => {
    const others = Array.from({ length: 300 }, (_, i) =>
      dish(`o${String(i)}`, `O${String(i)}`, '/images/o.jpg'),
    );
    editor(dataOf([dish('d1', 'Lemper'), ...others]), 'd1');
    expect(screen.getByText(/Picture limit reached \(300 of 300\)/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeDisabled();
  });

  it('a finished upload leaves the editor open (it does not close like Save)', () => {
    const closed = vi.fn();
    const { store } = mount(
      (d) => <DishEditor data={d} target={{ kind: 'library', dishId: 'd1' }} onClose={closed} />,
      dataOf([dish('d1', 'Lemper')]),
    );
    act(() => {
      store.dispatch(opDone({ kind: 'uploadDishPicture' }));
    });
    expect(closed).not.toHaveBeenCalled();
  });
});

describe('the dish library thumbnails', () => {
  useMenuTestSetup();
  it('no dish has a picture: no boxes at all', () => {
    mount(() => <DishesScreen />, dataOf([dish('d1', 'Lemper'), dish('d2', 'Soto')]));
    expect(screen.getByText('Lemper')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Add a picture for/ })).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('some dish has one: a thumbnail for it and a camera box for the others', () => {
    mount(
      () => <DishesScreen />,
      dataOf([dish('d1', 'Lemper', '/images/a.jpg'), dish('d2', 'Soto')]),
    );
    expect(document.querySelectorAll('img')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Add a picture for Lemper' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a picture for Soto' })).toBeVisible();
  });
});
