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

## D-050 · Chefs use their own phones and may share a kitchen tablet (2026-10-09; owner: "A and B are possible")
**Context:** a big seller such as Onde Onde has several chefs (4). After the per-role passkey fix, several people can keep passkeys on one device and pick theirs in the system prompt.
**Decision:** both are supported. Each chef can sign in on their own phone, and several chefs (and the seller) can share one kitchen tablet. On a shared device, switching person must be one step. A "Switch person" control signs out and opens the passkey picker straight away; its placement is shown as a mock-up before it is built. Every order change stays recorded under the signed-in person (D-013).
**Trade-off:** on a shared tablet anyone who can unlock it can use any passkey on it, so the audit is only as honest as people picking their own name.
**Revisit when:** a kitchen wants a PIN per chef on the shared tablet.

## D-051 · Sign-in pages show the seller's phone banner (2026-10-09; owner)
**Context:** the owner wants a nicer sign-in page with an image. Before sign-in the page doesn't know the seller.
**Decision:**
- The seller and admin sign-in pages use a split layout on tablet and desktop (image left, form right) and the image on top on a phone (mock-up approved in chat).
- The image is the **phone banner the seller uploaded** (the 1080×540 slot, D-038/D-040), taken from the last kitchen this device used. It is shown whole, never cropped (as D-038), with the seller's background colour filling the rest.
- Coordinator default, overrulable: on a device with no last kitchen, or for a seller with no phone banner, show a plain tinted panel with the app name (D-052) and no picture. The sample Onde Onde image would wrongly brand other sellers.
**Trade-off:** a shared device shows the last kitchen used, which is the right one for a kitchen tablet.
**Revisit when:** sellers want a dedicated sign-in picture.

## D-052 · The app is called "ShaggyBobo's Order"; "Delave" was only a sample seller name (2026-10-09; owner)
**Context:** the coordinator had used "Delave" as the app's name in UI strings, the passkey prompt, invite messages and docs. The owner: "there is no Delave .. Delave is just sample seller .. by default we call it ShaggyBobo's Order".
**Decision:** the app's default name is **ShaggyBobo's Order**, held in one shared constant (`APP_NAME`). It is used for the page title, the passkey prompt's site name (`RP_NAME`), invite and recovery messages, the home page and the sign-in panel without a picture. "Delave" goes from every user-visible string. Code comments and past docs are corrected when touched, not in a sweep.
**Trade-off:** passkeys already made keep showing "Delave" in Windows Hello; only new ones show the new name. They still work.
**Revisit when:** the owner picks a different name, which is a one-constant change.

## D-053 · Each developer's PC uses its own LAN IP; nothing is hard-coded (2026-10-09; owner; amends D-015)
**Ruling:** "my son will work on that IP address while I am working on this IP address, so the IP address should be per user who is running it and not hard-coded".
**Decision:** no repo file names a developer's IP. Each PC (today COVID-PC at `192.168.178.97` and ANDRAPC at `192.168.178.177`) makes its own certificate in its git-ignored `.certs/` for `localhost`, `127.0.0.1` and that PC's own LAN IP. Vite already listens on every address (`server.host: true`) and Playwright uses `localhost`, so no code changes.
**Trade-off:** each PC has its own mkcert root, so a test phone installs the `rootCA.pem` of every PC it tests against.
**Revisit when:** a PC's router reservation changes (regenerate that PC's certificate).

## D-054 · In local dev, every kitchen gets the sample pictures (2026-10-09; owner; narrows D-051)
**Ruling:** "A: Dev only" (to "ok so we can use that as default", asked: A dev only / B every seller / C keep as is).
**Decision:** with `DEV_TOOLS=1`, the sample Dapur Demo kitchen and every seller the admin creates start with the five `public/samples/` pictures (and the Onde Onde background colour), so screens never look empty while working on the UI. Without `DEV_TOOLS` (production) a new seller still starts with no pictures, as D-051 says.
**Trade-off:** in dev, the empty-picture fallback is no longer seen by default; to check it, remove a kitchen's pictures on the Pictures screen.
**Revisit when:** the owner wants generic, unbranded default pictures for real sellers.

## D-055 · Plans first; typecheck while building, the full gate at the end of a phase (2026-10-09; owner)
**Ruling:** "let's do planning first for what I want to change .. we need to have a plans folder .. and each plan will have goal and stages and we will do that after end of phase .. so we don't waste time to test everything .. typecheck is okay .. eslint, test etc. can be done later".
**Decision:** every change starts as a plan in `docs/plans/` (one file each: goal, stages, end-of-phase checklist; template in its README), approved by the owner before building. While building, only `typecheck` runs; lint, format:check, Vitest and the changed Playwright specs run once at the end of the phase. Amends the gate in CLAUDE.md and tech-stack.md, and convention §5's per-stage loop and §4's "serial stages get a cheap gate every 2nd–3rd stage".
**Trade-off:** faster stages; a lint or test failure is found later and may touch several stages' work at once.
**Revisit when:** end-of-phase gates keep turning up failures that are costly to unpick.

## D-056 · A menu can be made any time, for any cooking day; the seller home depends on whether a menu is live (2026-10-09; owner)
**Ruling:** "what the seller does can be weekly or any time they want .. is to create a menu .. this menu will be available to be picked up or delivered on any day .. usually Saturday and have a cut-off order time (customer can still send via WhatsApp if they want to order after the cut-off) and the seller will then publish it to customers .. once a menu is live .. and once the day is done .. the order is finished .. so the first page is .. past order list .. if none is live".
**Decision:** the cycle is not tied to a weekday. The seller creates a menu, sets its cooking day (usually Saturday) and cut-off, and publishes it. After the cut-off, customers can still message the seller on WhatsApp, and the seller adds the order. When the cooking day is done, that menu's orders are finished. The seller's first page is the past orders list when no menu is live. While a menu is live, the first page is that menu's order list (cut-off time, "new order"), as the app does today: owner "A" (A live order list / B a summary page / C always past orders with the live menu pinned).
**Trade-off:** the product overview and CLAUDE.md still describe a fixed "Wednesday menu, Saturday pickup" cycle; they are updated when this lands in a plan.
**Revisit when:** the seller wants two menus live at the same time.

## D-057 · Seller app: design for the tablet; the phone gets a small subset (2026-10-09; owner)
**Ruling:** "this is only seller design, not customer phone design .. and we focus on tablet .. and in phone it may only have a subset of items .. like just active order list and ability to reply or confirm order or send if arrived at destination or pickup etc".
**Decision:** the seller redesign targets the tablet (desktop shares the layout). On a phone the seller app offers only: the active order list and order detail (confirm, reply / send the WhatsApp link), hand-over (pickup, delivery, "arriving soon" and other updates), sign-in and a reduced More. The other screens are tablet/desktop only. Recorded in [seller-ux-brief.md](../design/seller-ux-brief.md).
**Trade-off:** a seller away from the tablet can't edit the menu or settings on a phone.
**Revisit when:** the seller needs a tablet-only task (e.g. mark sold out) while on the phone.

## D-058 · "Hand-over" is called Delivery / Pengiriman (2026-10-09; owner)
**Ruling:** "we call it .. delivery (pengiriman)".
**Decision:** the cooking-day area (pickup, delivery run, updates; `/seller/hand-over` in code) is named **Delivery** in English and **Pengiriman** in Indonesian in the seller UI and the designer brief. It covers both pickup and drop-off. Brief updated now; code strings change in a later plan.
**Trade-off:** the drop-off sub-screen ("Delivery run") now shares the word; it needs its own name (designer to propose).
**Revisit when:** sellers find "Delivery" confusing for pickup orders.
**Amended (2026-10-09, owner):** "pickup/delivery and serah terima is better" (to A Drop-off / B Delivery run / C designer proposes). The area is **Pickup / Delivery** (EN) / **Serah terima** (ID); its two screens are **Pickup** and **Delivery**. This replaces "Delivery / Pengiriman" above and removes the clash.
**Amended (2026-10-09, owner):** "also in phone the action is the ability to send order or confirm order, since usually WhatsApp is on the phone and not on the tablet". The phone subset also has **New order**; confirming and sending the order link (WhatsApp) must work on the phone.

## D-059 · Customer phone numbers (and delivery addresses) live on the seller's phone only (2026-10-09; owner)
**Ruling:** "A" (to: A numbers only on the phone / B don't save numbers / C copy between devices by file or QR / D encrypted sync through the server), after "how do you then share phone between phone and tablet?".
**Decision:** a customer's phone number, and the delivery address (as D-008), are saved only on the seller's phone, never on the tablet or the server. On the phone, a saved number makes "Send order link" / "Reply" open that customer's WhatsApp chat. Export / import to a file (on the phone) moves them to a new phone. The tablet never shows them. Address follows the same rule as phone (coordinator default from D-008, overrulable).
**Trade-off:** a lost phone without an export loses the contacts; a chef's phone doesn't have the owner's contacts.
**Revisit when:** more than one person needs the contacts, or the seller does WhatsApp on the tablet.

## D-060 · One menu picture per menu; a picture per dish later (2026-10-09; owner)
**Ruling:** "menu picture is per menu, that usually has multiple items of food in it .. note that .. we may need later to have ability to have image per order item .. but later".
**Decision:** each menu has one picture (usually a collage of several dishes), uploaded by the seller and shown to customers at the top of that menu. A picture per dish is a later feature, not part of plan 001.
**Trade-off:** customers can't see what a single dish looks like until per-dish pictures exist.
**Revisit when:** the owner starts the per-dish pictures plan.

## D-061 · Up to 5 saved pickup locations, each with its own time (2026-10-09; owner)
**Ruling:** "we will need to plan to have multiple pickup times, each with its own time .. up to say 5 pickup locations .. this pickup is a setting and seller can choose where, or they can add, and if more than 5, need to delete 1".
**Decision:** pickup locations are a seller setting: up to 5 saved, each with place, directions (EN + ID) and its own time window. Adding a 6th requires deleting one. Each menu picks which saved locations it uses, and customers choose one when ordering. Replaces "one pickup point for now" (D-008's limit). Planned as stage 7b of plan 001. Each location's time in Settings is the default; the seller can change it for one menu without changing the setting (owner "A": A default + per-menu change / B fixed in Settings).
**Trade-off:** more for the seller to set up once; order labels and the pickup screen must show which location each order is for.
**Revisit when:** a seller needs more than 5 locations.

## D-062 · A live menu stays editable; warn, never block (2026-10-09; owner)
**Ruling:** "even when live .. seller can still update whenever seller wants, we should not lock .. but we can show a warning if deleting a menu item that someone ordered already .. just warning. we never block".
**Decision:** the seller can add, edit and remove dishes (and use a saved set) on a live menu at any time. Deleting or replacing a dish that already has orders shows a warning the seller can confirm; it is never blocked. Today's app blocks three cases, all to change in plan 001: deleting a dish with orders ("can't be deleted, mark it sold out"), using a saved set on a published menu ("Unpublish it first"), and replacing dishes that have orders.
**Trade-off:** orders keep a snapshot of the dish as ordered (D-020), so an order stays readable after its dish is deleted; the cook list and labels must still count those orders.
**Revisit when:** a deleted dish causes confusion at cooking or pickup.

## D-063 · One menu at a time: live → done → next unpublished menu (2026-10-09; owner; extends D-056)
**Ruling:** "A" (A: one menu at a time, the next one only after the live one is done / B: the next can be prepared while one is live), after "when seller creates a new menu for the next one, it should become the 'unpublished menu' on the main screen, so they can keep updating, add / remove dishes etc., so we can only have one inactive menu, and it can only be created when the current active menu is done".
**Decision:** a seller has at most one menu at a time. The next menu can be created only when the live one is done (its cooking day is over). It starts unpublished, shows on the main screen and stays editable until published (and after, D-062). Main screen: a live menu → its order list; an unpublished menu → that menu to edit and publish; neither → past orders with a **New menu** button.
**Trade-off:** the seller can't prepare next week's menu while this week's is still live.
**Revisit when:** the seller wants to prepare the next menu before the current one is done.

## D-064 · Colour themes come from the designer; the seller picks one, and their customer pages use it too (2026-10-09; owner)
**Ruling:** "also we will generate theme colours from the UX designer .. and in seller can select their theme .. which means customer app will also use the same theme".
**Decision:** the designer delivers a small set of colour themes (each meeting WCAG AA in light and dark). The seller picks one in Settings; the seller app and that seller's customer pages (menu, basket, order) both use it. Replaces the single fixed direction (Sogan, D-025) as the only option; Sogan can be one of the themes. Planned in plan 001.
**Trade-off:** every theme must be checked for contrast on every screen, seller and customer.
**Revisit when:** a seller wants a fully custom colour beyond the designer's set.

## D-065 · No "More" page: Settings instead (2026-10-09; owner)
**Ruling:** "now you have More, which is not good" (on the indicative Settings screenshot: nav Orders · Kitchen · Pickup & delivery · Menu · Settings, with Settings sections Kitchen, Ordering & WhatsApp, Pickup locations, Menu defaults, Appearance, Chefs, Devices, Backup).
**Decision:** the seller app drops the "More" catch-all. The last nav item is **Settings**, organised in sections; switch person, language and sign out sit at the foot of the left panel; Past orders lives with Orders. The section list follows the owner's design drop (plan 001).
**Trade-off:** none known; screens move, none are removed.
**Revisit when:** the design drop says otherwise.

## D-066 · Kitchen has Cook and Pack tabs; Pack ticks each customer's bag (2026-10-09; owner)
**Ruling:** the owner's design note, kept verbatim in [uxDesign/kitchen-cook-and-pack.md](../../uxDesign/kitchen-cook-and-pack.md).
**Decision:** the Kitchen area (today's cook list) gets two tabs: **Cook** (by dish) and **Pack** (by order). Pack lists bags (name, code, place, time, progress or "Packed"), sortable by pickup time, place or code; the open bag shows its items as tick rows and the customer's note; "Packed · next bag" marks it done and opens the next, warning (never blocking, D-062) if items are unticked; "Skip for now"; header "N of M bags packed" with Print labels. Packing is new: today there is no packed state. Planned in plan 001.
**Trade-off:** a new saved state per order (packed, and which items are ticked).
**Revisit when:** the design drop changes it.
**Amended (2026-10-09, owner):** packing is separate from order status. "Packed" is its own flag on the order (next to status, paid and locked), saved with the order so every device sees it; it never changes the status and the customer never sees it. When all items are ticked the hint reads "All in. Packing doesn't change the order status; mark it ready in Pickup & delivery." Pickup & delivery shows a small "Packed" tag. The per-item ticks are saved on the server with the order too, so the owner and chefs on different devices see the same bag (owner: "save in server").
**Amended again (2026-10-09, owner):** "the seller app on a phone (smaller screen) will only show live orders, and is used to send messages to customers and also mark if it's delivered or ready to be picked up .. that's what the phone is for .. also add new order". Phone = live orders (confirm), message the customer, mark ready / delivered, new order, plus sign-in and switch person / language. Nothing else.

## D-067 · Phone seller app: same routes, adaptive by width (2026-10-09; owner; provisional)
**Ruling:** "A is okay .. but you have to see later when you receive the UX design drop" (A: same routes, adaptive / B: a separate phone route / C: decide after the design).
**Decision:** one set of seller routes; below a phone breakpoint (around 600 px, so tablets in either orientation get the full app) the app shows the phone subset (D-057), and tablet-only screens say "Open this on a tablet or computer". Provisional: re-checked against the design drop at plan 001 stage 1.
**Trade-off:** the breakpoint must separate a large phone from a small tablet; today's 1024 px switch would give an upright tablet the phone view.
**Revisit when:** the design drop arrives (stage 1), or a device lands on the wrong side of the breakpoint.

## D-068 · Pickup & delivery is about notifying the customer (2026-10-09; owner)
**Ruling:** "in reality .. the seller just needs to notify if the order is ready to be picked up, or will be delivered in say X minutes, and arrived".
**Decision:** the core of Pickup & delivery is three notifications, one tap each (per order or for a group): **ready for pickup**; **arriving in X minutes** (delivery); **arrived** (delivery). Each also moves the order's status. Other steps on today's screens (typing a code to hand over, mark collected, out for delivery) are secondary and follow the design drop. With D-062, these screens warn rather than block (today they refuse, e.g. "Mark it ready first").
**Trade-off:** less tracking of who has collected; the packed flag (D-066) and the status still show what's done.
**Revisit when:** the design drop says otherwise.
**Amended (2026-10-09, owner):** "Ready for pickup or Ready for pickup in X minutes". Pickup has two notifications: **ready for pickup** (now) and **ready for pickup in X minutes**.

## D-069 · The seller design handoff is the spec for plan 001, with the owner's answers (2026-10-10; owner)
**Ruling:** the design drop `uxDesign/seller/` (README + `docs/handoff.md`, boards, `theme/tokens.ts`) is the source of truth for the seller redesign; where a board and `handoff.md` disagree, the doc wins. The owner settled where it differed from earlier rulings or left questions open:
- **Q1 customer phone numbers: "B: Keep D-059".** Numbers (and delivery addresses) stay on the seller's phone only; the design gets a phone field on the phone order screens. Overrides the handoff's "no phone numbers stored".
- **Q2 editing a live menu: "A: Instant".** Changes reach customers as they are saved, with a Done button; no staged "Publish changes" banner.
- **Q3 Ready: "A: Message sets Ready"** (asked twice, kept). Sending "Ready for pickup" to a pickup place also marks those orders Ready; "Ready in N min" changes nothing. Overrides the handoff's "messages don't change status" for this one message.
- **Q4 collection: "B: Customer or seller".** The customer taps "I've collected it"; the seller also has a quiet "Mark collected" in the order detail (not on the pickup board); orders still open when the menu finishes close automatically.
- **Q5 menu finished: "C: Auto + early finish".** A menu finishes automatically at midnight after its cooking day; the seller can also "Finish menu now".
- **Q6 handoff open items: all three in plan 001**: a live Dishes panel on Orders (sold / limit / left, edit limit, sold out); New order on tablet as a slide-over with the phone form's fields; danger colour shifted toward orange-red under the Sumatra theme.
- **Q7 web push: "A: Separate plan".** Plan 001 shows messages on the order page as today; push comes with the customer app redesign.
**Trade-off:** plan 001 grows a server stage (menus, dish library, pickup places, packing, message log) before the screens.
**Revisit when:** the customer design changes any of these.
**Amended (2026-10-10, owner):** "but a push is very important and needs to be done". Web push is a must-have: plan 002, scheduled straight after plan 001 (not waiting for the customer redesign; its customer "Turn on updates" screen gets restyled later).

## D-070 · Plan 001 on hold on this PC; carry on from phase 4 (2026-10-10; the builder, the owner's son)
**Ruling:** "Just follow through with what is currently done rather than the plan and make note of it", then "A" (to: A keep the app as it is, no redesign, carry on from phase 4 / B build the redesign from what exists / C only the tidy-ups).
**Decision:** the seller redesign (plan 001) is **not started** on ANDRAPC. Work continues from the state at the end of phase 4: first the open low findings and doc tidy-ups (plan 003), then web push (plan 002, a must before going live per D-069). Plan 001 stays approved as written; its status says "on hold", with a note, so the owner sees it. New work still starts as a plan (D-055).
**Trade-off:** the design drop and D-056…D-069 wait; plan 002's customer screens use today's UI and get restyled later.
**Revisit when:** the owner or the builder restarts plan 001.
**Amended (2026-10-10, builder):** "B" (after learning the pull held the design, not built screens: A keep on hold / B start plan 001 right after plan 003 / C stop 003 and start 001 now). Plan 001 starts **right after plan 003**, stage by stage with checkpoints; plan 002 (web push) follows plan 001, as D-069 says.

## D-071 · One plan for the customer redesign and web push (2026-10-10; builder)
**Ruling:** "A" (to: A one plan, 004, replacing plan 002 / B the redesign first, then push / C push first on today's screens). Asked after the customer design drop `uxDesign/customer/` arrived; it draws the whole install-and-notify flow.
**Decision:** plan 004, "Customer app redesign and web push", replaces the placeholder plan 002. It is drafted for approval (D-055) and must be done before going live (D-069).
**Trade-off:** one longer plan; push can't ship ahead of the customer redesign.
**Revisit when:** going live is needed before the customer redesign is ready.

## D-072 · Plan 004 settled: two new packages, Ready keeps D-069, initials icon, checkpoints 2/4/7 (2026-10-10; builder)
**Ruling:** "A" (packages), "A" (keep D-069), "B" (initials icon), "A" (checkpoints), then "A" (approve plan 004).
**Decision:**
- A QR code generator and a Workers-compatible web push library may be added. The builder names them, with versions, in its report (approval under CLAUDE.md "no new dependency without the owner's OK").
- "Ready for pickup" keeps marking orders Ready (D-069 Q3); the customer spec's "messages don't change status" is overridden for that message.
- A kitchen without a small icon gets a generated icon: its initials on its theme colour.
- Plan 004 pauses after stages 2, 4 and 7; no coordinator commits.
- The owner's `imgs/OndeOndeIcon.jpg` becomes the sample kitchen's small icon, cropped to full bleed at 512 × 512.
**Trade-off:** two more dependencies to keep updated.
**Revisit when:** a package becomes unmaintained or adds weight beyond its use.

## D-073 · Review and security fixes; the 6-digit code lock is global (2026-10-10; builder)
**Ruling:** "A" (plan 005 for the 3 correctness findings), "Fix the security issues raised and follow through with the recommended outcomes" (plan 006), "A" (plan 007 for the two lower-scored auth points), "A" (keep the global code lock).
**Decision:**
- Plans 005–007 are done. Auto-finish isolates failures, customer collect needs Ready, and place messages are safe to retry. R2 deletes only own keys, restore drops foreign image refs, and refs reach CSS only via `cssUrl()`.
- Add-device codes lock after 5 wrong tries counted per device **and per kitchen with a live code**, which, since a wrong code has no kitchen, means all kitchens with live codes for 15 minutes.
- A code redeems once (a conditional update).
**Trade-off:** anyone can block add-device codes for 15 minutes; password and passkey sign-in are unaffected.
**Revisit when:** the lock is abused (then add a kitchen field to the code screen).

## D-074 · Customer app: the EN/ID switch lives only in Settings (2026-10-10; builder)
**Ruling:** "in customer app. the toggle of id/en should be only in setting page .. why you also have it in main page?"
**Decision:** the customer app's language switch appears only on the Settings tab. It is removed from the menu home (the photo corner) and from the menu state screens (paused, closed, not published). This overrides `uxDesign/customer/SPEC.md` §4.1 ("On the photo: EN/ID switch (top right)"). The language still defaults from the phone and is remembered.
**Trade-off:** a first-time customer who wants Indonesian has to open Settings once; the WhatsApp link already brings most in their usual language (default from the phone).
**Revisit when:** customers miss it on the menu.

## D-075 · Customer: getting a lost order back; the name remembered on the phone (2026-10-10; builder)
**Ruling:** "do C for now .. and only retries 2 .. case insensitive .. and also we always have A"; "first name should save in phone storage too".
**Decision:** (A) the WhatsApp message carries the private order link. (C) My orders can find an order by code plus first name, in one kitchen; the name ignores case; 2 wrong tries lock for 15 minutes, per IP and per kitchen-and-code; a miss never says which part was wrong. The first name is kept in the phone storage and prefills checkout.
**Trade-off:** code plus first name is weaker than the private link; the 2-try lock keeps guessing impractical, but anyone who knows both can open the order (it holds no phone or address).
**Revisit when:** abused, or once A makes C unnecessary.

## D-076 · Cloudflare: a demo kitchen for samples; Onde Onde is a real seller (2026-10-10; builder)
**Ruling:** "A then" (a separate demo kitchen); "onde-onde is my own seller to test and show off as demonstrator and really owned seller"; "get ready to deploy to cloudflare for real test".
**Decision:** `DEV_TOOLS` (reset everything, no sign-in, dev samples) is never on in production. The admin can mark a kitchen as demo; only a demo kitchen's signed-in seller can add 50 sample orders and clear them, and its customers see "Demo kitchen". Onde Onde goes to Cloudflare as a real kitchen: created by the admin, filled by Backup → Restore from the local Onde Onde; pictures uploaded on the PC are uploaded again (restore keeps only the built-in `/samples/` pictures). Plan 012 (deploy readiness) and plan 013 (demo kitchen) are approved together.
**Trade-off:** one more kitchen to keep up to date for demos.
**Revisit when:** demos need their own data set or a reset schedule.

## D-077 · The app's address is order.shaggybobo.app (2026-10-10; builder)
**Ruling:** "we do have bought domain in Cloudflare .. shaggybobo.app domain"; "b" (a sub-address, not the main domain).
**Decision:** the Worker runs on `https://order.shaggybobo.app` as a Cloudflare custom domain; `workers.dev` is off. Kitchens are `order.shaggybobo.app/<slug>`. `shaggybobo.app` itself stays free for a website.
**Trade-off:** slightly longer links than the main domain.
**Revisit when:** never lightly: moving the address means every seller, chef and admin registers new passkeys.

## D-078 · jsqr approved for camera scanning (2026-10-10; builder)
**Ruling:** "jsqr is okay".
**Decision:** plan 018 may add the `jsqr` dependency (MIT, no dependencies) as the QR decoder on iPad and iPhone Safari, loaded only when scanning starts; the built-in BarcodeDetector is used where it exists.
**Trade-off:** one more dependency to keep updated.
**Revisit when:** Safari ships BarcodeDetector.

## D-079 · Automatic app version: 1.0.<commit count> · <commit> (2026-10-10; builder)
**Ruling:** "A" (automatic version on every deploy).
**Decision:** the version is `<major>.<minor>.<git commit count>` plus the short commit id, with "· draft" for uncommitted builds. Major and minor are raised by hand in package.json for big releases. It shows in /api/health, the seller Settings and admin footers, and the customer About page (plan 020).
**Trade-off:** the build number counts commits, so two deploys of the same commit share a number (the draft tag tells uncommitted ones apart).
**Revisit when:** a CI pipeline deploys without git history.

## D-080 · Two admins share one admin account, each on their own named devices (2026-10-10; builder)
**Ruling:** "A for now" (the handover doc's "two admins" rule).
**Decision:** there stays one admin account. The owner and the builder each add their own named devices (a 6-digit code from the admin page), and either can add a device for the other, so one lost passkey never locks the platform out (plan 027).
**Trade-off:** the admin page can't show which person did something; both have the same rights.
**Revisit when:** admins get different rights or an audit of who did what is needed.

## D-081 · Chefs can scan the customer's QR and mark an order collected (2026-10-10; builder)
**Ruling:** "A" (the handover doc's roles table: Chef, "Scan QR, mark collected" = Yes).
**Decision:** owners, chefs and helpers can all hand an order over. Chefs keep what they have today; plan 028 adds helpers.
**Trade-off:** none for chefs; the handover's leftover "assumed; confirm" bullet and open question are settled by this.
**Revisit when:** a kitchen wants hand-over limited to owners and helpers.

## D-082 · Sold out: helpers any dish, chefs only their own (2026-10-10; builder)
**Ruling:** "A" (as the handover doc's roles table says).
**Decision:** owners and helpers can mark any dish sold out; a chef only the dishes assigned to them (plans 028 and 030).
**Trade-off:** a helper has a right a chef lacks; on purpose, since helpers run the stall and see what has run out.
**Revisit when:** a kitchen finds helpers marking pre-order dishes sold out by mistake.

## D-083 · A dish can be pre-ordered and sold on the day, counted apart (2026-10-10; builder)
**Ruling:** "A" (the handover doc: "Pre-order quantities shown separately from on-the-day stock").
**Decision:** each dish has a pre-order switch (with its existing portion limit) and an optional on-the-day stock. Either or both. Pre-orders never take from the day stock; the kitchen view shows the two apart (plan 029).
**Trade-off:** two numbers per dish instead of one type; the dish editor gets one more field.
**Revisit when:** kitchens want unsold pre-order portions moved into the day stock automatically.

## D-084 · Admins may open any kitchen with the owner's rights, logged (2026-10-10; builder)
**Ruling:** "A" (the owner's updated handover doc: admins see and manage any kitchen's menu and orders).
**Decision:** replaces "the admin sees no order data". An admin enters a kitchen from the admin page and works as its owner under a "Viewing as admin" banner; every admin change is logged with the admin device's name; the customer privacy note says administrators can see orders (plan 031).
**Trade-off:** two more people can see customers' first names and notes; the log and the privacy line make that visible.
**Revisit when:** more admins join, or a kitchen asks for admins to be kept out.

## D-085 · Invite keys work once, for 24 hours (2026-10-10; builder)
**Ruling:** "A" (asked while planning invite links, plan 032).
**Decision:** an invite key (admin → seller, owner → chef) lets exactly one device in, within 24 hours; then it is spent. Further devices are added with a 6-digit code from Settings → Devices. Replaces "up to 3 devices per key" (`KEY_MAX_DEVICES`).
**Trade-off:** a seller who sets up the iPad and the phone needs one code after the key; in return a forwarded invite message is useless once used.
**Revisit when:** sellers find the extra code step a burden.

## D-086 · The admin can pause a kitchen two ways (2026-10-10; builder)
**Ruling:** "A and C .. so admin can choose the kind of pause".
**Decision:** **Paused** (full): the kitchen's devices are signed out, its staff can't sign in, customers see "closed for now", no push is sent. **Closed to customers**: staff work as normal (for example to get ready), customers see "closed for now". In both, customers' existing order pages still open, nothing is deleted, and Resume restores the kitchen (plan 032).
**Trade-off:** a full pause signs everyone out, so resuming needs each person to sign in again.
**Revisit when:** a kitchen needs removing for good (a separate plan with a backup step).

## D-087 · One passkey across kitchens is for kitchen staff only; admin keeps its own passkey (2026-10-10; builder)
**Ruling:** "the admin can have its own passkey .. and seller is one that can be one .. so easier for them .. for me .. I want to have admin passkey separately".
**Decision:** when kitchens become memberships (the later sign-in rework), a person's one passkey covers all their kitchens and roles (owner, chef, helper) behind a kitchen switcher. The admin stays a separate login with its own passkey (D-080), never joined to a kitchen person. An admin who also runs kitchens has two passkeys: admin and staff.
**Trade-off:** admins pick between two passkeys on their devices; in return a stolen staff passkey never opens the admin pages.
**Revisit when:** the sign-in rework is planned (this sets its scope).

## D-088 · Today's seller and chef logins are demo only; the sign-in rework may clear them (2026-10-10; builder)
**Ruling:** "note so far all logins on seller are just demonstration. They can be revoked and cleared to allow the new login or sign-in workflow".
**Decision:** the sign-in rework (D-087) does not migrate or join existing kitchen logins. When it ships, every seller and chef account, device and session is cleared, and staff join again by invite link. Kitchens, menus, dishes, images, orders and the admin login are kept.
**Trade-off:** everyone signs in again once; in return the rework needs no "join my other login" step and no account migration.
**Revisit when:** a real seller relies on their login before the rework ships.

## D-089 · The sign-in rework comes next, before helpers and the rest (2026-10-10; builder)
**Ruling:** "A" (rework first: easier, safer, faster overall, since there is no real seller yet).
**Decision:** order: deploy 027 → plan 033 (people and memberships, one kitchen passkey, switcher, invite links; absorbs 032 stages 1–2) → 032 pause → 028 helpers → 030 chefs' dishes → 031 admin opens a kitchen → 029 selling on the day.
**Trade-off:** the next visible feature (helpers) arrives later; nothing is built twice.
**Revisit when:** a real seller needs helpers before 033 is done.

## D-090 · A kitchen person is known by a display name only (2026-10-10; builder)
**Ruling:** "A" (display name, usually prefilled from the invite; not a unique username, not an email).
**Decision:** a person's login has a display name, prefilled from the name the owner (or admin) typed on the invite and editable when joining. No email, no phone (D-007). Password sign-in is: open the kitchen's sign-in page, pick your name from its team list, type the password. Recovery is a re-invite by the owner, or the admin for owners (plan 033).
**Trade-off:** password sign-in starts from a kitchen's page rather than anywhere; passkey sign-in is unaffected.
**Revisit when:** kitchens grow beyond teams that know each other, or self-service recovery is needed.

## D-091 · A long order continues on the next label, never cut (2026-10-10; builder)
**Ruling:** "A" ("some may have many orders so be careful").
**Decision:** an order whose items don't fit one label prints on as many labels as needed, each with code, name, QR and "1 of 2"; the note goes on the last; the preview counts labels and orders (plan 035). Replaces silently hiding the overflow.
**Trade-off:** a big order's bag gets two or more stickers.
**Revisit when:** a kitchen uses bigger labels.

## D-092 · A helper is a third membership role; history labels it "chef" for now (2026-10-11; owner)
**Ruling:** "A". Plan 028, re-planned after 033: a helper is a membership role (`owner | chef | helper`), not a kind on the `chefs` table. In order history a helper's actions carry the role `chef`, with the helper's own display name.
**Trade-off:** no rebuild of the large `orders` table (its `entered_by_role` CHECK allows only seller and chef); the cost is that history says "chef" for a helper.
**Revisit when:** the owner needs to tell helpers and chefs apart in an order's history.
**Also (owner, "A"):** a helper's invite follows D-085 like every invite (one key, one device, 24 hours; more devices by 6-digit code).

## D-093 · The seller's wide banner is 3840 × 328, designed for iPad landscape (2026-10-11; owner)
**Ruling:** "A" (plan 040). The real content sits in the middle 1896 × 328, exactly what iPad landscape shows at the left menu's top height (164 px, 2× for retina); the sides are scenery that wider screens reveal; narrower screens shrink the banner rather than cut the middle. No side bands anywhere (owner: "I don't want to have ugly bg on left and right"). The left-menu logo fills its block at the same height. The phone banner stays a separate 1200 × 400.
**Trade-off:** the seller's designer draws a wider canvas with scenery on the sides; existing 5:1 banners must be re-uploaded (not deployed to real sellers yet). Replaces the 5:1 sizes of D-038 for the wide banner.
**Revisit when:** sellers mostly use another device than iPad landscape.

## D-094 · A chef may put her own dish on the current menu (2026-10-12; owner)
**Ruling:** "A" ("yes"). Amends plan 030 (chefs worked in the library only). A chef may add **her own** dish (dish chef = herself) to the current menu, whether it is still being made or already live; on a live menu customers see it at once, like a chef's edits (plan 030 ruling A). She still cannot publish, finish, change the menu's details, or add another chef's dish. The owner sees it on the menu and can remove it. Same dish names from different chefs are separate dishes (no unique name), and the CSV import matches by name + chef (plan 050).
**Trade-off:** a chef can change what customers see on a live menu without the owner; acceptable for a family team.
**Revisit when:** an owner wants to approve chef additions first.

## D-095 · Seller help is public at a hard-to-guess address (2026-10-12; owner)
**Ruling:** "A" (public) + "make the seller help URL a bit hard to remember and not easy to find" + "wave on Help only". The seller Help page (plan 058) opens without sign-in at `/help-yw4xsvh8` (one constant in `shared/`), `noindex, nofollow`, in no sitemap and linked from no customer page. Links: the left menu's **Help** under Settings, phone More, the sign-in page, the first-setup (invite key) page, and the invite message. Its mascot blinks and waves; the other pages keep their jump.
**Trade-off:** obscurity, not a lock: anyone with the link can read it. Acceptable: it holds no kitchen or personal data.
**Revisit when:** the link spreads widely (change the constant) or the help needs kitchen-specific content.

## D-096 · Languages for customers, and one language per dish is enough (2026-10-12; owner)
**Ruling:** "A". A per-kitchen setting **Languages for customers**: both (default), English only, Indonesian only (plan 056, migration 0013). With one language, customers see it with no switch and the seller types each text once (saved to both columns). With both, a dish may still be filled in one language only; the empty one shows the other's text. A **⇄ Translate** button (plan 057, Cloudflare Workers AI, 100 a day per kitchen; the account is on the Free plan, so no charge is possible) fills the other language for the seller to check.
**Ruling 13 Oct ("A", plan 060):** for "English and Indonesian", a new customer sees **the phone's own language** unless the seller actively picked **Customers see first** (Phone's language / English / Indonesian; default Phone's language). Stored as a nullable `first_language` (NULL = not chosen; migration 0014 not yet live, so amended).
**Trade-off:** machine translation can mangle food names; the seller always sees and can fix it before saving.
**Revisit when:** a kitchen wants a third language.

## D-097 · Devices opens on the phone too (2026-10-12; owner)
**Ruling:** "A". The seller's **Devices** screen (this device, other devices, **Add a device** with the 6-digit code, Sign out) is no longer tablet-only: it opens on a phone from **More → Devices**, so a seller signed in only on her phone can add her tablet herself. The code rules don't change (10 minutes, her own account only).
**Trade-off:** none found; the screen is a short list.
**Revisit when:** Devices grows controls that need a wide screen.

## D-098 · Docs site: two dev-only libraries (2026-10-13; owner)
**Ruling:** "A". Plan 070 may add `marked` (Markdown → HTML) and `mermaid` (diagrams) as **devDependencies**, used only by the docs build on the PC, never shipped in the app. The site is private (not served by the live app).
**Trade-off:** two more packages to keep updated; the alternative (hand-drawn diagrams) would drift.
**Revisit when:** the docs move to a hosted, access-controlled place.

## D-099 · Delivery addresses: encrypted in the cloud, team-only, deleted a day after the menu (2026-10-13; owner)
**Ruling:** "A" (amends D-007 for addresses only). A customer may enter a **delivery address in the app**. The server stores it **encrypted** (AES-GCM with a master key kept as a Cloudflare secret, never in the database or backups); only the **kitchen's own team** (owner, chef, helper) can read it, on the order, with **Directions / Call / WhatsApp**; it is **deleted automatically one day after the menu finishes**. If the master key is lost, undelivered addresses become unreadable and the customer simply enters the address again (or sends it on WhatsApp). Phone numbers stay out of the cloud (D-007). The seller may keep a long-term address book only on her own device (CSV backup / restore). The customer sees, in the kitchen's name (owner: "it won't be ShaggyBobo, but the seller"): "🔒 Your address is kept safe. {Kitchen} keeps it encrypted and uses it only to deliver this order and help you with it, never for advertising. Only {Kitchen}'s team can see it. It is deleted automatically one day after this menu ends. Want it removed sooner? Ask {Kitchen} on WhatsApp." (and the ID text in plan 071).
**Trade-off:** addresses exist in the cloud for a few days (encrypted); in return no copying, every team device sees them, and they survive a cleared browser.
**Revisit when:** the owner wants end-to-end encryption (the server unable to read), or longer keeping.

## D-100 · Seller app About page with release notes (2026-10-14; owner)
**Ruling:** plan 075. An **About** page in the seller app only (all roles) with the ShaggyBobo branding, the version and the releases. **No "What's new" pop-up** after an update: the notes stay on About (owner: "no, leave it in About"). **About text: the owner's approved draft (15 Oct; fun and light, "HomeMade"; plan 075).** The release list **starts from the next release** (1.0.36); earlier releases are not written up. Claude drafts each release's notes (2–4 plain lines, EN / ID) from the handover; **the owner or the builder decides what is included** before the deploy.
**Trade-off:** sellers only see changes if they open About; in return nothing interrupts their work.
**Hero (15 Oct):** the owner's own Lottie, **calm version** (one file for phone, one for tablet, 16 s loop) over the faded market scene, played with **lottie-web (light build)**, a new dependency loaded only on About; the CSS mascot is the fallback.
**Revisit when:** sellers miss changes that matter to them.

## D-101 · Times: UTC stored, the device's time shown; kitchens are in Adelaide (2026-10-15; owner)
**Ruling:** "A": the kitchens are all in Adelaide for now (the Melbourne clock in the code was a prototype assumption, never a ruling). "Save everything as UTC and device time is what we will show. Seller or admin sets 9 am, it is 9 am on their time." Each kitchen gets a time zone (default `Australia/Adelaide`) for the jobs that have no device (auto-finish, default cut-off). Plan 077.
**Trade-off:** a customer in another zone sees converted times (with a small "your time" label); in return nobody does time-zone sums in their head.
**Revisit when:** a kitchen opens outside Adelaide (then the owner picks its zone in Settings).
