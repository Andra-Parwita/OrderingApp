# Deploy to Cloudflare (order.shaggybobo.app)

Plan 012 · D-076. The commands below touch the real Cloudflare account, so **the owner runs them** (or the builder, with the owner's OK). Agents never run anything with `--remote`, `wrangler deploy` or `wrangler secret`.

Run everything from the project folder on the PC, after the full gate is green on the commit you deploy.

## 1 · Sign in to Cloudflare (once per PC)

```bash
pnpm exec wrangler login
```

## 2 · Create the database and image storage (once)

```bash
pnpm exec wrangler d1 create shaggybobo-order
```

Copy the `database_id` it prints into `wrangler.jsonc`, replacing `"local-only"` in `database_id` only. Leave `preview_database_id` as `"local-only"`, so your PC keeps its local data. Commit that change: the id is not a secret.

```bash
pnpm exec wrangler r2 bucket create shaggybobo-images
```

## 3 · Create the tables in the real database

```bash
pnpm exec wrangler d1 migrations apply shaggybobo-order --remote
```

Run this again after every deploy that adds a file to `migrations/`.

## 4 · Secrets (once; never commit them)

1. **Admin setup key.** Make a new, long one (not the dev key in `.dev.vars.example`) and keep it in a password manager:

   ```bash
   pnpm exec wrangler secret put ADMIN_SETUP_KEY
   ```

2. **Web push keys.** Make the pair once and keep it; a new pair cuts off every customer's notifications:

   ```bash
   node scripts/vapid-keys.mjs
   ```

   Then add each of the three values it prints:

   ```bash
   pnpm exec wrangler secret put VAPID_PUBLIC_KEY
   ```

   ```bash
   pnpm exec wrangler secret put VAPID_PRIVATE_KEY
   ```

   ```bash
   pnpm exec wrangler secret put VAPID_SUBJECT
   ```

   `VAPID_SUBJECT` is a contact address such as `mailto:you@example.com`.

**Never set `DEV_TOOLS`** on Cloudflare. It switches on reset-everything and no-sign-in (D-076).

## 5 · Deploy

```bash
pnpm run deploy
```

It builds and uploads. The app is then at **`https://order.shaggybobo.app`** (D-077). Cloudflare creates the address and its certificate on the first deploy, because `shaggybobo.app` is in the same account; the first load can take a minute. There is no `workers.dev` address, because passkeys work only on the one address they were made on.

Addresses:
- customers: `order.shaggybobo.app/<kitchen>`, e.g. `/onde-onde` and `/onde-onde-demo`;
- seller sign-in: `order.shaggybobo.app/seller/sign-in?kitchen=<kitchen>`;
- seller app: `order.shaggybobo.app/seller`;
- admin: `order.shaggybobo.app/admin`.

## 6 · First visit

1. Open `/admin/setup`, enter the admin setup key and register the admin passkey.
2. In admin, create the kitchens:
   - **Onde Onde** (real). Sign in as its seller. On the PC's local app, open Onde Onde → **Backup**, export the file, and **Restore** it on Cloudflare. Then upload again the pictures you uploaded on the PC (the built-in sample pictures come across by themselves).
   - **The demo kitchen.** Restore the same backup, switch **Demo kitchen** on in admin, and use "Add 50 sample orders" there.
3. Invite chefs from each kitchen's Settings.

## 7 · Phone checks

- **iPhone:**
  1. Open the kitchen link in Safari, then Share → Add to Home Screen.
  2. Open the app from the home screen, place an order and allow notifications.
  3. On the seller side, confirm the order; the notification should arrive. Push works on iPhone only from the home-screen app.
- **Android:** Chrome → Install app, then the same steps.
- **Seller tablet:** sign in with a passkey, take orders and print labels.

## 8 · When something is wrong

- Live logs:

  ```bash
  pnpm exec wrangler tail
  ```

- Back to the previous version:

  ```bash
  pnpm exec wrangler rollback
  ```

  A rollback does not undo database migrations, so add migrations only in a way that the old version still works with.
