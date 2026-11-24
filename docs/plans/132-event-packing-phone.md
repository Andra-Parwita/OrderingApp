# 132 · Packing on the phone at the event: item ticks, auto-ready, totals everywhere

**Target:** next small release (with the owner's other updates of 15 Nov). **Status:** mock-up `uxDesign/seller/mockups/132-event-packing.html` (also covers plan 131), approved (owner "A", 15 Nov, v2 with the pack sheet); building.

## Why (owner, 15 Nov, after the DellaVee event)
"The seller does the packing on event day at the event place, so we need to update a few UI things": the total price must show on the order rows (Orders and the Kitchen screens); on the phone, each item in an order gets a tick the seller or a helper ticks while preparing, and when all are ticked the order is "Ready to pickup"; the total price is very important and on the order detail panel some need to scroll down for it, so the total should be **pinned on top**.

## What
1. **Total price on every order row**: Orders (tablet + phone; already there, keep aligned) and the **Kitchen** screens' order rows (Cook / Pack bag rows), in the shared column layout.
2. **Order detail, phone and tablet** (owner 15 Nov: "tick to pack item also good in seller"): a **tick per item line** (the existing packing ticks, D-066, saved on the server, so the tablet's Pack tab, the phone and several helpers stay in step). Seller and helper roles that may pack can tick.
3. **All ticked → automatically Packed + Ready for pickup** (owner **"A"**), with a short **Undo** (a few seconds) for a wrong tap; the customer gets the usual "ready" message (only after the undo window, so an undone tap sends nothing). Applies to pickup and delivery orders.
4. **Total pinned at the top** of the order detail (tablet panel and phone page): the order code, name and **Total $…** stay visible while the rest scrolls.

## Owner rulings (15 Nov)
- **"A"** (with the owner's photos of the tablet Pack tab and the phone order detail): "total price are important, since buyer will pay when they pickup" → total **plus Paid / Not paid** in these places:
  | place | change |
  |---|---|
  | Orders rows (tablet + phone) | total already there; add Paid / Not paid if missing, keep aligned |
  | Kitchen → Pack bag rows | total + Paid / Not paid; place + time on one line (no 2-line address) |
  | Kitchen → Pack open bag | pinned header: code, name, Total, Paid / Not paid |
  | Order detail (tablet panel + phone) | ticks per item, "N of M packed", the same pinned header |
  | Pickup & delivery (hand-over) rows | total + Not paid |
- Seen in the photo, fix in any case: tablet Pack header "Print labels" and "0 of 4 items in the b…" cut off at the right edge (Rina's Samsung tablet, landscape).

- **Correction after the mock-up (owner, 15 Nov):** "I don't suggest tick or untick is live for packing, so treat it like a modal; they need to tick Ready or Save or something like that, especially on phone (can then Save and next order etc.). Sometimes they pack ad hoc: the customer arrives, then they find the order and start packing." → replaces the auto-ready-with-Undo idea: packing happens in a **pack sheet** (modal) opened from the order; ticks are saved only by its buttons, never on each tap; no automatic Ready. Finding an order quickly (customer standing there) must be easy. **Buttons (owner "A"):** **Ready for pickup** (big, green: saves the ticks, marks Packed + Ready, sends the usual message; if items are unticked it asks "N items not ticked. Ready anyway?", D-062 warn-never-block), **Save** (keeps the ticks, closes, order unchanged), **Ready & next order** (as Ready, then opens the next unpacked order by pickup time). Ad hoc: Orders search (name or code) → order → Pack.
- **Footer pinned (owner, 15 Nov):** on the tablet too, the action buttons are pinned at the bottom and visible without scrolling (order detail panel, pack sheet, Kitchen → Pack), like the pinned total on top.

- **Delivery orders (owner "A", 15 Nov):** in the pack sheet and Kitchen → Pack, a delivery order's button reads **"Packed"** (and "Packed & next order" / "Packed & next bag"): it saves the ticks and marks the bag packed, **no status change and no message**. "Out for delivery" stays a separate tap (order detail or Pickup & delivery) when the driver leaves, so customers don't get "on the way" while bags are packed at the event.

## Open questions (after the mock-up)
- None yet.

## Stages
| # | what | proof |
|---|---|---|
| 0 | mock-up v2 (pack sheet, pinned header + footer, totals) | ✅ owner "A" 15 Nov |
| 1A | orders: pinned header/footer on order detail (phone + tablet panel), Pack sheet + pack-and-ready action (new `src/features/seller-pack/`), Orders rows total + Paid + packed count | typecheck, unit |
| 1B | plan 131 (migration 0038, settings, new-menu default) + Pickup & delivery total column | typecheck, unit |
| 1C | Kitchen → Pack: rows total + one-line place, pinned header, buttons Ready & next bag / Ready / Save, ticks saved only by a button, header not clipped | typecheck, unit |
| 2 | captures phone + tablet (looked at), emulator Pixel_9 + Tablet_11, directed specs | logs, screenshots |
