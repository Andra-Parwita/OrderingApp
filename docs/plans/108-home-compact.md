# 108 · Seller Home: smaller text, better use of space (tablet first)

**Status:** in **1.0.42** (owner, 18 Oct: "we may need to include 108 in 42 build since it's just UI only"); builds after the owner picks options in the mock-up.
**Owner, 18 Oct** (photo of the Samsung tablet, live 1.0.41, dark mode, Home while taking orders): "Seems like our text is so big and not efficiently using the spaces (focus on this home screen first)."

## What the photo shows (Home, taking orders)
- Title "Menu for Wed 21 Oct" very large; "Orders close Tue 20 Oct, 3:30 pm · 1 d 20 h left" under it; "Go to Orders" button.
- Phase strip of 4 steps (Make the menu · Taking orders · Cooking day · Finished) with bars, taking a full band.
- Four big number tiles: 4 orders · 1 cancelled; $60.00 total · $12.00 paid; 0 to confirm · 0 changed; 3 not paid · $48.00.
- Dishes: one row per dish with a long meter and "10 left" / "10 · no limit"; "Go to Menu to change limits"; "Per chef" button.
- Right column: Cooking day Wed 21 Oct; Bakulan pickup 10 am–12 pm · 3; Delivery · 1.
- Only ~3 dishes visible on the first screen; large empty gaps.

## Goal
Same information and actions, smaller type and tighter spacing so the whole Home fits a 1138×640 tablet screen with all dishes of a typical menu (8–12) visible; no new information or features. Phone checked too. Button labels never wrap.

## Related
- 107: on cooking day Home shows a small read-only "On the day" summary (per dish sold on the day / left) with a link to Menu › On the day.
- 100 (Cook compact), 104 (delivery rows) follow the same density direction.

## Menu screen too (owner, 18 Oct)
"Also in Menu, the header and the menu event headers are both also too big; we need to be able to show more list." Photo: page header "Menu" + Your dishes / Saved sets / Past menus; event header "LIVE MENU", big "Wed 21 Oct", meta line, Edit details / Share again / Unpublish; only 3 dish rows on screen. Same goal: slim headers, ~12 rows on the tablet. Combined with the 1.0.42 Fix 8 rulings (one "Edit menu" button, no pencil on published rows).

## Orders detail panel (owner, 18 Oct)
"The order detail panel top seems like one with the orders toolbar on top, so maybe make the panel pop up a bit or have a better panel header? Can be taller too." Also seen in the photo: "Mark ready for pickup" wraps to two lines (no-wrap rule). Mock-up options: A raised panel with its own header, taller (from the top of the content area); B same header under the toolbar with clear separation.

## Owner answers
- **Home = A (owner, 18 Oct):** compact, small numbers in one row; "make sure it's okay, no wasted spaces" — check against the owner's photo state (taking orders, 3+ dishes, cooking day panel) on the 1138×640 tablet in dark mode: no large empty gaps, all dishes of an 8–12 dish menu visible.
- **Orders toolbar too big (owner, 18 Oct, iPad photo, light):** "the top toolbar is big": six large boxed icon buttons (search, scan, print, +, …, ^) next to "Orders · Live · Taking orders"; the tabs row is cut ("Cancell…"); "Mark out for delivery" wraps to two lines. Owner on the raised panel beside the toolbar: "okay, but sometimes your toolbar is large, so moving it left could be problematic." Proposal: compact toolbar first (smaller icon buttons, tighter gaps, rarely used ones in "…"), then the raised panel beside it; below ~1024 px the panel goes under the toolbar.
- **Order rows (owner, 18 Oct, photo of the list without the panel):** a big empty gap between the left (code, name, chips, items) and the right (price, status); each order takes two lines. Idea for the mock-up: one line on wide screens. **Show the customer's note on the row** as text cut with an ellipsis (owner: "showing note on the row with ellipsis may be good, having the icon itself may not be enough"); full note in the panel. **When the panel is open (list narrower), the note is hidden from the rows** (owner, 18 Oct).
- **Orders panel = A (owner, 18 Oct, clarified):** raised panel (shadow/border) **under** the toolbar, its own header bar (code, name, ✕, chips) and a fixed footer with one-line buttons ("Out for delivery", "Ready for pickup"); toolbar unchanged.
