# 093 · Customer banner doesn't flash on page change

**Status:** approved 17 Oct (owner "B": build tonight as release 1.0.40); built and gated (scoped) 23:31, release 1.0.40.

## Goal
Owner, 17 Oct, on live 1.0.39 (iPhone): "in customer app, changing page make the image banner on top flashing and kept reloading". The banner should stay put; only the content below it slides.

## Cause (read-only search, 17 Oct)
- `src/app/CustomerShell.tsx:~262` wraps the page in `<Slide key={pathname}><Outlet/></Slide>`: every route change remounts the whole page, including its banner.
- Each page draws its own `KitchenBanner` (`src/components/KitchenBanner.tsx`): `MenuHomeView.tsx:220-225`, `MyOrdersView.tsx`, `CustomerSettingsView.tsx`. A fresh `<img>` on iPhone paints blank first → flash.
- On `/:slug`, `MenuLoadStates.tsx:35-45` shows a grey skeleton banner while the kitchen loads, then the real one.
- The image itself is cached (`worker/images/serve.ts:5`, immutable, 1 year). Older than 1.0.39 (`key={pathname}` since `6d6384b`, 10 Oct).

## Change
| # | item |
|---|---|
| 1 | Render the banner once in `CustomerShell`, above (outside) the sliding `Slide`, on the routes that show it today (menu home, My orders, Settings), from the same kitchen those pages use today; the pages stop rendering their own |
| 2 | The skeleton banner shows only while no banner has ever loaded (first visit); after that the loaded banner stays |
| 3 | Same look as today on every page (no visual change except no flash); the slide-in of the content stays |

## Stages
| # | what | who | proven by |
|---|---|---|---|
| 1 | Build 1–3 | one builder, sonnet | typecheck; unit test: navigating between banner pages keeps the same `<img>` element (not remounted) |
| 2 | Scoped gate | coordinator | lint/format changed files; unit of CustomerShell + the 3 views; e2e customer-batch1, customer-batch2, native-customer, p087, pickup-map (mobile-chromium + iphone-chromium) |

**Deploy impact:** client only; no migration, no secret. Release notes: none new beyond "Small fixes and polish." (reuse).
