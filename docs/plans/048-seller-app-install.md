# 048 · The seller app can be installed from the sign-in page

**Status:** approved (2026-10-12, owner: "this is about seller"). Checked on the live site with Chrome's installability check: `/ondeonde` (customer) is installable with no errors; `/seller/sign-in` has **no app manifest**, so Android Chrome offers only a shortcut, not "Install app".
**Goal:** on Android (and iPhone "Add to Home Screen"), a seller can install the seller app from any seller page, signed in or not (owner's screenshot: even signed in on Settings there was no install), and it opens without the address bar (`display: standalone`).

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **A ShaggyBobo seller manifest** for seller pages with no known kitchen (`/seller/sign-in`, `/seller/setup`, and any `/seller/*` before the kitchen is known): name "ShaggyBobo Seller", short name "Seller", `start_url` `/seller`, `scope` `/seller`, standalone, the brand colours, icons 192 and 512 **PNG, square, not transparent** made from the happy-face logo on beige (`public/brand/app-icon-192.png`, `app-icon-512.png`, plus a maskable 512 with the face inside the middle 80%). Served from the page head (the Worker's head rewrite) and as `apple-touch-icon`. **Changed during the build:** the Worker cannot know the kitchen from a `/seller/*` URL, and the per-kitchen seller manifest was not installable on Android Chrome, so **every** `/seller/*` page (signed in or not) gets this one manifest (head and React side); the per-kitchen `seller.webmanifest` route stays but is no longer linked. | `worker/pages.ts`, `worker/api/kitchenRoutes.ts` (or a static `public/seller.webmanifest`), `shared/kitchenHeadLinks.ts`, `public/brand/` | tests: `/seller/sign-in` has a manifest link and an apple-touch-icon; the manifest parses with the fields above; every seller page, signed in or not, gets the ShaggyBobo manifest |
| 2 | **Check:** Chrome's installability check (CDP `Page.getInstallabilityErrors`) on the local `/seller/sign-in` returns no errors. | a scratch script | no errors |
| 3 | **An "Install the app" button in the seller app** (owner: "A"), reusing the customer app's install flow (`src/components/install/`): a row in **More** (phone) and in **Settings** (tablet/desktop). Android: one tap opens Chrome's install dialog; iPhone/iPad: the two-step "Share → Add to Home Screen" screens; hidden when already installed or not installable. EN + ID. | `src/components/install/`, `src/app/AppRoutes.tsx` (More row), the seller Settings list | unit: shows when installable, hidden in standalone, iOS steps on iOS |

## End of phase
- [ ] typecheck · eslint · the touched unit and `mocks` tests
- [ ] after deploy, the owner opens `/seller/sign-in` on Android Chrome: ⋮ → **Add to Home screen → Install**
