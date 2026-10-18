# 107 · "Sell" made obvious: on-the-day dishes as part of the menu

**Status:** idea (owner, 18 Oct); not approved. Not in 1.0.42 unless the owner says so.

## Owner, 18 Oct
"So instead of Sell it could be 'On event dishes or menu'? And it needs to be obvious on screen what that means. It could be part of menu but in a different group or tab inside the menu view. So live menu or menu should also include items on the event day only."

## Today (from code)
- Rail item **Sell** (`src/features/seller-saturday/SellScreen.tsx`): dishes marked "Sold on the day" in the dish editor, with portions left, Sell one / Sell N, Set count, Undo, "Sold out at the stall"; Summary tab (pre-ordered vs on the day vs left, by person, log, CSV); live across devices.
- A dish is "sold on the day" by a flag in the dish editor; there is no separate group in the menu for it.

## Coordinator's reading (to confirm with the owner)
1. Rename and place: the stall selling lives **inside the Menu view** as its own tab or group, e.g. Menu tabs "Pre-orders | On the day", instead of a separate "Sell" rail item (or the rail item renamed "On the day").
2. The menu can hold **dishes sold only on the day** (not orderable by customers in advance), shown in that group, besides dishes sold both ways.
3. The words on screen say plainly what it is: "Sold at the stall on Sat 24 Oct — not in customers' pre-orders".

## Open questions (later, one at a time)
- Name: "On the day" / "At the stall" / "Event sales" (EN/ID).
- Customers: do they see on-the-day-only dishes (as "at the stall only") or not at all?
- Rail: keep a shortcut on cooking day, or only inside Menu?

## Owner, 18 Oct (later)
"So instead of Sell we can have Dishes library view": the rail item **Sell** is replaced by **Dishes** (the "Your dishes" library). Sell moves into the Menu view (this plan). Open: when (1.0.42 or with plan 107) and where Sell lives meanwhile.
- **Answer A (owner, 18 Oct): in 1.0.42 the rail shows "Dishes" instead of "Sell"; Sell stays reachable from a clear Menu-screen button ("On the day · Sell at the stall") and in More on the phone, until this plan builds the tab.**
- Finding: the data already supports it: each menu item has `preorder` (customers can pre-order) and `dayStock` (portions for the day); an on-the-day-only item is `preorder: false` + a `dayStock` (`shared/daySalesContract.test.ts:42`). No migration expected.
- **In release 1.0.42** (owner, 18 Oct: "I want 107 and 106"). Open questions first (name, customer visibility, rail), then a mock-up.
- **Q1 name = A (owner, 18 Oct): "On the day"** (EN); ID "Hari H" (first suggestion; owner can change). Menu view tabs "Pre-orders | On the day".
- **Q2 = A (owner, 18 Oct):** customers see on-the-day-only dishes, not orderable, grouped separately: either a separate tab or a separate list under the orderable dishes (mock-up shows both; owner picks).
- **Q3 = A (owner, 18 Oct):** on the menu's cooking day only, Home shows a big "On the day · sell at the stall" button and Menu opens on the On the day tab; other days it lives inside Menu (no rail item). All 107 questions answered; next: mock-up.
- **Home: no big button; show a summary instead (owner, 18 Oct: "menu is ok to have tab; home screen should have also summary of on the day? no need to have the big button since they can go to Menu anyway"):** replaces Q3 = A. On the cooking day Home shows an "On the day" summary (per dish: sold on the day, left; total sold) from the existing Summary data, read-only, with a link to Menu › On the day. Menu tabs "Pre-orders | On the day" stay.
- **Home detail (owner, 18 Oct, later):** no "On the day" button on Home; just show how many items are available on the day, and which are sold out (e.g. "On the day: 4 dishes · Lalampa sold out"). Read-only.
- **Customer layout = (b) one list (owner, 18 Oct):** orderable dishes first, then "On the day only · at the stall" with on-the-day-only dishes (no +, "Available on the day").
