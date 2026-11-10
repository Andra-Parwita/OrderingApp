# 127 · Change the menu's delivery days from the seller phone

**Target: hotfix 1.0.46.1** (client only). **Status:** mock-up `uxDesign/seller/mockups/127-phone-delivery-days.html` approved, option A (owner 10 Nov: "now is better with 2 rows").

## Why (owner, 10 Nov)
"I want her to be able to change the menu's delivery days from the phone too … the same chip band in the phone's menu view, with a mock-up first." Today the delivery days (plan 126, delivery on another day) are set only in the tablet's menu Details; the phone's read-only menu (plan 124, phone menu card) only lists them.

## What
- **Where:** the phone's read-only menu (tap the Menu card on Orders), owner only, menu not finished, Delivery on. The "Delivery days: …" line becomes a **Delivery days** section with the **same chip band** as the tablet: 2 days before, the event day (soft blue), 1 day after; ✓ = a delivery day, dotted = not; 🔒 = the default, tap it for the "Default delivery day" sheet; the amber warning for the day 2 before; same hint.
- **Saving:** changes are held until **Save** (a sticky bar "Save delivery days · Discard" appears once something changed), like the tablet's edit mode; the same server rules and route as the tablet (`menus/current` delivery days + default). Orders keep their day (plan 126 ruling).
- Delivery off: the section says "Delivery is off for this menu. Turn it on on the tablet." (no chips).
- Not in scope: dishes, prices or times on the phone.

## Owner rulings (10 Nov)
- One row of 4 chips on the phone: "so ugly … you can have 2 rows" → **option A: two rows of two**, each a full date on one line ("Fri 13 Nov"), equal size, aligned grid; ＋ dotted = not a delivery day, ✓ green = a delivery day, blue + 🔒 "default" = the event day / default. Option B (summary row + bottom sheet) drawn but not chosen.

- **Keep open on the phone (owner "A"):** the "Keep the menu open 1 more day" switch with its finish-time line sits under the delivery days on the phone menu view, saved with the same Save bar.

## Stages
| # | what | proof |
|---|---|---|
| 0 | mock-up | owner OK |
| 1 | phone menu layer: chip band (shared DayChips + DefaultDaySheet), Save/Discard bar, owner only, EN/ID | unit: owner only, save sends the days + default, discard, delivery off text |
| 2 | captures at 412×915 and 360×780 (looked at), Android emulator Pixel_9, `e2e/p126-delivery-day.spec.ts` + one new phone check | logs, screenshots |

**Deploy impact:** client only (reuses the 1.0.46 route and columns), no migration.
- **Also in 1.0.46.1 (owner, 10 Nov): kitchen switch from the collapsed tablet menu.** Rina joined Onde Onde and could not switch back: with the left menu collapsed the kitchen name (the switcher) is hidden. Owner: "put it in the same release with the delivery selection on the mobile phone." → in the collapsed rail, when the person has 2+ kitchens, tapping the logo / kitchen initial opens the same kitchen list (aria-label "Switch kitchen: <name>"); one kitchen = no change.
- **Also in 1.0.46.1 (owner "A", 10 Nov): no Switch person in the collapsed tablet menu.** In the collapsed rail the ⇄ button sat just above the expand arrow; its "Tap again" warning was only a tooltip (invisible on touch), so a second tap signed out (Rina, then the owner). → Switch person shows only in the **open** rail (with its visible two-tap warning); the collapsed rail has no ⇄.
- **Also in 1.0.46.1 (owner "ok", 10 Nov): sign-in hint.** Rina did not know "Use PIN" means the tablet's own unlock PIN. Under "Sign in with your screen lock": "Your tablet or phone asks for its own fingerprint, face or the PIN you unlock it with." / "Tablet atau HP akan meminta sidik jari, wajah, atau PIN yang Anda pakai untuk membuka perangkat itu."
