import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { adminSignIn, originHeaders, type AdminLabel } from './adminSession';
import { collectErrors } from './sellerHelpers';
import { credentialsOf, virtualAuthenticator } from './virtualAuthenticator';

// Stage 7.2a: sign-in screens through the harness. Runs on the Android phone and the desktop only,
// in the "auth" projects (one at a time). The admin comes from global-setup.ts, with its own
// passkey per project. Device names are unique per project. Stage 8.2: passkeys are real WebAuthn,
// made and used in Chrome's virtual authenticator; the password path stays covered.

test.skip(({ browserName }) => browserName !== 'chromium', 'Android (Chromium) and desktop only');
// Both tests use the same admin device and Dapur Demo's account: one after the other.
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'e2e long enough password';

/** An invite key for Dapur Demo, made by this project's admin device (signed in by passkey). */
async function inviteKeyFor(request: APIRequestContext, project: string): Promise<string> {
  const kind = project.includes('desktop') ? 'desktop-chromium' : 'mobile-chromium';
  await adminSignIn(request, `seller-auth-${kind}` as AdminLabel);
  const sellers = await request.get('/api/admin/sellers');
  const list = (await sellers.json()) as { sellers: Array<{ id: string; slug: string }> };
  const seller = list.sellers.find((candidate) => candidate.slug === 'dapur-demo');
  if (!seller) throw new Error('Dapur Demo is not in the mock');
  const invite = await request.post(`/api/admin/sellers/${seller.id}/invite-key`, {
    headers: originHeaders,
  });
  expect(invite.ok()).toBe(true);
  return ((await invite.json()) as { key: string }).key;
}

const capture = (page: Page, name: string, project: string) =>
  page.screenshot({ path: `captures/seller-auth-${name}-${project}.png`, fullPage: true });

test('a real passkey: create it, sign out, sign back in with it', async ({
  page,
  request,
}, testInfo) => {
  const errors = collectErrors(page);
  const project = testInfo.project.name;
  const deviceName = `E2E passkey ${project}`;
  const key = await inviteKeyFor(request, project);
  const authenticator = await virtualAuthenticator(page);

  await page.goto('/?harness=seller-auth&screen=key');
  await page.getByLabel('Enter the key you were sent').fill(key);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Create a passkey' })).toBeVisible();
  // The prototype note is gone: the passkey is real now.
  await expect(page.getByText(/simulated/i)).toHaveCount(0);
  await page.getByLabel('Name of this device').fill(deviceName);
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await expect(page.getByText(deviceName, { exact: true })).toBeVisible();

  // The authenticator really holds a passkey for this site, and the page kept only its id.
  const made = await credentialsOf(authenticator);
  expect(made).toHaveLength(1);
  expect(made[0]?.rpId).toBe('localhost');
  const stored = await page.evaluate(() => ({
    credential: localStorage.getItem('passkeyCredential.staff'),
    session: localStorage.getItem('session'),
  }));
  expect(stored.session).toBeNull();
  expect(stored.credential).toBe(
    Buffer.from(made[0]?.credentialId ?? '', 'base64').toString('base64url'),
  );
  // The session is an HttpOnly cookie: script cannot see it, the browser has it.
  expect(await page.evaluate(() => document.cookie)).not.toContain('__Host-session');
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === '__Host-session');
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/' });

  await page.getByRole('button', { name: 'Sign out of this device' }).click();
  await page.getByRole('button', { name: 'Tap again to sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Dapur Demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in with passkey' }).click();
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await expect(page.getByText('Active now')).toBeVisible();
  // The signature counter went up on the authenticator (a replay would be refused).
  const used = await credentialsOf(authenticator);
  expect(used[0]?.signCount).toBeGreaterThan(made[0]?.signCount ?? 0);

  expect(errors).toEqual([]);
});

test('key, password, devices and add-device code, then sign out and back in', async ({
  page,
  request,
}, testInfo) => {
  const errors = collectErrors(page);
  const project = testInfo.project.name;
  const deviceName = `E2E ${project}`;
  const key = await inviteKeyFor(request, project);

  await page.goto('/?harness=seller-auth&screen=key');
  await expect(page.getByRole('heading', { name: 'Set up your sign-in' })).toBeVisible();
  await capture(page, 'key', project);

  // A key typed in small letters, with spaces, is accepted.
  await page.getByLabel('Enter the key you were sent').fill(key.toLowerCase().replaceAll('-', ' '));
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Create a passkey' })).toBeVisible();
  await expect(page.getByText(/simulated/i)).toHaveCount(0);
  await capture(page, 'passkey', project);

  await page
    .getByRole('button', { name: "My phone can't do this → set a password instead" })
    .click();
  await expect(page.getByRole('heading', { name: 'Set a password' })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Name of this device').fill(deviceName);
  await capture(page, 'password', project);
  await page.getByRole('button', { name: 'Save password' }).click();

  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await expect(page.getByText(deviceName, { exact: true })).toBeVisible();
  await expect(page.getByText('Active now')).toBeVisible();

  await page.getByRole('button', { name: 'Add a device' }).click();
  await expect(page.getByLabel('Your code')).toHaveText(/^\d{6}$/);
  await expect(page.getByText(/^Expires in \d\d:\d\d$/)).toBeVisible();
  await capture(page, 'devices', project);

  // Sign out of this device (two taps), then back in with the password.
  await page.getByRole('button', { name: 'Sign out of this device' }).click();
  await page.getByRole('button', { name: 'Tap again to sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Dapur Demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Use password instead' }).click();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await capture(page, 'signin', project);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await expect(page.getByText('Active now')).toBeVisible();

  expect(errors).toEqual([]);
});

/** Setup with a key and a real passkey, on the real route; lands on the seller home. */
async function setUpWithPasskey(page: Page, key: string, device: string) {
  await page.goto('/seller/setup');
  await page.getByLabel('Enter the key you were sent').fill(key);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Create a passkey' })).toBeVisible();
  await page.getByLabel('Name of this device').fill(device);
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(page).toHaveURL(/\/seller$/);
}

/** D-050: the rail button on a tablet or desktop, the top of the More tab on a phone. */
async function switchPerson(page: Page) {
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await page
      .getByRole('navigation', { name: 'Seller' })
      .getByRole('button', { name: /Switch person/ })
      .click();
  } else {
    await page.getByRole('link', { name: 'More' }).click();
    await page.getByRole('button', { name: /Switch person/ }).click();
  }
  // Sign out, then the passkey picker opens by itself and signs the chosen person in.
  await expect(page).toHaveURL(/\/seller$/);
}

test('two staff passkeys on one device: Switch person goes between them', async ({
  page,
  request,
}, testInfo) => {
  const errors = collectErrors(page);
  const project = testInfo.project.name;
  const chefName = `Switchy ${project}`;
  const wide = (page.viewportSize()?.width ?? 0) >= 1024;
  const authenticator = await virtualAuthenticator(page);

  // The seller, then a chef, each make a passkey on this one device.
  await setUpWithPasskey(page, await inviteKeyFor(request, project), `E2E seller ${project}`);
  await expect(
    page.getByText('Signed in as Dapur Demo').or(page.getByText('Dapur Demo · seller')),
  ).toBeVisible();
  const made = await page.request.post('/api/seller/chefs', { data: { name: chefName } });
  expect(made.ok()).toBe(true);
  const { chef } = (await made.json()) as { chef: { id: string } };
  const invited = await page.request.post('/api/seller/chef-invites', {
    data: { chefId: chef.id },
  });
  expect(invited.ok()).toBe(true);
  const chefKey = ((await invited.json()) as { key: string }).key;
  await setUpWithPasskey(page, chefKey, `E2E chef ${project}`);
  await expect(
    page.getByText(`Signed in as Chef ${chefName}`).or(page.getByText(`${chefName} · chef`)),
  ).toBeVisible();
  if (wide) {
    await expect(page.getByRole('navigation', { name: 'Seller' })).toContainText(
      `${chefName} · chef`,
    );
  }

  const both = await credentialsOf(authenticator);
  expect(both).toHaveLength(2);
  const chefId = await page.evaluate(() => localStorage.getItem('passkeyCredential.staff'));
  const chefKeyPair = both.find(
    (item) => Buffer.from(item.credentialId, 'base64').toString('base64url') === chefId,
  );
  const sellerKeyPair = both.find((item) => item !== chefKeyPair);
  if (!chefKeyPair || !sellerKeyPair) throw new Error('could not tell the two passkeys apart');

  // The browser offers every passkey and picks one by itself here (no one to click), so to choose
  // who signs in, the other passkey is held back while the picker opens, then put back.
  // Held back with its current sign count, so that putting it back does not look like a replay.
  const hide = async (item: typeof chefKeyPair) => {
    const now = (await credentialsOf(authenticator)).find(
      (candidate) => candidate.credentialId === item.credentialId,
    );
    if (!now) throw new Error('passkey is not on the authenticator');
    await authenticator.cdp.send('WebAuthn.removeCredential', {
      authenticatorId: authenticator.authenticatorId,
      credentialId: item.credentialId,
    });
    return now;
  };
  const restore = (item: typeof chefKeyPair) =>
    authenticator.cdp.send('WebAuthn.addCredential', {
      authenticatorId: authenticator.authenticatorId,
      credential: item,
    });

  const heldChef = await hide(chefKeyPair);
  await switchPerson(page); // chef -> seller
  await expect(
    page.getByText('Signed in as Dapur Demo').or(page.getByText('Dapur Demo · seller')),
  ).toBeVisible();
  await restore(heldChef);

  const heldSeller = await hide(sellerKeyPair);
  await switchPerson(page); // seller -> chef
  await expect(
    page.getByText(`Signed in as Chef ${chefName}`).or(page.getByText(`${chefName} · chef`)),
  ).toBeVisible();
  await restore(heldSeller);

  // With both on the device the picker still opens and someone is signed in, no password screen.
  await switchPerson(page);
  await expect(
    page.getByText(/^Signed in as /).or(page.getByText(/ · (seller|chef)$/)),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use password instead' })).toHaveCount(0);
  expect(await credentialsOf(authenticator)).toHaveLength(2);

  expect(errors).toEqual([]);
});
