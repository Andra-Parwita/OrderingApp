# 081 · Private orders (Khusus): one-off orders for an event

**Status:** draft, **after the 1.0.36 deploy**; goes in Release 1.0.37 (owner, 17 Oct: "A"). Plan and mock-up first (D-055).
**Owner, 17 Oct:** "when seller want to add 'private event/order' so we may have a page on left menu, private, khusus, where seller can create order for a customer say for birthday, etc, that contain dishes and customer info and address .. which seller can send the order code to customer to follow up .. so this will be maintained by the seller only". Release notes will mention it.

## Understanding (to confirm with the owner, one question at a time)
- A new **Private / Khusus** page in the seller app's menu (left rail on tablet; More on phone?).
- Only the seller's team creates and manages a private order; customers can't create one.
- It holds: dishes (from the dish library or typed, own prices), the event date and time, the customer's name and details, pickup or a delivery address, a note.
- The seller sends the **order code** to the customer (e.g. WhatsApp); the customer follows it on the usual order page (status updates).
- Separate from the weekly menu: never on the public menu, no effect on its limits or cut-off.

## Open questions
1. Customer info: today no phone numbers in the cloud, and addresses are encrypted and deleted a day after the menu (D-099). A private order's address may need to live until the event date (weeks): what rule?
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
