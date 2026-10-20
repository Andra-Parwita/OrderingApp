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
