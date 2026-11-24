# 134 · Make and change menus from the seller phone

**Target:** 1.0.48, together with plan 133 (owner "B", 24 Nov). **Status:** ✅ live in 1.0.48 (25 Nov, Worker `e99199ee`). owner "A" (24 Nov); mock-up `uxDesign/seller/mockups/134-menu-from-phone.html`, approved (owner "B", 24 Nov: OK, ship with 133 as 1.0.48); built B1 (24 Nov) + B2 (25 Nov), layout fixes from the captures; Android emulator check before deploy.

## Why (owner, 24 Nov)
"Rina actually wants to be able to add new items and create a menu from the phone (her Android), since her tablet is sometimes used by her daughter, and she can add or create a menu using her phone while she is on the lunch break of her real job."

## Today (code, 24 Nov)
- Phone **can**: Your dishes (More → Your dishes: add and edit dishes, plan 051); the Orders menu card: publish a ready draft, delivery days + keep open, new-menu notice, Share menu, read-only menu (plans 124, 127).
- Phone **cannot** (`TABLET_ONLY` in `src/app/sellerNav.ts`, "Open this on a tablet or computer"): the menu wizard `/seller/menu` (Dishes, Details, Check, Publish), editing a live menu (Dishes / Details / Prices), sets, Settings. The menu card says "Finish on the tablet: …" when a draft is not ready.

## Owner ruling (24 Nov): "A, especially adding new dishes"
- The phone does **all** menu-making, phone-sized: a new menu with the same four steps as the tablet (**Dishes, Details, Check, Publish**), and changing a live menu (**Dishes / Details / Prices**). Then Rina never needs the tablet for menus.
- **Adding new dishes is the most important part:** making a new dish must be quick from inside the menu's Dishes step (and stay in Your dishes), with its name, size, price and picture.
- `/seller/menu` leaves `TABLET_ONLY` for owners on the phone; sets, Settings and the rest stay as today unless asked.

## Stages
| # | what | proof |
|---|---|---|
| 0 | mock-up: phone wizard (4 steps), new dish from the Dishes step, live-menu edit tabs | owner OK |
| 1 | build (one builder per step group, sequential) | unit + phone e2e |
| 2 | captures 412×915 (+125/150 %), emulator phone, tablet unchanged | pictures looked at |
