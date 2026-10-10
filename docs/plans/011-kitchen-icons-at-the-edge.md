# 011 · Kitchen icon and manifest in the page itself (server side)

**Status:** proposed (2026-10-10, builder: "implement seller-specific icons and manifests at the Cloudflare routing layer, not solely through React runtime code … should resolve the grey-letter icon problem"). **Approved** (10:03, builder: "my layout is just illustration", "so lets do this"); paths stay under /k/<slug>/.
**Goal:** when a customer adds a kitchen to the home screen, the phone finds that kitchen's icon and manifest in the HTML it first receives, so it never falls back to the grey letter, for any number of kitchens.

## Why the grey letter happens today
- The `<link rel="manifest">` and `<link rel="apple-touch-icon">` tags are added by React **after** the menu loads (`src/app/CustomerShell.tsx:200-213`, `src/components/install/manifestLinks.ts`).
- `apple-touch-icon` is left out entirely when the kitchen has no uploaded icon (the default is an SVG, which iOS can't use).
- If the phone reads the page before the menu has loaded, or the kitchen has no PNG or JPEG icon, iOS draws a grey letter.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **The icon address always works.** `/k/:slug/apple-touch-icon.png` (and `icon-180/192/512.png`) always answer with an image: the uploaded icon if there is one, else **a default PNG** (a static app icon in `public/`, made once by a small script that renders an SVG to PNG with the Playwright already installed, and committed; no image library). The manifest always lists PNGs, so there are no SVG-only manifests. | `worker/api/kitchenRoutes.ts`, `shared/kitchenManifest.ts`, one default PNG in `public/` | tests: a kitchen with no upload gets a PNG with `image/png`; with an upload, its own image |
| 2 | **The links are in the HTML.** For kitchen pages (`/:slug`, `/:slug/*`), the HTML that is served already contains `<link rel="manifest" href="/k/<slug>/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/k/<slug>/apple-touch-icon.png">` and the kitchen name as `apple-mobile-web-app-title`. Production: the Worker handles navigations first (`assets.run_worker_first` for non-asset paths) and rewrites the head with `HTMLRewriter`. The slug comes from the URL; the name comes from the DB, and an unknown slug gets no links. For order pages (`/o/:token`), the Worker looks up the order's kitchen by token. Dev: a small Vite `transformIndexHtml` hook does the same from the request URL, so phones on the home Wi-Fi see the same thing. Both use one shared function. | `worker/index.ts` or `worker/api/`, `wrangler.jsonc` (`assets`), `vite.config.ts`, one new `shared/` helper | tests: the HTML for `/onde-onde` contains both links with the right slug; an unknown slug gets none; `/o/<token>` gets its kitchen's links |
| 3 | **React keeps them right after navigation** but no longer removes them because of a missing upload. `manifestLinks.ts` always points at `/k/<slug>/apple-touch-icon.png`. | `src/components/install/manifestLinks.ts`, its test | the existing tests, updated |
| 4 | **The seller app also goes on the home screen with the kitchen's icon** (builder, 10:09: "seller app will be open on iPad or tablet and need to be able to add as home screen, so use same logo icon too"). A second manifest `/k/:slug/seller.webmanifest`: start `/seller`, scope `/seller`, name "<kitchen> · Seller" (EN/ID not needed: it's a name), the same icons. Seller pages (`/seller`, `/seller/*`) have no slug in the URL, so in production the Worker finds the kitchen from the seller's session cookie (the existing session lookup; no session means no links), and the React runtime sets the same links once the seller is known (this also covers dev). | `worker/` (head rewrite), `shared/kitchenManifest.ts`, `worker/api/kitchenRoutes.ts`, `src/components/install/manifestLinks.ts`, `src/app/SellerLayout.tsx` (one hook call) | tests: the seller manifest has start and scope `/seller` and the kitchen's icons; a signed-in seller page's HTML has the links; no session, no links |

## Not in this plan
- Paths stay under `/k/<slug>/…`; they already exist and can't collide with page routes. A `/<slug>/manifest.webmanifest` layout would work too, but it would mix files into the page routes.
- No image generation in the Worker. Kitchens without an upload get the shared default PNG, not their initials.

## End of phase
- [ ] typecheck · lint · format:check · unit tests for `mocks`, `shared`, `src/components/install` · e2e `mobile-chromium` for one kitchen page and one order page · a phone check by the builder (remove the app, add it again)
