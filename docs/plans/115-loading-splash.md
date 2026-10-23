# 115 · No blank screen while the app loads

**Target: hotfix 1.0.43.1** (owner, 20 Oct: "since it's just perf and not too visible").
**Status:** analysis by Fable (20 Oct); not approved for building. Owner: "can we have a splash screen or loader … I saw it blank black a bit before showing the app (customer app)".

## Cause
`index.html` is an empty shell with no background colour, so until the 1.8 MB app file loads and styled-components sets the page colour (`src/theme/GlobalStyle.tsx`), iOS shows its launch backdrop: black on a dark-mode iPhone. An installed iPhone app has no manifest splash. Slow links stretch it: the page is fetched fresh each launch (`worker/pages.ts`, `no-cache`, two D1 reads), the service worker waits on the network (plan 114 item 5), and the Google Fonts stylesheet blocks the first paint.

## Recommendation (one builder, about half a day, low risk)
1. `index.html`: an inline `<style>` with the page background per kitchen brand, light and dark (values from `shared/themeColours.ts` / `designTokens.ts`; no `color-scheme` there: it would override the app's own light/dark setting), and a tiny inline script applying the saved light/dark choice before the first paint; a test keeps the values in step with the tokens.
2. A small splash (`#splash`) shown only while `#root` is empty, after 250 ms (no flicker on fast launches): the kitchen name for customers (set by the Worker), "ShaggyBobo" for sellers; no spinner, no animation with reduced motion.
3. `worker/pages.ts`: put the kitchen name into the splash for kitchen and order pages.
4. Seller manifest `background_color`: owner 20 Oct "A": cream `#F6F2E8` (done in 1.0.43). Android uses one splash colour for light and dark; a dark-mode seller sees cream briefly, then the dark app.
5. Optional: fonts stylesheet non-blocking. Also fix `SellerHomeRoute.tsx:34` showing the raw word "loading".

**Not worth it:** iOS `apple-touch-startup-image` (about 20 images per kitchen), cache-first pages, splitting the app file (own plan).

## Stage 2 · Saved page at once (hotfix 1.0.43.2)

**Status:** built + scoped gate green 24 Oct (unit 109/109, e2e 11/11: p115-splash, customer-batch1, native-customer on mobile + iPhone); item 3 gap fixed (a failed script load drops the saved `shell-*` pages before its one reload). Waiting for the owner's deploy. e2e runs on the dev server without the service worker: sw.js is proven by its unit tests only.
**Source:** the owner's 1.0.43.1 live check (24 Oct, iPhone home-screen app, Dark): "spalsh not even shong … its black nd then … dellavee and onded … it just show black maybe a second or less and then the full load"; "for savedpage … can we always serve like just a text and small icon or something?" Rulings: the splash shows at once and hides as soon as the menu is ready (owner "A"); its own hotfix 1.0.43.2 (owner "A"). This overrules Fable's "not worth it: cache-first pages" above.
**Cause:** the black second is iOS's own launch backdrop while the page is fetched (`public/sw.js` asks the network first and waits up to 4.5 s; `worker/pages.ts` does D1 reads); then the app renders within 250 ms, so the splash never shows. The cached shell is stored under `/` only, so a kitchen app's copy would say "ShaggyBobo".

| # | what | file | done when |
|---|---|---|---|
| 1 | Customer pages (navigate): serve the saved copy **at once** if there is one, refresh it from the network in the background (`event.waitUntil`); no copy → network as today. Store **one copy per kitchen path** (`/s/<slug>`, order pages under their kitchen), `/` stays the fallback key. Bump `CACHE_VERSION` to `v3`. Seller/admin pages stay never cached. | `public/sw.js` | unit test: a cached kitchen page answers without waiting for the network; the background answer replaces it; DellaVee's copy is not Onde Onde's |
| 2 | Splash shows icon + name **at once** (drop the 250 ms delay on `#splash > *` and `::before`), still hidden as soon as `#root` has content; reduced motion unchanged. | `index.html` | `e2e/p115-splash.spec.ts` updated |
| 3 | After a deploy the old saved page may ask for a script file that no longer exists: the existing `vite:preloadError` handler (`src/components/update/updateCheck.ts`) must recover (reload once / show the green pill). Verify; fix only if it doesn't. | read only unless broken | a test or a stated check |
| 4 | Docs: offline/caching rule in `docs/architecture` (the page that describes `sw.js`), this plan's status. | docs | `pnpm run docs` |

**Deploy impact:** client only (service worker + `index.html`), no migration, no secret. The first open after each deploy shows the previous version once, then the green "new version" pill. Old phones pick up the new worker on their next open (cache `v2` deleted on activate).
**Gate (scoped):** typecheck, lint, format; `serviceWorkerSlowLink.test.ts` + the new sw tests; `indexHtmlCsp.test.ts`, `indexHtmlColours.test.ts`; e2e `p115-splash`, `customer-batch1`, `native-customer` (mobile-chromium + iphone-chromium).
**Live check:** iPhone home-screen DellaVee app, Dark, cold start twice: the second start shows DellaVee's icon + name almost at once, no "ShaggyBobo"; Light the same; a deploy → first open old, pill, tap, new.
