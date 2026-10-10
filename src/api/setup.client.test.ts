import { beforeEach, describe, expect, it } from 'vitest';
import { mockStores } from '../../mocks/handlers';
import { pngFor } from '../../mocks/images';
import {
  createChef,
  deleteChef,
  exportBackup,
  fetchChefs,
  fetchCurrentMenu,
  fetchImages,
  fetchOrdersCsv,
  fetchPastWeek,
  fetchPastWeeks,
  placeOrder,
  removeImage,
  renameChef,
  restoreBackup,
  saveImageStyle,
  uploadImage,
} from './client';
import {
  createDish,
  finishMenu,
  publishMenu,
  removeMenuPicture,
  unpublishMenu,
  updateCurrentMenu,
  uploadMenuPicture,
} from './menus';
import type { ApiResult } from './http';

function data<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(`${result.error}: ${result.message}`);
  return result.data;
}

const text = (en: string, id = '') => ({ en, id });
const B = 'dapur-demo';

beforeEach(async () => {
  await mockStores.reset();
});

describe('seller setup client', () => {
  it('runs a menu: edit the details, add a dish, unpublish, publish', async () => {
    const view = data(await fetchCurrentMenu()).menu;
    expect(view.menu.state).toBe('live');
    const saved = data(
      await updateCurrentMenu({ delivery: { available: true, note: text('Within 5 km') } }),
    ).menu;
    expect(saved.menu.delivery.available).toBe(true);
    expect(data(await unpublishMenu()).menu.menu.state).toBe('not_published');
    const dish = data(await createDish({ name: text('Soto'), priceCents: 1400 })).dish;
    const ids = [...saved.dishes.flatMap((d) => (d.dishId ? [d.dishId] : [])), dish.id];
    expect(data(await updateCurrentMenu({ dishIds: ids })).menu.dishes.length).toBeGreaterThan(0);
    expect(data(await publishMenu()).menu.menu.state).toBe('live');
  });

  it('warns, never blocks: an empty menu publishes with force (D-062)', async () => {
    await unpublishMenu();
    data(await updateCurrentMenu({ dishIds: [] }));
    expect(await publishMenu()).toMatchObject({
      ok: false,
      status: 409,
      error: 'no_items',
      warning: { code: 'no_dishes' },
    });
    expect(data(await publishMenu(true)).menu.menu.state).toBe('live');
  });

  it('keeps a menu picture on the menu, 3:2', async () => {
    const url = pngFor('menuPicture');
    expect(data(await uploadMenuPicture(url)).menu.menu.pictureRef).toBe(url);
    expect(await uploadMenuPicture(pngFor('desktopBanner'))).toMatchObject({
      ok: false,
      error: 'image_ratio',
    });
    expect(data(await removeMenuPicture()).menu.menu.pictureRef).toBeUndefined();
  });

  it('manages chefs', async () => {
    const chef = data(await createChef('Budi')).chef;
    expect(data(await renameChef(chef.id, 'Pak Budi')).chef.name).toBe('Pak Budi');
    expect(data(await fetchChefs()).chefs.map((c) => c.name)).toEqual(['Chef Wati', 'Pak Budi']);
    expect((await deleteChef(chef.id)).ok).toBe(true);
  });

  it('uploads and removes images and saves the colour', async () => {
    const url = pngFor('railIcon');
    expect(data(await uploadImage('railIcon', url, undefined, B)).images.railIcon).toBe(url);
    expect(await uploadImage('railIcon', pngFor('desktopBanner'), undefined, B)).toMatchObject({
      ok: false,
      error: 'image_ratio',
    });
    expect(
      data(await saveImageStyle({ bannerBackground: '#223344' }, undefined, B)).images,
    ).toMatchObject({
      railIcon: url,
      bannerBackground: '#223344',
    });
    expect(data(await removeImage('railIcon', undefined, B)).images.railIcon).toBeUndefined();
    expect(data(await fetchImages()).images.desktopBanner).toBe('/samples/banner-wide.jpg');
  });

  it('finishes a menu into past menus, and backs up and restores', async () => {
    await placeOrder('onde-onde', {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 2 }],
    });
    const backup = data(await exportBackup());
    expect(backup.orders).toHaveLength(1);
    const closed = data(await finishMenu());
    expect(closed.closedOrders).toBe(1);
    const weeks = data(await fetchPastWeeks()).weeks;
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.totals.incomeCents).toBe(3000);
    expect(data(await fetchPastWeek(closed.menu.menu.id)).week.orders).toHaveLength(1);
    expect((await restoreBackup(backup)).ok).toBe(true);
    expect(data(await fetchPastWeeks()).weeks).toEqual([]);
    expect(await restoreBackup({ ...backup, version: 2 as 1 })).toMatchObject({
      ok: false,
      error: 'invalid_backup',
    });
  });

  it('downloads the orders CSV with its BOM', async () => {
    await placeOrder('onde-onde', {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
    });
    const csv = data(await fetchOrdersCsv());
    expect(csv.startsWith('﻿code,first name')).toBe(true);
    expect(csv).toContain('Rina');
  });
});
