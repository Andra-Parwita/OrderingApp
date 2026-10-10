# Pickup & delivery (owner's direction for the designer, 2026-10-09)

What we have today is not quite right; the owner is asking the designer to redesign it along these lines.

**Two tabs: Pickup and Delivery.**

**Pickup tab**
- Just the **pickup locations** (from the seller's saved places used by this menu).
- Each location has its **list of customers** (orders) picking up there.
- The seller can **send a message per pickup location**, to everyone picking up there (for example "Ready for pickup", "Ready for pickup in X minutes").

**Delivery tab**
- Just the **list of deliveries** (orders).
- The seller sends a message **to each delivery separately** (for example "Arriving in X minutes", then "Arrived"), since each goes to a different address.

The core job is notifying customers (D-068): ready for pickup (now or in X minutes); arriving in X minutes; arrived.

## Mock-up (owner, 2026-10-09; images in `temp/image1.png` Pickup and `temp/image.png` Delivery, not committed)

**Header:** "Pickup & delivery · Sat 17 Oct" · search "Bag code or name" · two tabs with counts: "Pickup 6 orders · 2 collected by customers", "Delivery 4 orders · 1 delivered".

**Pickup tab:** one column per pickup location (Glenelg, Clayton), side by side.
- Location header: name, time window and directions ("11:00–13:00 · Front porch, blue door"), counts ("3 to collect", "1 to collect · 2 collected"), and the last message sent ("Sent 'Ready for pickup' at 11:05").
- **"Message N"** button per location (N = customers still to collect there).
- One row per order: code, first name, items, status (Ready / Confirmed / "Collected 10:12"), paid or "Not paid · $58.00". Collected orders are greyed and the name struck through.

**Delivery tab:** one row per order.
- Code, first name, items, paid or "Not paid · $71.00".
- A three-step stepper per order: **Out for delivery › Arriving soon › Delivered**. Done steps show a tick; the next step is a filled button; delivered orders are greyed.
- Note above the list: "Addresses aren't in the app; they're in your WhatsApp chats. Each step notifies that customer."

## Message dialog per pickup location (owner heads-up, 2026-10-09)

Opens from "Message N" on a location.
- Title: "Message everyone picking up at Glenelg" · "3 customers · sent as a web push and shown on their order page".
- Choose one: **Ready in [15] min** · **Ready for pickup** · **Your own text**. Each shows when it was last sent ("Sent 10:40", "Sent 11:05").
- "They'll see": a preview of the message ("Your Onde Onde order is ready for pickup at Glenelg.").
- Warn, never block: "You already sent 'Ready for pickup' to this group at 11:05. You can still send it again." Button: **Send again to 3** (or "Send to 3") · Close.
