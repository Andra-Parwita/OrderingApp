# 104 · Seller small fixes from the owner's tablet and phone checks (18 Oct)

**Status:** collecting (owner, 18 Oct); target 1.0.42. Each item is small; UI items get a mock-up or a before/after capture first.

| # | item | owner / source | size |
|---|---|---|---|
| 1 | **Labels page: "Printer settings" (label printer 62 mm roll) above the preview**, not hidden at the bottom | owner, 18 Oct: "Printer setting should be on top, so not hidden at the bottom" | S |
| 2 | Labels page preview is cut off on the right on the Samsung tablet (second column clipped) | owner's photo, 18 Oct | S |
| 3 | Bag label: the customer's note prints very small and right under a rule; bigger, with space above | coordinator, from the owner's print preview photo | S |
| 4 | Orders header: the "Not paid" chip is clipped below ~1,100 px; New order / "…" spill at 712 px portrait | tablet repro, 18 Oct | S |
| 5 | Pickup & delivery on the tablet: one delivery is a tall 7-line card in the left third; one or two lines across the width | owner, 18 Oct: "This also a waste of space (row)" — mock-up asked (A/B pending) | S–M |

**Deploy impact (expected):** client only; no migration, no secret.

## Owner answers (18 Oct, questions page)
- **T1 = A:** mock-up the Pickup & delivery tablet rows for 1.0.42.
- **T2 = A:** bag label note bigger, with space above, in 1.0.42.
- **P1 = A:** customer app: if a seller passkey is picked, say so and name the right one ("customer (Remember me)"). Small, 1.0.42.
- **Chef permissions C1–C5 = A, keep all as today:** delete address now, add/edit orders, change fulfilment, set paid, lock, WhatsApp received, messages to all customers, Translate, demo samples, read Settings and pictures, cancel a normal order.
- **New design rule (owner, 18 Oct): button labels never wrap to two lines** — shorter label, then icon-only, when space runs out (Samsung zoom/text). Recorded in `docs/design/README.md`. Apply first to the phone toolbars (Cook B2, Orders header, order panel footer); check at 360 px and font size +1.
- **Orders tab "All" becomes "Active"** (owner, 18 Oct: "on order screen we should have active tab (all orders without cancelled), so let's simply replace the text as Active instead of All"): the first tab lists every order except cancelled (Done orders stay in it); EN "Active", ID "Aktif"; the count excludes cancelled. Cancelled keeps its own tab.
- **Print orders asks what to include** (owner: "in print orders, we can ask also what to be included in order print"), like the labels page's "Which orders": e.g. Active (default) / Confirmed / Selected / All incl. cancelled. Mock-up or capture first. Target 1.0.42 with the rest of 104.
- **Tablet rail order (owner, 18 Oct: "maybe the order on left is Home, Menu, Orders, then as is"):** Home, Menu, Orders, then Private, Kitchen, Pickup & delivery, Dishes, Settings, Help, About. Phone tab bar unchanged. 1.0.42.
- **Delivery rows in 1.0.42 (owner, 18 Oct: "2 or 3 lines are ok, as long as it can use the whole width efficiently"):** option B style (2 lines; 3 allowed when needed), full width on the tablet; Delete address in the "…" menu; pickups in the same style; phone stacks. Plus the button rule on the 3 phone toolbars (Cook, Orders header, order panel) after builders 3a/3c finish (Fable report).
- **Pickup & delivery filter (owner, 18 Oct: "may want to have filter to see delivery only or pickup only"):** a segmented filter "All · Deliveries · Pickups" (with counts) at the top of the Pickup & delivery screen; remembered on this device. Built with the delivery rows.
- **Admin short message preview (owner, 18 Oct: "how many characters? if we have a limit we should also show the preview of the text being cut"; "can we include emoji?"):** limit is 90 characters per language (`shared/shortMessage.ts` MESSAGE_MAX, counted per symbol); emoji are allowed (some count as 2). The pill shows one line and cuts with "…". Admin composer: a live preview as the real notice pill at phone width (≈360 px) and tablet width, EN and ID, showing exactly where it is cut, plus a counter "64 / 90". Replaces the old bubble preview (open follow-up from 1.0.41). 1.0.42.
- **Scroll (owner, 18 Oct):** Home on the tablet can't scroll (fixed one-screen shell, no inner scroll) → fixed; "double check every main screen to make sure scroll works okay" → check of all main seller screens.
- **Order panel as a card (owner):** 4px corners, border, soft shadow, small margin (done in `ListWithPanel.tsx`).
- **Customer "Check your address" (owner, iPhone 15 Pro):** the map is so tall the "Is the pin in the right place?" answers are hidden under the sticky "Next" footer; map adapts to the screen, content scrolls with footer padding, map doesn't trap scrolling.
- **Small maps are view-only (owner "A", 18 Oct):** the address-check and pickup maps don't pan/zoom so the page scrolls; "Check in Apple Maps" / "View on map" open full Maps. Owner can change.
