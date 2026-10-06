# Product overview

A summary of [the concept brief](../../briefs/food-ordering-concept-brief.md), which stays the source of truth. If this page and the brief disagree, the brief wins; flag the gap to the owner.

A home cook publishes a short menu every **Wednesday** for **pickup or delivery on Saturday**. Customers order through a link (in English or Bahasa Indonesia), get an **order number**, and send it to the seller on **WhatsApp**. The seller moves each order through its statuses, and customers are notified. **No payment handling, no customer accounts, no phone numbers in the cloud.**

Scale: one seller, about 10–50 orders a week, one ordering round per week.

## Weekly cycle

Wednesday publish (up to 10 items, up to 5 images) → Wednesday to Friday customers order and can change their order until the cut-off → Saturday cook, mark ready or out for delivery, then collected or delivered.

## Seller

- Publish the weekly menu: per item a name and short description in **EN + ID**, price in AUD (cents allowed), a size or quantity ("4 pieces", "250 g"), and an optional portion limit.
- Reuse menus by keeping a rotation of **4–5 saved menu sets**, or editing last week's.
- **Share to WhatsApp:** one tap builds the group post: images, the item list in the familiar friendly style (ID, EN or both) and the order link.
- Set the cut-off time and the Saturday pickup and delivery details.
- See all orders, statuses and the **total of each item to cook**. Live updates as orders arrive.
- Match a WhatsApp message to an order by its number. Keep customer phone numbers **on the seller's device only**, with export and import to a file.
- Update status with one tap. An optional **Paid** tick for the seller's own reference.
- **Print labels** (A4 sheet or label printer) showing the order number, QR, first name, items and quantities, and pickup or delivery, with item names in both languages.

## Customer

1. Open the link or QR and see this week's menu.
2. Pick items and quantities, choose pickup or delivery, and enter a name.
3. Get an order number and QR, saved on the phone in "My orders".
4. Tap "Send to seller on WhatsApp", which opens a pre-filled message (number, items, total).
5. Change or cancel the order until the cut-off.
6. Get notified at each status change. An in-app inbox always shows the updates too.

## Statuses

Ordered → Confirmed → Ready for pickup / Out for delivery → Collected / Delivered, or Cancelled at any point.

## Pickup and delivery

The customer scans the QR on their container. If it's in their "My orders", they tap Collected; otherwise the app says "This isn't your order". The seller or a helper can scan the label or type the number. A driver scans at the door to mark it Delivered, and can send "Arriving soon" with one tap.

## Rules that shape every design

- **Bilingual EN / ID throughout** (screens, statuses, notifications, the WhatsApp text, labels) via i18n (react-i18next) from day one. Use the phone's language by default, with an EN/ID switch on every screen that is remembered. If one language is missing for an item, show the other. Dates follow the language (Saturday / Sabtu), and prices stay in AUD.
- **Order codes:** 6 characters, uppercase letters and digits, no look-alikes (O/0, I/1), shown as `K7F-2QX`. Input is forgiving (lowercase, spaces, missing dash) and the order opens on the 6th character. The private order link uses a **separate long random token**. Code lookups are rate-limited.
- **No phone numbers in the cloud. No customer accounts.** The phone remembers the customer's orders.
- **A web app from a normal link** that feels native on phones and can be added to the iPhone Home Screen (needed for push on iOS 16.4+). No App Store.
- **Web Push (VAPID):** ask for permission only after the customer taps "Turn on updates". Address notifications to the order or device, never to a phone number. Send in batches (50 subrequests per request on the Cloudflare free plan) and drop expired subscriptions.
- **Destructive actions** (cancel, delete) need a second tap.
- **Minimal storage:** only the current week, plus 4–5 saved menu sets. Old orders are deleted or reduced to weekly totals after a few weeks. Images are resized and compressed on upload.
- **Free hosting:** Cloudflare free plan (Workers, D1, Durable Objects for live updates, R2 for images).
- **Open source on GitHub.**
- **Test on real phones early**, especially iPhone.

## Open questions

Ask one at a time, A / B / C with a recommendation. Record each answer in [decisions](../decisions/README.md) and remove it from this list.

1. Delivery address: collected in the app, or only by WhatsApp (keeping it off the cloud)?
2. Pickup time slots, or one pickup window?
3. What happens to orders the seller never confirms by the cut-off?
