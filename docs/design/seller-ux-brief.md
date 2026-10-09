# Seller app: UX brief

**For:** the UX designer. **Scope:** the seller app only, the tool a home cook uses to run their food orders. The customer site is not part of this brief.

**Design for the tablet first.** Desktop uses the same layout. A phone gets only a small subset of the app (see "Phone").

---

## 1 · What the seller does

A home cook sells food to family and friends, roughly 10–50 orders per menu. There are no payments in the app and no customer accounts. Customers order through a link and confirm on WhatsApp.

There's no fixed weekday: the seller makes a menu whenever they want.

1. **Make a menu.** Add dishes, set the **cooking day** (usually Saturday) and the **order cut-off**, and choose pickup points and/or delivery.
2. **Publish it.** The menu is now **live**. The seller shares a WhatsApp post with the menu and its order link.
3. **Take orders.** Customers order through the link and send their order number on WhatsApp. After the cut-off, customers can still message the seller, who adds the order by hand.
4. **Cook.** A cook list shows the total of each dish, and labels are printed for the bags.
5. **Pickup / Delivery.** On the cooking day, customers collect at a pickup point or the seller delivers, and status updates go to customers.
6. **Done.** When the cooking day is over, the menu's orders are finished and move to **Past orders**.

**People**
- **The seller (owner)** can do everything.
- **Chefs** help cook. They sign in on their own phone or a shared kitchen tablet, and only see the order and pickup/delivery side (no menu, settings, pictures, chefs or backup).
- A shared tablet can **switch person**, so more than one person can use it.

**Order statuses:** Ordered → Confirmed → Ready for pickup / Out for delivery → Collected / Delivered. An order can also be Cancelled.

---

## 2 · Layout (fixed, don't change)

Two panels: a **left panel** that collapses, and a **main panel** that holds the screen.

| | Left panel open | Left panel collapsed |
|---|---|---|
| Top | The kitchen's **menu image** (2:1) and the kitchen name | The kitchen's **small icon** (square), or its initial |
| Navigation | Orders · Cook list · Pickup / Delivery · Menu · **Settings**, with labels (chefs: no Menu) | Icons only, with a tooltip on each |
| Bottom | Who is signed in (switch person) · language EN / ID · collapse | Language · expand |

- The collapsed or open choice is remembered on each device.
- The **main panel** starts with the kitchen's **banner**: a wide one (5:1) on tablet and desktop, or a 2:1 one on a phone. A background colour or background picture fills the space around it.
- **List and detail sit side by side:** an order opens beside the order list, and a dish opens over the menu.

---

## 3 · Screens and fields

In each table, *Who: all* means the owner and chefs, *owner* means the owner only, and *✓* means the screen is also on the phone.

### Sign-in

| Screen | Fields | Behaviour | Who | Phone |
|---|---|---|---|---|
| **Sign in** | Kitchen picture and name · passkey button · or: username, password | Passkey (face or fingerprint) first; password as a fallback; "First time? Use your invite key" | all | ✓ |
| **First-time setup** | Invite key (from the owner) · or a 6-digit code from another device · then: create a passkey, or set a password | Joins this device to the kitchen | all | ✓ |

### Orders (the home screen)

**What the first page shows:**

| State | First page |
|---|---|
| A menu is live | That menu's order list, with its cut-off time and **New order** |
| An unpublished menu exists | That menu, to keep editing and then **Publish** |
| Neither | The **Past orders** list, with a **New menu** button |

There is only one menu at a time. The next menu can be created only when the live one is done (its cooking day is over); it starts unpublished.

| Screen | Fields | Behaviour | Who | Phone |
|---|---|---|---|---|
| **Order list** | Per row: order code (6 characters) · first name · items summary · total · pickup or delivery · status · paid tick · flags (WhatsApp received, returning customer, changed by customer, entered by staff) · cut-off time in the header | Filter by status; search by name or code; open an order; **New order**; **Share menu**; empty state when there are no orders yet | all | ✓ |
| **Order detail** | Code · first name · language · items (name, size, qty, price) · total · pickup or delivery · customer note · status · paid · locked · WhatsApp received · who entered it · last 4 changes (who, what, when) · messages sent to the customer | **Confirm**; move status on (Ready / Out for delivery / Collected / Delivered); **Mark paid**; **Send WhatsApp link** (reply to the customer); **Lock** (the customer can't change it any more); **Nudge**; **Cancel**; "Changed by customer" is cleared by the next action | all | ✓ |
| **New order** | First name · language · items and quantities · pickup or delivery · note | For orders that come in on WhatsApp, including after the cut-off; **Create**, optionally **Confirm now** and **Mark paid**; then send the customer their link | all | ✓ |

### Cooking

| Screen | Fields | Behaviour | Who | Phone |
|---|---|---|---|---|
| **Cook list** | Each dish: name, size, total to cook · optionally per chef | **Group by** (dish / chef / customer / pickup or delivery) · **Count** (confirmed + ordered, or confirmed only) · totals (orders, income, paid, unpaid) · **Print** | all | |
| **Print labels** | One label per order: code, first name, items, pickup or delivery | Choose **A4 sheet** or **62 mm roll** · **Print** | all | |

### Pickup / Delivery (cooking day) · ID: *Serah terima*

**What matters here:** in reality the seller only needs to **notify the customer**: the order is **ready for pickup** (now, or **in X minutes**), or for delivery it **will arrive in X minutes**, then **has arrived**. Keep these one tap each, per order or for a group. Everything else on these screens is secondary.

| Screen | Fields | Behaviour | Who | Phone |
|---|---|---|---|---|
| **Pickup / Delivery** (hub) | Counts: to collect, to deliver | Choose Pickup or Delivery · **Send an update** | all | ✓ |
| **Pickup** | The current order (code, name, items) · the queue of orders waiting | **Mark collected** · **Next order** · scan the bag label (later) | all | ✓ |
| **Delivery** | Orders to deliver, in order | **Arriving soon** message · **Mark delivered** | all | ✓ |
| **Send an update** | Template (e.g. ready, running late by N minutes) or free text · recipients | **Send to N customers** | all | ✓ |

The names of these screens, in English and Indonesian, are open to the designer's proposal.

### Menu (owner only)

| Screen | Fields | Behaviour | Who | Phone |
|---|---|---|---|---|
| **Menu** | Cooking day · status (draft or live) · **menu picture** (one per menu, usually a collage of several of its dishes, uploaded by the seller; customers see it at the top of the menu on a phone; dishes have no pictures of their own for now, a picture per dish may come later) · list of dishes: name, size, price, limit, remaining, sold out, chef | **Add dish** · reorder · **Saved sets** · **Paste a WhatsApp post** · **Preview as customer** · **Publish / Unpublish** | owner | |
| **Edit dish** | Name (EN + ID) · description (EN + ID) · size or portion (EN + ID) · price · limit (optional maximum portions) · chef (optional) | **Save** · **Mark sold out** · **Delete** | owner | |
| **Saved sets** | Saved menus: name, number of dishes | **Use this set** (replaces the current dishes, after asking) · **Save current as set** · rename · delete | owner | |
| **Paste a WhatsApp post** | A large text box | **Read items** shows the dishes it found · **Use these N dishes** | owner | |
| **Preview** | The menu exactly as customers see it | **Back to editing** · **Publish** | owner | |
| **Menu settings** | Cooking day · cut-off date and time · **which pickup locations** this menu uses (picked from the saved ones; each shows its usual time, which can be changed for this menu only) · delivery on/off with a note (EN + ID) | **Save** | owner | |
| **Share menu** | The ready WhatsApp post (greeting, dishes and prices, cut-off, pickup info, order link, closing) · language: ID, EN or both | **Share to WhatsApp** · **Copy text** | all | |

### Settings (replaces "More")

There is no "More" catch-all page. **Settings** groups the kitchen's setup into clear sections; Past orders lives with Orders. Switch person, language and sign out are at the bottom of the left panel.

| Screen | Fields | Behaviour | Who | Phone |
|---|---|---|---|---|
| **Settings** | Sections for everything below | Pick a section | all (chefs see fewer sections) | |
| **Past orders** | Each finished menu: cooking day, number of orders, totals | Open one to see its orders (details kept for 4 weeks, then totals only) | all | |
| **Settings** | Ordering open/closed (a manual switch) · **pickup locations: up to 5**, each with place, directions (EN + ID) and its own time window (to add a 6th, delete one first) · WhatsApp number · post greeting (EN + ID) · post closing (EN + ID) · **colour theme** (one of the designer's themes) · light / dark / auto | **Save** | owner | |
| **Pictures** | Five slots, each with a preview: menu image 2:1 · small icon (square) · wide banner 5:1 · phone banner 2:1 · background picture · background colour · picture description (EN + ID) | **Upload** · **Change** · **Remove** · **Save colour**; a live "how it looks" preview | owner | |
| **Chefs** | Each chef: name, signed in or not | **Add chef** · rename · delete · **Invite to sign in** (makes an invite key) | owner | |
| **Devices** | Each device: name, last used | **Add a device** (shows a 6-digit code) · rename · sign out a device | all | |
| **Backup** | — | **Download backup** · **Download orders (CSV)** · **Restore a backup** | owner | |

---

## 4 · Phone (a subset only)

The phone is for **live orders and talking to customers**, nothing else. WhatsApp is usually on the seller's **phone**, not the tablet. On a phone, the seller can only:
- see the **live orders** (the live menu's order list and an order's detail) and **confirm** an order;
- **message the customer**: send the order link or reply (opens WhatsApp); "arriving soon" and other updates go in the app (the customer sees them on their order, plus a notification if they turned updates on);
- **mark an order ready for pickup or delivered** (and collected);
- **add a new order** that came in on WhatsApp, and send the customer their link;
- sign in, switch person, change language and sign out.

**Customer contacts live on the phone only.** WhatsApp is on the phone, so that's the only device that needs them.
- Order detail and New order **on the phone** have two extra fields: **phone number** and **delivery address**, marked "saved on this phone only".
- With a number saved, **Send order link** and **Reply** open WhatsApp straight to that customer's chat. Without one, WhatsApp opens and the seller picks the chat.
- The tablet never shows these fields. It may show a small hint, such as "contact on your phone".
- **Export / import contacts** (on the phone) saves them to a file, to move them to a new phone or keep a copy.

Everything else is tablet or desktop only. On a phone it can say "Open this on a tablet or computer". The designer proposes how the phone moves between its few screens: a bottom bar, or a slide-out left panel.

---

## 5 · Rules to keep

- **Two languages:** every text exists in English and Indonesian. Indonesian runs about 20–30% longer, so design for the longer text. Dish names, descriptions and notes are entered in both languages.
- **Colour themes:** please design a small set of colour themes (each in light and dark, each meeting the contrast rules below). The seller picks one in Settings, and **that seller's customer pages use the same theme**, so each theme must also work on the customer menu, basket and order pages.
- **Style:** professional and subtle, with muted colours and one restrained accent colour. No saturated backgrounds, heavy borders or boxed cards; separate things with spacing or a 1px hairline.
- **Dense but readable:** compact rows, so a list of orders fits on one screen; tabular numbers for prices, quantities and totals; never cut off an order code, name or total.
- **Accessibility:** contrast of at least 4.5:1 for text and 3:1 for icons and controls, a visible focus ring, tap targets of at least 44 px, light and dark mode. Status is never shown by colour alone; always pair it with text or an icon.
- **Warn, never block:** the seller can change anything at any time, including a live menu. Where a change affects existing orders (for example deleting a dish someone has ordered), show a clear warning the seller can confirm, never a blocked action.
- **Low tech literacy:** one obvious next step per screen, plain words and no hidden gestures.
- **Pictures:** the seller uploads their own in the five slots. Banners are shown whole and never cropped. Keep faces and logos in the middle of a banner, which stays visible at every width.
- **No fixed weekday wording:** avoid "this week" and "Saturday", because a menu can be for any day. Use the menu's cooking date.
- **Privacy:** the server keeps only the customer's first name, the items and the status. A customer's **phone number and delivery address are saved on the seller's phone only** (see "Phone"), never on the tablet or the server.
