# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here.

**Last session:** 2026-10-12, late evening into the night, the owner's PC (Adelaide), with Claude as coordinator. The owner went to sleep at about 23:00 and asked: "do this automated and tested, then commit and push; I will check tomorrow". Branch `indra/brand_logo_ux`. `main` = **Release 1.0.30** (`0ad9830`, plans 047–059, deployed by the builder on 12 Oct). **Everything below is now live as Release 1.0.34** (deployed by the owner from this PC on 13 Oct, 07:40, after a database backup to `backups/` and migrations 0014 + 0015; `main` fast-forwarded to `709a377` and tagged **v1.0.34**).

## Where things stand
**Final gate (13 Oct, 06:36), all green:** typecheck ✅ · lint ✅ · format ✅ · **unit: all pass** (172+ files; the full run had 9 load-only timeouts that pass alone, and 2 tests still assuming 10 dishes, fixed) · **e2e 76 passed, 0 failed** (`scratch/n-e2e5.log`; 28 skipped = captures and opt-ins). The e2e runs found **one real bug, fixed**: after Save, Settings → Kitchen kept the typed WhatsApp number instead of the saved one (a plan 061 draft re-written by the form's unmount flush). Two specs updated (a chef lands on `/seller/orders`; the banner scroll check waits for the list). One overnight run hung for 6 hours in `design-compare-customer` while the PC slept; it passes alone and in the final run.

### Built after 1.0.30 (this branch)
| plan | what | deploy impact |
|---|---|---|
| 060 | **The language customers see first**: Settings → Kitchen, under "English and Indonesian", "Customers see first"; once a customer switches, their own choice is remembered (`langChosen`) and the seller app's language on the same device is untouched | ⚠️ **migration 0014** |
| 061 | **Never lose typed data**: a draft on the device for the dish editor (with "Close and keep draft"), the new chef's name, the menu wizard's note and place, Settings (kitchen, ordering rules, WhatsApp post, pickup places), the seller's New order (device only), invites (name, role; never the key or link), and the **customer basket and checkout**; "Restored what you typed · Discard"; 7-day expiry; "Keep my version / Use the saved version" when the server changed meanwhile | none |
| 062 | **Calm network errors**: loading retried 3 times (1/3/9 s) only for network errors, 5xx and 429; **saves never retried** (owner A); live refresh backs off and **stops after 5 refusals** (owner A) with "Can't reach the kitchen right now · Try again"; reconnect capped at 8; one offline banner (stacks under the update bar); the customer order page pauses while hidden; 403 says "You are not allowed to do this" | none |
| 063 | **Pickup · Delivery · Both**: one clear choice at the top of the menu's Details step; only the matching settings show; switching to Delivery with places ticked asks first; Check says "Pickup only / Delivery only / Pickup or delivery"; **the customer basket offers only what the menu offers** (Dellavee's live bug) and the **server refuses** anything else from customers (`fulfilment_unavailable`) | none |
| 064 | **Pictures of the last 10 menus are kept** (rolling): Past menus show their picture; "Start from" a past menu copies it; the picture slot has "Use a past menu's picture"; files are deleted only when nothing uses them | ⚠️ **migration 0015** |
| 065 | **My orders** remembers the last kitchen (its banner after a reload) and shows each order's **kitchen pill** between code and total | none |
| 066 | **Up to 50 dishes per menu** (portions per dish per order stay 99; dish stock up to 10,000). Fixed a real bug on the way: a 50-line order hit D1's 100-variable limit (`portionGuard` now uses `json_each`). Every route stays at ≤ 7 database round trips. Print totals fit; the WhatsApp post lists dishes up to 3,000 characters, then "+ N more on the menu" | none; **publish 11+ dishes only a day after the deploy** (an app that hasn't refreshed still refuses more than 10) |
| D-097 | **Devices opens on the phone** (More → Devices), so a phone-only seller (Chandra) can add her tablet herself | none |
| Help | two tabs, **Seller help** (12 topics, incl. new "Phone or tablet?" and a rewritten "Make and publish a menu" with pickup places first) and **Customer help** (a 7-question FAQ: ordering, lost order, updates, home screen, odd app, languages, orders from other kitchens) | none |
| — | customer **Settings** shows the kitchen banner on top | none |

**Decisions recorded:** D-095 (Help public at a hidden address), D-096 (languages; one language per dish is enough), D-097 (Devices on the phone). **Live plan status:** [plans/live-status.md](plans/live-status.md). **Plans index:** [plans/README.md](plans/README.md).

### Built after 1.0.34 (this branch, not deployed)
| plan | what | deploy impact |
|---|---|---|
| 069 | **Per-chef portions and income**: one Per chef / My income button (Home, phone Orders, Past menus) opens a panel; owners see all chefs, a chef her own line when Settings → Team "Chefs can see their own income" is on (default on); helpers never. Each finished menu now **keeps its per-chef summary** (snapshot); menus finished before the deploy show "not kept" | ⚠️ **migrations 0016 + 0017** (add-only) **before** deploying (the finish fails without 0017) |
| 070 | **Branded docs site** (`pnpm run docs`, open `docs/site/index.html`; private) with sequences and UX flows; CLAUDE.md "Docs stay current" rule; architecture docs refreshed + source-layout page; product roadmap | none (dev-only `marked`, `mermaid`, D-098) |
| 071 · 1–3 | **Delivery addresses (D-099)**: guided address at checkout (Check on map, Use my location, driver notes, saved card), privacy line in the kitchen's name; encrypted, team-only, deleted a day after the menu; seller order + **Deliveries** list with Directions; all customer texts updated | ✅ **secret `ADDRESS_KEY` already set on Cloudflare by the owner (13 Oct; copy in Keeper)**; ⚠️ **migration 0018** before deploying; optional **`MAPS_EMBED_KEY`** (Google Maps Embed API key, restricted to our sites) for the in-app map check |
| 068 | **Two kitchens on one phone**: fixed app id per kitchen (`/<slug>`) and for the seller app (`/seller`); inside a kitchen's home-screen app the Menu tab stays with that kitchen and My orders shows its orders first, "Other kitchens (N)" folded; the home-screen card also shows on "coming soon" | none (an app once installed from an order link `/o/…` may count as a new app identity: low risk) |

## For the owner tomorrow: questions waiting (one at a time)
1. ~~063 Menu defaults~~ **Decided (owner A, 13 Oct): leave Menu defaults two-way;** the three-way choice is per menu in Details.
2. ~~060 default first language~~ **Decided (owner A, 13 Oct): the phone's language unless the seller picked one** (migration 0014 amended before it ever reached the live database).
3. ~~Dish pictures~~ **Decided (owner B, 13 Oct): after the next deploy** → [plan 067](plans/067-dish-pictures.md) (dishes have no picture today; sellers will add one per dish, customers see it).
4. ~~Invite message drafts~~ **Decided (owner A, 13 Oct): fine as is** (name and role kept; the message holds the key, so it is never stored).

## Deploy impact (tell the builder before the next deploy)
| area | impact |
|---|---|
| database | ⚠️ **two new migrations, both add-only: 0014_first_language, 0015_past_menu_pictures.** Apply to the live D1 **before** deploying: `pnpm exec wrangler d1 migrations apply shaggybobo-order --remote`. On each PC `pnpm db:migrate:local` (never reseed). Deploying the code first breaks the kitchen settings reads and the menu finish until they are applied |
| secrets / settings | ✅ nothing new |
| beta testers | ✅ the new-version bar (plan 059, live since 1.0.30) tells them to Refresh; no "close and reopen" message needed this time |
| 50 dishes | publish a menu with more than 10 dishes only a day after the deploy |
| signed-in people | ✅ nobody is signed out |

**After deploying, check:** Dellavee's basket offers delivery only; a translation still works (⇄); a menu finish keeps its picture in Past menus.

## Next session
1. Read this file. Check the gate line above.
2. Go through "Questions waiting" **one at a time** (owner rule).
3. When the owner is happy: merge `indra/brand_logo_ux` into `main` (a normal push now, no force), and the builder deploys (migrations 0014 + 0015 first).

## Known and not done
- **Plan 071 decisions (13 Oct):** addresses encrypted in the cloud, team-only, deleted a day after the menu (D-099, wording in the kitchen's name); guided address fields + Check on map + optional Use my location + driver notes; Delivery opens the form or shows the saved address card with Change; anonymous per-kitchen customer code + "Link to a saved customer?" at confirm; backup reminder only with new data; **no outside delivery: only the kitchen's team delivers** (owner, 13 Oct).
- **Found while refreshing the architecture docs (13 Oct), listed not fixed — ask the owner one at a time:** (1) the "find my order" and log limiters keep a **hash of the visitor's IP** (swept later) although D-007 / the sign-in page say "no IP stored"; (2) expired invite keys and device codes are never swept; (3) `chefMayNot` in routes.ts lists dead route names, and the old `POST /api/seller/chef-invites` is still live beside `invites`; (4) theme colours are copied in `shared/kitchenManifest.ts` (change both); (5) Playwright projects pick specs by file name (fragile); (6) `docs/plan/roadmap.md`'s folder section is out of date (see architecture/source-layout.md).
- **Dellavee is a beta tester.** Ask her for feedback after the next deploy (delivery-only basket fixed).
- Help screenshots still missing for screens that need a real signed-in session (Devices, the 6-digit code, Invite, Publish, Orders): take them from the live app.
- Clearer image-slot labels; the seller's own invite list with paging; keep max 50 invites per kitchen.
- 031 as a read-only "view as"; Send reminder / Download CSV on Orders; stall sales in the printed totals; owners pausing their own kitchen.
- The owner's wife's iPad (invite "used", 0 devices): send a recovery key if she can't sign in ("leave it for now").
- The **customer app** round (with the owner's Lottie animations).

## Ready prompt for the next session
> Read docs/HANDOVER.md and CLAUDE.md. Overnight work (plans 060–066, D-097, Help tabs) is pushed on indra/brand_logo_ux, not deployed. Tell me the gate result, then go through "Questions waiting" **one at a time**: two lines on each, then one A / B question, and wait for my answer before the next. Never several questions in one message.
