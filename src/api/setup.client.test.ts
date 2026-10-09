import { beforeEach, describe, expect, it } from 'vitest';
import { mockStores } from '../../mocks/handlers';
import { pngFor } from '../../mocks/images';
import {
  closeWeek,
  createChef,
  createItem,
  deleteChef,
  deleteItem,
  deleteSet,
  exportBackup,
  fetchChefs,
  fetchImages,
  fetchOrdersCsv,
  fetchPastWeek,
  fetchPastWeeks,
  fetchSets,
  fetchWeek,
  placeOrder,
  publishWeek,
  removeImage,
  renameChef,
  renameSet,
  reorderItems,
  restoreBackup,
  saveImageStyle,
  saveSet,
  saveWeek,
  unpublishWeek,
  updateItem,
  uploadImage,
  useSet,
  fetchSellerMenu,
} from './client';
import type { ApiResult } from './http';

function data<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(`${result.error}: ${result.message}`);
  return result.data;
}

const text = (en: string, id = '') => ({ en, id });
const B = 'dapur-demo';

beforeEach(() => {
  mockStores.reset();
});

describe('seller setup client', () => {
  it('runs a week: edit settings, edit items, publish and unpublish', async () => {
    const week = data(await fetchWeek()).week;
    expect(week.status).toBe('published');
    const saved = data(
      await saveWeek({
        cookingDate: '2026-10-17',
        cutoffAt: '2026-10-16T21:00:00+11:00',
        pickupPoints: [
          { place: 'Clayton', directions: text('Gate'), window: { start: '10:00', end: '12:00' } },
        ],
        delivery: { available: true, note: text('Within 5 km') },
      }),
    ).week;
    expect(saved.pickupPoints).toHaveLength(1);
    expect(data(await unpublishWeek()).week.status).toBe('draft');
    const created = data(await createItem({ name: text('Soto'), priceCents: 1400 })).item;
    expect(data(await updateItem(created.id, { soldOut: true })).item.manualSoldOut).toBe(true);
    const ids = data(await fetchSellerMenu()).items.map((item) => item.id);
    expect(data(await reorderItems([...ids].reverse())).items[0]?.id).toBe(created.id);
    expect(data(await publishWeek()).week.status).toBe('published');
  });

  it('keeps D-020: an ordered item is not deleted (item_has_orders)', async () => {
    await placeOrder('onde-onde', {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
    });
    expect(await deleteItem('pesmol')).toMatchObject({
      ok: false,
      status: 409,
      error: 'item_has_orders',
    });
    expect((await deleteItem('tempe-mendoan')).ok).toBe(true);
  });

  it('manages chefs and saved sets', async () => {
    const chef = data(await createChef('Budi')).chef;
    expect(data(await renameChef(chef.id, 'Pak Budi')).chef.name).toBe('Pak Budi');
    expect(data(await fetchChefs()).chefs.map((c) => c.name)).toEqual(['Chef Wati', 'Pak Budi']);
    expect((await deleteChef(chef.id)).ok).toBe(true);

    const set = data(await saveSet('Classic')).set;
    expect(data(await renameSet(set.id, 'Week A')).set.name).toBe('Week A');
    expect(data(await fetchSets()).sets).toHaveLength(1);
    await unpublishWeek();
    expect(await useSet(set.id)).toMatchObject({ ok: false, error: 'confirm_required' });
    expect(data(await useSet(set.id, { confirm: true })).items).toHaveLength(6);
    expect((await deleteSet(set.id)).ok).toBe(true);
    expect(data(await fetchSets()).sets).toEqual([]);
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

  it('closes a week into past weeks, and backs up and restores', async () => {
    await placeOrder('onde-onde', {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 2 }],
    });
    const backup = data(await exportBackup());
    expect(backup.orders).toHaveLength(1);
    const closed = data(await closeWeek());
    expect(closed.closed.totals.incomeCents).toBe(3000);
    expect(data(await fetchPastWeeks()).weeks).toHaveLength(1);
    expect(data(await fetchPastWeek(closed.closed.id)).week.orders).toHaveLength(1);
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
