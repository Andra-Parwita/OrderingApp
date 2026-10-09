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

## D-028 · Asking: record the answer and ask the next question in the same message (2026-10-08)
**Ruling:** "It is fine as is, A" — a project exception to conventions §2 ("Record the answer, then wait for the owner's 'OK' before the next question").
**Trade-off:** fewer round trips; the coordinator records each answer and may ask the next single A/B/C question in the same message. Still one question per message, with a recommendation; the owner can stop or redirect at any time.
**Revisit when:** a recorded answer turns out to have been misunderstood because there was no confirmation step.

## D-029 · `.gitattributes` keeps LF line endings (2026-10-08)
**Ruling:** "A" (add `.gitattributes` with `* text=auto eol=lf`).
**Trade-off:** git keeps LF in the repo and writes LF on checkout on every machine, whatever `core.autocrlf` says, so Prettier's LF rule can't be broken by a git checkout or stash (it happened in stage 4.1). Cost: one committed config file.
**Revisit when:** a file type genuinely needs CRLF (e.g. a Windows `.bat`/`.cmd` script) — add an override line for it.

## D-030 · Desktop seller layout: mock up table + slide-over vs three columns; keep it simple (2026-10-08)
**Ruling:** "Can you mock up A for now for review? It shouldn't have too much information either since I don't want to overwhelm the users. We should ensure it is easy to use for people with low tech literacy", after the owner found the desktop seller layout "awkward … a lot of spacing … like a mobile display on desktop".
**Trade-off:** a real desktop layout instead of a stretched phone one, compared as two directions (A1 table + slide-over detail, A2 three columns). **Refines style principle 2 ("maximise information density") for the seller desktop:** use the width to show what matters at a glance, not more data — few columns, plain words, verbs on buttons, one obvious next action, icons always with text, nothing hidden in "…" menus for everyday tasks, large readable type and targets. Cost: one mock-up round before the build.
**Revisit when:** the owner picks a direction, or testers with low tech literacy struggle with it.

## D-031 · Desktop seller layout: A1, table + slide-over, with "Next order" (2026-10-08)
**Ruling:** "A" (A1 from [seller-desktop.html](../design/mockups/seller-desktop.html), plus a "Next order" button in the panel).
**Trade-off:** a calm desktop layout: left rail, orders as a simple table (≤ 6 columns: order, name, what they ordered, total, status, one "needs attention" flag), the order opening in a slide-over panel from the right with one big next action and the everyday actions as labelled buttons; cook list with quantities large and who-ordered names inline; a plain empty state. The row flag reads "Edited by customer" (not "Changed", which reads like a status). Cost: one open/close step per order, softened by "Next order". Phones keep the current layout.
**Revisit when:** sellers mostly process orders in long runs (then reconsider A2), or testers miss the panel's close control.

## D-032 · Collapsible seller rail: icons only, labels on hover (2026-10-08; exception to D-030)
**Ruling:** "Add the ability to have a collapsible left navigation bar, like in Microsoft DevOps", then "Just an icon with the labels on hover."
**Trade-off:** a « / » control at the bottom of the desktop rail collapses it to an icon strip (~48 px); names show as a tooltip on hover **and on keyboard focus**, and every icon keeps an accessible name for screen readers. Expanded by default; the choice is remembered per device (localStorage, try/catch). **Exception to D-030** ("icons always with a text label") for the collapsed rail only — mitigated by expanded-by-default, a clearly labelled expand control, and the current page still marked. Built after 4.6 (which owns the rail).
**Revisit when:** testers can't find their way with the collapsed rail.

## D-033 · Cook list "who ordered": equal-width chips "Name × qty" (2026-10-08)
**Ruling:** "B, but make it the same width for each chip" (owner found "in cook list, the names and order amount isn't clear").
**Trade-off:** under each item, one chip per customer reading `Rina × 2`, all chips the same width in a grid so they line up in columns; the quantity is bold and tabular; long names truncate with the full name on hover/focus as an addition. Compact and clearer than "+2"; no code or pickup/delivery in the chip (those stay in the order table). Applies to desktop and phone. Built with D-032 after 4.6.
**Revisit when:** packers need the order code or pickup/delivery next to each name.

## D-034 · Banner image slots: seller rail + seller main body, customer top (2026-10-08)
**Ruling:** "make sure on both phone and seller main body to have a banner image that I can send, so in the seller menu there would be 2 images, left menu and main menu, while in the app would be one on top. For now simply make it an empty container."
**Interpretation (coordinator, overrulable):** seller desktop gets two image slots — one at the top of the left rail (kitchen image/logo area; a small square when the rail is collapsed) and one banner across the top of the main content on every seller page; seller phone layout gets the main banner on top; customer screens keep one banner on top (already there). For now each slot is an **empty placeholder container** with a fixed aspect ratio and an accessible label ("Banner image — coming soon"); no upload, no storage yet (the banner editor and R2 images come in batch 3 / phase 5). Built after 4.7 (4.7 owns the rail).
**Revisit when:** the owner supplies the real images, or the banner editor is built.

## D-035 · Up to three seller images; the owner's banner as sample (2026-10-08; extends D-034)
**Ruling:** "in OrderingApp\imgs there is an image that we can use for the body top of seller .. I will give you the image for left menu later", and "we will be able or need to upload the image for different seller, 2 images .. and could be 3 if you need different dimension for the phone app".
**Trade-off:** each seller can have up to three images, each with its own shape: **rail image** (square, desktop left menu; image to come), **desktop banner** (wide, ~2.5:1 like the sample `OndeOnde1.png`, 1983×793), **phone banner** (shorter crop for phones, ~2:1; falls back to the desktop banner cropped with `object-fit: cover` when not uploaded). Uploading per seller comes with the banner editor (batch 3) and image storage (phase 5); for now the slots show the sample banner (a resized, compressed copy for dev only — the 3 MB original is never served) or an empty labelled placeholder. Every image needs alt text. Not committed unless the owner chooses to.
**Revisit when:** the owner provides the rail image, or the multi-seller question is ruled.

## D-036 · One app, many sellers (2026-10-08; overrides the brief's "one seller")
**Ruling:** "as I said at the beginning, this is just one app, we will allow multiple sellers with different id or key." (Earlier the owner asked for an admin who "generates keys" for sellers; the coordinator had recorded one seller per the concept brief — "One seller, 10–50 orders a week" — and should have asked.)
**Trade-off:** Delave is a single app serving many sellers (e.g. Onde Onde). Every seller-owned record (kitchen, settings, images, menu, saved sets, chefs, orders, devices, invite keys) carries a seller id; each seller is created by the admin and gets their own invite key; sellers and chefs only ever see their own seller's data; customers reach a seller through that seller's own link. Order codes stay short (unique per seller); private order links stay globally unique. Cost: a foundation stage before batch 3 (prototype mock and contracts), more isolation tests, and per-seller sign-in scope in phase 4. Free-plan limits are per account, so total volume across sellers is watched.
**Revisit when:** the number of sellers grows past what one free Cloudflare account comfortably serves.

## D-037 · Customer link per seller: a path, e.g. `/onde-onde` (2026-10-08)
**Ruling:** "A" (a path per seller on one domain).
**Trade-off:** each seller has a short, unique, URL-safe slug set by the admin (lowercase letters, digits, hyphens; reserved words such as `seller`, `admin`, `o`, `api`, `my-orders`, `samples` refused). Customer menu at `/<slug>`, basket `/<slug>/basket`; order links stay `/o/<token>` (globally unique, the order knows its seller); "My orders" stays one list across sellers on the phone. Works on one domain and the free plan with no DNS per seller; easy to share on WhatsApp. Seller screens resolve the seller from the signed-in session (phase 4); in the prototype a dev seller picker stands in. The root `/` shows a simple Delave page (not a seller's menu).
**Revisit when:** a seller wants their own domain (then add custom-domain mapping on top).

## D-038 · Seller image sizes; no cropping; background colour on wide screens (2026-10-08; refines D-035)
**Ruling:** "A" — after the owner's screenshot showed the cropped banner "does not look good", and "the target for seller is tablet landscape .. if opened in desktop we should fill the bg with some bg colour nicely"; and "why is the left menu square? if expanded it should not be square".
**Sizes the owner generates (per seller):**
| image | size | key content inside | shown |
|---|---|---|---|
| seller banner | 1600 × 320 (5:1) | middle 1200 × 280 | full width up to 1600 px, never cropped (`object-fit: contain`); wider screens fill the sides with the seller's background colour |
| phone banner | 1080 × 540 (2:1) | middle 960 × 480 | full phone width (seller phone layout + customer app) |
| rail image (expanded) | 448 × 224 (2:1) | — | 224 × 112 at the top of the left menu |
| rail icon (collapsed, optional) | 128 × 128 | — | ~40 × 40; fallback: the seller's initial in a circle in the accent colour |
| background colour | one hex per seller | — | sides of the banner on wide screens |
**Trade-off:** nothing important is ever cut off; four images to make per seller (one optional). Until the owner's new images arrive, the sample (`OndeOnde1.png`) is shown uncropped with a brown side fill, and the rail uses a crop of its logo area.
**Revisit when:** the owner's generated images arrive (swap the samples).

## D-039 · Customer app feels native: banner on top, bottom tabs Menu · My orders · Settings (2026-10-08)
**Ruling:** the owner (with a screenshot of the customer menu): "the language selection [goes] under the image and the name, so there is no need for 'My orders' on top … or have it in settings … so there should be a tab bar, since the phone app should mimic the native app UI"; then "A".
**Trade-off:** the customer app opens with the banner at the very top (nothing above it), then the kitchen name with a small EN/ID toggle beside it; a fixed bottom tab bar (icon + label, ≥ 44 px, safe-area aware) with **Menu · My orders · Settings**; My orders shows a dot (with accessible text) when an order has an unread update; **Settings** holds language, light/dark/auto theme, "Turn on updates" and the Home Screen guide. The basket bar sits above the tab bar. Pages under an order (`/o/:token…`) keep the tab bar with My orders active. Cost: one more screen (Settings) and moving the theme switch out of My orders.
**Revisit when:** testers miss the language toggle or the tab bar crowds small phones.

## D-040 · The owner's image set for Onde Onde; background image behind the wide banner (2026-10-08; refines D-038)
**Ruling:** "I added a few images, try them" — five files in `../imgs/` made to the D-038 sizes: `01_header_wide_1600x320.png` (seller banner), `02_header_standard_1080x540.png` (phone banner), `03_sidebar_expanded_448x224.png` (rail image, "Onde2" logo), `04_sidebar_collapsed_128x128.png` (rail icon), and `05_desktop_background_2560x512.png` (a soft blurred version of the scene).
**Trade-off:** the seller banner sits on the **blurred background image** (cover, behind, full width) on screens wider than the banner, instead of a flat colour; `bannerBackground` colour stays as the fallback while the image loads or if none is uploaded. So a seller has up to five images: banner, phone banner, rail image, rail icon, background. Served copies are compressed (the originals stay outside the repo and are never modified). Question 38 is superseded: the wide banner is now a true 5:1 image. Note for the owner: the phone banner has blurred bands above and below the scene, so on phones the scene itself is about 3:1.
**Revisit when:** the owner reworks any image, or another seller supplies theirs.

## D-041 · Build the native customer app (4.10) without a separate mock-up (2026-10-08; exception to the mock-up rule)
**Ruling:** "B" — build straight from the owner's annotated screenshot and D-039, skipping the mock-up step that conventions §2 requires before a UI change.
**Trade-off:** saves a round; the owner reviews the built screens instead (captures in light and dark, phone width). Risk of rework if the built layout differs from what the owner pictured — mitigated by building exactly D-039 and showing captures before moving on.
**Revisit when:** a later UI change is less precisely specified than this one (then mock up first).

## D-042 · Customer sub-pages: native-style header, no language switch (2026-10-09)
**Ruling:** "A" — basket, order page, order placed and My orders get a simple header: a back arrow where there is somewhere to go back to, plus the page title; their language switch is removed (language lives in Settings and beside the name on the menu, D-039).
**Trade-off:** consistent with native apps and less clutter; switching language from a sub-page takes one tap to Settings. Shipped with the `viewport-fit=cover` fix and removing the unused `onMyOrders` prop.
**Revisit when:** testers look for the language switch on sub-pages. **Amended same day:** "keep the language switch though" — the sub-page headers keep a compact EN/ID switch on the right (back + title + language).

## D-043 · Batch 3 plan approved, no separate mock-up round (2026-10-09)
**Ruling:** "A" (the batch 3 stage table in the [roadmap](../plan/roadmap.md#phase-3--batch-3-seller-setup-stage-table): 6.1 domain + mock → wave 6.2a menu editor ∥ 6.2b seller setup ∥ 6.2c labels + history → 6.3 shell).
**Trade-off:** three rounds; visual sources are the approved batch 3 wireframes, the owner's reference prototype and the desktop A1 style (D-031); the owner reviews built screens. Sign-in, invites and the admin page stay in batch 4.
**Revisit when:** a built screen misses the owner's intent (then mock up before the fix).

## D-044 · Closed-week orders stay readable by their link for 4 weeks (2026-10-09)
**Ruling:** first "C" (drop them from My orders), then "Nvm, do A" — the owner's final answer is **A**.
**Trade-off:** when a seller closes a week, its orders leave the seller's live list but stay **readable, read-only** through the customer's order link (`/o/<token>`, My orders) for the same 4 weeks the order details are kept (D-027 row 6): status, items, total, seller and date, with no change/cancel and a note "This week is closed". After 4 weeks the link shows "This order has been archived" with its seller and date, and My orders shows it under "Earlier" without details. Network errors never remove anything. Cost: the global token lookup must also search archived weeks (and respect retention). Built after the 6.2 wave, together with the webkit reload fix.
**Revisit when:** customers want older orders kept longer, or storage grows.

## D-045 · Batch 4 plan approved: simulated sign-in, hand-over by typed code (2026-10-09)
**Ruling:** "A" (the batch 4 stage table in the [roadmap](../plan/roadmap.md#phase-3--batch-4-sign-in-admin-saturday-stage-table): 7.1 domain + mock → wave 7.2a sign-in ∥ 7.2b admin ∥ 7.2c Saturday tools → 7.3 shell).
**Trade-off:** the whole sign-in, admin and Saturday flow is clickable now on the dev mock; the passkey step is simulated and sessions are mock-only until phase 4 (real WebAuthn, D1 sessions, rate limits); real QR codes and camera scanning wait for phase 5 and a dependency OK, so hand-over uses typed order codes.
**Revisit when:** phase 4 starts (replace the simulation), or the owner wants QR before phase 5.

## D-046 · Phase 4 plan approved, with the coordinator's plan-review changes (2026-10-09)
**Ruling:** "Let's check compliance … and check over the plan first", then "lets get started with phase 4 after that" (the UI will be reworked later).
**Plan-review changes (coordinator, overrulable):**
1. **Sessions in an HttpOnly `__Host-` cookie** (question 45 option A, as designed in seller-auth.md).
2. **Passkeys can't be tested on phones over the LAN IP:** WebAuthn refuses an IP address as the site identity. On this PC passkeys are tested on `https://localhost` (and with Playwright's virtual authenticator); phones use the password fallback until phase 5 gives a real domain (`*.workers.dev`). seller-auth.md corrected. Alternative later: a local hostname (e.g. `andrapc.local`) with a new mkcert certificate — only if the owner wants passkeys on phones before phase 5.
3. **Stage 8.1 split** into 8.1a (data model doc + schema + repository interface, behaviour-preserving) and 8.1b (D1 implementation + seed script), so the data model is reviewed before code depends on it.
4. **Durable Objects on the free plan must be SQLite-backed** (`new_sqlite_classes` migration in wrangler config); noted for 8.3.
5. Schema changes in a wave apply to every scratch database used (conventions §4).
**Trade-off:** one more round (four instead of three) for a reviewed data model; no passkeys on phones during phase 4.
**Revisit when:** the owner wants phone passkeys before phase 5 (local hostname), or prefers fewer rounds.

## D-047 · One home for business rules: the D1 repository; the in-memory store retires (2026-10-09; coordinator decision, overrulable)
**Context:** the 8.1a builder made the `Repository` interface operation-level ("place an order", "redeem a key") and kept the 1 100-line in-memory store behind it, noting that a D1 implementation would then re-implement every business rule next to the SQL, with contract tests the only guard against drift. Data model reviewed by the coordinator: accepted as written ([data-model.md](../architecture/data-model.md)).
**Decision:** 8.1b ports the business rules once into the D1 repository (atomic D1 batches per operation); the shared contract tests run against **both** implementations during the transition; in 8.4 the in-memory store is removed and unit/MSW tests run against a local D1 through wrangler's `getPlatformProxy` (wrangler is already installed — no new package), each test file on its own scratch persist directory. From 8.4 there is one implementation of the rules.
**Trade-off:** no long-lived duplicate rule set; tests get slower (local SQLite per file) and need scratch-DB discipline (conventions §6).
**Revisit when:** D1-backed unit tests prove too slow (then keep a thin in-memory adapter for pure-logic tests only).

## D-048 · Writes need a same-site Origin; tests send it, the server stays strict (2026-10-09; owner: A)
**Context:** 8.2 added an Origin check: POST/PUT/PATCH/DELETE to `/api/seller/*`, `/api/admin/*` and `/api/auth/*` without an `Origin` equal to the request's own origin get 403 `bad_origin`. Browsers always send it; Playwright's direct API calls in about six specs do not.
**Decision:** the server rule stays strict (no exception for requests without `Origin`). Playwright sends the test site's own origin as an `Origin` header on all requests (`extraHTTPHeaders` in `playwright.config.ts`).
**Trade-off:** the header also goes on any cross-origin request a spec makes (none today); a spec that needs a different origin overrides it per request.
**Revisit when:** a non-browser client (script, integration) needs to write to seller endpoints.

## D-049 · Phase 4 closing choices: dev flag, portion guard, weekly cron, query budget (2026-10-09; coordinator decision, overrulable)
**Context:** stages 8.4a and 8.4b switched the Worker to D1 and closed the 8.1b findings.
**Decision:**
- Every dev-only path sits behind one Worker var, `DEV_TOOLS === '1'`, set only in `.dev.vars`. This covers the `X-Seller`/`X-Actor` override, the live-socket slug fallback, `/api/dev/{sellers,sample-orders,reset}`, the seller picker and the sample buttons. Absent means off, which is production.
- Portion limits are re-checked inside the order's D1 batch. A guard statement fails the batch when the limit no longer fits, and the loser gets the normal `sold_out` / `exceeds_remaining` error.
- Retention runs from a weekly cron, Monday 03:00 UTC (`0 3 * * 1`). It is idempotent and logs counts only.
- Each route stays under 40 D1 round trips with 100 orders in the week; a `batch()` counts as one. That reading of the 50-per-invocation free limit is unconfirmed and gets checked on Cloudflare in phase 5.
- A new seller's first week is the coming Saturday, with the cut-off Friday 21:00 Melbourne time.
**Trade-off:** the guard relies on a deliberate SQLite error to roll the batch back, which is less obvious than a DO-serialised write but costs no extra round trip.
**Revisit when:** Cloudflare counts batch statements one by one (then split bulk routes into chunks per request), or orders arrive fast enough to need the DO to serialise them.
