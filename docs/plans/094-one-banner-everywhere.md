# 094 · One big banner on every customer page

**Status:** approved 18 Oct (owner "A"); building as release 1.0.41. Review on `https://localhost:5173` before commit (stands in for a mock-up: same banner as today, only placed on more pages).

## Goal
Owner, 18 Oct, on live 1.0.40 (iPhone): "clicking see order anyway (no menu active) .. show small order banner .. and goes back .. the banner image flashes again … maybe we just keep all banner image and not use small banner on the customer app".

## Cause (read-only search, 18 Oct)
- "See the dishes anyway" (`MenuHomeView.tsx:318-322`, closed menu or paused kitchen) → `/:slug/dishes`.
- Dishes, order (`/o/:token`), placed, QR and closed-order pages show a small logo bar (`PageTopBar`, `src/components/CustomerPage.tsx:67-90`, `kitchen.images.railImage`), not the banner.
- `ShellBanner` (`src/app/ShellBanner.tsx:61-67`) shows the banner only on `/:slug`, `/my-orders`, `/settings`, and not on a closed menu with a menu picture (that page draws its own `Hero` image inside the keyed `Slide` → remounted → flash).
- Images are already cached for a year (immutable); the flash is iPhone painting a fresh `<img>`, so the fix is to keep one `<img>` mounted.

## Change
| # | item |
|---|---|
| 1 | The shell banner shows on **every customer page that belongs to a kitchen**: menu home, dishes, how-it-works, basket steps, order, placed, QR, edit, closed order, My orders, Settings. Kitchen from the path slug, or for `/o/:token…` from the order page's seller slug; My orders / Settings as today |
| 2 | `PageTopBar` drops the small logo; keeps Back and the title |
| 3 | Closed menu: the banner stays at the top; the menu picture is no longer a full Hero replacing it (show it below as a smaller tappable picture or keep it reachable via the existing full-picture viewer, whichever is already built) |
| 4 | The shell banner image loads eagerly (no `loading="lazy"`) |
| 5 | Pages with no kitchen (`/` home) unchanged |
| 6 | **Seller app** (owner: "check also seller app for banner so it won't flash too"): `src/app/SellerLayout.tsx:217-251` unmounts the tablet banner on task screens (Menu, Kitchen, Pickup, Settings) and shows the phone banner only on the Orders list, so returning mounts a fresh `<img>`. Keep both banner elements mounted and hide/collapse them with CSS instead of `? … : null`; banner loads eagerly. Rail images (persistent) unchanged. Built after items 1–5 (shares `ImageSlot`) |
| 8 | **Bottom sheets lock the page behind** (owner, 18 Oct: "about/read privacy bottom sheet, scrolling it actually also scrolls the page behind it"): `src/ui/patterns/BottomSheet.tsx` locks page scroll while open (iOS-safe, restores position), `overscroll-behavior: contain` on the sheet; all sheets get it |
| 8b | **Swipe down to close** (owner "A", 18 Oct; today the handle is decoration only, `BottomSheet.tsx:121` "no swipe-only action"): drag by the handle/top edge, or the content when it is scrolled to the top; release past ~1/3 of the height (or a fast flick) closes with the slide-down, otherwise springs back; Close stays; none with Reduce Motion (instant) |
| 9 | Stale test `src/app/AppRoutes.test.tsx` "theme switch in the customer Settings" (broken since 092's value rows; missed by 092's scoped gate) fixed |
| 7 | **Plan 082 (store)** carries the same rule and test (owner: "make sure it's tested and think about it during store planning/implementation"); lesson 31 |

## Gate (scoped)
typecheck · lint/format changed files · unit: CustomerShell, ShellBanner, CustomerPage, customer-menu, customer-orders, order page · e2e: customer-batch1, customer-batch2, native-customer, order-flow, batch2-flow, customer-live, p087, pickup-map (mobile-chromium + iphone-chromium) · captures at 390 px of dishes, order, closed menu.

**Deploy impact:** client only; no migration, no secret.
