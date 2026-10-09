import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';
import { server } from '../../../mocks/server';
import type { MenuResponse } from '../../../shared/menuContract';
import { DishesScreen, MenuPreview, MenuScreen } from './MenuScreen';
import { renderWithStore, setupI18n } from './testSupport';

const noop = () => undefined;
beforeAll(() => setupI18n('en'));

async function menu(): Promise<MenuResponse> {
  return (await (await fetch('/api/s/onde-onde/menu')).json()) as MenuResponse;
}

describe('menu polish', () => {
  it('preview: says ordering is off and disables every stepper button', async () => {
    const data = await menu();
    renderWithStore(<MenuPreview slug="onde-onde" menu={data} />);
    expect(await screen.findByText('Ordering is turned off in preview')).toBeVisible();
    const steppers = screen.getAllByRole('button', { name: /^(Add|Remove) one /i });
    expect(steppers.length).toBeGreaterThan(0);
    for (const button of steppers) expect(button).toBeDisabled();
    // The preview shows the sheet's facts but none of its actions.
    expect(screen.queryByRole('button', { name: 'See dishes and order' })).toBeNull();
  });

  it('no preview note on the live menu', async () => {
    renderWithStore(<MenuScreen slug="onde-onde" onSeeDishes={noop} onHowItWorks={noop} />);
    await screen.findByRole('button', { name: 'See dishes and order' });
    expect(screen.queryByText('Ordering is turned off in preview')).toBeNull();
  });

  it('delivery off: the pickup row has no "or delivery"; no leading separator without a size', async () => {
    const data = await menu();
    const first = data.items[0];
    if (!first) throw new Error('no items');
    const next: MenuResponse = {
      ...data,
      week: { ...data.week, delivery: { ...data.week.delivery, available: false } },
      items: [{ ...first, size: { en: '', id: '' } }, ...data.items.slice(1)],
    };
    server.use(http.get('*/api/s/onde-onde/menu', () => HttpResponse.json(next)));
    const home = renderWithStore(<MenuScreen slug="onde-onde" onSeeDishes={noop} />);
    expect(await screen.findByRole('button', { name: /^Pickup at/ })).toBeVisible();
    expect(screen.queryByText(/or delivery/)).toBeNull();
    home.unmount();

    renderWithStore(<DishesScreen slug="onde-onde" onBack={noop} onViewBasket={noop} />);
    await screen.findByText(first.name.en);
    expect(screen.getAllByText('$15.00')[0]!.parentElement?.textContent).toBe('$15.00');
  });
});
