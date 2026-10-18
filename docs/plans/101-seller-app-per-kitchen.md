# 101 · One seller app per kitchen on the home screen

**Status:** mock-up + analysis, owner "A" 18 Oct, target 1.0.42 if small (see stage 0: only if the spike passes). Not approved for building.
**Owner, 18 Oct:** Onde Onde's chefs see "Seller" with the ShaggyBobo logo. A person in Dellavee and Onde Onde has one seller icon and must use the kitchen switcher. Ruling "A": **one seller app per kitchen** on the home screen, like the customer apps (plan 068).
**Mock-up:** `uxDesign/seller/mockups/101-seller-app-per-kitchen.html` (Android and iPhone home screens, 3 naming/badge options, the install row, the one-time move notice, the four launch states; EN / ID toggle).

## Goal
Each kitchen can be installed as its own seller app: its own icon and name, and opening it always shows **that** kitchen. The old "Seller" app (id `/seller`) keeps working.

## What exists (read first)
- The per-kitchen seller manifest **already exists**: `GET /k/<slug>/seller.webmanifest` (`worker/api/kitchenRoutes.ts:86,111-125`), built by `buildManifest({ seller: true })` (`shared/kitchenManifest.ts:104-134`) with name `"<kitchen> · Seller"`, id/start_url/scope all `/seller`, the kitchen's icons. Plan 011 stage 4 added it; plan 048 then stopped linking it: "the Worker cannot know the kitchen from a `/seller/*` URL, and the per-kitchen seller manifest was not installable on Android Chrome" (`worker/api/kitchenPage.ts:32-36`). The cause was never recorded (candidates: it was only set by React after load, or the 302 icon redirect/JPEG icon type). **Stage 0 finds out.**
- Every seller page links the one static `public/seller.webmanifest` (`SellerLayout.tsx:160`, `worker/api/kitchenPage.ts:34`, `worker/pages.ts:39`, `shared/kitchenHeadLinks.ts:30`).
- The active kitchen is **one value on the server session** (`sessions.seller_id`, `worker/db/authTeam.ts:48-59`, route `worker/api/authRoutes.ts:241`). `switchKitchen` takes a sellerId, not a slug; `fetchMemberships` returns both (`src/app/KitchenSwitcher.tsx:50-73`).
- Seller URLs carry no kitchen (`/seller/orders` ...); about 470 hard-coded `/seller` references across 94 files (src, worker, e2e, mocks).

## 1 · Manifest: route, id, start_url, scope (recommendation)
| field | value | why |
|---|---|---|
| route | `/k/<slug>/seller.webmanifest` (unchanged) | already there, same family as the customer one (`kitchenManifest.ts:31`) |
| `id` | `/seller?k=<slug>` | equals `start_url`, so Chrome's implicit identity matches (same reasoning as plan 068 rule 1); differs per kitchen; differs from the old `/seller` |
| `start_url` | `/seller?k=<slug>` | the launch tells the app which kitchen to open |
| `scope` | `/seller` (unchanged) | start_url must be inside scope; a query cannot narrow a scope |
| `name` / `short_name` | see 5 | |

**Two WebAPKs, same scope, different ids:** Chrome treats the manifest `id` as the app identity, so both install (and the old `/seller` one stays a third). The launcher icon always opens its own `start_url`, so **icon taps are unambiguous**. The risk is only **links into `/seller/...` from outside** (a WhatsApp link, a push notification click): with several apps claiming the same scope Android either asks "open with" or Chrome picks one, and I cannot verify which without two real installs. That is why every entry point must work whichever app opens it: the `?k=` launch rule in section 2 applies to any `/seller*` load that carries `k`, and push links get `?k=<slug>` (stage 6). **Needs a phone check (stage 0).**

**Per-kitchen path instead (`/seller/k/<slug>/...`, disjoint scopes):** removes the ambiguity but every seller route, link, redirect, push URL, test and doc changes: size **L**, high regression risk on a live app, and the single-session problem below remains. Not recommended unless stage 0 shows links open the wrong app.

**Smallest safe option: same scope, per-kitchen id, `?k=` in start_url.** Changes: `buildManifest` seller branch, the head, one launch hook. No route change.

## 2 · Launching a kitchen's seller app opens that kitchen
A small hook in the seller area (next to `SellerGuard`, `src/app/guards.tsx:43`) reads `k` on any `/seller*` load (valid slug only):
| state | behaviour |
|---|---|
| signed in, active kitchen = k | nothing |
| signed in, member of k (from `fetchMemberships`, match on slug) | `switchKitchen(sellerId)`, `adopt`, then the same clean reload as `goToSeller` (`KitchenSwitcher.tsx:36`); screen "Opening Onde Onde…" meanwhile |
| signed in, **not a member** (removed from the team) | the server already refuses; show "You are not on Onde Onde's team any more" with "Open <other kitchen>" and a hint to remove the icon. Nothing of Onde Onde is shown |
| signed in, kitchen **paused** (`switchKitchen` returns false for `full` pause) | "Onde Onde is paused", button to the other kitchen |
| **signed out** | `/seller/sign-in` with the heading "Sign in to Onde Onde" (k is kept through the sign-in redirect); after sign-in the same rules run. The existing `lastSignedIn()` fallback (`guards.tsx:55`) is used only when there is no `k` |
| no `k` in a standalone launch and no remembered kitchen | the **old "Seller" app**: today's behaviour, plus the one-time notice (section 4) |

**Hidden trap: one cookie, two apps.** On Android both WebAPKs share Chrome's cookie jar, so they share **one session and one active kitchen**. Open Dellavee's app, switch to Onde Onde's app, go back to Dellavee's window: its API calls now act on Onde Onde while its header says Dellavee (a wrong-kitchen edit). Fix (stage 4): each app remembers its kitchen (`sessionStorage`, try/catch, set at launch from `k`); on `visibilitychange`/focus it compares with `/me`, and if different switches back and reloads. A per-request kitchen header checked against membership would be the real fix, but it touches every seller route: out of scope, noted for plan 098. On **iPhone** each home-screen app has its own storage and session (iOS 16.4+), so this does not occur there, but each icon needs its own sign-in (a passkey makes that one tap).

## 3 · iPhone
- iOS takes the **name** from `apple-mobile-web-app-title` (else `<title>`) and the **icon** from `apple-touch-icon`, both read from the page **at the moment of "Add to Home Screen"**, and the **start page is the URL on screen** (newer iOS also reads the manifest, not guaranteed to override). So the seller pages must set, per kitchen: `<meta apple-mobile-web-app-title>`, `<link apple-touch-icon href=/k/<slug>/apple-touch-icon.png>` and the per-kitchen manifest link. `sellerHeadHtml(slug, name)` (`shared/kitchenHeadLinks.ts:19-27`) already produces exactly this.
- Production: the Worker must know the kitchen at first response. With `?k=<slug>` in the URL it does, with **no session lookup** (name and icon are public already): `kitchenPageFor` (`worker/api/kitchenPage.ts:27`) needs the query string (today it gets only the pathname; `worker/pages.ts:55`). React keeps the links right after navigation: `useManifestLinks(sellerManifestTarget(slug))` in `SellerLayout.tsx:160` instead of `(null, true)`, falling back to the default when no kitchen.
- The page on screen when someone taps Share is usually `/seller/more` (no `k`), so iOS would save a start page without a kitchen. Fix: while the iPhone install steps are open, `history.replaceState` the URL to `/seller/more?k=<slug>` (stage 5).
- **Passkeys:** bound to the site (`order.shaggybobo.app`) and the person's account, not to an app. One passkey signs in to every seller app of every kitchen the person belongs to. No effect. Sessions are per app on iOS (above), shared on Android.

## 4 · Existing "Seller" installs (id `/seller`)
- They keep working: the static `public/seller.webmanifest` stays, id `/seller` is unchanged, the launch rule with no `k` is today's behaviour. Admin and the first setup also stay on it (no kitchen), so **`/seller` is kept as the generic fallback** (sensible: signed-out sign-in, admin, setup).
- Moving people: a web app cannot uninstall another. A one-time **notice pill** (plan 095/096 `NoteHost` pattern) inside the old app: "Onde Onde now has its own seller app. Install / Hide", shown per kitchen, only when running standalone with no `k`, no remembered kitchen and the person is in 2+ kitchens (one-kitchen chefs lose nothing by staying); Hide for 30 days. Install opens the same flow as the More row. They remove the old icon by hand.
- Detecting "old app" needs no extra data: a new app always launches with `?k=`.

## 5 · Names and icon
`short_name` ≤ 12 characters shows fully on Android; real launchers cut at about 12 (the mock-up cuts labels the same way). The kitchen name alone is 8-9 characters for both current kitchens, but the same label as the customer app.
| option | name | short_name | icon | note |
|---|---|---|---|---|
| A | `Onde Onde · Seller` | `Onde Onde` | kitchen icon + corner badge | only the badge tells the two apps apart |
| **B (recommended now)** | `Seller · Onde Onde` | `Seller · Onde Onde` (cut to "Seller · Ond…") | kitchen icon, no badge | role first, so the cut end is the kitchen; **no image work** |
| C | `Seller · Onde Onde` | same as B | badge + prefix label | most readable; needs the badge |
ID: "Penjual · Onde Onde". The manifest cannot follow the phone's language after install; choice at stage 1: **fixed "Seller"** (same in EN/ID, as `sellerAppName` comment says today) or `?lang=` on the manifest link from the page's i18n language (+S, the Worker head would still default to EN). Recommend fixed "Seller".
Pattern change vs today: `sellerAppName` is `"<kitchen> · Seller"` (`shared/kitchenManifest.ts:28`); B reverses it to `"Seller · <kitchen>"`.

**How kitchen icons are made today:** the cook uploads one 512x512 picture (slot `railIcon`, `shared/imageSlots.ts:32`; resized in the browser by `src/components/imageResize.ts`); `/k/<slug>/icon-*.png` and `apple-touch-icon.png` serve those bytes unchanged at any size, or redirect to the shared `public/app-icon.png` (`kitchenRoutes.ts:128-135`). The Worker does **no image processing** (plan 011 "Not in this plan"). The initials SVG (`defaultIconSvg`) is only for pages, never an installed icon (iOS and WebAPK need PNG).
**A badge needs one of:** (1) Cloudflare Images binding, a transform with an overlay in the Worker (new binding in `wrangler.jsonc`: owner's OK, and free-tier limits to check); (2) the seller's phone draws the badge on a canvas when the icon is uploaded and uploads a second image (new `railIconSeller` slot: setting change, maybe a migration, existing kitchens need a re-save); (3) a pre-drawn static badge only works as a separate file, it cannot be composed without (1) or (2). Hence badge = follow-up; B needs none of it.

## Open questions for the owner
1. **Identity and scope.** **A (recommended): same scope `/seller`, per-kitchen id `/seller?k=<slug>`.** B: per-kitchen path `/seller/k/<slug>/...` (L, touches every seller route). C: only a switcher inside one app (today).
2. **Names.** A: kitchen name + badge. **B (recommended): "Seller · Kitchen", no badge.** C: both.
3. **Badge.** **A (recommended): none now; revisit after B is live.** B: Cloudflare Images binding. C: second icon drawn on the cook's phone.
4. **Old "Seller" app.** **A (recommended): keep it working, notice pill only for people in 2+ kitchens.** B: notice for everyone. C: no notice.
5. **Release.** **A (recommended): 1.0.42 only if the stage 0 spike passes, else 1.0.43.** B: always 1.0.43. C: 1.0.42 regardless.
6. **Label language.** **A (recommended): fixed "Seller".** B: "Penjual" when the page is in ID at install time (+S).

## Stages
| # | stage | files | size | tests |
|---|---|---|---|---|
| 0 | **Spike (builder, phone):** serve a per-kitchen seller manifest with `id`/`start_url` `/seller?k=onde-onde` in the HTML head; Chrome installability (CDP `Page.getInstallabilityErrors`, as plan 048 stage 2); on an Android phone install Dellavee and Onde Onde seller apps plus the old one, tap links and a push into `/seller/...`, note which app opens; find why the per-kitchen manifest "was not installable" | scratch script only | S | none; result recorded here |
| 1 | `buildManifest` seller branch: id/start_url `/seller?k=<slug>`, name/short_name per option B; keep scope `/seller`; update `sellerAppName` | `shared/kitchenManifest.ts` (+ test), `worker/api/kitchenRoutes.ts` header comment | S | `mocks/push.test.ts:609` area and `shared/kitchenHeadLinks.test.ts:77-107`: ids differ per kitchen, `/seller` static manifest unchanged |
| 2 | Head: pass the query to `kitchenPageFor`; `/seller*` with a valid `k` of a known kitchen gets `sellerHeadHtml(slug, name)`, else the default; React links by `me` slug; Vite dev hook the same | `worker/api/kitchenPage.ts`, `worker/pages.ts`, `vite.config.ts`, `src/app/SellerLayout.tsx:160`, `src/components/install/manifestLinks.ts` | M | unit: head for `/seller?k=onde-onde`, unknown k, no k; `manifestLinks.test.ts`; e2e `kitchen-links` (extend) |
| 3 | Launch hook (section 2 table) + sign-in heading for k + the four screens (mock-up) with EN/ID | `src/app/guards.tsx` or a new `useLaunchKitchen.ts`, `src/features/seller-auth/`, `src/api/auth.ts` (use existing calls), i18n | M | unit per state; e2e `multi-seller` (new case: two kitchens, `?k=` switches) and `seller-auth` (signed out with k) |
| 4 | Own-kitchen memory + resume check (switch back and reload on mismatch) | `src/app/session.tsx` or the stage 3 hook | S-M | unit with a fake `visibilitychange` |
| 5 | More/Settings install row says "Install <kitchen>'s seller app" (`useSellerInstall`), iPhone `replaceState` with `k` while the steps are open, one-time move notice in the old app | `src/components/install/useSellerInstall.tsx` (+ test), `src/app/MoreRoute.tsx:94-156`, `src/features/seller-settings/SettingsPanes.tsx`, `NoteHost` | M | unit: row text, hidden when installed; notice only standalone without k and 2+ kitchens |
| 6 | Push links to a seller carry `?k=<slug>` so any app that opens them switches correctly | push sender in `worker/` (find with `notificationclick` data.url), `public/sw.js` unchanged | S | `mocks/push.test.ts` |
| 7 | Docs: `docs/architecture` (manifest and head), `docs/product` (install flow), decision record, `pnpm run docs`; scoped gate; HANDOVER | docs | S | scoped gate: typecheck, lint, the unit tests above, e2e `kitchen-links`, `multi-seller`, `seller-auth` |
Total M-L; stages 1-3 and 5 are the core.

## Deploy impact
- **Migration: none.** No secret, no new dependency, no new binding (badge excluded). Client + Worker only.
- Safe for live installs: the old manifest and its id are untouched; new apps appear only when someone installs them.
- Risks to check live after deploy: (a) with two seller apps installed, which app opens a seller link or push; (b) the resume check does not loop (switch, reload, switch); (c) an iPhone install done from `/seller/more` keeps the kitchen (replaceState); (d) Chrome's install prompt now appears per kitchen: confirm "Install" on Onde Onde's seller page while the old app is installed.
- Order: deploy with web push already live (memory: push before deploy is satisfied by plan 004).

## Beta testers: reset or delete (owner, 18 Oct)
Owner: "since we have a beta trial, it's important to also let them know how to reset or delete." The move from the old "Seller" app to a kitchen's own seller app ships with plain steps (EN/ID, sendable on WhatsApp): remove the old home-screen app (Android: long-press → Uninstall / Remove; iPhone: long-press → Remove App), clear the site data if something looks stuck, keep the seller passkey (it still works), then install the kitchen's seller app from More. Same guide style as plan 102's customer steps.

## Owner answers (18 Oct, questions page)
- **Q6 = A:** the app name always says "Seller".
- **Q1 = A:** same seller pages, each kitchen its own app id (`/seller?k=<slug>`). Owner asked whether it breaks a seller with one app today (Dellavee): no, the old "Seller" app (id `/seller`) keeps working as it is.
- **Q2 = B:** the kitchen's icon as it is, no badge. Name (owner "ok" to the suggestion): full name "<Kitchen> · Seller" (e.g. "Onde Onde · Seller"), short name kitchen first + a seller mark "OndeOnde ✓" (owner ok), because Android shows ~12 characters and "Admin" is the platform role.
- **Q3 (badge): none now**, follows from Q2 = B.
- **Q4 = A:** keep the old "Seller" app; a one-time notice pill only for people in 2+ kitchens.
- **Q5 (release): owner decides later**, once all questions are answered.
