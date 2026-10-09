import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';
import { server } from '../../../mocks/server';
import type { MenuResponse } from '../../../shared/menuContract';
import { MenuScreen } from './MenuScreen';
import { renderWithStore, setupI18n } from './testSupport';

const noop = () => undefined;
beforeAll(() => setupI18n('en'));

async function menu(): Promise<MenuResponse> {
  return (await (await fetch('/api/s/onde-onde/menu')).json()) as MenuResponse;
}

describe('menu polish', () => {
  it('preview: says ordering is off and disables every stepper button', async () => {
    const data = await menu();
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} preview={data} />);
    expect(await screen.findByText('Ordering is turned off in preview')).toBeVisible();
    const steppers = screen.getAllByRole('button', { name: /^(Add|Remove) one /i });
    expect(steppers.length).toBeGreaterThan(0);
    for (const button of steppers) expect(button).toBeDisabled();
  });

  it('no preview note on the live menu', async () => {
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />);
    await screen.findByText('How ordering works');
    expect(screen.queryByText('Ordering is turned off in preview')).toBeNull();
  });

  it('delivery off: one clear row; no leading separator when an item has no size', async () => {
    const data = await menu();
    const first = data.items[0];
    if (!first) throw new Error('no items');
    const next: MenuResponse = {
      ...data,
      week: { ...data.week, delivery: { ...data.week.delivery, available: false } },
      items: [{ ...first, size: { en: '', id: '' } }, ...data.items.slice(1)],
    };
    server.use(http.get('*/api/s/onde-onde/menu', () => HttpResponse.json(next)));
    renderWithStore(<MenuScreen slug="onde-onde" onViewBasket={noop} />);
    expect(await screen.findByText('Not available, pickup only')).toBeVisible();
    expect(screen.queryByText('Delivery available')).toBeNull();
    expect(screen.getAllByText('$15.00')[0]!.parentElement?.textContent).toBe('$15.00');
  });
});
