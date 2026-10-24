**Status: parked (owner, 24 Oct):** "we don't need 120, since iPhone image is enough." The launch pictures shipped in hotfix 1.0.43.3; the snapshot part is not planned.

# 120 · Instant first screen (saved snapshot + iOS launch pictures)

**Target: release 1.0.44** (after hotfix 1.0.43.3 / plan 119 is live). Client only: no migration, no Worker change, no `sw.js` logic change.
**Status:** analysis by Fable (24 Oct), not approved. Owner: "can we actually have a static html first loaded and loading all the router etc on bg .. so give impression that it's fast .. (note that the splash screen seems not useful)". Launch pictures: owner "A", one ShaggyBobo set for all kitchens, light and dark, planned with the snapshot.

## Summary

- A cold start today (live, iPhone-sized Chrome, ×4 CPU, Fast 4G): black iOS launch screen ≈ 0.3 s on the phone → splash at 0.26 s (saved page from the service worker) → menu at 1.3 s; ≈ 0.85 s after plan 119. The gap is the JavaScript bundle running. Pictures are not the cost (lesson 39).
- **Part 1, snapshot.** The last rendered **menu home** (`/<slug>` only) is saved on the phone as HTML + CSS and shown **before the bundle runs**, so the menu is visible at ≈ 0.1–0.3 s. React renders underneath; the snapshot is removed the moment the real menu is ready. The eye sees the same pixels, so there is nothing to see. Target: **menu visible under 0.4 s** on a warm cold start.
- **Part 2, launch pictures.** Hotfix 1.0.43.3 (worktree, plan 119) **already ships** 14 ShaggyBobo pictures for iPhone 14 and newer, light and dark, portrait, plus the generator `scripts/make-startup-images.mjs`. Plan 120 finishes it: older iPhones (and iPads if wanted), a test that keeps links and files in step, the `apple-mobile-web-app-capable` meta if the iPhone check needs it, and the plan-119 doc, which does not mention the pictures (only lesson 42 does).
- **Side finding (live headers, 24 Oct):** `/splash.js` and `/brand/logo-icon.webp` are served `Cache-Control: public, max-age=0, must-revalidate`. `splash.js` is a render-blocking script in `<head>` that the service worker does not intercept, so **every cold start waits for a network round trip (304) before anything paints**, even though the page itself came from the saved copy at once. On a weak signal this is part of the "black". `public/_headers` is honoured live (`/version.json` is `no-store`), so a one-line rule fixes it.
- Size: ≈ 3 h of builders (sonnet, one per stage) + ≈ 1.5–2 h gate ≈ **5 h**. Rollback: redeploy the previous Worker version; nothing stored server-side.

## How a cold start looks after plan 120

| time (warm cold start, ×4 CPU) | today (after 119) | after 120 |
|---|---|---|
| 0 → ≈ 0.3 s | iOS black launch screen | **ShaggyBobo launch picture** (cream or dark), iPhone 14+ |
| ≈ 0.05 s | saved page HTML arrives (SW) | same |
| ≈ 0.1–0.3 s | splash (icon + name) | **the menu, from the snapshot** (inert, identical pixels) |
| ≈ 0.85 s | menu rendered by React | React renders under the snapshot; menu data arrives; snapshot removed |

Splash is kept only for starts with no usable snapshot (first visit, other screens, a deploy, dark/light change, stale).

---

## Part 1 · The snapshot

### 1.1 What is captured

- `document.getElementById('root').innerHTML` of **menu home only**: the route `/<slug>` in any menu state (open, closed, paused, not out yet, kitchen not found). Nothing else; see 1.6.
- The CSS styled-components injected: `document.querySelectorAll('style[data-styled]')`. **In a production build styled-components v6 inserts rules through CSSOM (`insertRule`, "speedy" mode), so those `<style>` tags have empty text.** Serialise `Array.from(style.sheet.cssRules, (r) => r.cssText).join('\n')` instead. This covers `GlobalStyle` (body colour, font, `box-sizing`) and every mounted component. The dev build has text content; use `sheet.cssRules` in both so the test proves the production path.
- Not captured: the Google Fonts stylesheet (already in `index.html`), the top bars (update, offline, maintenance mount in their own `document.body` hosts, outside `#root`), `<script>`.
- Cleaning before saving (plain DOM work on a detached clone, no dependency):
  - remove every `[data-snapshot="skip"]` element (see 1.6);
  - remove `id` attributes (React `useId` ids, `#splash` clashes, label `for` lookups);
  - remove `href`, `action`, `srcdoc`, every `on*` attribute, and any `<script>`/`<iframe>`/`<form>` (none expected; this is a guard, not a feature);
  - keep `src` on `<img>`: the banner and the menu picture are same-origin, cached a year (`immutable`), so they appear at once.
- Size cap: **250 KB** per snapshot (HTML + CSS); bigger → not saved. Expected: 20–40 KB HTML + 30–60 KB CSS.

### 1.2 When it is captured

- Trigger: `MenuScreen`'s `MenuGate` reaches a final state for `/<slug>` (`ready`, `error`, not-published) **and** the browser is idle: `requestIdleCallback` where it exists, else `setTimeout(…, 1500)` (Safari has no `requestIdleCallback`). The banner `<img>` need not have loaded: the snapshot stores the URL.
- Again on every later final state for that slug (sold-out, price or notice changes while the page is open), **rate-limited to once per 30 s per slug** and skipped when the serialised string equals the saved one.
- Never during the seller's preview (`MenuPreview`), never in the fixtures page, never when `#root` is not the live app.

### 1.3 Where it is stored

| option | before first paint? | works without the SW (e2e)? | change | verdict |
|---|---|---|---|---|
| **A. `localStorage`**, key `firstScreen:/<slug>`, JSON `{ stamp, mode, brand, lang, at, html, css }` | yes, synchronous read (≈ 1 ms for 100 KB) | yes | `index.html` + a 1 KB script | **recommended** |
| B. Cache Storage, the SW splices the snapshot into the saved page's HTML string | yes (in the HTML bytes) | no: the e2e suite runs without the SW, so only unit tests would prove it | `sw.js` rewrite of every page response, `CACHE_VERSION` bump | no |
| C. IndexedDB | no (async; first paint has passed) | yes | — | no |

- Quota: Safari and Chrome give ≥ 5 MB per origin; a snapshot is ≈ 100 KB; keep at most **5 kitchens** (evict the oldest `at`). A `QuotaExceededError` is caught and ignored.
- iOS home-screen apps have their own storage, separate from Safari: each captures its own snapshot. Safari deletes script-writable storage after 7 days without a visit (ITP); a browser-tab customer then just gets the splash.

### 1.4 How it is shown, and how React takes over

**Why not at `DOMContentLoaded` (where `splash.js` works today):** `<script type="module">` is deferred, and `DOMContentLoaded` fires **after** deferred scripts have run. So a snapshot inserted there would wait for the 1 MB bundle to parse and execute: the whole gain gone. And a `<head>` script cannot reach `<body>`.

Design:

1. **`index.html`:** a second tiny classic script `<script src="/first-screen.js">` placed in `<body>` right after `<div id="root"></div>` and before `#splash`. It is parser-blocking only for what follows it (the splash); the page colour is already set by `splash.js` in `<head>`. Under 1.5 KB, ES5, every step in `try`.
2. **`first-screen.js`** (new, `public/`): reads `localStorage['firstScreen:' + key]` where `key` is the exact path `/<slug>` (`isValidSlug` shape: lower-case letters, digits, hyphens; reserved words `seller`, `admin`, `o`, `my-orders`, `settings`, `k` excluded; one segment only, no trailing path). Checks, in order; any failure → no snapshot, the splash stays:
   - **stamp** equals the page's own bundle: `document.querySelector('script[type="module"][src]').getAttribute('src')` (`/assets/index-<hash>.js`; in dev `/src/main.tsx`). After a deploy the SW still serves the *old* page once, whose hash matches the *old* snapshot: consistent. The new page has a new hash → no snapshot → splash → fresh capture. This is **better than `version.json`**: synchronous, no network, and it changes exactly when the layout code can change;
   - **mode** equals the mode the page will render in: `localStorage.theme` if `light`/`dark`, else `matchMedia('(prefers-color-scheme: dark)')`;
   - **brand** equals `document.documentElement.dataset.brand` (the Worker stamps it on kitchen pages; the saved page keeps it);
   - **lang** equals `localStorage.lang` (i18n saves it there) or both absent;
   - **age** `Date.now() - at` ≤ the maximum (question 1; default 14 days).
   On success it creates `<div id="first-screen" inert aria-hidden="true">` with a `<style>` holding the saved CSS (inline styles are allowed by the CSP) and the saved HTML, inserts it before `#splash`, and sets `html[data-first-screen="shown"]`.
3. **CSS in `index.html`:** `#first-screen { position: fixed; inset: 0; overflow: hidden; z-index: 999; pointer-events: none; user-select: none; background: var(--bg); }`, `html[data-first-screen="shown"] #splash { display: none }`, and the safety net `html[data-first-screen="ready"] #first-screen { display: none }`. `position: fixed; inset: 0` shows the top of the page exactly as the real page at scroll 0 (a cold start always starts at the top) and never adds to the document's height, so **no layout jump** and no double scrollbar.
4. **The app signals readiness**, not "has children": `#root` getting its first child is the *loading skeleton*, and swapping the snapshot for a skeleton would be a flash backwards. New `src/components/first-screen/ready.ts` exports `markFirstScreenReady()` → `document.documentElement.dataset.firstScreen = 'ready'`. Called from `MenuGate` when the state is final (`ready`, `error`, not-published), from `KitchenNotFoundPage`, and from `CustomerShell` for every route that is not `/<slug>` (so a redirect, e.g. first-timer → how-it-works, never leaves the overlay up).
5. **`first-screen.js` removes `#first-screen`** when the attribute turns `ready` (a `MutationObserver` on `<html>` attributes), **instantly, no fade**: the pixels underneath are the same page, and a cross-fade would only reveal a difference. Hard safety: it also removes the overlay after **8 s** whatever happens, and `splash.js`'s existing `#root` observer is untouched (the splash hides as today when there is no snapshot).
6. **`createRoot`, not hydration.** `hydrateRoot` needs server-rendered markup that matches React's render exactly (same i18n strings, same `useId` sequence, same theme object); a saved menu with yesterday's data would mismatch and React would fall back with a warning, or patch text in place and show stale prices after the data arrives. `createRoot(container).render()` into the empty `#root` is what `main.tsx` does today; it is unchanged. The snapshot is a sibling overlay, never `#root`'s content, so React never sees it.
7. **The menu data under the overlay.** The menu request is network-first (SW `networkFirst`, 4.5 s slow-link timer, plan 114). On a normal link the data is back before React's first render anyway; on a slow link the snapshot stays up to ≈ 4.5 s longer than the skeleton would, inert. That is the trade-off: a correct-looking, untappable menu instead of a grey skeleton. (Seeding the store from the SW's cached answer is a separate idea, not in this plan.)

### 1.5 Staleness

- **Maximum age:** question 1. Customers open the app about once a week, when a menu is out; an age under 7 days would make most cold starts snapshot-less and the plan pointless. **Recommended 14 days.** A week-old snapshot shows last week's date and picture for under a second, then the live menu replaces it; the owner accepted sold-out and price differences of under 1 s.
- **Layout changes:** the bundle stamp (1.4 step 2) makes a snapshot from another build unusable, always. No `version.json` read is needed.
- **Mode, brand, language:** checked (1.4); mismatch → splash.
- **Owner's deploy:** nothing to do; the first new-build open shows the splash once and captures a fresh snapshot.

### 1.6 Privacy, a hard rule

**The snapshot must never hold a customer's name, address, phone, order details or "Remember me" data.** How the plan guarantees it:

| rule | how |
|---|---|
| Only menu home is snapshotted | `first-screen.js` matches the exact path `/<slug>`; the capture module checks the same shape (`shared/seller` `isValidSlug`, one segment) before saving. The kitchen home shows kitchen data only: name, tagline, cook's name (the seller's, public), date, cut-off, pickup places, delivery note, notices (plan 112), demo note, the menu picture and banner. `YourTime` shows a time-zone note, not personal data. |
| Never on: dishes (basket counts), basket / pickup / name (address, phone, name), order pages (order details, Remember-me pill, `PlacedNudge`), My orders, Settings (Remember me, Start fresh), seller, admin, `/`, `/o/<token>` | not matched → nothing saved, nothing shown; a unit test asserts each of these paths is refused |
| Device-state marks stripped | `data-snapshot="skip"` on the My-orders tab `Dot` + its hidden "new update" text (an order exists on this phone). The `HomeScreenCard` (install card) is device state, not personal; it is kept (a browser tab captured it, a browser tab shows it). |
| Top bars | never inside `#root` (own hosts), so never captured |
| A test guards it | `capture.test.ts` renders `MenuHomeView` with a fixture menu into a container, runs the capture, and asserts the output contains no `data-snapshot`, no `id=`, no `href=`, no `on*=`; and that `captureAllowed('/dellavee/basket/name')` etc. are `false` |

### 1.7 Taps before the takeover

- `inert` (iOS 15.5+, Chrome 102+) plus `pointer-events: none; user-select: none` for older engines. A tap in the first fraction of a second lands on the overlay and does nothing; it never reaches `#root` either (the real page is still loading), which equals today, where a tap on the skeleton does nothing.
- Nothing looks broken: the pixels are the real menu's. No spinner, no "loading" text, no greyed buttons (that would be a flash the owner did not ask for).

### 1.8 Dark and light mode, kitchen theme

- The CSS captured holds the resolved theme colours (styled-components writes literal values), so a snapshot is one `mode` × one `brand`. Both are stored and checked (1.4). Light and dark are not two files per kitchen: the phone's usual mode is captured; a mode switch shows the splash once, then captures the new mode.
- Page colour before the snapshot paints: `index.html`'s first-paint colours (plan 115) already follow `data-brand` and `data-theme`.

### 1.9 The splash after this plan

- The splash shows only when no usable snapshot exists: first visit to a kitchen, every non-menu page, after a deploy, after a mode/language change, stale, or storage unavailable.
- `splash.js` keeps its jobs: the saved light/dark choice before the first paint (must stay in `<head>`), and hiding the splash when `#root` has content. `first-screen.js` is a separate file because it must run inside `<body>`. Both stay external (CSP: no inline scripts).
- **Blocking round trip (side finding):** add to `public/_headers`
  `/splash.js`, `/first-screen.js`, `/brand/logo-icon.webp`: `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`. The browser then paints without the network. A changed `splash.js`/`first-screen.js` is picked up within a day; the snapshot stamp is the bundle hash, so a day-old script never shows a wrong snapshot. (Alternative: cache them in the SW's shell cache, which needs a `CACHE_VERSION` bump and sw tests; not needed.)

### 1.10 Accessibility

- `#first-screen` is `aria-hidden="true"` and `inert`: screen readers skip it and focus cannot enter it. The real page is announced when React renders, as today.
- No duplicate `#root`: the overlay is a sibling with its own id; `id` attributes inside are stripped (1.1), so no duplicate ids in the document.
- `prefers-reduced-motion`: nothing animates (instant removal).
- Zoom / text size: `textSize.ts` sets the saved size on `<html>` when the app loads; the snapshot's CSS uses `rem`, so it follows the same root size once the bundle runs; before that it uses the default. A customer with a saved larger text size sees a one-step enlargement when the app takes over. Accepted; note it in the plan's open points if the owner minds.

### 1.11 Measuring

- **The method stays the owner's:** iPhone-sized Chrome, ×4 CPU, Fast 4G, DevTools Performance, 2nd and 3rd open (lesson 41). Target: **menu visible under 0.4 s** on a warm cold start; app ready (`data-first-screen="ready"`) unchanged (≈ 0.85 s after 119).
- **`scripts/measure-cold-start.mjs`** (new, dev only, no dependency beyond Playwright): builds, starts `vite preview` (SW on), opens `/onde-onde` three times with CDP `Emulation.setCPUThrottlingRate(4)` and `Network.emulateNetworkConditions` (Fast 4G), waits for capture, then on each reload records from the Performance timeline: first paint, time at which the "Onde Onde" heading is visible (`#first-screen` or `#root`), and `data-first-screen="ready"`. Prints a 3-run table. Writes its log to `scratch/120-measure.log`.
- **e2e `e2e/p120-first-screen.spec.ts`** (dev server, no SW; the mechanism, not wall-clock, lesson 37): scripts delayed 1500 ms as in `p115-splash`; after a first visit and capture, the reload shows the heading **inside `#first-screen`** while the bundle is still delayed, `#splash` is hidden, the overlay is `inert`, a tap on "See dishes" does not navigate; when the app is ready the overlay is gone and the heading exists once; dark mode shows the dark snapshot; a changed stamp or a stale `at` shows the splash instead; `/onde-onde/basket` and `/onde-onde/o/<token>` never save or show one.

---

## Part 2 · iOS launch pictures (`apple-touch-startup-image`)

### 2.1 What hotfix 1.0.43.3 already ships (worktree `OrderingApp-hotfix`, uncommitted on 24 Oct)

- `public/startup/startup-<w>x<h>-{light,dark}.png`: 7 sizes × 2 = 14 PNGs, 57–63 KB each (≈ 840 KB), iPhone 14 and newer, portrait, @3x: 390×844, 393×852, 402×874, 420×912, 428×926, 430×932, 440×956 CSS px.
- `index.html`: 14 `<link rel="apple-touch-startup-image" media="screen and (device-width: Wpx) and (device-height: Hpx) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)[ and (prefers-color-scheme: dark)]">`; light links first, dark after, so an iOS that ignored the colour condition would show cream, never black or white.
- `scripts/make-startup-images.mjs`: Playwright Chromium screenshots of a small HTML page (page colour, the 72 px ShaggyBobo icon, "ShaggyBobo" in Plus Jakarta Sans from Google Fonts), the same look as the splash.
- Documented only in `docs/plan/lessons.md` #42. **Not in `docs/plans/119-customer-bundle-split.md`** (which says "no index.html change" by omission) nor in the plan list: the coordinator should add one line to plan 119 before the hotfix commit.

### 2.2 The device list (2026)

iOS needs an **exact** match of `device-width`, `device-height` (CSS px, portrait), `-webkit-device-pixel-ratio` and `orientation`; the PNG must be exactly W×dpr by H×dpr pixels. No match → iOS's own launch screen (black in dark mode on the owner's iPhone; white in light mode is the common report; **unverified**).

| CSS px (portrait) | dpr | PNG px | models | in 1.0.43.3? |
|---|---|---|---|---|
| 440×956 | 3 | 1320×2868 | 16 Pro Max, 17 Pro Max, **18 Pro Max** | yes |
| 402×874 | 3 | 1206×2622 | 16 Pro, 17, 17 Pro, **18 Pro** | yes |
| 420×912 | 3 | 1260×2736 | iPhone Air | yes |
| 430×932 | 3 | 1290×2796 | 14 Pro Max, 15 Plus/Pro Max, 16 Plus | yes |
| 393×852 | 3 | 1179×2556 | 14 Pro, 15, 15 Pro, 16 | yes |
| 390×844 | 3 | 1170×2532 | 12, 12 Pro, 13, 13 Pro, 14, 16e | yes |
| 428×926 | 3 | 1284×2778 | 12 Pro Max, 13 Pro Max, 14 Plus | yes |
| 375×812 | 3 | 1125×2436 | X, XS, 11 Pro, 12 mini, 13 mini | **no** |
| 414×896 | 2 | 828×1792 | XR, 11 | **no** |
| 414×896 | 3 | 1242×2688 | XS Max, 11 Pro Max | **no** |
| 375×667 | 2 | 750×1334 | 8, SE 2nd/3rd gen | **no** |
| 414×736 | 3 | 1242×2208 | 8 Plus | **no** |

Sources: iPhone 17 family and Air: [Use Your Loaf, "iPhone 17 Screen Sizes", 13 Oct 2025](https://useyourloaf.com/blog/iphone-17-screen-sizes/) (points and scale for every model back to iPhone 8; pixel sizes for older models are points × scale). iPhone 18 Pro 2622×1206 and 18 Pro Max 2868×1320 (same points as 17 Pro / Pro Max): [Apple, iPhone 18 Pro tech specs](https://www.apple.com/iphone-18-pro/specs/) (read 24 Oct 2026). **Unverified:** iPhone 18 (non-Pro), 18e, a second Air, the "iPhone Fold" (a third-party site lists 1920×2713 at 7.76"; no Apple source) — if they bring new point sizes they are missing here; add when Apple's spec pages list them.

iPads (if wanted, question 3), all @2x, portrait W×H: Pro 13" M4/M5 1032×1376; Air 13" and Pro 12.9" 1024×1366; Pro 11" M4/M5 834×1210; Pro 11" gen 1–4 834×1194; Air 11" / Air 4–5 / iPad 10th–11th gen 820×1180; iPad 7th–9th gen 810×1080; mini 6/7 744×1133; 9.7" and mini 4–5 768×1024. Source: [Use Your Loaf, "iPad 2024 Screen Sizes", 13 May 2024](https://useyourloaf.com/blog/ipad-2024-screen-sizes) (iPad 11th gen 2025 and Pro M5 share earlier sizes: **unverified** for the M5). iPads also launch in landscape, which needs a second set with swapped dimensions and `(orientation: landscape)`. That is 9 sizes × 2 orientations × 2 modes = 36 more files (≈ 2 MB).

### 2.3 Does iOS honour `prefers-color-scheme` in the startup-image media query?

**Not verifiable without a device; marked unknown.** Evidence: the widely used generator `pwa-asset-generator` has a `--dark-mode` option that emits `(prefers-color-scheme: dark)` on the links ([README](https://github.com/elegantapp/pwa-asset-generator)); a production app (Stacker News) ships paired light/dark links this way and reports it works, with the caveat that **iOS picks the picture when the app is added to the home screen and keeps it**: a later mode switch shows the old mode's picture until the app is re-added ([commit note](https://git.ekzy.is/ekzyis/stacker.news/src/branch/master/public/splash); the generator's FAQ says the same). Apple documents none of this. The 1.0.43.3 ordering (light first, dark after) is the safe form. **The owner's iPhone check decides:** Dark phone → re-add the app → cold start → a dark picture, or cream?

### 2.4 Generation (keep the hotfix script, tighten it)

- Keep `scripts/make-startup-images.mjs` (Playwright Chromium, `deviceScaleFactor` = dpr, `page.screenshot({ type: 'png' })`). Changes: sizes move to `scripts/startup-sizes.json` (`[{ w, h, dpr }]`) so a test can read them without running the generator; add the 5 older iPhone sizes (and iPads/landscape only if the owner says so); write a file **only when its bytes differ** (`readFileSync` compare) so an unchanged run leaves `git status` clean.
- **Determinism:** same Chromium build + same fonts → same bytes on this PC. The text "ShaggyBobo" depends on the Google Font download (the script warns when it falls back to a system font; a fallback run must not be committed). Across PCs the bytes may differ by anti-aliasing; that is why the PNGs are committed and the gate never regenerates them. An icon-only picture (owner's third option) would remove the font dependency; the owner chose icon + name (it matches the splash), so keep it.
- **Sizes:** ≈ 60 KB per file at 3x (mostly flat colour plus the icon and text). 12 iPhone sizes × 2 = 24 files ≈ 1.4 MB in the repo and on the server; a phone downloads only its one or two matches, once, at "Add to Home Screen". Fine.
- Commit only `public/startup/*.png`, `scripts/make-startup-images.mjs`, `scripts/startup-sizes.json`; nothing in `scratch/`.

### 2.5 Which pages link them

- The links are static in `index.html`, so **every** page carries them: customer pages (kitchen apps) and the seller app (`/seller/...`, its own manifest) alike. The Worker touches nothing. The 1.0.43.3 links are already on seller pages. ShaggyBobo is the right brand for both. Removing them from seller pages would need a Worker (HTMLRewriter) change: not worth it (question 4).
- iOS reads the links **when the app is added to the home screen**; a page saved by the SW also carries them. Existing installs keep the black screen until the customer removes and re-adds the app. Tell the owner: nothing can push a launch picture to an already installed app.
- Caching: `/startup/*` is served like the other static files (`max-age=0, must-revalidate`); iOS fetches once at install. No `_headers` rule needed.
- `<meta name="apple-mobile-web-app-capable" content="yes">` is **not** in `index.html` today; iOS treats the manifest's `display: standalone` as the same since 11.3, and the kitchen and seller manifests set it. Old guides say the startup image needs the meta ([Apple forums thread](https://developer.apple.com/forums/thread/733490)). If the owner's 1.0.43.3 check still shows black with a matching size, add the meta (one static line; harmless on Android, which uses the manifest). Decide from the check, not in advance.

### 2.6 Testing without a Mac

- Unit test `src/theme/indexHtmlStartup.test.ts` (next to `indexHtmlColours.test.ts`): parses `index.html`, and for every `apple-touch-startup-image` link checks the media string shape, that `href` exists under `public/startup/`, that the PNG's IHDR width/height (bytes 16–24 of the file, no dependency) equal `device-width × dpr` and `device-height × dpr`, that every size in `startup-sizes.json` has a light and a dark link and no extra files exist, and that every light link precedes every dark link.
- The iPhone (the only real check; owner, Dark then Light): delete the DellaVee app → Safari → Add to Home Screen → close → open twice. Expect: the dark picture (icon + ShaggyBobo) instead of black, then the menu. Switch the phone to Light without re-adding: the dark picture still shows (expected iOS behaviour); re-add → cream. Note the iOS version.
- Playwright WebKit cannot show a home-screen launch screen; no CI check is possible.

---

## Risks (live customers)

| risk | why small, and the check |
|---|---|
| A stale snapshot shows a wrong price, a sold-out dish or last week's date for < 1 s | accepted by the owner; capped by the age limit; the live data replaces it; `p120` spec proves removal on `ready` |
| A layout change makes an old snapshot look wrong | impossible across builds: the bundle hash stamp; a same-build snapshot is by definition the same layout |
| The overlay never leaves (a bug in the ready signal) | three nets: the attribute set from `MenuGate`, `KitchenNotFoundPage` and every non-menu route; the CSS rule `html[data-first-screen="ready"] #first-screen { display: none }`; the 8 s hard timeout. `ScreenBoundary` errors render inside `#root`; the shell's non-menu signal does not cover a crash on `/<slug>` itself → the 8 s timeout does |
| A customer taps during the overlay | nothing happens for < 0.5 s on a normal link; equals today's skeleton |
| Personal data in a snapshot | only `/<slug>`; nothing personal is on that screen; `skip` marks; unit test (1.6) |
| Stored HTML injected into the page | same-origin storage only; the source is our own rendered DOM; `href`/`on*`/`<script>` stripped; the CSP forbids inline scripts anyway |
| Snapshot in the wrong mode/brand/language | all three checked before showing; mismatch → splash |
| `first-screen.js` fails or storage is blocked (private mode) | every step in `try`; the page then behaves as today (splash) |
| `localStorage` quota | 250 KB cap, 5 kitchens, `QuotaExceededError` caught |
| The `_headers` rule serves an old `splash.js`/`first-screen.js` for up to a day after a deploy | both tolerate the other's version (attributes, not function calls); the stamp protects the snapshot; `index.html` changes are picked up via the SW's background refresh as today |
| Plan 119's bundle check | the capture module is customer code (≈ 2 KB); `check:bundle` stays green |
| Launch pictures: a size mismatch | black as today, nothing worse; the unit test keeps links and PNGs in step |

## What could break in a deploy

- Client only. No migration, no secret, no Worker code, no `sw.js` change (`CACHE_VERSION` stays `v3`): the saved pages refresh in the background as today, and the first open after the deploy shows the old page once, then the green pill.
- `index.html` grows by ≈ 1 KB of CSS/script tags (+ ≈ 2 KB of launch-picture links on top of 119's ≈ 4 KB). The SW re-saves it per kitchen on the next open.
- New static files: `public/first-screen.js`, more `public/startup/*.png`, a `public/_headers` change. Nothing to pre-warm.
- First open on the new build: splash (no valid snapshot), then a fresh capture; second open: the snapshot. Tell the owner to judge from the 2nd and 3rd open (lesson 41).

## Rollback

Redeploy the previous Worker version. Old snapshots in phones carry the old build's hash and are simply ignored by the old page (which has no `first-screen.js`); they age out (14 days) or are overwritten. Launch pictures: existing installs keep whatever iOS captured at install; nothing to undo server-side.

## Stages (builders: sonnet; one builder per stage, stages in order; typecheck only between stages)

Build on `main` after hotfix 1.0.43.3 (plan 119) is merged: it changes `index.html` (links) and `main.tsx`.

| # | stage | files | proof | done when |
|---|---|---|---|---|
| 1 | **Show.** `public/first-screen.js` (read, validate, insert, remove on `ready`, 8 s timeout, ES5, all guarded); `index.html` (script tag after `#root`, the three CSS rules, comment); `public/_headers` rule (1.9). Unit test `src/components/first-screen/firstScreenScript.test.ts` runs the script's text in a jsdom with a fake `localStorage` (valid → overlay + splash hidden; each of stamp/mode/brand/lang/age mismatch → no overlay; `ready` attribute → removed; bad JSON → no throw). Extend `indexHtmlCsp.test.ts` for the second external script. | `public/first-screen.js` (new), `index.html`, `public/_headers`, new test, `src/theme/indexHtmlCsp.test.ts` | typecheck; `vitest run src/components/first-screen src/theme` | the script shows a hand-made snapshot from storage before any module runs, and hides it on `ready` |
| 2 | **Capture + ready signal.** `src/components/first-screen/{index.ts, ready.ts, capture.ts, capture.test.ts}`: `markFirstScreenReady()`, `captureAllowed(pathname)`, `captureFirstScreen(slug)` (clone, strip, serialise CSS via `cssRules`, cap, rate limit, 5-kitchen eviction, stamp from the module script's `src`, mode/brand/lang/at). Hooks: `MenuGate` (final state → ready + capture when the path is `/<slug>`), `KitchenNotFoundPage` (ready), `CustomerShell` (ready on non-menu routes). `data-snapshot="skip"` on the tab `Dot` and `Hidden` text. | new folder (4 files), `src/features/customer-menu/MenuScreen.tsx`, `src/app/pages.tsx` (KitchenNotFoundPage), `src/app/CustomerShell.tsx` | typecheck; `vitest run src/components/first-screen src/features/customer-menu src/app` | `capture.test.ts`: output has no `id=`/`href=`/`on*=`/`data-snapshot`, is under the cap, refuses every non-menu path; a second capture within 30 s is skipped |
| 3 | **Prove + measure.** `e2e/p120-first-screen.spec.ts` (1.11); `scripts/measure-cold-start.mjs` (1.11) writing `scratch/120-measure.log`. | new spec, new script | the spec green on `iphone-chromium` and `mobile-chromium`; the script prints 3 runs | heading visible inside `#first-screen` while the bundle is delayed; measured menu-visible time under 0.4 s (preview build, ×4 CPU, Fast 4G, runs 2–3) |
| 4 | **Launch pictures, finished.** `scripts/startup-sizes.json` with the 12 iPhone sizes (iPads/landscape only if question 3 says so); the generator reads it and writes only changed files; `index.html` links for the 5 added sizes (light first, then dark); `src/theme/indexHtmlStartup.test.ts` (2.6); the `apple-mobile-web-app-capable` meta only if the owner's 1.0.43.3 iPhone check asks for it. | `scripts/make-startup-images.mjs`, new `scripts/startup-sizes.json`, `public/startup/*.png` (+10), `index.html`, new test | typecheck; `vitest run src/theme`; `node scripts/make-startup-images.mjs` twice → `git status` shows no PNG change on the second run | every link has a matching PNG of the exact pixel size; the test is green |
| 5 | **Docs.** `docs/architecture/overview.md` (service worker / first paint row: snapshot, `first-screen.js`, `_headers`), `docs/architecture/source-layout.md` (`public/` row, `components/first-screen`), `docs/product/flows.md` if it has a cold-start line, plan list + roadmap (D-115), plan 119's doc gets its launch-picture line if the coordinator has not added it. `pnpm run docs`. | docs | `pnpm run docs` | pages describe the new start sequence |
| 6 | **Scoped gate** (coordinator). | — | `typecheck` · `lint` · `format:check` · `test` · `check:bundle` · e2e: `p120-first-screen`, `p115-splash`, `customer-batch1` (mobile-chromium, iphone-chromium, mobile-webkit), `native-customer`, `order-flow` (iphone), `route-safety`, `p087-remember-me` (privacy paths), `seller-batch1` (index.html is shared) | — |

**Time (builders 7–15 min each per past releases, these are bigger):** stage 1 ≈ 40 min, 2 ≈ 45 min, 3 ≈ 30 min, 4 ≈ 30 min, 5 ≈ 15 min; gate ≈ 1.5–2 h. **Total ≈ 5 h.**

**Live check (owner, iPhone, DellaVee app, Dark then Light):** open after the deploy (old page once, pill, tap); close fully; open: splash (first capture); close; open: **the menu at once**, no splash, no skeleton, no visible swap when the live data lands; tap "See dishes" straight away: either nothing (overlay) or the dishes (taken over), never a broken state. Then 2.6 for the launch picture.

## Deploy impact

| item | value |
|---|---|
| migration | none |
| Worker code | none |
| `sw.js` / `CACHE_VERSION` | unchanged, `v3` |
| new static files | `/first-screen.js`, `/startup/*.png` (+10), `_headers` rule |
| first open after deploy | old page once → pill → new page with splash → snapshot from the 2nd open |
| rollback | previous Worker version; nothing server-side |

## Open questions for the owner (A / B / C, one at a time)

1. **Maximum snapshot age.** A: **14 days** (covers the weekly menu with slack; a week-old snapshot shows last week's date for < 1 s) · B: 7 days (a customer who opens weekly often misses it) · C: 48 hours (nearly always the splash; little gain). **Recommendation: A.**
2. **Which screens get a snapshot.** A: **menu home `/<slug>` only** (the installed app's start page; nothing personal on it) · B: menu home + dishes `/<slug>/dishes` (prices, pictures; the basket count and "View basket" bar would have to be stripped, and dishes is never a cold-start page in the installed app) · C: every kitchen page without personal data. **Recommendation: A.** Cold starts land on the start URL; the other screens are reached by taps, when the app is already running.
3. **Launch pictures: which devices.** A: **iPhone 14 and newer (shipped in 1.0.43.3) + the 5 older iPhone sizes** (24 files, ≈ 1.4 MB) · B: iPhone 14+ only, as shipped (7 sizes) · C: A + iPads portrait and landscape (36 more files, ≈ 2 MB). **Recommendation: A.** Family and friends on older iPhones (SE, 11, 13 mini) are plausible; iPads ordering food are not, and the installed-app share on iPad is unknown.
4. **Launch pictures on seller pages too.** A: **yes, as now** (one `index.html`, ShaggyBobo fits the seller app, no Worker change) · B: customer pages only (Worker HTMLRewriter strips 24+ links on `/seller`; more code for nothing) · C: a kitchen-coloured set per seller (dozens of files per kitchen, plan 115 said not worth it). **Recommendation: A.**
5. **`_headers` cache rule for `splash.js`, `first-screen.js`, the logo** (side finding). A: **yes, 1 day + stale-while-revalidate** (no SW change) · B: cache them in the SW shell cache (`CACHE_VERSION` v4, sw tests) · C: leave as is and measure first on the phone. **Recommendation: A.** It is the one network round trip left between the saved page and the first paint; the stamp makes it safe.

## Unverified points

- iOS honouring `prefers-color-scheme` in startup-image media queries (anecdotal only; the iPhone check decides).
- What iOS shows with no matching picture (black in Dark is observed; white in Light is reported, not seen).
- Whether `apple-mobile-web-app-capable` is still needed alongside the manifest for the launch picture (decide from the 1.0.43.3 check).
- iPhone 18 (non-Pro), 18e, Air 2 and the Fold's point sizes; iPad Pro M5 sizes.
- The exact gain on the owner's iPhone: estimated 0.1–0.3 s to a visible menu from the measured 0.26 s splash (the snapshot has no fade-in animation and the fonts stylesheet is cached); the measurement script gives the PC number, the iPhone the real one.
