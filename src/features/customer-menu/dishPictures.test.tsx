import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ThemeProvider } from 'styled-components';
import type { MenuItemView } from '../../../shared/domain';
import { lightTheme } from '../../theme/themes';
import { Dish } from './DishesView';
import { setupI18n } from './testSupport';

// Plan 067: a customer dish row shows its picture on the left (64 x 64, lazy) and enlarges it on a
// tap; a dish without a picture has no box.

beforeAll(() => setupI18n('en'));
afterEach(cleanup);

const item = (pictureRef?: string): MenuItemView => ({
  id: 'i1',
  name: { en: 'Lemper', id: 'Lemper' },
  description: { en: 'Sticky rice rolls', id: 'Lemper ketan' },
  size: { en: '4 pieces', id: '4 buah' },
  priceCents: 1000,
  remaining: null,
  soldOut: false,
  ...(pictureRef ? { pictureRef } : {}),
});

function show(view: MenuItemView) {
  return render(
    <ThemeProvider theme={lightTheme}>
      <ul>
        <Dish item={view} qty={0} lang="en" onQty={() => undefined} readOnly={false} />
      </ul>
    </ThemeProvider>,
  );
}

describe('customer dish row picture', () => {
  it('without a picture there is no picture button and no image', () => {
    show(item());
    expect(screen.queryByRole('button', { name: /Enlarge picture/ })).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('Lemper')).toBeVisible();
  });

  it('with a picture: a 64 x 64 image (not lazy, sync decode) before the text, no layout jump', () => {
    show(item('/images/a.jpg'));
    const button = screen.getByRole('button', { name: 'Enlarge picture of Lemper' });
    const img = button.querySelector('img');
    expect(img).toHaveAttribute('src', '/images/a.jpg');
    expect(img).not.toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'sync');
    expect(img).toHaveAttribute('width', '64');
    expect(img).toHaveAttribute('height', '64');
    // The picture comes first in the row, on the left of the name.
    const row = button.parentElement as HTMLElement;
    expect(row.firstElementChild).toBe(button);
  });

  it('a tap enlarges it with the name, price and description under it, and Close shuts it', () => {
    show(item('/images/a.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge picture of Lemper' }));
    const viewer = screen.getByRole('dialog', { name: 'Picture of Lemper' });
    expect(viewer).toBeVisible();
    expect(screen.getByText('Lemper · $10.00')).toBeVisible();
    expect(screen.getAllByText('Sticky rice rolls').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
