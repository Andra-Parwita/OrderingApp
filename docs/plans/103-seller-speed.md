# 103 · Seller app speed: menu ticks, dish edits, Confirm and Paid

**Status:** approved for **1.0.42**, all fixes 1–8 (owner, 18 Oct: "for 42 include 103, 105"). Fixes 1–6 building; 7 and 8 wait for the mock-up picks.
**Owner, 18 Oct:** "performance is bad, I tick to add dishes in menu, it does not change. Edit dish to change chef, also slow to respond." "In order, confirm and click paid seem slow." "When click paid should open modal to confirm if paid, also allow ability to make it unpaid." "In menu edit, all should be in modal like and then have footer or button to save."

## Findings (measured locally, normal and at 150 ms RTT + CPU ×4)
- **Menu tick:** optimistic (the box flips at once, 0 requests); one save 1 s after the last tick. Not reproducible as "doesn't change"; a refused save (menu finished/paused, signed out) snaps the ticks back about 1 s later.
- **Every seller write comes back to the same device as a live event** and triggers full reloads: `src/api/live.ts:456` (`liveRefreshLoop`) ignores `event.from`; `useLiveReload.ts:72` already skips own events.
- **Confirm / Paid:** not optimistic; the row changes after the answer (0.1 s desktop, 0.5–0.6 s throttled), then the echo reloads the whole orders list and private orders (2 more GETs); `usePrivateToday.ts:25` refetches on every orders change.
- **Chef edit:** 3 sequential requests (PATCH dish → PATCH item → GET menu) because the editor sends the whole draft (`itemForm.ts:144-157`): 0.4–0.5 s desktop, 1.4–1.7 s throttled; the editor stays open until all three return.
- **Opening the menu screens** fires the 7-request "load everything" bundle on every mount (`menuShared.tsx:144-146`), 2–4 times.
- **Bug:** a chef change made from the wizard's pencil does not reach the live menu copy (`menuSaga.ts:329-339` follow-up omits `chefId`); from the Menu screen it does.
- Live Worker: 35–45 ms without D1, 60–135 ms with D1, plus ~3 D1 round trips of auth per seller request. Nothing in 1.0.39–1.0.41 touched these paths.
- **Unpaid** is already supported end to end (`POST /orders/:code/paid {paid:false}`, audit "unpaid", panel "Mark not paid").

## Fixes (smallest first)
| # | fix | size | risk |
|---|---|---|---|
| 1 | drop own-device echoes in `liveRefreshLoop` | S | low |
| 2 | private orders: reload on live event, not on every orders change | S | low |
| 3 | dish editor sends only changed fields (chef edit = 1 request) + send `chefId` in the follow-up (bug) | S–M | medium |
| 4 | optimistic Confirm / Paid with rollback on failure | M | medium |
| 5 | menu data loads once, not per mount (keep explicit refresh) | S | low–medium |
| 6 | one orders fetch per screen (sold counts from the orders slice) | S | low |
| 7 | "Mark as paid?" / "Mark not paid?" confirm sheet (BottomSheet, mock-up first) | S | low |
| 8 | menu editing in a sheet with a footer Save (ticks: explicit save; dish edits batched) | M (L for one transaction) | medium; mock-up first |

**Deploy impact (expected):** client only for 1–7; no migration, no secret. Live check: tick dishes, change a chef, Confirm and Paid on the tablet; a second device still updates live.

## Owner answers (18 Oct, questions page)
- **S1 = B:** fixes 1–6 in 1.0.42, including optimistic Confirm / Paid (undo on failure), plus memoized selectors in the screens the fixes touch (owner asked about Redux/memo). Mock-ups next for fix 7 ("Mark as paid?" / "Mark not paid?" sheet) and fix 8 (menu editing in a sheet with a footer Save).
- **Fix 7 confirmed (owner, 18 Oct):** "for paid we will need to add confirmation modal to seller, paid or unpaid since it's important; confirm is okay" — a confirm sheet for Paid and for Not paid; Confirm (status) stays one tap. Mock-up `uxDesign/seller/mockups/103-paid-sheet.html` (sheet vs dialog to pick).
- **Fix 7 look = A (owner, 18 Oct):** a bottom sheet on tablet and phone (same style as the other sheets), "Mark paid" / "Mark not paid" (red outline) + Cancel, showing code, name and total; the change shows at once after confirming.
- **Fix 8 ruling (owner "A", 18 Oct), replaces the A/B sheet choice:** one way of editing for draft and published menus.
  - **Published menu:** only quick row actions on the live menu (e.g. Sold out) stay instant (optimistic, roll back on failure). Adding/removing dishes, chef, name, size need **Edit** first, which opens an edit session: changes kept on the device, a pill "Not saved · N changes" → Save (customers see the change only after Save) / Discard; leaving asks "Save N changes?".
  - **Draft (not published):** the same session with "Draft · N changes not saved"; saved automatically on the next wizard step or with Save.
  - Owner: "double check what shows in the row in menu and home screen when menu is published and active" — the mock-up update starts with an inventory of today's published-menu rows (Menu screen and Home) and keeps those row actions as they are.
  - **Saving indicator** (owner, 18 Oct: "in modal when save, we can show saving indicator or spinner"): after Save in the edit session (and in the Paid sheet), the button shows a small spinner + "Saving…" and stays disabled until the answer; then "Saved ✓" and the sheet closes, or the error state keeps the changes.
  - **Edit menu picks existing dishes; new dishes are made in the dish library** (owner, 18 Oct: "on edit menu allow it to include existing dishes, dishes can be added on dishes library"): the edit sheet's Dishes tab lists the library (tick, search, saved sets, past menus); creating a dish happens in "Your dishes".
  - **Published rows: no pencil (owner "A", 18 Oct).** A published menu row keeps only the instant Sold out switch; one **Edit menu** button opens the edit sheet for everything else (dishes, chef, name, size, price, limit, details).
