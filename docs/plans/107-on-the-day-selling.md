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
