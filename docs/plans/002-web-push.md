# 002 · Customer app redesign + web push

**Status:** approved by the owner (2026-10-10). Starts **after plan 001 is finished** (D-070). **Must be done before the app goes live on Cloudflare.**
**Goal:** the customer side looks and works like the design in `uxDesign/customer/`, and it's an installable web app (PWA): customers who turn on updates get a phone notification for every seller message, even with the app closed.

## Before you start (for whoever builds this)

- **Read first:** `uxDesign/customer/README.md`, then `uxDesign/customer/SPEC.md` (the spec). Boards (`design/*.dc.html`) are a visual reference only: never copy their markup. For how to open the boards and find a screen, see `uxDesign/customer/HANDOFF-AGENT.md`, but use **its viewing tips, not its checking depth** (see "How to run it").
- **Precedence:** D-070 and the rulings below > `SPEC.md` > boards > the old customer brief.
- **Plan 001 is done first.** It provides: the theme tokens and `ThemeProvider` (stage 1), the kitchen theme, pickup places, menu picture, message log, "collected" and packed flags on the server (stages 3–4), and plain customer support for these (stage 12). This plan redesigns on top of that.
- **Setup, checks and commits:** as plan 001 (Node 22, `.dev.vars`, mkcert for this PC's IP, `pnpm db:seed:local`, `pnpm dev`); **typecheck only** while building; the full gate once at the end.
- **Every label in EN and ID**: starter copy is `uxDesign/customer/data/strings.json` (Indonesian is a draft).

## How to run it (auto mode)

Same as plan 001: at the start ask the builder once where to pause for checks and whether to commit after each stage, write it here, then run stage after stage. Stop only at those checkpoints or for a truly blocking question; decide everything else and note it under "Notes".

**Speed over detail:** at each checkpoint run the design-compare check yourself, in **dark, Onde Onde brand, the default state only**, fix anything clearly off and carry on. No pixel diffs, no per-theme or light-mode passes.

## Rulings this plan relies on

| # | Ruling |
|---|---|
| D-055 | Typecheck only while building; full gate at the end. |
| D-060 | One menu picture per menu (3:2); no dish pictures. |
| D-061 | Up to 5 pickup places, each with its own time; the customer picks one. |
| D-062 | Warn, never block (here: never block ordering; install and notifications are optional). |
| D-064 | The customer pages use the seller's theme; light / dark / auto per device. |
| D-069 | Q3: "Ready for pickup" sent to a place also marks those orders Ready. Q4: the customer taps "I've collected my order" (the seller can also mark it). |
| D-070 | Q1 one plan for redesign + push · Q2 keep D-069 Q3 (only "Ready for pickup" changes status) · Q3 the drop's agent file is `HANDOFF-AGENT.md` · Q5 after plan 001 · Q6 a QR package and a Workers web-push package are approved (name them in "Notes" before installing). |
| Privacy | First name only; never a phone number, address or email on the server (the seller-phone contacts of D-059 stay on the seller's phone). |

## Stages

Do them in order. Each ends with `pnpm typecheck` passing.

| # | stage | where (main files) | done when |
|---|---|---|---|
| 1 | **Design references and compare check** | new `uxDesign/customer/capture.mjs` (adapt `uxDesign/seller/capture.mjs`: serve `design/`, capture each `.scr` frame listed in `data/screens.json` with `"compare": true`, phone chrome hidden as in `HANDOFF-AGENT.md`, dark + ondeonde); `src/harness/` fixtures pages from `data/fixtures.json` (`?harness=customer&screen=<id>`); `e2e/customer-design-compare.spec.ts` | `node uxDesign/customer/capture.mjs` writes `uxDesign/customer/captures/<id>.jpg` (ignored by git); one command shows each app screen beside its design frame in `captures/design/customer.html` |
| 2 | **Shell and navigation** | `src/app/CustomerShell.tsx`, `index.html`, a customer page-stack component | bottom tab bar Menu · My orders · Settings (update dot); pages slide in from the right with "‹ Back" + the kitchen's wide logo; cross-fade under reduced motion; `viewport-fit=cover`, safe areas via `--sat` / `--sab`; `theme-color` from the theme's `bg`; centred at max 480 px on wide screens; the seller's theme and the device's light/dark/auto |
| 3 | **Menu** | `src/features/customer-menu/` | menu-home (banner 3:1, menu picture behind a see-through sheet, or a plain background without one), full-picture viewer (pinch, swipe down, ✕), dishes page (steppers, "N left", sold out, sticky basket bar), how ordering works (auto once for first-timers); states: paused (with "See the dishes anyway"), cut-off passed (date, no weekday), not published, load error, kitchen not found, home |
| 4 | **Basket and checkout** | `src/features/customer-menu/` | basket (bin at 1, segmented pickup / delivery), **pickup place** (radio rows up to 5, time, directions, maps button), **your name** (first name, note, summary), placing; inline warning banner for sold out / fewer left / cut-off / paused; empty basket; **Change order** (same screens, edit mode) |
| 5 | **Order placed and QR** | `src/features/customer-menu/OrderPlacedScreen.tsx`, the approved QR package | order placed (code card, Send to {cook} on WhatsApp, "Get a message when your order is ready" card); full-screen QR (dark on white in every mode, code in 44 px mono) |
| 6 | **Order page, My orders, Settings** | `src/features/customer-orders/`, `src/features/customer-settings/` | order page: status pills, 4-step progress, **Ready / Out for delivery / Arriving soon / Delivered** banners, **I've collected my order** (asks once), updates from the seller, notifications line, details, Change / Cancel (cancel as an action sheet), locked and cut-off states; My orders (open by code, Current / Earlier, empty, earlier read-only, archived); Settings (language, appearance, order updates, home screen) |
| 7 | **Installable app (PWA)** | `worker/` (a per-kitchen manifest route, e.g. `/k/{kitchen}/manifest.webmanifest`), `public/` (service worker, default icon), `index.html` | one manifest per kitchen (name, theme colours, the seller's small icon at 192 / 512 / maskable + 180 apple-touch; a default icon when none is uploaded); `start_url` = the page being viewed (for an order: `/o/{code}?source=homescreen`); on first open of the installed app, the order from `start_url` is saved to My orders; the service worker shows the last loaded menu or order offline with "You're offline" |
| 8 | **Web push** | `worker/` (VAPID keys from `.dev.vars` / Cloudflare secrets, a subscriptions table + migration, sending with the approved package), the service worker, `shared/` contracts | the customer's subscription is saved **per order** (never per phone number); every seller message (pickup place messages, delivery steps, own text) and status change sends a push (title = kitchen name, body = the message, icon = the seller's icon, tap opens `/o/{code}`) and still shows on the order page; sends in batches; expired subscriptions are dropped |
| 9 | **Install and notification flows** | `src/features/customer-orders/` (or a new `customer-notify/`) | "Turn on updates" picks the right path by device (SPEC §6.1): iPhone Safari guide (ask → 4 steps → open from home screen), iPhone or Android inside WhatsApp ("open in Safari / Chrome", Copy link), Android allow, notify-off → system prompt → notify-on, notify-blocked with how-to and "I turned them on", desktop quiet line; permission asked only from a tap; Settings mirrors and can turn off |

## End of phase

- [ ] Full gate: `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test` · the Playwright specs of changed screens
- [ ] The owner tries it on a real **iPhone** (Safari → Add to Home Screen → notifications on) and a real **Android** phone (Chrome), placing an order and receiving "Ready for pickup" as a notification
- [ ] Then, and only then, the app may be deployed to Cloudflare (the owner's step)

## Notes

- **Open items from the design (SPEC §10):** provide the default home screen icon; verify the iPhone guide on iOS 26 and one older iOS; check in-app browser detection on current WhatsApp; the Indonesian copy needs a native check; a portrait menu collage gets cropped on menu home (whole in the full-picture view).
- **Packages (fill in before installing, D-070 Q6):** QR: _____ · web push: _____
