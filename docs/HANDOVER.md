# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here.

**Last session:** 2026-10-13 → 14 (overnight), the owner's PC (Adelaide), Claude as coordinator. **Live: Release 1.0.35** (`14a4440`, Worker version `afd9eeb0-132a-438b-8ee5-6acac5535271`, deployed 14 Oct by the owner from this PC; `main` fast-forwarded and tagged `v1.0.35`). Backup `backups/shaggybobo-2026-10-14.sql` taken before migrations 0016–0023 (all applied); `MAPS_EMBED_KEY` set. Post-deploy server check ✅: pages, Help, `/api/status` (backupMinutes 5/5), OndeOnde + DellaVee menus.

## Where things stand
**Final gate (14 Oct, ~08:30), green:** typecheck ✅ · lint ✅ · format ✅ · **unit 2,199 tests** ✅ (61 failed in the big parallel run only from Windows port exhaustion — EADDRINUSE; all re-ran green, 75/75) · **e2e 81 passed, 0 failed** (`scratch/f-e2e3.log`). The e2e run found an **order-dependent failure, fixed**: the plan 046 maintenance test switched maintenance on while seller-auth ran in parallel; it now runs alone in its own `maintenance-desktop-chromium` project. The docs site is rebuilt (23 pages).

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

### In Release 1.0.35 (deployed 14 Oct)
| plan | what | deploy impact |
|---|---|---|
| 069 | **Per-chef portions and income**: one Per chef / My income button (Home, phone Orders, Past menus) opens a panel; owners see all chefs, a chef her own line when Settings → Team "Chefs can see their own income" is on (default on); helpers never. Each finished menu now **keeps its per-chef summary** (snapshot); menus finished before the deploy show "not kept" | ⚠️ **migrations 0016 + 0017** (add-only) **before** deploying (the finish fails without 0017) |
| 070 | **Branded docs site** (`pnpm run docs`, open `docs/site/index.html`; private) with sequences and UX flows; CLAUDE.md "Docs stay current" rule; architecture docs refreshed + source-layout page; product roadmap | none (dev-only `marked`, `mermaid`, D-098) |
| 071 · 1–3 | **Delivery addresses (D-099)**: guided address at checkout (Check on map, Use my location, driver notes, saved card), privacy line in the kitchen's name; encrypted, team-only, deleted a day after the menu; seller order + **Deliveries** list with Directions; all customer texts updated | ✅ **secret `ADDRESS_KEY` already set on Cloudflare by the owner (13 Oct; copy in Keeper)**; ⚠️ **migrations 0018–0023** before deploying (0022 = maintenance settings; writes fail without it) (0019 customer code, 0020/0021 address changed/seen; order reads break without them); optional **`MAPS_EMBED_KEY`** (Google Maps Embed API key, restricted to our sites) for the in-app map check |
| 074 | **Live updates everywhere**: seller Sell / Hand over / Orders / Cook update from the live connection (no timers; 1 sale = 1 request); customers get ONE live connection for their active orders (order page + My orders update instantly; a notification also refreshes open pages); backup check only while disconnected, every N min set on the admin page (customers / sellers, default 5); "Connection: live ●" line in customer Settings | ⚠️ migration 0023; deploy Worker + app together. Note for later: the customer socket passes order tokens in the URL (`?tokens=`), which can appear in request logs |
| 073 | **Fewer requests**: menu wizard ops refresh only what changed (1+7 → 1), menu badge and settings caches; Cook/Pack and the admin page next | none |
| 072 | **Tick freely, saved in one go**: menu dish ticks and prices/limits save once after a 1 s pause (and at once when leaving), "Saving… / Saved ✓ / Not saved yet · Try again" | none |
| 046 | **Maintenance notice + mode**: admin "Announce an update" bar for sellers and customers; "Maintenance on" shows "Updating, back in a few minutes" and refuses changes; optional `MAINTENANCE_TOKEN` | ⚠️ migration 0022 |
| 068 | **Two kitchens on one phone**: fixed app id per kitchen (`/<slug>`) and for the seller app (`/seller`); inside a kitchen's home-screen app the Menu tab stays with that kitchen and My orders shows its orders first, "Other kitchens (N)" folded; the home-screen card also shows on "coming soon" | none (an app once installed from an order link `/o/…` may count as a new app identity: low risk) |

## For the owner tomorrow: questions waiting (one at a time)
1. ~~063 Menu defaults~~ **Decided (owner A, 13 Oct): leave Menu defaults two-way;** the three-way choice is per menu in Details.
2. ~~060 default first language~~ **Decided (owner A, 13 Oct): the phone's language unless the seller picked one** (migration 0014 amended before it ever reached the live database).
3. ~~Dish pictures~~ **Decided (owner B, 13 Oct): after the next deploy** → [plan 067](plans/067-dish-pictures.md) (dishes have no picture today; sellers will add one per dish, customers see it).
4. ~~Invite message drafts~~ **Decided (owner A, 13 Oct): fine as is** (name and role kept; the message holds the key, so it is never stored).

## Deploy impact (tell the builder before the next deploy)
Nothing is built after 1.0.35 yet. **Next time you deploy:** back up first; announce (admin → Announce an update); switch Maintenance on before the migrations, off after the live check (plan 046 is live now).

## Next session
1. Read this file.
2. Ask the owner whether the phone checks of 1.0.35 were OK (seller Orders + Settings, customer "Connection: live ●", Check on map, admin Announce + backup settings).
3. Then the open items, **one at a time**: plan 067 (dish pictures), the cleanup list below, customer socket tokens out of the URL, Help screenshots, the customer app round (Lottie).

## Known and not done
- **State duplication found while documenting (13 Oct; see docs/architecture/state-and-data-flow.md "what looks inconsistent") — cleanup candidates, ask the owner first:** seller orders held in two slices (sellerOrders + sellerCook), so one live event triggers two fetches; the current menu copied into four slices; two `menuRequested` actions; the session in three places; several screens call the API directly instead of through a slice.
- **Plan 071 decisions (13 Oct):** addresses encrypted in the cloud, team-only, deleted a day after the menu (D-099, wording in the kitchen's name); guided address fields + Check on map + optional Use my location + driver notes; Delivery opens the form or shows the saved address card with Change; anonymous per-kitchen customer code + "Link to a saved customer?" at confirm; backup reminder only with new data; **no outside delivery: only the kitchen's team delivers** (owner, 13 Oct).
- **Found while refreshing the architecture docs (13 Oct), listed not fixed — ask the owner one at a time:** (1) the "find my order" and log limiters keep a **hash of the visitor's IP** (swept later) although D-007 / the sign-in page say "no IP stored"; (2) expired invite keys and device codes are never swept; (3) `chefMayNot` in routes.ts lists dead route names, and the old `POST /api/seller/chef-invites` is still live beside `invites`; (4) theme colours are copied in `shared/kitchenManifest.ts` (change both); (5) Playwright projects pick specs by file name (fragile); (6) `docs/plan/roadmap.md`'s folder section is out of date (see architecture/source-layout.md).
- **Dellavee is a beta tester.** Ask her for feedback after the next deploy (delivery-only basket fixed).
- Help screenshots still missing for screens that need a real signed-in session (Devices, the 6-digit code, Invite, Publish, Orders): take them from the live app.
- Clearer image-slot labels; the seller's own invite list with paging; keep max 50 invites per kitchen.
- 031 as a read-only "view as"; Send reminder / Download CSV on Orders; stall sales in the printed totals; owners pausing their own kitchen.
- The owner's wife's iPad (invite "used", 0 devices): send a recovery key if she can't sign in ("leave it for now").
- The **customer app** round (with the owner's Lottie animations).

## Ready prompt for the next session
> Read docs/HANDOVER.md and CLAUDE.md. Release 1.0.35 is live and `main` is tagged v1.0.35. Ask me first whether my phone checks were OK, then go through the open items **one at a time**: two lines on each, then one A / B question, and wait for my answer before the next.
