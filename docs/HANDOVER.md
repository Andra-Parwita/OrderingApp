# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here.

**Last session:** 2026-10-12 evening, the owner's PC (Adelaide), with Claude as coordinator. Branch `indra/brand_logo_ux` = `main` (release **1.0.24**, `e056995`, deployed) + the builder's plans 045/046 (`09268ac`) + **this session's uncommitted work** below. GitHub's copy of the branch still has the old history: push it with `git push --force-with-lease origin indra/brand_logo_ux`.

## Where things stand
Built on this PC tonight, **not committed or deployed yet**. Each builder ran typecheck, eslint, its unit tests and its own e2e specs. The final gate: typecheck ✅, lint ✅, format ✅ (one file fixed at 20:26), **all unit tests pass: 1852 of 1852 in 164 files** (20:34, before plan 055), and **the full e2e suite has not run on the whole set yet** (see "First thing next session").

| plan | what |
|---|---|
| 047 | **link previews**: WhatsApp shows a small square picture (the ShaggyBobo happy face for invites/admin; the kitchen's app icon for menu links) with title and description; every WhatsApp link now uses `api.whatsapp.com/send` (the 👋 no longer breaks) |
| 048 | the **seller app installs** on every `/seller` page ("ShaggyBobo Seller", the bean icon, opens without the address bar); an **"Install the app"** row in More (phone) and Settings (tablet) |
| 049 | **"Edit chefs" opens a modal** over the dish editor, so a typed dish is never lost |
| 050 | **dish library CSV**: Import (preview of new / update / problem before anything changes), Export, Template; matched by **name + chef** |
| 051 | **dishes on the phone** (More → Dishes); a **chef can put her own dish on the current menu** (D-094), via a new "add one dish" route |
| 052 | admin page **"Last updated" + Refresh** (at most once a minute) |
| 053 | **Menu step tabs** for an unpublished menu: each step read-only, **Edit** opens the wizard at that step, **Continue to step N** |
| 054 | a friendly **"put it on your home screen"** card (customer menu; seller Home/Orders), only in the browser, never in the installed app; "Not now" = 7 days |
| 055 | **Publish now, or publish with ordering paused**, chosen in a **confirmation modal when the seller presses Publish**, each option explained in plain words; after a paused publish a notice says how to open orders. ✅ built (271 tests) |
| 056 | **Languages for customers**: both / English only / Indonesian only (Settings → Kitchen); one field per text when one language. ✅ built |
| 057 | **⇄ Translate** button for dish name/description (Cloudflare Workers AI, 100 a day per kitchen). ✅ built, in the dish editor. Locally there is no AI (`remoteBindings: false`), so the button says "not available": expected. **After deploying, check one translation returns 200** (a 503 means the binding didn't ship) |
| 058 | **Seller Help** page, public at the hidden address `/help-yw4xsvh8` (D-095), 11 topics EN/ID with real screenshots, waving mascot; **Help** under Settings in the left menu, More, sign-in, setup and the invite message ✅. 6 real screenshots so far (English); more (devices, invite, publish, orders) need a real signed-in session — next round |
| 059 | **"A new version is ready · Refresh"** bar + automatic reload when an old screen misses a replaced part ✅ (`version.json` no-store via the new `public/_headers`) |
| fix | **customers no longer see an unpublished (draft) menu**: they get "The next menu is coming soon" (it was leaking the draft's dishes on the live site) |
| fix | the seller banner no longer collapses with the left menu (only on scroll or ^) |
| fix | `/seller/sign-in` shows ShaggyBobo branding when the device has no kitchen |
| fix | the Orders badge counts no cancelled orders; the admin seller row's summary shows at once for a new seller |

**Decisions recorded:** D-094 (a chef may put her own dish on the current menu, draft or live). **Live plan status:** [plans/live-status.md](plans/live-status.md). **Plans index:** [plans/README.md](plans/README.md) (✅ 047–054; 045/046 are the builder's drafts).

## Deploy impact (tell the builder before deploying)
| area | impact |
|---|---|
| database | ⚠️ **one new migration, 0013_languages (add-only, plan 056)**: apply to the live D1 **before** deploying (deploying the code first breaks the kitchen settings reads until it's applied): `pnpm exec wrangler d1 migrations apply shaggybobo-order --remote`; on each PC `pnpm db:migrate:local` (never reseed) |
| secrets / settings | ⚠️ `wrangler.jsonc` gains an **AI binding** (plan 057); no new secret. The account is on the **Workers Free** plan (owner checked 2026-10-12): over the free daily allowance translations just stop, no charge possible |
| server + app together | ⚠️ deploy **both in one go** (a normal `pnpm run deploy` does): the app now understands the new "not published" state and the new add-one-dish route |
| customers | the moment it's live, an unpublished menu disappears from the customer page ("coming soon") until it's published |
| seller home-screen apps | ⚠️ low: old shortcuts keep working; installing now gives "ShaggyBobo Seller" with the bean icon (not the kitchen's name/icon) |
| WhatsApp previews | WhatsApp caches previews; a link shared before the deploy may show the old card for a while |
| chefs | ⚠️ rule change: chefs can add **their own** dish to a **live** menu; tell the team |
| signed-in people | ✅ nobody is signed out |
| beta testers with the app open | ⚠️ **this** deploy: an old home-screen app keeps the old version until it is **fully closed and reopened** (swipe it away). Tell them once. From this version on, the new-version bar (plan 059) tells them |

## First thing next session (before the commit)
1. Check plan 055 finished (its report / `docs/plans/live-status.md`), then re-run the unit tests it touched (`pnpm exec vitest run src/features/seller-menu mocks`). The rest passed (1852/1852 at 20:34). A miniflare "fetch failed" / EADDRINUSE in one file is a known flake: re-run that file alone.
2. Run the **full e2e suite** once on a quiet tree (parallel, see "Running e2e" in [guide/tech-stack.md](guide/tech-stack.md)): `NODE_EXTRA_CA_CERTS="$LOCALAPPDATA/mkcert/rootCA.pem" pnpm exec playwright test > scratch/gate-e2e.log 2>&1`. Fix only real failures; expected-URL or wording changes from tonight are spec updates.
3. Then the owner commits (message below), pushes with `--force-with-lease`, opens a PR / merges `indra/brand_logo_ux` into `main`.

**Suggested commit message** (owner's rule: no mention of Claude):
```
Link previews, seller app install, dish CSV, chef menu additions, menu step tabs, fixes

- WhatsApp link previews (small square picture, title, description); WhatsApp links via api.whatsapp.com
- Seller app installable on every seller page; "Install the app" in More and Settings
- Home-screen card for customers and sellers (browser only, Not now = 7 days)
- Dish library CSV import (preview first), export and template; matched by name and chef
- Dishes on the phone; chefs can add their own dish to the current menu (D-094)
- Edit chefs opens a modal so a typed dish is never lost
- Menu step tabs for an unpublished menu (read-only, Edit, Continue)
- Publish now or publish with ordering paused
- Languages for customers: both, English only or Indonesian only (migration 0013)
- Translate button for dish texts (Workers AI)
- Seller Help page (public, hidden address) with links from the app and the invite message
- Admin page: Last updated and Refresh (once a minute)
- Fix: customers no longer see an unpublished menu ("coming soon")
- Fix: banner no longer collapses with the left menu; ShaggyBobo on a fresh seller sign-in; badge without cancelled orders
```

## After the merge: the builder deploys
`git pull` on `main` → `pnpm install` → `pnpm db:migrate:local` → apply **0013** to the live D1 → read [guide/deploy-cloudflare.md](guide/deploy-cloudflare.md) and the latest `plans/release-*.md` → `pnpm run deploy` → check the live app.

## The owner's checks after the deploy
- Send yourself an **invite** and a **menu link** on WhatsApp: the small picture and the 👋 are right (use a fresh link).
- Android tablet: open `/seller`, then the **Install the app** row or ⋮ → Add to home screen → Install; it opens without the address bar.
- Chandra on her phone: More → **Dishes** → add a dish, tick "Also add to the current menu".
- Unpublish nothing on the live kitchen just to test; instead open the customer link of a kitchen whose menu is still a draft: "coming soon".
- Import a small CSV (Download template first) on Dapur Demo.

## Known and not done (next round unless the owner says otherwise)
- **Never lose typed data**: drafts kept on the device for every form until Save/Cancel (owner).
- **Graceful network and refusal handling**: no endless retries on 401/403; a calm offline state (owner).
- Clearer image-slot labels; the seller's own invite list with paging; keep max 50 invites per kitchen.
- 031 as a read-only "view as" for the admin; Send reminder / Download CSV on Orders; stall sales in the printed totals.
- The owner's wife's iPad: her kitchen invite shows "used" but "0 devices" on the admin page; if she can't sign in, send a **Create recovery key** (owner: "leave it for now").
- The **customer app** round (with the owner's Lottie animations).

## Ready prompt for the next session
> Read docs/HANDOVER.md and CLAUDE.md. Finish "First thing next session": check the unit result, run the full e2e suite once and fix real failures, then give me the commit message. After I merge and my son deploys, we'll start the next round (never lose typed data, graceful network handling, then the customer app). Ask me one question at a time.
