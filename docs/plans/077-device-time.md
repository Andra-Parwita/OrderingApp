# 077 · Times: stored as UTC, shown in the device's time

**Status:** ✅ built and gated (16 Oct; approved: "do 77"); time code choice D-102; owner ruling D-101. Owner: "who said Onde Onde is in Melbourne?" → "for now they are all in Adelaide like me, A … but we should also be clear and show device time … maybe we need to save everything as UTC and device time is what we will show? Seller or admin sets 9 am, it is 9 am on their time".
**Goal:** no city is hard-coded. Every moment is stored as **UTC**; every screen shows times in **the device's own time zone**; when a seller or admin types "9:00", it means 9:00 **on their device**.

## Today
- The app's clock is fixed to `Australia/Melbourne` in 3 places (`shared/dates.ts`, `src/features/seller-menu/instant.ts`, `src/features/seller-home/liveData.ts`), used by ~50 files. It came from the first prototype (8 Oct), **never an owner ruling**. The kitchens are in Adelaide (30 min behind Melbourne), so cut-offs, pickup windows, the cooking day, the midnight auto-finish and the admin's maintenance notice ("Times are the cook's time (Melbourne)") are all 30 min off for them.
- Cut-offs are stored as ISO instants with an offset; pickup windows as wall-clock `HH:MM` with the cooking date; the cooking day as a date.

## Proposal
1. **Store:** every instant as UTC (cut-off, maintenance window, order times — most already are). Pickup windows and the cooking day stay as the kitchen's wall-clock date and times **plus the kitchen's time zone**, which turns them into exact instants.
2. **The kitchen's time zone** (new, one value per kitchen): set automatically from the owner's device when the kitchen is set up or the owner opens Settings; existing kitchens get **`Australia/Adelaide`** (owner, 15 Oct: "for now they are all in Adelaide"). Needed for what has no device: the hourly auto-finish ("midnight after the cooking day"), a new seller's default cut-off (Friday 21:00), the daily sweeps.
3. **Enter:** a time a seller or admin types is read in **their device's** zone and saved as UTC (owner: "seller or admin sets 9 am, it is 9 am on their time").
4. **Show:** every time in the **viewer's device** zone. When the viewer's zone differs from the kitchen's, a small muted label says so (e.g. "your time"), so a customer travelling is not confused. The admin maintenance text becomes "Times are in your time (Adelaide)" (the device's zone name).
5. **Tests** run with a fixed zone (Adelaide and one other) so day boundaries are proven.

## Stages (sketch)
| # | stage |
|---|---|
| 1 | migration (add-only: kitchen time zone, default `Australia/Adelaide`); one shared zone helper replaces the 3 hard-coded zones |
| 2 | enter/show in the device zone (seller menu wizard, cut-off, pickup windows, admin maintenance, customer screens, My orders grouping) |
| 3 | server jobs use the kitchen zone (auto-finish, default cut-off, sweeps) |
| 4 | tests in two zones, docs (data-model, flows), Help wording |

**Deploy impact (expected):** ⚠️ one add-only migration; menus already published keep their stored instants (cut-offs were saved as Melbourne instants: an open menu's cut-off shown in Adelaide time will read 30 min earlier, e.g. 20:30 instead of 21:00; check live menus at deploy and re-save if needed).

## Build decisions (coordinator, 16 Oct)
- **Migration 0025** (add-only): `kitchens.time_zone TEXT NOT NULL DEFAULT 'Australia/Adelaide'`. A new kitchen takes the zone of the admin's device that creates it (validated IANA name, else the default). No "change zone" control this round (it would need a mock-up); the kitchen's zone only matters for server jobs and for viewers whose device differs.
- **One helper** `shared/zone.ts` (device zone, default zone, wall clock ↔ instant in any zone). The 3 hard-coded zones go. Functions the Worker uses take the zone **as a required argument** (the Worker's own zone is UTC); screen formatting defaults to the device zone.
- **Pickup windows** stay stored as the kitchen's wall-clock `HH:MM` on the cooking date; screens convert them to the device's time (identity when the zones match, which is everyone today).
- **"your time" label:** a small muted word next to times on the customer menu and order pages, only when the device's zone differs from the kitchen's. Text only, no mock-up.
- **Tests:** unit tests run with `TZ=Australia/Adelaide`; Playwright with `timezoneId: 'Australia/Adelaide'`; zone helpers are also tested in a second zone (Asia/Jakarta).
