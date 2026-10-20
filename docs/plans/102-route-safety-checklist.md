# Plans 101/102: route safety checklist

Safety-net tests that pin **today's** routing, links and manifests, so the route change of plans 101/102 cannot break existing users unnoticed. Source of the risks: [docs/reports/2026-10-20-101-102-risk.md](../reports/2026-10-20-101-102-risk.md) (builder notes 1-9). Tests only; no product code was changed.

Run: `npx vitest run shared/routeSafety.test.ts src/app/routeSafety.test.ts mocks/routeSafety.test.ts --no-file-parallelism` and `npx playwright test e2e/route-safety.spec.ts --project=mobile-chromium --no-deps`.

When 102 ships: update the intended expectations (the `toMatchInlineSnapshot` file list, the "today ..." tests that change on purpose) and turn the `102:` / `101:` `it.todo` and `test.skip` cases into real tests.

## Tests and the risk each guards

| file | test | risk |
|---|---|---|
| shared/routeSafety.test.ts | every theme: manifest `id` is `/<slug>`, `start_url` inside `scope` for 12 start inputs | 2, 9 (biggest risk) |
| shared/routeSafety.test.ts | today: scope `/`, order start kept, unknown start falls back to `/<slug>` | 2 |
| shared/routeSafety.test.ts | icon paths are `/k/<slug>/icon-N.png`, one maskable | 2 |
| shared/routeSafety.test.ts | per-kitchen seller manifest keeps id/start/scope `/seller` | 4 |
| shared/routeSafety.test.ts | `public/seller.webmanifest` exact JSON (id `/seller`, scope `/seller`) and its icons exist | 4 |
| shared/routeSafety.test.ts | seller manifest paths and `sellerHeadHtml` shape | 4 |
| shared/routeSafety.test.ts | `kitchenPageTarget` reads `/o/<token>[/..]`, `/<slug>[/..]`; reserved words are not kitchens | 1, 8 |
| shared/routeSafety.test.ts | `manifestHref` encodes the start | 2 |
| shared/routeSafety.test.ts | the list of files that mention `/o/` (inline snapshot): a new link builder shows up | 3 |
| shared/routeSafety.test.ts | push payload `/o/<token>`, menu-notice payload `/<slug>`, service worker `data.url` handling | 7 |
| mocks/routeSafety.test.ts | every kitchen's customer manifest (real Worker handler, local D1): id, start in scope, display | 2 |
| mocks/routeSafety.test.ts | start inputs today (order kept, `/my-orders` and unknown fall back) | 2 |
| mocks/routeSafety.test.ts | seller manifest per kitchen | 4 |
| mocks/routeSafety.test.ts | every manifest icon answers 200 or one 302 to an existing public file | 2 |
| mocks/routeSafety.test.ts | page heads of `/<slug>`, `/o/<token>` and `/placed|qr|edit|edit/name` link the manifest with the order start; unknown token or slug, `/my-orders`, `/settings` give no head (SPA still served); `/seller` links only `/seller.webmanifest` | 1, 2, 4, 8 |
| mocks/routeSafety.test.ts | `/<slug>/o/<token>` is today the plain kitchen page | 1, 9 |
| src/app/routeSafety.test.ts | `tokenOfOrderUrl` reads `/o/<token>` and its sub-paths, query, hash; ignores menu URL and junk | 7 |
| src/app/routeSafety.test.ts | customer WhatsApp text and seller "send link" text carry `/o/<token>` that parses back | 3, 7 |
| src/app/routeSafety.test.ts | `manifestTarget` start for an order page, My orders, Settings | 2, 8 |
| src/app/routeSafety.test.ts | My orders entries with and without `sellerSlug` load; junk and broken storage are safe; a saved order reads back | 9 |
| e2e/route-safety.spec.ts | Worker answers 200 HTML for `/o/<token>[/placed\|qr\|edit\|edit/name]`, an unknown token, `/my-orders`, `/settings`, `/onde-onde`, `/seller` | 1, 8 |
| e2e/route-safety.spec.ts | place an order, then open `/o/<token>`, `/qr`, `/my-orders` (order listed), `/settings`; reload each; no console errors; unknown token still shows the app | 1, 3, 8, 9 |

## Pending (flip on when 102 / 101 ships)

| where | name | risk |
|---|---|---|
| mocks | 102: `/<slug>/o/<token>` head carries the order start_url | 2 |
| mocks | 102: `/<wrongslug>/o/<token>` resolves the real kitchen from the token | 9 |
| mocks | 101: `/seller` with no `?k=` never links a per-kitchen seller manifest | 4 |
| shared | 102: `kitchenPageTarget` reads `/<slug>/o/<token>` as an order | 1 |
| shared | 102: `manifestHref` start for an order is `/<slug>/o/<token>?source=homescreen` | 2 |
| src | 102: `tokenOfOrderUrl` accepts `/<slug>/o/<token>` | 7 |
| src | 102: every sent order link is `/<slug>/o/<token>` or still redirects | 3 |
| src | 102: `manifestTarget` start for an order page uses the new shape | 2 |
| e2e (skip) | 102: old `/o/<token>` redirects to `/onde-onde/o/<token>` (302, sub-paths kept) | 1 |
| e2e (skip) | 102: `/<wrongslug>/o/<token>` corrects the slug | 9 |
| e2e (skip) | 102: `/<slug>/o/<token>` opens and survives reload | 1 |
| e2e (skip) | 102: `/<slug>/my-orders`, `/<slug>/settings` open; `/my-orders`, `/settings` still live | 8 |
| e2e (skip) | 102: order-page manifest `start_url` is inside its `scope` | 2 |

## Device-only checks (cannot be tested here)

- Samsung tablet (and one phone): open the installed customer app and the seller app **before** the release; after the release they still open at the same page, with no URL bar inside the app (risk 2; if a bar shows, flip the scope switch to `/`).
- An app installed from an order page (home-screen start `/o/<token>?source=homescreen`) still opens that order.
- Tap an **old** WhatsApp link (`/o/<token>`) in Chrome and in the installed app: lands on the order (redirect works). After Android re-mints the app, an old link opening in Chrome is accepted (risk 1).
- A push delivered **before** the release, tapped **after**: opens the order (risk 7). One duplicate notification at the switch is accepted.
- Notification click while the app is open and closed (focus vs open window).
- Printed label QR code scan: encodes the order code, not a URL (risk 1 note).
- Old "Seller" app (no `?k=`) keeps its icon and name after a kitchen app is installed; passkey sign-in still works (risk 4).
- Shared Android session: switching kitchen does not loop on reload (risk 6).
- My orders on a phone with saved entries from before many sellers (no `sellerSlug`) still lists and opens them (risk 9).
