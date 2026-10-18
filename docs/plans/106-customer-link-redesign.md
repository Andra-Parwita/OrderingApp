# 106 · Seller's customer list: clearer "Link to a saved customer?"

**Status:** collecting (owner, 18 Oct); explainer of today's behaviour: `uxDesign/seller/mockups/106-customer-link-today.html` (8 scenarios, 15 unclear points). No redesign approved yet.

## Owner input (18 Oct)
- "I think that modal or text are not clear" — asked for the explainer of today's behaviour to re-review.
- Asked what "New customer" in the window does (today: saves name + customer code on this device, no phone number; the window doesn't say to type the number).
- **Show duplicate names where possible** (owner: "also ideally show if there is duplicate name if possible"): when an order's name matches one or more saved customers (or two saved customers share a name), say so clearly — e.g. "2 saved customers called Anin" with their last order date and the last digits of the number — so the seller doesn't link the wrong person.
- Button labels never wrap (design rule, `docs/design/README.md`).

## Main unclear points to solve (from the explainer)
"New customer" means three things; "Returning" (from the customer's phone) vs "saved" (seller's device list) look related but aren't; Skip and ✕ are the same and the window comes back; New customer saves no number; the list is per device; the backup reminder's Later lasts one page load.

## Next
Owner reviews the explainer → redesign options in a mock-up → plan stages.

- **In release 1.0.42** (owner, 18 Oct: "I want 107 and 106"). Next: redesign options mock-up, then questions one at a time.
- **Option A ok (owner, 18 Oct: "106: ok").**
- **Customer list screen (owner: "do we have customer list or can we show existing or past customer list?"):** today there is none — Settings/More "Customer details" shows only a count + backup/upload (`src/features/seller-orders/contacts/ContactsBackup.tsx`); the list is in `addressBook` (`listCustomers`). Add a "Customers" list on this device: search, name, last 3 digits, last order date, edit name/number, delete, and duplicate names flagged. Mock-up first; 1.0.42 with the rest of 106.
- **Changed to Option B (owner, 18 Oct, after seeing the options on the phone):** two short steps — step 1 "Same person on a new phone" / "Someone new"; step 2 the duplicate list (with …last 3 digits · last order) or the number field + Save customer. Same wording fixes as A (one meaning per word, "Order … is confirmed", Skip choices, Later explained, per-device note).
- **Correction (owner, 18 Oct): Option A, not B** ("for 106, I like A not B"): one window with "Same person on a new phone" / "Someone new", the number field in the same step, duplicates with …last 3 digits · last order. The "Changed to Option B" line above is withdrawn.
- **Customers list layout (owner, 18 Oct: "why not put the toolbar to backup or upload on top?"):** a toolbar at the top with Search, Download backup and Upload; the "Saved on this tablet only" note under it; the list below.
- **Show the address (owner, 18 Oct: "is it possible to see address when it is not yet deleted or expired?"):** yes — the device list already keeps a saved delivery address per customer (`bookTypes.ts` `address?: BookAddress`, in the backup CSV). The list row shows a short "Wattle St, Fullarton" line when one is saved; the edit sheet shows and edits the full address. (The server copy of an order address is separate: encrypted, deleted one day after the menu ends, D-099.)
- **Q1 = A (owner, 18 Oct: "consistent with orders"):** tapping a row opens Edit (name, number, address) like an order row opens its panel; Delete inside the edit sheet with a confirm.
- **Q2 = B (owner, 18 Oct):** list sorted A to Z by name.
- **Q3 = A (owner, 18 Oct): "+ Add customer" in the top toolbar.** Fields (the existing saved-customer shape, device only): first name (required), WhatsApp number (optional, AU mobile), delivery address: street, suburb, postcode, notes for the driver (all optional). No customer code yet; it gets linked the first time that person orders from a phone ("Same person on a new phone" in the confirm window). Phone and address stay on this device (and in its backup file), never on the server.
- **Q4 = A (owner, 18 Oct), in plain words:** Delete confirm says: "Remove Anin from this tablet? Her name, number and address are deleted from this tablet only. Her past orders stay as they are. If you have a backup file, she comes back when you upload it."
- **Clearer link wording (owner: "'Same person on a new phone' is confusing; maybe: it may be the same person in our list? or we think this is a new person, or you can link to an existing customer; a bit more explanation"):** proposed wording below, waiting for the owner's OK, then applied to the built window.
- **Wording approved (owner "A", 18 Oct):** title "Order K7Q2MD is confirmed."; "Is Anin already in your customer list? Your list is saved on this tablet only."; "We found 2 customers called Anin:" rows "Anin · …678 · last order 4 Oct" → "This is her" (gender-neutral in code: "This is them"/"Ini dia"); hint "Choosing her means her next orders show her saved number and address."; "Or: she's a new customer" → name, WhatsApp number (optional) → "Add to my list"; no match: "Anin isn't in your list yet"; skips "Ask me next time" · "Don't ask for this order".
