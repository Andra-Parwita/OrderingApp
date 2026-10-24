# 119 · Customers load only the customer app (bundle split)

**Target: hotfix 1.0.43.3.** Client only: no migration, no Worker change, no service-worker change.
**Status:** built 24 Oct (stage 1 + 3), awaiting the coordinator's gate. Result: customer entry 1,861 KB raw / 527 KB gzip -> **891 KB raw / 267 KB gzip** (limit 1,100); staff chunk `StaffArea-*.js` 887 KB. The entry got below the plan's 1,020 estimate because `store.ts` and `rootSaga.ts` now import the seven seller slices and sagas by file (not through the feature barrels, which pulled every seller screen into the entry); `check:bundle` therefore forbids seller `.tsx` screens, all of admin and the staff app files, and allows the seller `.ts` slices/sagas that the one store wires. Approved: (owner "A"): **light split only** = stage 1 (area switch, staff chunk, staff strings) + stage 3 (bundle check, threshold 1,100 KB raw) + gate. **No store split** (stage 2 dropped: "leave the seller app untouched"). Progressive loading of rare customer extras: **dropped** (owner, 24 Oct: "we can discard progressive loading, that can be for store app if needed, but pagination would also be enough"). Owner: "I did not know that the customer app loads everything."

## Summary

- Today every page, including a customer's `/dellavee`, loads one file: **1,861 KB raw / 527 KB gzip** (519 KB measured over the wire). On an iPhone-sized Chrome at ×4 CPU the splash shows at 0.26 s and the app renders at 1.3 s; the gap is parsing and running that file.
- About **1,050 KB of it is for sellers and admins** (their screens, their Redux slices and sagas, their help text, and 178 KB of their EN/ID strings). Customers never run any of it.
- The fix is one boundary: `AppRoutes` picks the area from the address (`/seller…`, `/admin…` and the hidden Help path are "staff"; everything else is "customer") and loads the staff area with one `React.lazy` import. The seller and admin route files, the session provider, the seller i18n strings and the seller store slices move behind that import unchanged.
- **Measured with a scratch build of a customer-only entry: 808 KB raw / 246 KB gzip** (−57 % raw, −53 % gzip). Without the store split it is 1,023 KB / 285 KB.
- **Estimated start-time saving at ×4 CPU: about 0.5 s** (render at ≈ 0.8 s instead of 1.3 s), plus ≈ 280 KB less to download on a first visit or after a deploy. Sellers pay one extra request on a cold start.

## What makes up the 1,861 KB today (measured)

Method: `vite build --sourcemap` to `scratch/119-dist-map/`, then `scratch/119-map-sizes.mjs` sums the bytes of the main chunk per source file from its map (no dependency). The i18n JSON is inlined as text without mappings, so it is measured separately from the source files (`scratch/119-json-sizes.mjs`, minified). Per-folder code numbers are ±10 KB because the map pins some inlined text to neighbouring files.

| # | what | KB (raw, minified) | area |
|---|---|---|---|
| 1 | i18n strings, all 56 EN/ID JSON files | 252 | seller/admin 178 · customer 50 · shared 24 |
| 2 | `react-dom` | 203 | third-party, needed by all |
| 3 | `src/features/seller-orders` | 136 | seller |
| 4 | `src/features/seller-menu` | 107 | seller |
| 5 | `src/features/seller-help` (help topics as TS text) | 76 | seller |
| 6 | `src/api` (customer part 48) | 75 | mixed |
| 7 | `src/features/customer-menu` | 62 | customer |
| 8 | `shared/` (customer part 21) · `src/app` (customer part 11) | 52 · 52 | mixed |
| 9 | `features/admin` 43 · `customer-orders` 43 · `seller-labels` 42 (one 42 KB `LabelsScreen.tsx`) · `i18next` 42 · `seller-home` 42 · `seller-cook` 41 · `components/install` 41 | 43–41 each | mixed |
| 10 | `react-router` 38 · `components/translate` 37 (seller) · `seller-saturday` 30 · `src/ui` 29 · `seller-auth` 29 · `pickup-map` 26 · `seller-settings` 26 · `seller-private` 25 · `seller-setup` 23 · `styled-components` 20 | 38–20 each | mixed |

Other third-party in the file: `@redux-saga/core` 15, `react-i18next` 12, `immer` 9, `@simplewebauthn/browser` 8 (used by Remember me **and** seller sign-in, so it stays), `stylis` 8, `react` 8, `lean-qr` 7 (the order QR; stays), `@reduxjs/toolkit` 7. Already in their own lazy chunks today: `jsQR` 130 KB (seller scan) and `lottie_light` 169 KB (hero, seller link pane).

By area (code only, from the map): seller-only 673 KB · third-party 395 · shared app code 247 · customer-only 158 · `shared/` 52 · admin-only 43 · unmapped text 249 (the i18n strings plus CSS comments inside styled templates and module glue).

Side findings (no action in this plan): the `AboutHero` lazy import in `pages.tsx` is ineffective today because `AboutScreen` (seller) imports it statically; the split fixes it for free (it became a 4.6 KB chunk in the scratch build). CSS comments inside `styled` templates ship to the browser.

### What the customer entry would hold (measured, scratch build `scratch/119-dist-customer/`)

| group | KB | notes |
|---|---|---|
| third-party | 392 | react-dom 202, i18next 42, react-router 37, styled-components 20, saga 14, react-i18next 12, immer 9, simplewebauthn 8, stylis 8, react 8, lean-qr 7, RTK 7 |
| shared app code | 153 | `components/install` 41, `src/api` 48, `src/ui` 23, `components/update` 12, `src/app` 11, theme 8 |
| customer features | 114 | customer-menu 62, customer-orders 43, customer-settings 9 |
| customer components | 41 | pickup-map 23, remember-me 16, notice 2 |
| `shared/` | 21 | |
| i18n strings | ≈ 75 | customer 50 + shared 24 (inside the 68 KB unmapped) |
| **total** | **808 raw / 246 gzip** | seller/admin code in it: 0.6 KB (`seller-about/aboutTokens`, two colour constants) |

## Design

### 1. One boundary: the area switch in `AppRoutes`

```
areaOf(pathname): 'staff' | 'customer'
  staff    = /seller, /seller/…, /admin, /admin/…, SELLER_HELP_PATH   (same shape as the SW's NEVER_CACHE_PAGES)
  customer = everything else ("seller" and "admin" are reserved slugs, so no customer URL starts with them)

AppRoutes:
  staff    → <Suspense fallback={null}><StaffArea /></Suspense>      // StaffArea = lazy(() => import('./StaffArea'))
  customer → <Routes> "/" HomePage · customerRoutes() · "*" NotFoundPage </Routes>   (as today, minus the staff routes)
```

- **Why not `<Route path="/seller/*">` with nested `<Routes>`:** React Router ranks a splat below a static segment, so `/:slug/dishes` (customer) would win over `/seller/*` for `/seller/dishes`, and all 37 seller paths would have to become relative. The switch above keeps `sellerRoutes.tsx`, `adminRoutes.tsx` and `AuthRoutes.tsx` **unchanged**.
- `StaffArea.tsx` (new, about 60 lines, lives in the lazy chunk) is today's `AppRoutes` body minus the customer routes: `SessionProvider` → `RealLocation.Provider` → `<Routes location={background}>` with `sellerEntryRoutes()`, `adminRoutes()`, `sellerRoutes()`, `*` NotFound. The wizard helpers (`isWizardPath`, `wizardBackground`, `MENU_BACKGROUND`) move with it. `SessionProvider` moves too: no customer code uses `useSession` (checked: only `AppRoutes` and `kitchenNotice`, which is seller).
- **Admin shares the staff chunk** with the seller (one admin; admin shares sign-in screens, `SignInFrame`, `BrandPanel` and the session with the seller). A separate admin chunk would save customers nothing more.
- **Fallback `null`:** `#root` stays empty, so the plan-115 splash (icon + "ShaggyBobo" for sellers) keeps covering the screen until the staff chunk renders. Nothing is drawn before, so nothing jumps or flashes. In-app crossings customer → staff do not happen (the seller link on `/` is off, `SHOW_SELLER_LINK = false`); a typed URL shows a blank moment, acceptable.
- Named export through `lazy`, as `pages.tsx` already does: `lazy(() => import('./StaffArea').then((m) => ({ default: m.StaffArea })))`.
- Optional (3 lines, recommended): `main.tsx` starts the download early for staff addresses, `if (areaOf(location.pathname) === 'staff') void preloadStaffArea()`, so it runs in parallel with `initI18n()` instead of after the first render.

### 2. Redux: one store, staff slices and sagas injected when the staff area mounts

Measured cost of **not** doing this: +215 KB raw / +39 KB gzip in the customer entry (the 7 seller slices, 7 sagas and the seller `src/api` modules they import).

- `store.ts`: `combineSlices({ customer, customerOrders }).withLazyLoadedSlices<StaffSlices>()` (RTK 2.13 built-in, no new dependency). `createAppStore()` keeps its name and callers; it also returns `inject` (the root reducer's) and `runSaga` (the middleware's). `rootSaga.ts` keeps only the two customer sagas.
- `staffStore.ts` (new, in the lazy chunk): `enableStaff(store)` injects the 7 seller reducers, runs the 7 seller sagas once (guarded), then dispatches one `staff/enabled` action so the new slices have their initial state before any seller selector runs (RTK: injected state is undefined until the next action).
- `StaffArea` calls it in a small gate (`useStore()` + `useEffect` + a `ready` flag; renders `null` until then: one empty frame under the splash). No render-phase dispatch.
- `RootState` from `store.ts` is used nowhere else (features define their own `…RootState` types), so typing stays local. Tests keep calling `createAppStore()`; `CustomerShell.test.tsx` seeds customer slices, which are unchanged.

### 3. i18n strings by area

The 13 `register…I18n()` calls for seller and admin namespaces move from `main.tsx` to module scope in `StaffArea.tsx` (they run once, when the chunk loads; i18n is initialised before the app renders, and `addResourceBundle` is synchronous). Customer, install, remember-me and the root `src/i18n` bundles stay in `main.tsx`. That alone moves 178 KB of text out of the customer entry. No lazy JSON loading, no i18next backend.

### 4. Vite `manualChunks`?

Not needed. Vite 8 bundles with rolldown; the dynamic `import()` is the boundary, and modules shared by both sides (ui, install, api, theme) are hoisted into the entry automatically. The rolldown equivalent (`build.rolldownOptions.output.advancedChunks`) could later pin `react-dom` into a vendor chunk so a code-only deploy does not re-download 200 KB; the service worker's cache-first `/assets/` already softens that, so skip it in this hotfix.

## Estimate (an estimate, scaled from today's measurement)

| | today | after | change |
|---|---|---|---|
| customer entry, raw | 1,861 KB | **808 KB** (measured) | −1,053 KB (−57 %) |
| customer entry, gzip | 527 KB | **246 KB** (measured) | −281 KB |
| parse + execute at ×4 CPU, ≈ 0.5 s per MB raw | ≈ 0.93 s | ≈ 0.40 s | **≈ −0.5 s** |
| app renders (splash at 0.26 s) | 1.3 s | **≈ 0.8 s** | estimate; measure after the build |
| seller cold start | 1 file, 1,861 KB | 2 files, ≈ 790 + ≈ 1,070 KB | +1 request, +≈ 0.1–0.3 s before the pre-kick, less with it |

## Risks

| risk | why it is small, and the check |
|---|---|
| A deploy while a page is open | Customers never fetch the staff chunk, so nothing new for them: old saved page + old entry (SW cache-first) run as today until the green pill. Seller and admin pages are never SW-cached, so a seller's fresh load always gets matching hashes. A seller app open across a deploy already has its code; a missing old sub-chunk (scan, hero, link pane, now also the staff chunk) hits the existing `vite:preloadError` handler: drop saved pages, one reload per session (`update.test.tsx`). The public Help path `/help-…` is not under `/seller`, so the SW does save it; a stale copy asking for a gone staff chunk takes the same one reload. Fine for a hotfix; excluding it in `sw.js` would need a `CACHE_VERSION` bump (not now). |
| Flashes or layout jumps | Fallback is `null` under the splash; the store gate adds one empty frame. Nothing rendered before the staff screen, so nothing moves. `p115-splash` plus a manual seller cold start. |
| Seller cold start | One more request, after the entry has run; seller pages are never cached offline today, so this changes nothing offline. The `/assets/` cache-first rule makes repeat starts local as today. The optional pre-kick in `main.tsx` overlaps the download with i18n init. |
| Unit tests rendering seller routes through `AppRoutes` | `AppRoutes.test.tsx` (about 20 seller cases; 5 are synchronous: rail, More page, tablet landing, preview route, seller initial), `WizardLayer.test.tsx`, `sellerHelp.test.tsx` (6 synchronous renders of the Help path) must `await screen.findBy…` after the lazy boundary. Customer tests (`CustomerShell.test.tsx`, `pages.test.tsx`) unaffected. |
| Playwright | Runs on the dev server, where the dynamic import is a native module load: specs need no change and do exercise the boundary (`session-flow`, `seller-auth`, `admin` cross sign-in → area). Chunk sizes are not visible in e2e: the check script (stage 3) proves them. |
| Circular imports | `AppRoutes` → (dynamic) `StaffArea` → `sellerRoutes`, `adminRoutes`, `session`, `staffStore`; nothing imports `AppRoutes` or `StaffArea` back. `import-x/no-cycle` traces dynamic imports too, so `lint` proves it. Layer rule (app → features) holds. |
| A regression that drags staff code back into the entry (a new import in `main.tsx`, `store.ts`, `pages.tsx`, `CustomerShell.tsx`) | The stage-3 script fails the build check: it reads the entry chunk's source map and names the offending module. |

## Stages (builders: sonnet; one builder, stages in order; typecheck only between stages)

| # | stage | files | proof | size after (raw, est.) |
|---|---|---|---|---|
| 1 | **Area switch + lazy staff area + strings.** `areaOf()` with a unit test; `AppRoutes` renders the customer routes or `<Suspense fallback={null}><StaffArea/></Suspense>`; new `StaffArea.tsx` takes the staff routes, `SessionProvider`, `RealLocation`, wizard background and the 13 staff `register…I18n()` calls (removed from `main.tsx`); optional pre-kick in `main.tsx`. Update the three test files to `await findBy`. | `src/app/AppRoutes.tsx`, new `src/app/StaffArea.tsx`, new `src/app/area.ts` + `area.test.ts`, `src/main.tsx`, `AppRoutes.test.tsx`, `WizardLayer.test.tsx`, `sellerHelp.test.tsx` | typecheck; `vitest run src/app` green; `pnpm build` shows a `StaffArea-*.js` chunk | ≈ 1,020 KB |
| 2 | **Store split.** `combineSlices` + `withLazyLoadedSlices` in `store.ts`; customer-only `rootSaga.ts`; new `staffStore.ts` with `enableStaff()`; the gate in `StaffArea`. | `src/app/store.ts`, `src/app/rootSaga.ts`, new `src/app/staffStore.ts`, `src/app/StaffArea.tsx` | typecheck; `vitest run src/app` green (seller pages render with state; `CustomerShell.test` seeds still work) | ≈ 810 KB |
| 3 | **Proof script.** `scripts/check-customer-bundle.mjs` (+ `"check:bundle"` in `package.json`): builds with source maps into `scratch/bundle-check/`, fails if the entry chunk's map contains `src/features/seller-*`, `src/features/admin`, or `src/app/(sellerRoutes|adminRoutes|AuthRoutes|SellerLayout|StaffArea|staffStore)`, or if the entry is over **900 KB raw**; prints entry raw/gzip and the chunk list. Base it on `scratch/119-map-sizes.mjs`. Docs: `docs/guide/tech-stack.md` (gate line), `docs/architecture/source-layout.md` (two areas, one lazy chunk), plan list + roadmap (D-115). | new `scripts/check-customer-bundle.mjs`, `package.json`, 2 docs pages, `docs/plans/README.md`, `docs/product/roadmap.md` | `pnpm run check:bundle` green; `pnpm run docs` | — |
| 4 | **Scoped gate** (coordinator). | — | `typecheck` · `lint` · `format:check` · `test` (all Vitest) · `check:bundle` · e2e: `customer-batch1` (mobile-chromium, iphone-chromium, mobile-webkit), `native-customer`, `order-flow` (iphone), `p115-splash`, `route-safety`, `seller-batch1` (desktop + mobile), `seller-menu` (wizard layer over Menu), `seller-help-in-app`, then sequential `seller-auth`, `admin`, `session-flow` | — |

**Done when:** the customer entry is under 900 KB raw and 270 KB gzip (measured 808 / 246); `check:bundle` finds no staff module in the entry's map; the specs above are green; a seller cold start on a phone signs in and lands on Orders with no blank screen; a customer cold start at ×4 CPU renders under 0.9 s (DevTools, same method as today's 1.3 s).

**Time:** stage 1 ≈ 30–45 min, stage 2 ≈ 30 min, stage 3 ≈ 15 min (builders), gate ≈ 1–2 h. Total ≈ 3 h.

## Deploy impact

Client only: no migration, no secret, no Worker or `sw.js` change, `CACHE_VERSION` stays `v3`. The deploy adds one more hashed file under `/assets/`. First open after the deploy on a customer phone: the old saved page and old entry once, then the green pill (as today). Sellers: the next open loads the new entry and the new staff chunk from the network, as every seller open does today. Rollback: redeploy the previous Worker version; no data involved.

## Open questions for the owner

1. **Store split (stage 2).** A: do it in this hotfix (entry 808 KB; about 30 min more) · B: skip it, ship stage 1 only (entry ≈ 1,020 KB) and do it in 1.0.44 · C: two separate stores, one per area (simpler types, but tests that pass one store to `AppRoutes` need rework). **Recommendation: A.** It is RTK's built-in `combineSlices.inject`, no new dependency, measured −215 KB raw / −39 KB gzip, ≈ 0.1 s at ×4 CPU.
2. **Bundle check in the gate (stage 3).** A: a script run at the end of every phase and before every deploy (`pnpm run check:bundle`) · B: a Vitest test that reads a built source map (needs a build first, slows `test`) · C: none, read the `pnpm build` chunk list by eye. **Recommendation: A.** It is 40 lines, already prototyped in `scratch/119-map-sizes.mjs`, and a stray import would otherwise undo the gain silently.
3. **Target.** A: hotfix 1.0.43.3 as asked (client only, no migration, scoped gate ≈ 3 h) · B: fold into release 1.0.44 (it then rides on the release gate, but customers wait). **Recommendation: A.**

## Scratch output (not committed)

`scratch/119-build.log` (today's build), `scratch/119-dist-map/` (build with maps), `scratch/119-map-sizes.mjs` + `119-map-sizes.txt` (today's breakdown), `scratch/119-unmapped.mjs`, `scratch/119-json-sizes.mjs` (i18n sizes), `scratch/119-customer-entry.tsx` + `scratch/119-vite.config.mts` + `scratch/119-dist-customer/` + `119-map-sizes-customer.txt` (the measured customer entry), `scratch/119-customer-entry-fullstore.tsx` + `scratch/119-dist-customer-fullstore/` (the full-store variant). Run from the repo root: `pnpm exec vite build --config scratch/119-vite.config.mts`.
