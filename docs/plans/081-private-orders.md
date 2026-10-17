# 081 · Private orders (Khusus): one-off orders for an event

**Status:** owner rulings and mock-up done 17 Oct; building (owner: "all good, let's start private order"); goes in Release 1.0.37 (owner, 17 Oct: "A"). Plan and mock-up first (D-055).
**Owner, 17 Oct:** "when seller want to add 'private event/order' so we may have a page on left menu, private, khusus, where seller can create order for a customer say for birthday, etc, that contain dishes and customer info and address .. which seller can send the order code to customer to follow up .. so this will be maintained by the seller only". Release notes will mention it.

## Understanding (to confirm with the owner, one question at a time)
- A new **Private / Khusus** page in the seller app's menu (left rail on tablet; More on phone?).
- Only the seller's team creates and manages a private order; customers can't create one.
- It holds: dishes (from the dish library or typed, own prices), the event date and time, the customer's name and details, pickup or a delivery address, a note.
- The seller sends the **order code** to the customer (e.g. WhatsApp); the customer follows it on the usual order page (status updates).
- Separate from the weekly menu: never on the public menu, no effect on its limits or cut-off.

## Owner rulings
- **Several private orders can be active on the same day** (owner, 17 Oct: "seller can have multiple private orders active on same day").
- **Customer details: name, address, a note; no phone number** (owner "A", 17 Oct). The address is encrypted like D-099 and deleted one day after the event date; the seller reaches the customer on WhatsApp.
- **Roles** (owner "A", 17 Oct): owners create, edit and cancel private orders; chefs and helpers see them and update the status (cooking, ready, handed over).
- **Day tools** (owner "A", 17 Oct): on its event day a private order shows in Cook, Pack, labels and per-chef income, marked "Private"; the Private page is where they are made and checked.
- **Dishes** (owner, 17 Oct: "all order can be added to dishes ... since this maybe usable dishes"): every item of a private order is a library dish; a new item made while building the order is saved to the dish library so it can be reused. The price and quantity can be changed for that order (coordinator's reading, owner may correct). Owner, 17 Oct: "all dishes are in dishes library ... since in menu ... seller may select which dishes would be used": pick dishes from the library the same way the menu wizard does.
- **Payment** (owner "A", 17 Oct): Paid / Not paid plus an optional "Deposit paid $…"; the order shows what is still to pay. No money handled by the app.
- **Where it sits** (owner "A", 17 Oct): tablet left menu under Orders; phone inside More, with a small count on More when a private order is due today or tomorrow.
- **Delivery first** (owner, 17 Oct: "private order usually is delivery"): a new private order starts on Delivery; Pickup stays possible and then picks one of the kitchen's pickup places (coordinator's default, as menu orders do).
- **Mock-up** `uxDesign/seller/mockups/081-private-orders.html` (17 Oct): a "Private" tag only where private orders mix with menu orders (Cook, Pack, Orders), not on every row of the Private page.
- **Cancelled** (owner "A", 17 Oct): a cancelled private order moves to Past with a "Cancelled" label; filters stay Upcoming / Past.
- **Changes** (owner "A", 17 Oct): the customer asks on WhatsApp only ("Need a change? Message <kitchen> on WhatsApp."); the owner edits the order. No request button.
- **Simple to check or see** (owner, 17 Oct: "make it simple to check or see"): one clear list in the seller app's Private page.

## Open questions
1. ~~Customer info~~ decided: A (above).
2. Build on the existing seller "New order" (current menu only) or a separate kind of order? (coordinator's call at build time; not an owner question)
3. ~~Roles~~ decided: A (above).
4. ~~Cook/pack lists, printing, per-chef income~~ decided: A (above). Payment decided: A (above).
5. ~~Where it sits~~ decided: A (above).

## Stages (sketch, after the rulings)
| # | stage |
|---|---|
| 1 | mock-up (seller list + editor, customer order page) for the owner |
| 2 | data + routes (migration, private order kind, roles) |
| 3 | seller screens; customer order page |
| 4 | tests, Help, docs, release line |
