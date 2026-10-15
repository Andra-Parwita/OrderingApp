import { expect, test } from '@playwright/test';
import { markHowItWorksSeen } from './customerHelpers';

// Plan 076: a pickup place may carry an address and a map pin. The seller API stores and validates it;
// the customer's menu shows one small line (address, View on map, Directions) only for a place that
// has an address. The menu answer is edited in the browser, so the kitchen's real menu is untouched.
const SELLER = { 'X-Seller': 'onde-onde' };

test('the seller API saves, changes and removes a pickup address, and refuses bad pins', async ({
  request,
}, testInfo) => {
  const name = `Map ${testInfo.project.name}`.slice(0, 40);
  const base = {
    place: name,
    directions: { en: 'Blue gate', id: 'Gerbang biru' },
    window: { start: '10:00', end: '12:00' },
  };
  const created = await request.post('/api/seller/pickup-places', {
    headers: SELLER,
    data: { ...base, address: ' 12 Jetty Road, Glenelg 5045 ', lat: -34.98, lng: 138.51 },
  });
  expect(created.status()).toBe(201);
  const place = ((await created.json()) as { place: { id: string } }).place;
  try {
    expect(await created.json()).toMatchObject({
      place: { address: '12 Jetty Road, Glenelg 5045', lat: -34.98, lng: 138.51 },
    });

    // A pin out of bounds, or without an address, is refused.
    const outOfBounds = await request.patch(`/api/seller/pickup-places/${place.id}`, {
      headers: SELLER,
      data: { address: '12 Jetty Road', lat: 91, lng: 0 },
    });
    expect(outOfBounds.status()).toBe(400);
    const pinAlone = await request.patch(`/api/seller/pickup-places/${place.id}`, {
      headers: SELLER,
      data: { lat: 1, lng: 2 },
    });
    expect(pinAlone.status()).toBe(400);

    // Changing the address without a pin drops the old pin; null removes the address.
    const changed = await request.patch(`/api/seller/pickup-places/${place.id}`, {
      headers: SELLER,
      data: { address: '5 Hay St, Perth 6000' },
    });
    const next = ((await changed.json()) as { place: Record<string, unknown> }).place;
    expect(next['address']).toBe('5 Hay St, Perth 6000');
    expect(next['lat']).toBeUndefined();
    const removed = await request.patch(`/api/seller/pickup-places/${place.id}`, {
      headers: SELLER,
      data: { address: null },
    });
    const gone = ((await removed.json()) as { place: Record<string, unknown> }).place;
    expect(gone['address']).toBeUndefined();
  } finally {
    await request.delete(`/api/seller/pickup-places/${place.id}`, { headers: SELLER });
  }
});

test('the customer sees the address line with View on map and Directions; no address, no line', async ({
  page,
  context,
}) => {
  await markHowItWorksSeen(context);
  let withAddress = true;
  await page.route('**/api/s/onde-onde/menu', async (route) => {
    const response = await route.fetch();
    const menu = (await response.json()) as {
      week: { pickupPoints: Array<Record<string, unknown>> };
    };
    const first = menu.week.pickupPoints[0];
    if (first && withAddress) first['address'] = '12 Jetty Road, Glenelg 5045';
    await route.fulfill({ response, json: menu });
  });

  await page.goto('/onde-onde');
  await page.getByRole('button', { name: /Pickup at/ }).click();
  const line = page.getByTestId('pickup-map-line').first();
  await expect(line).toContainText('12 Jetty Road, Glenelg 5045');
  await expect(line.getByRole('link', { name: /Directions/ })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/dir/?api=1&destination=12%20Jetty%20Road%2C%20Glenelg%205045',
  );
  // No map until View on map is tapped; the panel then shows the address and a big Directions button.
  await expect(page.locator('iframe')).toHaveCount(0);
  await line.getByRole('button', { name: /View on map/ }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('12 Jetty Road, Glenelg 5045');
  await expect(panel.getByRole('link', { name: 'Directions' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);

  // A place without an address works as before: no line at all.
  withAddress = false;
  await page.reload();
  await page.getByRole('button', { name: /Pickup at/ }).click();
  await expect(page.getByTestId('pickup-map-line')).toHaveCount(0);
});
