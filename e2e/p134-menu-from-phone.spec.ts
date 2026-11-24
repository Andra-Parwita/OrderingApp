import { readFileSync } from 'node:fs';
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import { collectErrors } from './sellerHelpers';

// Plan 134 (stages B1 and B2): the seller phone starts a menu and works step 1 of the wizard: New menu from
// the Orders card, + New dish (name + price) that lands in Your dishes and on the menu, and the
// "On this menu" sheet. The tablet wizard is captured too, to show it is unchanged. Captures go to
// scratch/cap-134. The run has its own database (scripts/scratch-server.mjs), so closing Onde Onde's
// menu here is safe.

const SELLER = 'onde-onde';
const HEADERS = { 'X-Seller': SELLER };
const SHOTS = 'scratch/cap-134';
const ORIGIN = 'https://localhost:5181';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

type Cfg = Readonly<{
  name: string;
  width: number;
  height: number;
  font: number;
  lang: 'en' | 'id';
}>;

async function open(browser: Browser, cfg: Cfg, phone: boolean): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    timezoneId: 'Australia/Adelaide',
    baseURL: ORIGIN,
    extraHTTPHeaders: { Origin: ORIGIN },
  });
  const page = await context.newPage();
  await page.addInitScript(
    ([slug, lang, font]) => {
      localStorage.setItem('devSeller', String(slug));
      localStorage.setItem('lang', String(lang));
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = `${String(font)}%`;
      });
    },
    [SELLER, cfg.lang, cfg.font],
  );
  return page;
}

/** No menu is open: the live (or draft) menu is closed so the card offers "New menu". */
async function closeMenu(request: APIRequestContext): Promise<void> {
  await request.post('/api/seller/menus/current/unpublish', { headers: HEADERS });
  const gone = await request.delete('/api/seller/menus/current', { headers: HEADERS });
  if (!gone.ok()) {
    const done = await request.post('/api/seller/menus/current/finish', {
      headers: HEADERS,
      data: {},
    });
    expect(done.ok(), await done.text()).toBe(true);
  }
}

/** Nothing spills sideways and no control is cut off at the right edge. */
async function expectFits(page: Page, width: number): Promise<void> {
  const spill = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(spill).toBeLessThanOrEqual(1);
  const cut = await page.evaluate((limit) => {
    return [...document.querySelectorAll('button, input, a')]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.right > limit + 1;
      })
      .map((el) => el.textContent?.trim() ?? el.tagName);
  }, width);
  expect(cut).toEqual([]);
}

const PHONES: ReadonlyArray<Cfg> = [
  { name: 'phone-412x915-en', width: 412, height: 915, font: 100, lang: 'en' },
  { name: 'phone-412x915-text150-en', width: 412, height: 915, font: 150, lang: 'en' },
  { name: 'phone-412x915-id', width: 412, height: 915, font: 100, lang: 'id' },
];

test.beforeEach(async ({ request }, testInfo) => {
  // The tablet's edit sheet test looks at the live menu the last phone run left.
  if (testInfo.title.includes('keeps live menu')) return;
  await closeMenu(request);
});

for (const cfg of PHONES) {
  test(`phone: New menu, step 1 and + New dish at ${cfg.name}`, async ({ browser }) => {
    const en = cfg.lang === 'en';
    const t = (a: string, b: string) => (en ? a : b);
    const page = await open(browser, cfg, true);
    const errors = collectErrors(page);
    const dishName = `Tempe goreng ${cfg.name}`;

    await page.goto('/seller/orders');
    // The run's menu is finished here, so the card offers the next one ("No menu open" is in the unit test).
    await expect(
      page.getByRole('button', { name: t('New menu', 'Menu baru'), exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${cfg.name}-1-card.png` });

    // New menu: the existing dialog, the whole screen on the phone.
    await page.getByRole('button', { name: t('New menu', 'Menu baru'), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: t('New menu', 'Menu baru') });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(cfg.width);
    expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(cfg.height - 2);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${cfg.name}-2-new-menu.png` });
    await dialog.getByRole('button', { name: t('Create menu', 'Buat menu') }).click();

    // Step 1: the wizard layer.
    const wizard = page.getByRole('dialog', { name: t('Make a menu', 'Buat menu') });
    await expect(wizard).toBeVisible();
    await expect(
      wizard.getByRole('button', { name: t('New dish', 'Hidangan baru') }),
    ).toBeVisible();
    await expectFits(page, cfg.width);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${cfg.name}-3-step1.png` });

    // The rows line up in shared columns: ticks, then pencils, each at one x.
    const columns = await wizard.evaluate((root) => {
      const x = (selector: string) => [
        ...new Set(
          [...root.querySelectorAll(selector)].map((el) =>
            Math.round(el.getBoundingClientRect().left),
          ),
        ),
      ];
      return { ticks: x('li input[type="checkbox"]'), pencils: x('li > button') };
    });
    expect(columns.ticks).toHaveLength(1);
    expect(columns.pencils).toHaveLength(1);

    // + New dish: name and price only; "Add to this menu too" is ticked.
    await wizard.getByRole('button', { name: t('New dish', 'Hidangan baru') }).click();
    const editor = page.getByRole('dialog', { name: t('New dish', 'Hidangan baru') });
    await expect(editor).toBeVisible();
    await expect(
      editor.getByRole('checkbox', {
        name: en ? /Add to this menu too/ : /Tambahkan juga ke menu ini/,
      }),
    ).toBeChecked();
    await editor.getByLabel(t('Name (English)', 'Nama (Inggris)')).fill(dishName);
    await editor.getByLabel(t('Price (AUD)', 'Harga (AUD)')).fill('10');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${cfg.name}-4-new-dish.png` });
    await editor.getByRole('button', { name: t('Add dish', 'Tambah hidangan') }).click();
    await expect(editor).toHaveCount(0);

    // It is in Your dishes and on the menu, ticked.
    const tick = wizard.getByRole('checkbox', {
      name: t(`On this menu: ${dishName}`, `Di menu ini: ${dishName}`),
    });
    await expect(tick).toBeChecked();
    await expect(
      wizard.getByRole('button', { name: t('On this menu 1', 'Di menu ini 1') }),
    ).toBeVisible();
    await expectFits(page, cfg.width);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${cfg.name}-5-added.png` });

    // On this menu: the sheet lists it with its price and a remove button.
    await wizard.getByRole('button', { name: t('On this menu 1', 'Di menu ini 1') }).click();
    const sheet = page.getByRole('dialog', { name: en ? /On this menu · 1/ : /Di menu ini · 1/ });
    await expect(sheet.getByText(dishName)).toBeVisible();
    await expect(sheet.getByText('$10.00')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${cfg.name}-6-sheet.png` });

    // Android Back closes the sheet first, then steps out of the wizard to Orders.
    await page.goBack();
    await expect(sheet).toHaveCount(0);
    await expect(wizard).toBeVisible();
    await page.goBack();
    await expect(wizard).toHaveCount(0);
    await expect(page).toHaveURL(/\/seller\/orders/);
    // The work is kept on this device: starting the same menu again finds the tick where it was.
    await page.getByRole('button', { name: t('New menu', 'Menu baru'), exact: true }).click();
    await page
      .getByRole('dialog', { name: t('New menu', 'Menu baru') })
      .getByRole('button', { name: t('Create menu', 'Buat menu') })
      .click();
    await expect(wizard).toBeVisible();
    await expect(
      wizard.getByRole('button', { name: t('On this menu 1', 'Di menu ini 1') }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await page.context().close();
  });
}

// ---- Stage B2: the whole phone flow ---------------------------------------------------------------

type Tree = { [key: string]: Tree | string };
const load = (file: string): Tree =>
  JSON.parse(readFileSync(`src/features/${file}.json`, 'utf8')) as Tree;
const BUNDLES = {
  en: { menu: load('seller-menu/i18n/en'), phone: load('seller-menu/phone/i18n/en') },
  id: { menu: load('seller-menu/i18n/id'), phone: load('seller-menu/phone/i18n/id') },
};
/** A string of the menu feature (`menu`) or of the phone menu card (`phone`), by key, in a language. */
function words(lang: 'en' | 'id', ns: 'menu' | 'phone') {
  return (key: string, vars: Record<string, string | number> = {}): string => {
    let node: Tree | string | undefined = BUNDLES[lang][ns];
    for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined;
    if (typeof node !== 'string') throw new Error(`no string ${ns}:${key}`);
    return node.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(vars[name] ?? ''));
  };
}

/** Scrolls the open layer's scrolling part to its very end (a long page must reach its last field). */
async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    const layers = [...document.querySelectorAll('[role="dialog"]')];
    const top = layers[layers.length - 1];
    if (!top) return;
    for (const node of top.querySelectorAll<HTMLElement>('div')) {
      const overflow = getComputedStyle(node).overflowY;
      if (
        (overflow === 'auto' || overflow === 'scroll') &&
        node.scrollHeight > node.clientHeight + 2
      ) {
        node.scrollTop = node.scrollHeight;
      }
    }
  });
  await page.waitForTimeout(250);
}

/** The element ends above the pinned footer (nothing is hidden behind it). */
async function expectAboveFooter(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  const footer = await page.locator('footer:visible').last().boundingBox();
  expect(box, 'the last field is on screen').not.toBeNull();
  expect(footer, 'the footer is pinned').not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((footer?.y ?? 0) + 1);
}

for (const cfg of PHONES) {
  test(`phone: the whole flow, New menu to Edit menu, at ${cfg.name}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const en = cfg.lang === 'en';
    const t = (a: string, b: string) => (en ? a : b);
    const m = words(cfg.lang, 'menu');
    const p = words(cfg.lang, 'phone');
    const page = await open(browser, cfg, true);
    const errors = collectErrors(page);
    const dishName = `Tempe goreng ${cfg.name}`;
    const shot = async (name: string) => {
      await expectFits(page, cfg.width);
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${SHOTS}/${cfg.name}-b2-${name}.png` });
    };

    await page.goto('/seller/orders');
    await page.getByRole('button', { name: p('card.newMenu'), exact: true }).click();
    await page
      .getByRole('dialog', { name: t('New menu', 'Menu baru') })
      .getByRole('button', { name: t('Create menu', 'Buat menu') })
      .click();
    const wizard = page.getByRole('dialog', { name: m('make.layer') });
    await expect(wizard).toBeVisible();

    // Step 1: + New dish (name and price); the layer has its own bar and Cancel / Add dish pinned.
    await wizard.getByRole('button', { name: m('dishes.newDish') }).click();
    const editor = page.getByRole('dialog', { name: m('dish.titleNew') });
    await expect(editor).toBeVisible();
    await editor.getByLabel(m('dish.name')).fill(dishName);
    // No price: Add dish brings the error into view (it sits far below the fold) and shows it once.
    await editor.getByRole('button', { name: m('dish.add') }).click();
    const priceError = editor.getByText(m('dish.err.price'));
    await expect(priceError).toBeVisible();
    await expect(priceError).toBeInViewport();
    await expect(editor.getByLabel(t('Price (AUD)', 'Harga (AUD)'))).toBeFocused();
    await expect(editor.getByText(m('dish.priceHelper'))).toHaveCount(0);
    await shot('04-new-dish-price-error');
    // Tidy: the "⇄ From ..." link's text starts at the field's left edge; "Chef" and "Edit chefs" share a row.
    const link = await editor.evaluate((root) => {
      const button = [...root.querySelectorAll('button')].find((b) =>
        (b.textContent ?? '').trim().startsWith('⇄'),
      );
      const input = button?.parentElement?.querySelector('input');
      const text = button?.firstChild;
      if (!button || !input || !text) return null;
      const range = document.createRange();
      range.selectNodeContents(button);
      const first = range.getClientRects()[0];
      return { text: first?.left ?? -1, field: input.getBoundingClientRect().left };
    });
    expect(link).not.toBeNull();
    expect(Math.abs((link?.text ?? 0) - (link?.field ?? 99))).toBeLessThanOrEqual(2);
    const chef = await editor.evaluate((root, name) => {
      const label = [...root.querySelectorAll('label')].find((l) => l.textContent === name);
      const link = label?.parentElement?.querySelector('button');
      if (!label || !link) return null;
      const a = label.getBoundingClientRect();
      const b = link.getBoundingClientRect();
      return {
        sameRow: Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) < 4,
        left: b.left > a.left,
      };
    }, m('dish.chef'));
    expect(chef).toEqual({ sameRow: true, left: true });
    await editor.getByLabel(t('Price (AUD)', 'Harga (AUD)')).fill('10');
    await expect(editor.getByRole('heading', { name: m('dish.titleNew') })).toBeVisible();
    await expect(editor.getByRole('button', { name: m('dish.add') })).toBeVisible();
    const editorBox = await editor.boundingBox();
    expect(Math.round(editorBox?.y ?? -1)).toBe(0);
    await shot('04-new-dish');
    await scrollToBottom(page);
    await shot('04-new-dish-bottom');
    await editor.getByRole('button', { name: m('dish.add') }).click();
    await expect(editor).toHaveCount(0);
    await shot('05-step1-added');
    await scrollToBottom(page);
    await shot('05-step1-added-bottom');

    // Step 2: Details. A pickup place is chosen; the page scrolls to the menu picture.
    await wizard
      .getByRole('button', { name: m('make.next', { name: m('stepShort.details') }) })
      .click();
    await expect(wizard.getByRole('heading', { name: m('details.when') })).toBeVisible();
    await shot('06-details-top');
    await wizard.getByRole('button', { name: m('details.addPlace') }).click();
    const place = page.getByRole('dialog', { name: m('details.addPlace') });
    await expect(place).toBeVisible();
    await place.getByLabel(m('details.placeName')).fill(`Mile End ${cfg.name}`);
    await shot('07-place-layer');
    if (en) {
      // The place is made, then deleted again (the list is limited to five places).
      await place.getByRole('button', { name: m('details.savePlace') }).click();
      await expect(place).toHaveCount(0);
      const own = m('details.editPlace', { name: `Mile End ${cfg.name}` });
      await wizard.getByRole('button', { name: own }).click();
      const again = page.getByRole('dialog', { name: own });
      await expect(again).toBeVisible();
      await shot('07-place-layer-edit');
      await again.getByRole('button', { name: m('details.deletePlace') }).click();
      await shot('07-place-delete-ask');
      await page.getByRole('button', { name: m('details.deleteAnyway') }).click();
      await expect(again).toHaveCount(0);
    } else {
      await place.getByRole('button', { name: m('cancel') }).click();
      await expect(place).toHaveCount(0);
    }
    const places = wizard.getByRole('region', { name: m('details.places') });
    const first = places.getByRole('checkbox').first();
    if (!(await first.isChecked())) await first.check();
    await expect(first).toBeChecked();
    await shot('08-details-place-chosen');
    await scrollToBottom(page);
    await expectAboveFooter(page, wizard.getByText(m('details.picture.foot')));
    await shot('09-details-bottom');

    // Step 3: Check. Worth a look first; a price is changed here.
    await wizard
      .getByRole('button', { name: m('make.next', { name: m('stepShort.check') }) })
      .click();
    await expect(wizard.getByRole('heading', { name: m('check.worth') })).toBeVisible();
    await shot('10-check-top');
    // A pickup time never splits across lines.
    const timeLines = await wizard.evaluate((root) =>
      [...root.querySelectorAll('dd > span > span')]
        .map((el) => el.getClientRects().length)
        .filter((count) => count > 0),
    );
    expect(timeLines.length).toBeGreaterThan(0);
    expect(timeLines.every((count) => count === 1)).toBe(true);
    const price = wizard.getByLabel(m('prices.priceFor', { name: dishName }));
    await price.scrollIntoViewIfNeeded();
    await price.fill('11');
    await price.blur();
    await scrollToBottom(page);
    await expectAboveFooter(page, wizard.locator('dl').last());
    await shot('11-check-bottom');

    // Step 4: Publish.
    await wizard
      .getByRole('button', { name: m('make.next', { name: m('stepShort.publish') }) })
      .click();
    await expect(wizard.getByRole('heading', { name: m('publish.ready') })).toBeVisible();
    await shot('12-publish');
    await wizard.getByRole('button', { name: m('publish.button') }).click();
    const when = page
      .getByRole('dialog')
      .filter({ hasText: m('publish.nowTitle') })
      .last();
    await expect(when).toBeVisible();
    await shot('13-publish-dialog');
    await when.getByRole('button', { name: m('publish.confirmNow') }).click();
    const ask = page.getByRole('dialog', { name: m('notify.ask') });
    await expect(ask).toBeVisible();
    await shot('14-notify-ask');
    // Android Back closes only the question (it counts as Not now): "Your menu is live" stays.
    await page.goBack();
    await expect(ask).toHaveCount(0);
    await expect(wizard.getByRole('heading', { name: m('publish.live') })).toBeVisible();
    expect(page.url()).toContain('/seller/menu/make/publish');
    await expect(page.getByRole('dialog', { name: p('share.title') })).toHaveCount(0);
    await shot('14-notify-back-live');
    await wizard.getByRole('button', { name: m('publish.shareMenu') }).click();
    const share = page.getByRole('dialog', { name: p('share.title') });
    await expect(share).toBeVisible();
    await expect(share.getByRole('textbox')).toBeVisible();
    await shot('15-share-menu');
    await share.getByRole('button', { name: p('share.close') }).click();
    await expect(wizard).toHaveCount(0);
    await expect(page).toHaveURL(/\/seller\/orders/);
    const card = page.getByRole('button', { name: p('card.open') });
    await expect(card).toBeVisible();
    await expect(page.getByText(p('card.pill.live'), { exact: true }).first()).toBeVisible();
    // The Notice button is there without a reload (the notice status is read again).
    await expect(page.getByRole('button', { name: p('card.notice') })).toBeVisible();
    await shot('16-orders-live');

    // Edit a live menu: the menu from the card, then the edit sheet.
    await card.click();
    const edit = page.getByRole('button', { name: p('menu.edit'), exact: true });
    await expect(edit).toBeVisible();
    await shot('17-menu-layer');
    await edit.click();
    const sheet = page.getByRole('dialog', { name: m('session.layer') });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(m('session.band'))).toBeVisible();
    await shot('18-edit-dishes');
    await scrollToBottom(page);
    await shot('18-edit-dishes-bottom');
    await sheet.getByRole('button', { name: m('tab.details') }).click();
    await expect(sheet.getByRole('heading', { name: m('details.when') })).toBeVisible();
    await shot('19-edit-details');
    await scrollToBottom(page);
    await shot('19-edit-details-bottom');
    await sheet.getByRole('button', { name: m('tab.prices') }).click();
    const livePrice = sheet.getByLabel(m('prices.priceFor', { name: dishName }));
    await expect(livePrice).toBeVisible();
    await shot('20-edit-prices');
    await livePrice.fill('12.5');
    await livePrice.blur();
    await expect(sheet.getByRole('status').filter({ hasText: /1/ })).toBeVisible();
    await shot('21-edit-prices-changed');
    // Android Back asks; Back with the question open is Keep editing; the app is never left.
    const leave = page.getByRole('alertdialog');
    const unsaved = sheet.getByRole('status').filter({ hasText: /1/ });
    for (let round = 0; round < 2; round += 1) {
      await page.goBack();
      await expect(leave).toBeVisible();
      if (round === 0) await shot('21-edit-back-ask');
      await page.goBack();
      await expect(leave).toHaveCount(0);
      await expect(sheet).toBeVisible();
      await expect(unsaved).toBeVisible();
      expect(page.url()).toContain('/seller/menu/edit');
    }
    await sheet.getByRole('button', { name: m('session.save'), exact: true }).click();
    await expect(sheet).toHaveCount(0, { timeout: 15_000 });
    // Back on the read-only menu, with the new price.
    const layer = page.getByRole('dialog').filter({ hasText: dishName });
    await expect(layer).toBeVisible();
    await expect(layer.getByText(/12[.,]50/).first()).toBeVisible();
    await shot('22-menu-after-save');
    expect(errors).toEqual([]);
    await page.context().close();
  });
}

// A live menu is left by the last phone run: the tablet's edit sheet is unchanged.
for (const size of [
  { name: 'tablet-1280x800', width: 1280, height: 800 },
  { name: 'tablet-800x1280', width: 800, height: 1280 },
]) {
  test(`tablet: the edit sheet is unchanged at ${size.name} (keeps live menu)`, async ({
    browser,
  }) => {
    const cfg: Cfg = { ...size, font: 100, lang: 'en' };
    const page = await open(browser, cfg, false);
    const errors = collectErrors(page);
    await page.goto('/seller/menu');
    await page.getByRole('button', { name: 'Edit menu', exact: true }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Edit menu' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('navigation', { name: 'Sections' })).toBeVisible();
    // The tablet sheet is a panel, not the phone's full-screen layer.
    const box = await sheet.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(size.width - 16);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${size.name}-edit-sheet.png` });
    await sheet.getByRole('button', { name: 'Prices & limits' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${size.name}-edit-sheet-prices.png` });
    expect(errors).toEqual([]);
    await page.context().close();
  });
}

for (const size of [
  { name: 'tablet-1280x800', width: 1280, height: 800 },
  { name: 'tablet-800x1280', width: 800, height: 1280 },
]) {
  test(`tablet: the wizard is unchanged at ${size.name}`, async ({ browser }) => {
    const cfg: Cfg = { ...size, font: 100, lang: 'en' };
    const page = await open(browser, cfg, false);
    const errors = collectErrors(page);
    await page.goto('/seller/menu');
    await page.getByRole('button', { name: 'New menu', exact: true }).first().click();
    await page
      .getByRole('dialog', { name: 'New menu' })
      .getByRole('button', { name: 'Create menu' })
      .click();
    const wizard = page.getByRole('dialog', { name: 'Make a menu' });
    await expect(wizard).toBeVisible();
    await expect(wizard.getByRole('navigation', { name: 'Steps' })).toBeVisible();
    await expect(wizard.getByRole('complementary', { name: 'On this menu' })).toBeVisible();
    await expect(wizard.getByRole('radiogroup', { name: 'Start from' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${size.name}-wizard.png` });
    expect(errors).toEqual([]);
    await page.context().close();
  });
}
