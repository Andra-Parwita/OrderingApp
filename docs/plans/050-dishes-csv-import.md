# 050 · Import and export the dish library as CSV

**Status:** approved (2026-10-12, owner: "part of this round; deploy can be later tonight").
**Goal:** an owner fills a spreadsheet of dishes and imports it in one go, with a preview before anything changes; the current dishes can be exported in the same format.

## Format (UTF-8 CSV, header row, comma or semicolon separated, quotes allowed)
`name_en, name_id, description_en, description_id, size, price, limit, chef, preorder, day_stock`
- `name_en` required; `name_id` defaults to `name_en`. `price` a number (dot or comma decimals). `limit` and `day_stock` empty or whole numbers. `chef` empty (whole kitchen) or an existing cook's name. `preorder` yes/no (default yes; `no` needs a `day_stock`, plan 029). A row is matched to an existing dish by `name_en` (case-insensitive) **and** chef together (empty chef = the whole-kitchen dish), because the same name may exist for different chefs: a match updates that dish, otherwise it's new; a match with more than one dish, or the same name+chef twice in the file, is an error. No pictures.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Parse and check (shared).** `parseDishCsv(text)` → rows with per-row errors; no dependency (a small RFC-4180 reader); `dishesToCsv(dishes)` for the export and the template. | `shared/dishCsv.ts` (+ test) | tests: quotes, commas in fields, semicolons, BOM, comma decimals, bad price, unknown chef, preorder no without stock |
| 2 | **Server.** `POST /api/seller/dishes/import` `{ rows, apply: false }` returns the preview (new / update / error per row, matched against the library and cooks); with `apply: true` writes all valid rows in one batch, owners only (chefs: only rows whose chef is themselves, per plan 030; helpers 403), within the library's size limit. | `worker/api/routes.ts`, `worker/db/menus.ts`, `shared/menusContract.ts` | tests: preview counts; apply creates and updates; a chef can't import another chef's dishes; over the limit is refused with a clear error |
| 3 | **Screen.** On the dish library (Menu → Dishes): **Import** (choose a file → preview table with new / update / problems → Import or Cancel), **Export CSV**, **Download template**. EN + ID. | `src/features/seller-menu/` (DishesScreen + a new ImportDishes panel), i18n | unit: a file with 3 rows shows 2 new, 1 problem; Import calls apply; export downloads the same columns |

## End of phase
- [ ] typecheck · eslint · `shared`, `mocks`, `src/features/seller-menu` unit tests
- [ ] e2e: one import on Dapur Demo (its own spec, sequential project or a fresh kitchen)
