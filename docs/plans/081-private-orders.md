# 081 · Private orders (Khusus): one-off orders for an event

**Status:** planning started 17 Oct (owner: "all good, let's start private order"); goes in Release 1.0.37 (owner, 17 Oct: "A"). Plan and mock-up first (D-055).
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
- **Simple to check or see** (owner, 17 Oct: "make it simple to check or see"): one clear list in the seller app's Private page.

## Open questions
1. ~~Customer info~~ decided: A (above).
2. Build on the existing seller "New order" (current menu only) or a separate kind of order?
3. Roles: owner only, or chefs/helpers too?
4. Payment/deposit notes, statuses, printing, cook/pack lists and per-chef income: included or not?
5. Where it sits in the phone menu.

## Stages (sketch, after the rulings)
| # | stage |
|---|---|
| 1 | mock-up (seller list + editor, customer order page) for the owner |
| 2 | data + routes (migration, private order kind, roles) |
| 3 | seller screens; customer order page |
| 4 | tests, Help, docs, release line |
