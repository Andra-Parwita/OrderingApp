# 004 · Customer app redesign and web push

**Status:** approved by the builder (2026-10-10, "A"); **done** (08:46; end-of-phase gate green but 1 stale e2e line fixed in plan 008). Owner device checks pending. Replaces the placeholder plan 002 (builder: "A", one plan for both).
**Goal:** the customer side looks and works like the design in `uxDesign/customer/`. That covers the menu home with the picture and info sheet, dishes, basket and checkout, order placed with a QR, the order page with seller updates, My orders and Settings. Customers can add it to their home screen and get **web push** for seller messages (a must before going live, D-069).

## Before you start

- **Read first:**
  - `uxDesign/customer/README.md`;
  - `uxDesign/customer/SPEC.md` (the spec);
  - `uxDesign/customer/HANDOFF-AGENT.md` (how to view the boards and compare);
  - `data/screens.json`, `data/fixtures.json` and `data/strings.json`.
  The boards (`design/*.dc.html`) are a visual reference only. Where the spec and an earlier ruling disagree, the ruling wins unless noted below.
- **Theme:** the customer tokens are identical to the seller's (`src/theme/designTokens.ts`, plan 001 stage 1). The kitchen's theme already reaches the customer pages (plan 001 stage 12).
- **Checks (D-055):** typecheck only while building; the full gate once at the end.
- **Privacy (D-007, D-059):** first name only; never a phone number, address or email, on the server or in the customer app.

## Questions to settle before building

1. **New dependencies** (CLAUDE.md: none without the owner's OK):
   - a QR code generator for the order QR;
   - a web push library that runs on Cloudflare Workers (VAPID + payload encryption). Hand-writing the encryption is a security risk, as passkeys were (D-014).
   - **Answer (builder, 2026-10-10): "A"**: approved; the builder picks small, well-maintained ones and names them, with versions, in its report.
2. **Seller messages and status:** the spec (§7) says "messages don't change order status", but D-069 Q3 says "Ready for pickup" also marks orders Ready, and the seller app already works that way. Proposed: **keep D-069** and show it on the customer side as the status moving to Ready.
   - **Answer (builder, 2026-10-10): "A"**: keep D-069. The customer sees the message and the status moving to Ready. The spec's §7 line "Messages don't change order status" is overridden for "Ready for pickup".
3. **Default home-screen icon** for kitchens without a small icon (spec §6.5, §10). Proposed: a plain icon in the app's colours, made from the app name, until the owner sends one.
   - **Answer (builder, 2026-10-10): "B"**: generate a per-kitchen default from the **kitchen's initials on its theme colour** (e.g. "OO" for Onde Onde), in every manifest size. It meets contrast (`on` over `fill`), fills the square, and is replaced by the seller's upload when there is one.
4. **Checkpoints and commits** for the builder.
   - **Answer (builder, 2026-10-10): "A"**: pause after stages **2, 4 and 7**. No commits by the coordinator; the builder commits when they like.

## Stages

| # | stage | main files | done when |
|---|---|---|---|
| 1 | **Shell, navigation and fixtures mode** | `src/app/CustomerShell.tsx`, `src/features/customer-*`, `index.html`, `src/harness/` | viewport-fit and safe-area vars (`--sat`, `--sab`); `theme-color` per kitchen (light and dark); bottom tabs Menu · My orders · Settings (active = mark + word); pages slide in from the right with ‹ Back, the wide logo centred and a large title; reduced motion respected; a dev-only **fixtures mode** `/__fixtures/{screenId}?brand=&mode=` fed by `data/fixtures.json`; a `e2e/design-compare-customer.spec.ts` like plan 001's 2b, over the `compare: true` screens |
| 2 | **Menu** | `src/features/customer-menu/` | menu home (3:1 banner whole, 3:2 picture behind a see-through info sheet, EN/ID switch, See full picture, See dishes and order); the full-picture viewer (pinch, swipe down, ✕); dishes with steppers, "N left" at 5 or fewer, sold out, the sticky basket bar; how ordering works (auto once for first-timers); the states paused, closed (date, never a weekday), not out yet, load error, kitchen not found, home without a link |
| 3 | **Basket and checkout** | `customer-menu/` (basket), `src/api/customer.ts` | basket with steppers (bin at 1), pickup or delivery segmented; pickup place page (up to 5, with times, directions, maps button); your name (first name 40, note 200 with the "no address or phone" helper); placing; inline error banner (sold out or fewer left, cut-off, paused; adjusts the basket and says so); change-order mode ("Update order", first name fixed, the last dish can't be removed) |
| 4 | **Order placed, QR and the order page** | `src/features/customer-orders/` | order placed (code card, Send on WhatsApp, the "Get a message…" card, links); QR full screen (dark on white always); the order page (pills, the 4-step progress, the ready / out / arriving / delivered banners, "I've collected my order" with one confirm, Updates from the seller, the notifications line, details, Change / Cancel with an action sheet, locked and after-cut-off texts); the earlier and archived order views; codes read out character by character |
| 5 | **My orders and Settings** | `customer-orders/`, `src/features/customer-settings/` | My orders: the "Have an order code?" field (accepts any spacing or dashes), Current and Earlier rows, the update dot, empty state, footnote. Settings: Language, Appearance (Auto · Light · Dark), Order updates switch, "Put it on your home screen" |
| 6 | **Server: push and manifests** | `migrations/`, `worker/`, `shared/` | VAPID keys (a Worker secret in production, `.dev.vars` locally); push subscriptions **per order** (never per phone or person), deleted when the order is archived; a push sent for every seller message (ready in N, ready for pickup, delivery steps, own text) and status change, in batches, dropping expired subscriptions; one **manifest per kitchen** `/k/{kitchen}/manifest.webmanifest` (name, theme colours, icons 192, 512, maskable and `apple-touch-icon` 180 from the seller's small icon or the default, `start_url` = the page being installed); tests |
| 7 | **Client: install and notifications** | `src/` (service worker, `customer-orders/`, `customer-settings/`) | service worker (push, notification click → `/o/{code}`); detection (in-app browsers by user agent, iPhone, installed by `display-mode: standalone`, push support); the flows: iPhone ask → 4 steps → open from home; inside WhatsApp (copy link / open in Chrome); Android allow; notify off → prompt (only from a tap) → on; blocked with how-to and "I turned them on"; the desktop line; on first open in an installed app, read the code from `start_url` and save it to My orders; offline: show the last loaded menu or order with "You're offline" |

## End of phase

- [ ] Full gate: typecheck · lint · format:check · test · the changed Playwright specs
- [ ] The design-compare check over the `compare: true` screens (light and dark, Onde Onde and one other theme)
- [ ] On real devices: iPhone (Safari: install, push, open from the home screen; plus once inside WhatsApp) and Android (Chrome push); the seller's message arrives as a push and on the order page
- [ ] The Indonesian copy checked by a native speaker (owner)

## Notes

- **Onde Onde icon** (builder, 2026-10-10): `imgs/OndeOndeIcon.jpg` (outside the repo, 1254 × 1254). It has rounded corners on black, which spec §6.5 forbids ("no rounded corners, no black corners: the phone rounds it"). Stage 6 crops it inward to full-bleed artwork and saves it as the sample kitchen's **small icon** at 512 × 512 in `public/samples/`. That replaces today's small `rail-icon.png` for the dev samples (D-054) and feeds the manifest icons.

- The design's phone banner file is 2:1 with blurred bands; real uploads are 3:1 (1200 × 400).
- A portrait menu picture is cropped top and bottom on menu home and shown whole in the full-picture viewer.
- `uxDesign/tokens.ts` at the top level contains an HTML board index, not TypeScript. It looks misnamed; it is not used by this plan.
- The boards need an http server; reuse a small local static server (as `uxDesign/seller/capture.mjs` does) instead of `npx serve`, which would download a package.

## Notes (progress)

- Stage 1 (shell, navigation, fixtures mode, customer design-compare): started 05:43 (builder · sonnet).
  - ✅ landed ~05:49, typecheck clean (coordinator re-checked):
    - `CustomerPage` / `PageTopBar` (‹ Back with the previous page's name, the centred logo, a large title);
    - `--sat` / `--sab` on :root; shell and tabs centred at up to 480 px; the active tab has a bar plus bold;
    - the tab bar is hidden on the basket and edit pages; a 240 ms slide on push (instant with reduced motion);
    - dev-only `/__fixtures/:screenId` (JSON copied into `src/harness/customerFixtures/`; re-copy when the drop changes);
    - `scripts/capture-customer-design.mjs`: 70 reference shots (35 screens × light and dark);
    - `e2e/design-compare-customer.spec.ts`: 35 loaded, 0 console errors.
    Deviations: existing screens are not yet in `CustomerPage` and still use env() safe areas; the fixtures page has no tab bar; only my-orders-empty maps to a real screen so far.
- Code review of the plan 001 work (`/code-review`, high, 05:49): 6 findings.
  - Correctness: auto-finish stops for every seller if one menu fails; the customer "collected" route accepts unready orders; a place message is not atomic across batches.
  - Design: contacts are keyed per order, so they are not reused for a repeat customer.
  - Efficiency: a place message reads every order.
  - Dead legacy screens are still in the tree.
  - Not fixed yet: waiting for the builder to choose.
- Stage 2 (Menu): started 05:51 (builder · sonnet). Lesson 18 was added after a sed slip briefly damaged this file at 05:49 (restored).
- **Queued by the builder (06:03):** after plan 004 stage 2 and plan 005, before Cloudflare:
  - a compliance check against the agent conventions;
  - a fresh `/code-review`;
  - a security review.
  - Stage 2 ✅ landed ~06:02, typecheck clean (coordinator re-checked):
    - menu home (glass sheet over the picture), the full-picture viewer, dishes (steppers, "N left", Sold out, the basket bar), how it works (once for first-timers), and the paused, closed, not-published and error states;
    - new routes `/:slug/dishes` and `/:slug/how-it-works`;
    - all 8 screens wired into fixtures.
    Deviations:
    - the cook name falls back to the seller name;
    - "them" instead of "her" in the copy;
    - the not-published 409 carries no kitchen, so the real screen has no banner (needs a server change);
    - the default export in FixturesPage still fails lint;
    - the Prettier check fails on the copied JSON.
    **To fix at the end gate:** customer e2e specs (the first visit now redirects to how-it-works; steppers moved to `/:slug/dishes`), seller preview specs, and AppRoutes/CustomerShell tests.
- **Checkpoint 1 (after stage 2), 06:04:** the coordinator compared menu-home and menu-dishes with the design. Dishes matches closely. Menu home matches the structure, but the 3:1 banner is drawn small inside a black band instead of filling the width (clearly off; fixed in stage 3), and the fixture page has no tab bar.
- Builder: "let's continue with the next plan" (06:08). Plan 005 and plan 004 stage 3 (basket and checkout, plus the checkpoint-1 banner fix) run as a wave of 2, started 06:08.
  - Stage 3 ✅ landed ~06:22, typecheck clean:
    - basket → pickup place → your name (three pages, tab bar hidden) and placing;
    - the inline banners name the dish that sold out or dropped and give the new total; paused and cut-off block Next with a banner;
    - change-order mode ("Update order", first name fixed);
    - the menu-home banner is full width (the fixture uses a 3:1 crop; real uploads are 3:1);
    - 5 screens wired into fixtures.
    Deviations: the edit back label is "Order"; no language switch on the checkout pages; old `basket.*` strings left unused.
    **To fix at the end gate:** `customerSlice` and saga tests (new `checkout`/`notices` state); the customer e2e specs (single-page basket gone).
    Lint debt carried: the AppRoutes harness import, the FixturesPage default export, and px in CustomerShell.
- Plan 006 (security fix: image refs) and plan 004 stage 4 (order placed, QR, order page; adds the approved QR package) run as a wave of 2, started 06:24.
- Plan 006 ✅ done 06:30 (see plan 006). Plan 007 (add-device code hardening) approved, after checkpoint 2.
  - Stage 4 ✅ landed ~06:41, typecheck clean (coordinator re-checked at 06:42):
    - order placed (code card → QR, Send on WhatsApp, the updates card, links);
    - QR page `/o/:token/qr` (lean-qr 2.7.4, dark on white, encodes the code);
    - order page: header with QR, 4-step progress, the ready / delivery banner, "I've collected my order" with one inline confirm, seller updates, the notifications line, details, Change/Cancel with the cancel sheet, locked and after-cut-off texts;
    - earlier and archived views;
    - codes read out character by character, live regions;
    - 7 screens in fixtures.
    Deviations:
    - **`CustomerOrder` has no `paid`**, so the Paid pill shows only in fixtures (add `paid` to the customer contract in stage 6);
    - the archived code comes from My orders on the phone;
    - a "‹ My orders" top bar on the order page;
    - the ready banner shows the date, not "Today until";
    - the inbox copy was shortened to the spec.
    Process slips: node and shell heredocs used for a few patches (no stray processes); prettier run over all of customer-orders (formatting only).
    **To fix at the end gate:** the customer-orders and customer-menu screen tests; e2e customer-batch1/2, order-flow, native-customer; the `src/harness/customer.tsx` placed screen.
- **Checkpoint 2 (after stage 4), 06:42:** the coordinator compared order-ready and order-qr with the design. Both match closely (banner, progress, updates, notifications line; QR card, code, details, brightness hint). The fixture page still lacks the tab bar.
- Builder: "A" (continue). Plan 007 and plan 004 stage 5 (My orders, Settings, offline basics, tab bar on fixture root screens) run as a wave of 2, started 06:45.
- Plan 007 ✅ done 06:49 (see plan 007; one trade-off open for the builder).
  - Stage 5 ✅ landed ~06:52, typecheck clean:
    - My orders (code field + Open, Current and Earlier rows, footnote, empty state);
    - Settings (Language, Appearance, an Order-updates placeholder, a home-screen placeholder);
    - offline: the last good data marked stale, with Try again (in memory only until the stage 7 service worker);
    - `CustomerTabBar` extracted and shown on fixture root screens.
    Deviations: Settings uses inline controls instead of drill-in rows; Paid still only in fixtures (stage 6); dark mode not compared.
    **To fix at the end gate:** e2e multi-seller and customer-batch2 look for "Current orders".
- Stage 6 (server: push, manifests, icons, `paid` for customers, Onde Onde sample icon): started 06:57 (builder · sonnet, alone).
  - Stage 6 ✅ landed ~07:14, typecheck clean; the coordinator re-ran the push, retention and manifest tests (33/33). The builder ran `mocks` at 361/361.
    - push library `@block65/webcrypto-web-push@2.0.0` (WebCrypto + fetch; not yet run on Workers);
    - migration 0005: `push_subscriptions` per order, max 5 per order, deleted on cancel, finish and retention;
    - routes: `POST/DELETE /api/orders/:token/push` (Origin checked), `GET /api/push/public-key`, `/k/:slug/manifest.webmanifest` and `icon-{180,192,512}.{png,svg}`;
    - sending happens after the write through `ctx.waitUntil`; 404 and 410 prune; counts-only logs;
    - `paid` reaches customers;
    - Onde Onde sample icon `public/samples/icon-512.jpg` (cropped full bleed).
    Gaps:
    - a kitchen without an upload has an **SVG-only default icon** (no PNG without a font renderer), so iOS uses a screenshot until the seller uploads one;
    - the VAPID placeholders in `.dev.vars.example` count as set (stage 7 treats them as unset);
    - `e2e/banners.spec.ts:117` still expects `rail-icon.png`.
    Process slips: two `node -e` edits and an empty heredoc (no stray processes).
    **Builder's local DB:** run `pnpm db:migrate:local`; for real push locally, run `node scripts/vapid-keys.mjs` and put the keys in `.dev.vars`.
- Stage 7 (client: service worker, install guides, notifications, manifest link, first open from the home screen, placeholder VAPID treated as unset): started 07:16 (builder · sonnet, alone).
  - Stage 7 ✅ landed ~07:37, typecheck clean (coordinator re-checked at 07:38); `pnpm build` OK with `dist/client/sw.js`:
    - `public/sw.js` (push, notification click, network-first offline for the menu, orders and shell; never seller, auth, admin or push; production only, dev with `VITE_SW=1`);
    - install flows in `src/components/install/` (iOS ask, 4 steps, open from home; inside WhatsApp; Android allow; notify off, on and blocked; desktop line);
    - Settings: a real Order-updates switch and an Install card;
    - the manifest link is set per kitchen and order; `apple-touch-icon` only with an uploaded icon;
    - placeholder or empty VAPID keys count as unset (404, then "not set up on this server").
    Deviations: install code in `src/components/install/` (feature-boundary lint); success closes the sheet instead of showing a separate notify-on screen; sheets opened from Settings use the app name.
    **To fix at the end gate:** `src/i18n/en.json` still has the app name "Weekly Menu" (it should be APP_NAME, D-052); CustomerShell and AppRoutes tests need `registerInstallI18n()`; e2e customer specs; `banners.spec.ts:117`.
- **Checkpoint 3 (after stage 7), 07:38:** all 7 stages built. Next: the end-of-phase gate, then the queued pre-Cloudflare compliance check, `/code-review` and security review.
- **End of phase: gate run 1** (07:55–08:06, `scratch/gate-plan004-1.log`): typecheck ✅; lint 7 errors; Prettier 2 files; unit 28 of 1441 failing in 9 files; e2e 15 failing across archived, seller-saturday (×2), limits, banners, customer-batch1 (×6), customer-batch2 (×2), multi-seller and native-customer; session-flow and settings green. Fixers started 08:07: U (unit, lint, format, app name; no Playwright) and E (e2e specs plus the dark and Bali compares; the only one running Playwright).
- Gate fixer U ✅ (~08:25): unit tests pass (one push test flaked on a port clash with the e2e run, passes alone); lint and format clean; the app name is "ShaggyBobo's Order" in EN and ID. **Real bug fixed:** Change/Cancel showed after Ready or out for delivery (now only Ordered or Confirmed). The fixtures route moved to `main.tsx` (layer rule). Slip: `sed -i` used.
- **D-074 (builder, 08:28):** the EN/ID switch goes only in Settings, removed from menu home and the state screens. Queued until fixer E finishes, so the e2e run isn't disturbed.
- Gate fixer E ✅ (~08:30): all 8 e2e projects green alone (auth-mobile 4+1 skip, auth-desktop 5, session-flow 1, limits 1, archived 1, settings 4, desktop 24+3 skip, mobile 11+16 skip); no app bugs; new `e2e/customerHelpers.ts`. Spec cuts: old layout checks in native-customer; the placed-page note line. The customer compare now shoots light, dark and Bali: 105/105 loaded, 0 console errors. The coordinator looked at order-ready (dark), basket (dark) and dishes (Bali); all render correctly with the right theme colours.
- D-074 fix (EN/ID switch only in Settings): started 08:31 (sonnet, alone).
- Builder: "A" (a real QR on the seller labels). Fix started 08:33 (sonnet), alongside D-074; it doesn't run Playwright. The labels use `OrderQr` (the order code, black on white).
- D-074 ✅ (EN/ID only in Settings) and labels QR ✅ (`OrderQr` at 16 mm in print).
- **✅ Final gate 08:35–08:46 (coordinator, quiet tree, 0 CRLF):** typecheck ✅ · lint ✅ · format ✅ · unit **1441/1441** · e2e alone: auth-mobile 4 (+1), auth-desktop 5, session-flow 1, limits 1, archived 1, settings 4, mobile 11 (+16), desktop 23 (+3) with **1 failure**: `seller-history.spec.ts:43` expects the old label placeholder name (stale after the labels QR); fixed inside plan 008. Plan 004 is **done**, apart from that one line and the owner's device checks. Snapshot `plan004-done.tar`.
