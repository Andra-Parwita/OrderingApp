# Kitchen: Cook and Pack (owner's design note, 2026-10-09)

Kitchen now has two tabs at the top: **Cook** (by dish, how many to make) and **Pack** (by order, each customer's bag to tick). Both use the same orders.

## Pack tab (new board, next to Kitchen)

**Bag list on the left:** one row per order with the name, code, place and time, and progress such as "2/3", or "Packed" with a filled tick. You can sort by pickup time, place or code, so bags can be packed in the order they'll be collected.

**The open bag on the right:**
- The code and name in large type, plus pickup place and time or delivery.
- The customer's note, if any, highlighted, for example "Less spicy for the rendang, please."
- Each item as a large tick row ("2× Rendang · Regular"). A ticked item fades and is struck through.
- **"Packed · next bag":** this button marks the bag done and opens the next unpacked one, so the seller can work down the line without going back to the list. It never blocks: if something isn't ticked it says "1 not ticked yet. You can still mark it packed." **Skip for now** leaves a bag for later.

**Header:** shows "3 of 10 bags packed", with **Print labels** next to it, since labels and bags go together.

## Packing and order status are separate (owner, 2026-10-09)

Packing and order status are now separate. Marking a bag packed only records that the bag is done in the Kitchen. It doesn't change the order or tell the customer anything. When all items are ticked, the hint now reads: "All in. Packing doesn't change the order status; mark it ready in Pickup & delivery."

For your implementer, "packed" is its own flag on an order, next to status, paid and locked. Pickup & delivery can show it as a small "Packed" tag, so the seller can see which bags are waiting before marking them Ready.

The per-item ticks are saved on the server with the order, like "packed", so every device sees the same bag (owner, 2026-10-09).
