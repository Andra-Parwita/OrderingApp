# 004 · Customer app redesign and web push

**Status:** approved by the builder (2026-10-10, "A"); building. Replaces the placeholder plan 002 (builder: "A", one plan for both).
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
