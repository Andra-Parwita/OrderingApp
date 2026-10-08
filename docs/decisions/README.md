# Decisions

The owner's rulings, numbered and never silently rewritten. When a decision is overturned, amend it and link the new one.

Format for each entry:

```markdown
## D-001 · <title> (YYYY-MM-DD)
**Ruling:** "<the owner's words>"
**Trade-off:** what we gain and what we give up.
**Revisit when:** the trigger that would reopen it.
```

## D-001 · Minimum tech stack (2026-10-06)
**Ruling:** "react, typescript, redux, redux saga, vite … eslint and prettier … make sure there is cyclic import [checking]", plus unit tests and a Playwright harness, with Jest "or any modern test tool".
**Trade-off:** Vitest was chosen over Jest because it shares the Vite config and runs faster, with a Jest-compatible API. Details are in [tech-stack.md](../guide/tech-stack.md).
**Revisit when:** a required tool doesn't work with the Cloudflare Vite plugin.

## D-002 · Always HTTPS in development, with mkcert (2026-10-06)
**Ruling:** "A, go with mkcert, and optional later with C if we have cloudflare configured later" (A = always HTTPS with mkcert; C = Cloudflare tunnel).
**Trade-off:** push, Home Screen install and QR scanning work on phones every day, and dev matches production, all without leaving the LAN. The cost is a one-time root-certificate install on each test phone, The PC's IP `192.168.178.97` is reserved in the router (owner, 2026-10-06), so the certificate doesn't need regenerating.
**Revisit when:** Cloudflare is configured (then add a tunnel or preview deploy for testing away from home), or a phone can't be made to trust the certificate.

## D-003 · One project for the app and the Worker (2026-10-07)
**Ruling:** "A" (one Vite project holding the React app, the Cloudflare Worker and a `shared/` folder), after the owner noted there would be common components and styling.
**Trade-off:** one dev server and one config, the layout `@cloudflare/vite-plugin` expects, and shared UI (`src/theme`, `src/ui`, `src/components`) used directly by customer and seller screens. We give up hard package boundaries; lint import rules (no cycles, one-way layers, `src/` and `worker/` never import each other) replace them. Layout in [roadmap.md](../plan/roadmap.md#proposed-folder-structure).
**Revisit when:** a second app or deployable needs the same code, or build times hurt.

## D-004 · pnpm as the package manager (2026-10-07)
**Ruling:** "A" (pnpm, enabled through corepack after Node is installed).
**Trade-off:** faster installs, less disk, and strict dependency resolution (a package can't use a dependency it didn't declare). Costs one `corepack enable` per machine; `pnpm-lock.yaml` is committed.
**Revisit when:** a required tool (wrangler, the Cloudflare Vite plugin, Playwright) misbehaves under pnpm.

## D-005 · Prototype covers customer and seller, built bit by bit from wireframes (2026-10-07)
**Ruling:** "A, and we do it bit by bit so i can also review the UI .. or we can start with plan where early stages are wireframy".
**Trade-off:** the whole weekly cycle is clickable on both sides, and shared components are designed once. To keep each review small, the UI grows in steps: low-fidelity wireframes (layout and real content, no styling) → styled mock-ups → clickable React screens, a few screens per step, each reviewed by the owner. More review rounds, less rework.
**Revisit when:** the rounds feel too slow, or one side needs to ship first.

## D-006 · styled-components for styling; latest React (2026-10-07)
**Ruling:** "why not use styled component .. i like using styled component", then "we will use all latest version of react, and also styled component".
**Trade-off:** the owner's familiar authoring style, typed tokens through `ThemeProvider` (`DefaultTheme`), light and dark themes as two theme objects. Costs: a new dependency (approved here), runtime style generation (negligible at this size), and the library has been in maintenance mode since 2025 (fixes only). Guard rails: components read values only from `theme` (lint blocks literals in styled blocks); styled components live in `src/ui` and `src/components`, screens only compose; a unit test checks the theme's contrast pairs. Install the latest stable React and styled-components at scaffold time.
**Revisit when:** styled-components stops supporting the current React, or the runtime cost shows on a low-end phone.

## D-007 · Delivery address via WhatsApp only; no private information in the cloud (2026-10-07)
**Ruling:** "delivery address can be sent via the WhatsApp .. later we can add in cloud if needed .. but for now .. no private information in cloud".
**Trade-off:** the order only records "Delivery"; the pre-filled WhatsApp message prompts the customer to add their address, and the seller keeps it on their own device, like phone numbers. Generalised: the cloud stores only the customer's chosen first name (or nickname), the items and statuses — no address, phone, email or other private data. Cost: delivery labels and the driver's view carry no address; the driver works from the seller's own list.
**Revisit when:** the owner wants addresses on labels or the driver's screen (then weigh in-cloud storage with deletion after delivery, or device-only storage).

## D-008 · One pickup window per week; up to 5 pickup points later (2026-10-07)
**Ruling:** "we just show as a range the seller can specify as window .. in future there could be up to 5 pickup locations with different time if seller has multiple cars or kids to deliver".
**Trade-off:** now: the seller sets one pickup place and one time range for the week (e.g. "Saturday 2–5 pm"), shown on the menu, the order and the WhatsApp text; customers pick nothing. Later: up to 5 pickup points, each with its own place and time range. To avoid a migration then, the data model stores the week's pickup points as a list (one entry for now) and the UI shows only the single entry; no point-picking UI is built until asked.
**Revisit when:** the seller has a second pickup place, car or driver.

## D-009 · Unconfirmed orders stay open at the cut-off (2026-10-07)
**Ruling:** "A" (nothing happens automatically at the cut-off).
**Trade-off:** orders still "Ordered" at the cut-off stay as they are; the seller's order list flags them ("3 not confirmed") so the seller confirms or cancels each one. The seller stays in control and no order is silently dropped or confirmed; the cost is a short manual pass before cooking.
**Revisit when:** the seller regularly forgets the pass, or the weekly volume grows well past 50.

## D-010 · The seller can enter an order for a WhatsApp customer (2026-10-07)
**Ruling:** "some customers may get used to order via WhatsApp, so seller can then add it into the system and send link to the customer so they can then see the update".
**Trade-off:** keeps customers who won't use the order page; every order still lands in one list with correct cook totals. The seller enters the first name, items and pickup or delivery; the app returns the order number and the **private order link** (the long random token), which the seller sends by WhatsApp (a "Send link on WhatsApp" button with pre-filled text). Opening the link saves the order in the customer's "My orders" and offers "Turn on updates", exactly like a self-placed order. Defaults (overrule if wrong): the order is marked "entered by seller"; it starts as Confirmed (the seller already agreed to it); the customer can change or cancel it until the cut-off like any order; nothing private is stored (D-007).
**Revisit when:** most orders arrive this way (then simplify the seller's entry form further).

## D-011 · Sign-in: passkeys, with a password fallback for the seller; admin role (2026-10-07)
**Ruling:** "let's start with A, for me developer is okay to use passkey, for seller we ask them to use passkey, otherwise fallback to password .. but we need to give them easy instruction how to install passkey", after asking for a super-admin (developer) login to generate seller keys without running scripts or Claude.
**Trade-off:**
- **Admin (the owner):** passkey only. Bootstrapped once with the `ADMIN_SETUP_KEY` Cloudflare secret at `/admin/setup`; then creates seller invite keys, manages seller devices and issues recovery keys from the admin page.
- **Seller:** a one-time invite key, then a **passkey by default**. If the device can't make one, the seller sets a **password** instead (hashed with PBKDF2 via WebCrypto, rate-limited, minimum length). Both stay signed in 30 days, renewed on use; extra devices via "Add a device".
- **Easy passkey instructions:** a short bilingual help screen at setup, picked for the device (iPhone, Android, Windows/Mac): check there's a screen lock, tap "Create passkey", confirm with Face ID / fingerprint / PIN. Shown before falling back to the password.
- Cost: two seller sign-in methods to build and test (passkey and password). Note: the owner said "A" but described the password fallback (option B's shape for the seller); recorded as described.
**Revisit when:** a seller can't use either method, or the password fallback is never used (then drop it).

## D-012 · Menu items can have a chef; orders group by chef (2026-10-07)
**Ruling:** "add ability to group the order item with 'chefName', sometimes the seller has multiple chefs that provide different orders".
**Trade-off:** each menu item gets an optional **chef**, picked from a short list of chefs the seller manages (a list, not free text, so a typo can't split one chef into two groups). One item has one chef. The seller's cook totals and order items can be grouped by chef, so each chef gets their own "what to cook" list; saved menu sets keep the chef. Items with no chef group under the seller. Only a chef's display name is stored (no contact details, D-007). Cost: one more field and a chefs list to manage. **Visibility (owner, same day):** "the chef grouping does not need to be shown in the customer app, this is simply for seller view only". Chef names appear only on seller screens (cook totals, order list); never on customer screens, the WhatsApp post or the printed labels (labels go to customers).
**Revisit when:** chefs need their own sign-in or their own share of the takings.

## D-013 · Chefs can sign in (2026-10-07, scope pending)
**Ruling:** "seller has chefs .. it's possible for each chef to also login and see their order or maybe others as read-only .. but chef can also add order".
**Trade-off:** a third role, **chef**, linked to an entry in the seller's chefs list (D-012). Invited by the seller (or the admin) with a one-time key, same sign-in as the seller (passkey, password fallback, D-011). Can add orders the way the seller does for WhatsApp customers (D-010), marked "entered by <chef>". Cost: a third role in every permission check and in tests. **Scope (owner, same day):** "C, as long as we have a bit of audit on who last changed it .. or who changed, up to 4 changes". A chef is a **near-full helper**: same as the seller (orders, statuses, Saturday hand-over, adding orders) except the menu, the chefs list and inviting people. **Audit:** each order keeps its **last 4 changes** (who: display name and role; what: e.g. "Ready → Collected", "items changed"; when), shown on the order in the seller and chef views and deleted with the order. Owner: "just simple update audit": no conflict handling; if two people change the same order, the last save wins and the audit shows who did what.
**Revisit when:** chefs need separate menus or separate pickup points.

## D-014 · Approve the SimpleWebAuthn packages (2026-10-07)
**Ruling:** "A" (add `@simplewebauthn/server` and `@simplewebauthn/browser`, latest stable).
**Trade-off:** well-maintained passkey (WebAuthn) registration and verification that runs on Cloudflare Workers, instead of hand-written security-sensitive checks. Cost: two dependencies to keep updated. Installed in phase 4 (local backend), not before.
**Revisit when:** the packages stop supporting Workers or go unmaintained.

## D-015 · Develop on ANDRAPC (2026-10-07; amends D-002)
**Ruling:** "A" (develop on this PC, ANDRAPC, not COVID-PC).
**Trade-off:** D-002 still holds (always HTTPS with mkcert), but the certificate is issued on ANDRAPC for `localhost`, `127.0.0.1` and **`192.168.178.177`**, which the owner reserves for ANDRAPC in the router. One-time owner setup on ANDRAPC: Node LTS, pnpm (amends D-004's "via corepack": installed with winget, as `corepack enable` needs an admin shell on Windows), mkcert and `mkcert -install`. Each test phone installs ANDRAPC's `rootCA.pem` once.
**Revisit when:** development moves to another PC (new certificate, new reserved address).

## D-016 · Approve 7 helper dev packages; ask for every future one (2026-10-07)
**Ruling:** "B" (approve `@vitejs/plugin-react`, `@testing-library/dom`, `@eslint/js`, `globals`, `@types/react`, `@types/react-dom`, `@types/node`, and ask before every future helper package too).
**Trade-off:** phase 1 stands as built. No package is ever added silently, not even a type or peer package; every builder brief says so, and a builder that needs one stops and reports. Costs an extra question when tooling needs a companion package.
**Revisit when:** the questions become noise (then pre-approve a class such as `@types/*`).

## D-017 · Wireframe batches; the seller can customise the header banner (2026-10-07)
**Ruling:** "A" (wireframe batch 1 = the core loop: customer menu → basket and checkout → order placed; seller order list → order detail), plus "one thing to add is the ability to customise the image headers/banners for the seller".
**Trade-off:** the customer pages open with the seller's own banner: an image (stored in R2, resized and compressed on upload like menu images) and the kitchen name, with an optional short tagline in EN / ID. Defaults (overrule if wrong): one banner for the seller, kept week to week and changeable any time in the seller's settings; if none is set, a plain header with the kitchen name. The banner slot appears in batch 1 wireframes; the banner editor is in batch 3 (seller setup). Cost: one more image in storage and one more settings screen.
**Revisit when:** the seller wants a different banner each week or per menu set.

## D-018 · Order notes (dietary requirements) (2026-10-07)
**Ruling:** "B, but there should be a way to view notes or dietary requirements. E.g. the customer can add a note during checkout and the seller can view the note in the order detail. On the order screen, maybe add an asterisk or notifier if there is a note on an order."
**Trade-off:** an optional **note** on each order (max 200 characters), written by the customer at checkout (editable until the cut-off) or by the seller/chef when entering an order; shown in the order detail, and flagged in the seller's order list with a "Note" marker (icon + text, not an asterisk alone, so it isn't colour- or symbol-only). **Tension with D-007** (no private information in the cloud): a dietary note can be health-related and people may type an address or phone into any free-text box. Mitigation: helper text "Allergies or requests. Don't add your address or phone — send those on WhatsApp"; the note is deleted with the order; it never appears on labels or the WhatsApp group post.
**Tension settled (owner, same day):** "The cloud should be fine as long as it prompts them to not put any sensitive data." Notes stay in the cloud; the helper text prompting not to add sensitive data is required wherever a note is written (customer checkout, seller/chef order entry).
**Revisit when:** notes start carrying private details regularly (then move notes to WhatsApp only). **Amended by D-027:** notes do appear on labels (≤ 70 chars) as a packing/allergy aid.

## D-019 · Seller can preview the menu as customers see it before publishing (2026-10-07)
**Ruling:** "B, a menu to preview the menu in customer view before publishing it as a seller" (batch 3 approved with this change).
**Trade-off:** a "Preview as customer" action on the seller's menu (S6) opens the real customer menu screen (banner, week, items, EN/ID switch) filled with the draft, under a fixed seller bar "Preview · not published yet" with "Back to editing" and "Publish". Nothing can be ordered from the preview. Reuses the customer screen, so the cost is small.
**Revisit when:** the seller wants to share a preview link with someone else before publishing.

## D-020 · Editing items after orders exist: orders keep a snapshot (2026-10-07)
**Ruling:** "A" (existing orders keep what was ordered).
**Trade-off:** each order line stores a copy of the item's names (EN/ID), size and price at the time it was placed; edits to the menu only affect new orders. An item that has orders can't be deleted: the seller marks it Sold out, which stops new orders. Totals never change behind a customer's back and the cook list stays correct. Cost: order lines duplicate a few item fields.
**Revisit when:** the seller needs to correct a price on existing orders (then add an explicit "apply to existing orders" action that notifies customers).

## D-021 · Prototype data: a temporary mock API in the dev Worker (2026-10-07)
**Ruling:** "A" (mock API inside the dev server's Worker; MSW stays for tests).
**Trade-off:** orders live in the Worker's memory during the prototype (lost on restart), so an order placed on a phone over Wi-Fi shows up on the seller screen on the PC, and the app uses the same fetch path it will use against D1 in phase 4. The mock lives in `worker/mock/` behind the same typed contracts in `shared/`, and phase 4 replaces it with D1-backed routes. Cost: a throwaway in-memory store; dev-only "add sample orders" and "reset" endpoints that must never ship (guarded by a dev-only flag).
**Revisit when:** phase 4 starts (the mock is deleted).

## D-022 · react-router for navigation (2026-10-07)
**Ruling:** "A" (react-router, latest stable, library mode).
**Trade-off:** standard, typed routing for ~25 screens and deep links (`/o/<token>`, `/seller/...`, `/admin/...`), with correct back-button and URL behaviour; the URL owns what should survive a reload. Cost: one runtime dependency. Installed in stage 3.5 (routing and shell).
**Revisit when:** a react-router major release forces a rewrite of the route setup.

## D-023 · Visual direction: Sage (2026-10-07)
**Ruling:** "A, Sage" (the current theme tokens: warm grey neutrals with a muted sage-green accent), over the recommended B, Clay.
**Trade-off:** no palette change; the theme in `src/theme/themes.ts` stays as built. The status-pill tints proposed on the directions page (Ordered amber, Confirmed slate, Ready green, Cancelled clay, Done/Sold out grey, light and dark) are added as theme tokens in stage 3.1. Known risk: the accent and the Ready status are both green; mitigation: status pills always carry their text, the accent is used only on the primary action, the selected item and focus, and the Ready tint stays a light tint, never a solid fill.
**Revisit when:** testers confuse a Ready pill with a button. **Amended by [D-025](#d-025--visual-direction-changed-to-sogan-2026-10-07-amends-d-023):** the owner switched to Sogan.

## D-024 · After the cut-off, only customers are locked out (2026-10-07)
**Ruling:** "A" (seller and chefs keep full control after the cut-off).
**Trade-off:** after the cut-off customers can't create, change or cancel orders; the seller and chefs can still change statuses, set Paid, and enter or edit orders (e.g. a late WhatsApp order from a friend). Matches D-009 (the seller stays in control). Cost: the cook list can still move after the cut-off, so the seller re-checks it before shopping.
**Revisit when:** late changes cause cooking mistakes (then add a "freeze cook list" switch).

## D-025 · Visual direction changed to Sogan (2026-10-07; amends D-023)
**Ruling:** "B, maybe change the theme to clay or a more traditional indonesian-like theme", then "C please" (C = Sogan, inspired by Javanese sogan batik: cream/ivory surfaces, deep soga brown and ochre, a sparing indigo or deep-green secondary).
**Trade-off:** a warmer, heritage feel that fits an Indonesian home kitchen, and the accent (brown) no longer shares a hue with the green Ready status, which removes D-023's known risk. Cost: one theme swap (token values only; screens read tokens) plus re-checking contrast and re-capturing screens. **Pending:** whether to use the optional faint batik motif in the customer banner.
**Revisit when:** testers find it too dark or too brown on phones. **Amended by D-027:** the palette is now the owner's reference-prototype palette (same Sogan family).

## D-026 · No batik motif in the banner (2026-10-07)
**Ruling:** "C" (no motif; plain colours only), "then continue with batch 2. Refer to this artefact: https://claude.ai/artifact/Y65hpEgWgVcKHy9wsyaKQ3".
**Trade-off:** the most minimal look; the banner shows the seller's image or a plain surface. **Note:** the referenced artifact (the owner's own "Delave weekly orders" prototype) uses a kawung strip; that conflict is raised with the owner before anything is built.
**Revisit when:** the owner rules on the artifact's visual details.

## D-027 · Reconcile with the owner's reference prototype: accept all recommendations (2026-10-07)
**Ruling:** "A" (accept every recommendation in [reference-reconciliation.md](../plan/reference-reconciliation.md)), after the owner pointed to their "Delave weekly orders" artifact ([extraction](../design/reference/delave-prototype-extract.md)).
**What changes:**
1. Sign-in stays passkeys (D-011); adopt device names, 3 devices per invite key, a 6-digit add-device code valid 10 min, and 5 failed tries → 15-min lockout. No PIN.
2. Labels show the order note (≤ 70 chars, truncated) — **amends D-018**.
3. Colours: the artifact's palette replaces round-2 Sogan — **amends D-025** (Sogan family kept). Coordinator's AA check found three gaps, fixed by adding tokens rather than changing the look: light sage as text (4.0–4.3:1) gets a darker text shade; gold is never used as text on light surfaces (2.7–3.2:1), only as small fills/bars; input borders get an `outline` token ≥ 3:1 (the artifact's `--line` is 1.35:1, fine for hairlines only).
4. System font for now; self-hosting Plus Jakarta Sans needs a later OK.
5. No kawung strip (D-026 stands).
6. Order details are deleted after 4 weeks; weekly totals (orders, income, item totals) are kept for the past-weeks view; export to JSON/CSV and import backup.
7. Change tracking: last-4 audit (D-013) plus a "Changed" badge and a short diff in the audit entry.
8. Seller-entered orders: "Confirm now" (ticked by default) and "Mark paid" checkboxes — refines D-010.
9. Cut-off: ordering closes automatically at the cut-off, with a manual Open/Closed switch; sample cut-off Fri 9 pm — refines D-024.
10. "N left" shows only when 5 or fewer remain.
11. Sample kitchen name is "Delave".
**New features adopted** (placement per the reconciliation): lock order; the seller's own WhatsApp number in settings; "How ordering works"; returning customer / WhatsApp received / Nudge; order and income totals; cook-list grouping by item / customer / pickup-delivery merged with chef; light/dark/auto switch; desktop seller rail + list/detail split (batch 2); paste-a-WhatsApp-post parser, past weeks, backup/CSV (batch 3); send an update to many customers (batch 4).
**Trade-off:** the app converges on the owner's own design; batch 2 grows. **Revisit when:** a batch gets too big to review (then split it).
