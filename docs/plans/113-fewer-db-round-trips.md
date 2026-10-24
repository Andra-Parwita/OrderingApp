# 113 · Fewer database round trips per request

**Status:** items 3–7 approved for **1.0.44** (owner 24 Oct "B": all, including the backup, with a row-by-row comparison test of old vs new backup). **Built 24 Oct:** PATCH order 7→4 trips (27→18 statements), cancel 6→4, private create 7→5, dish edit 5→4, backup 15→7 (37→25). The new backup is JSON-identical to the old one (`mocks/backupCompare.test.ts` against `mocks/legacyBackup.ts`, plus a one-off against HEAD) and survives restore → backup unchanged. Budgets pinned in `mocks/roundTrips.test.ts`.

## Findings
- The Worker already batches well (`Db.reads` / `Db.batch`, no per-item loops, no N+1). The waste is **repeated reads inside one request**, mostly from composing service calls with `Promise.all`.
- Highest routes (trips / statements): backup 18/39 (budget < 40 statements), PATCH order 7/27, finish 7/30, cancel 6/24, POST order 6/17. Cloudflare's limit counts round trips, so production is safe; the 40-statement rule is our own margin.
- Plan 111 added 1 statement to the tested routes (the choices read in `listDishes`), 2 sequential reads on private orders, 1 on dish edit.

## Done in 1.0.43
1. `worker/db/sellerBackup.ts`: drop the duplicate `dropExpiredDetails` (already run by `readPastWeeks`).
2. `worker/db/menuDishes.ts` `listDishes`: parents and choices in one `db.reads` round trip.

## Later (one small plan, ~1 day)
3. `sellerOrders.ts` update/cancel: reuse the order `lookupByToken` already read; re-read in `orderTokenRoutes.ts` only when the address changed. PATCH 7/27 → 5/19, cancel 6/24 → 5/20.
4. Send `orderReadStatements` + `loadState` in one `db.reads` (raise `ReadResults` in `d1.ts`). PATCH → 4/19.
5. `private.ts` buildLines: one SELECT with a parent join and a has-choices EXISTS (−2 trips).
6. `menuDishes.ts` updateDish: `db.batch([update, syncChoices])` (−1 trip).
7. Backup built from `loadState()` + `readSets()` + two `db.reads` instead of 12 service calls: backup → about 8/25.

**Not worth it:** caching the menu (sold-out counts change with every order) or a per-request cache layer (stale-after-write risk).
