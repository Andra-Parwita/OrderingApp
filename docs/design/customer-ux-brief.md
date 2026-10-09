# Customer app: UX brief

**For:** the UX designer. **Scope:** the customer side only: what family and friends use to order food from a home cook. The seller app has its own brief.

**Design for the phone first.** Customers almost always open the menu from a WhatsApp link on their phone. Tablet and desktop use the same screens, wider.

---

## 1 · Who the customer is and what they do

Customers are family and friends of the cook, of all ages and tech levels. They speak English or Indonesian. There is **no account, no password and no payment** in the app: they pay the seller directly.

1. **Open the link** the seller shared on WhatsApp. It goes straight to that kitchen's menu.
2. **Pick dishes** and quantities.
3. **Choose pickup or delivery.** For pickup, choose one of the seller's pickup places, each with its own time.
4. **Enter a first name** (or nickname) and an optional note, then **place the order**.
5. **Send the order to the seller on WhatsApp** with one tap. The message is pre-filled with the order number, the dishes and the total.
6. **Follow the order.** The order page shows its status and the seller's messages, such as "Ready for pickup in 15 minutes" or "Arriving soon". The customer can also get a notification on their phone.
7. **Change or cancel** until the order cut-off, unless the seller has locked the order.

The phone remembers the customer's orders (**My orders**). Nothing about the customer is stored apart from the first name they type.

**Order statuses:** Ordered → Confirmed → Ready for pickup / Out for delivery → Collected / Delivered. An order can also be Cancelled.

---

## 2 · Look and feel

- **The seller's brand:** each kitchen has its own banner pictures, a menu picture and a **colour theme** the seller picks from the designer's set of themes. The customer pages use the seller's theme. Every theme must work on every customer screen, in light and dark.
- **Navigation:** a simple bottom bar with **Menu · My orders · Settings**. My orders shows a small dot when an order has a new update.
- **Language:** an EN / ID switch is always easy to reach. It's remembered, and the default is the phone's language.

---

## 3 · Screens and fields

### Menu (the kitchen's page, opened from the WhatsApp link)

| Part | Fields and behaviour |
|---|---|
| **Top** | Kitchen banner (shown whole, never cropped), kitchen name and tagline, language switch |
| **Menu picture** | One picture per menu, usually a collage of several of its dishes, shown at the top of the menu |
| **Menu info** | Cooking day and date · "Order by" cut-off · pickup places (place, time window, directions) · delivery available or not |
| **Dishes** | Each: name, description, size or portion, price · a quantity stepper · **"N left"** when 5 or fewer remain · **Sold out** (stepper disabled). Dishes have no pictures of their own for now. |
| **Basket bar** | Sticky at the bottom: "N items · total" · **View basket** |
| **How ordering works** | 3 short steps for first-timers, including the seller's WhatsApp |
| **States** | **Not published yet** ("The menu isn't out yet") · **Ordering closed** (cut-off passed, or the seller paused ordering), with **Message the seller on WhatsApp**, since they can still order that way · loading · error with "Try again" |

### Basket and checkout

| Field | Rules |
|---|---|
| Dishes | Quantity steppers and line totals; remove a line |
| **Pickup or delivery** | A choice. Delivery is hidden if the seller doesn't offer it. |
| **Pickup place** | If pickup: choose one of the menu's pickup places (up to 5), each showing its time window and directions |
| Delivery note | If delivery: "You'll send your address to the seller on WhatsApp after ordering. It's never stored in the app." |
| **First name** | Required, up to 40 characters, with the helper "Only your first name or a nickname" |
| **Note** | Optional, up to 200 characters, with a counter. The helper says not to put an address or phone number here. |
| **Place order · total** | Shows "Placing your order…" while sending |

- **Errors** (plain, friendly): a dish sold out or fewer portions left than asked; the cut-off passed; ordering closed. Each says what to do next.
- **Footer:** "You can change or cancel until {cut-off}."
- **Empty basket:** "Your basket is empty" with **Back to menu**.

### Order placed

| Part | Fields and behaviour |
|---|---|
| **Order number** | Large and easy to read out, for example **K7F-2QX** (6 characters), plus a QR code for scanning at pickup |
| **Summary** | Dishes, total, pickup (place, day, time) or delivery, note |
| **Send to seller on WhatsApp** | The main action. It opens WhatsApp to the seller with a pre-filled message: order number, dishes, total, pickup or delivery, first name, and for delivery "My address:" for them to complete. For a returning customer, sending is optional. |
| **Turn on updates** | Asks for permission to send notifications (only after the customer taps it) |
| **Saved in My orders** | "Saved in My orders on this phone." |
| **Change or cancel** | A quiet link to edit the order |

### Order page (the customer's private link)

| Part | Fields and behaviour |
|---|---|
| **Header** | Kitchen name, order number, QR, status |
| **Status** | A clear banner for the big moments: "Ready! Pick up at …", "Out for delivery", "Cancelled" · a timeline: Ordered → Confirmed → Ready / Out for delivery → Collected / Delivered |
| **Updates from the seller** | Newest first: "Ready for pickup in 15 minutes", "Ready for pickup at Glenelg", "Arriving soon", or the seller's own text. Empty: "No updates yet." |
| **Order details** | Dishes, total, pickup (place, day, time) or delivery, note |
| **Change order / Cancel order** | Only while the order isn't locked, it's still Ordered or Confirmed, and the cut-off hasn't passed. Cancelling needs a second tap. After the cut-off: "Changes closed at the cut-off". |
| **Locked** | "The seller has locked this order. Message them on WhatsApp to change it." |
| **Send to seller on WhatsApp** | Always available |
| **Older orders** | A finished menu's order is read-only ("This menu is closed"). After 4 weeks, only "This order has been archived", the kitchen name, the date and a link to the menu remain. |

### Change order

The same screen as the basket, in edit mode. The title is "Change your order", and the first name stays as it was. Quantities, pickup or delivery, pickup place and note can be changed. **Update order · total**. The last dish can't be removed; the customer cancels instead.

### My orders

| Part | Fields and behaviour |
|---|---|
| **Open by code** | "Have an order code? Open it". Accepts any format (k7f2qx, K7F 2QX, K7F-2QX) and opens the order if it's saved on this phone |
| **Lists** | **Current** and **Earlier**. Each row: order number · kitchen · dishes · day · pickup or delivery · status · total · "Locked" · new-update dot |
| **Empty** | "Your orders will appear here." with a link to the menu |
| **Footnote** | "Saved on this phone only. No account." |

### Settings

Language (EN / ID) · Appearance (light / dark / auto) · **Updates** (turn notifications on or off) · **Add to Home Screen**, a short guide so the menu is one tap away like an app (iPhone Safari and Android Chrome steps).

### Home and not found

- **Home**, without a kitchen link: the app name and "Open your seller's link from WhatsApp." There is no list of kitchens.
- **Kitchen not found**, for a wrong or old link: a friendly message and a way back.

---

## 4 · Rules to keep

- **Two languages:** every text in English and Indonesian. Indonesian runs about 20–30% longer, so design for the longer text. Dates follow the language (Saturday / Sabtu), and prices are in AUD.
- **Phone first:** one hand, thumb-reachable main actions, tap targets at least 44 px, and a sticky basket bar.
- **Style:** professional and subtle, in the seller's chosen theme. No heavy borders or boxed cards; separate things with spacing or a 1px hairline.
- **Accessibility:** contrast of at least 4.5:1 for text and 3:1 for icons and controls, a visible focus ring, every input labelled, light and dark mode, reduced motion respected. Status is never shown by colour alone; always pair it with text or an icon.
- **Low tech literacy:** plain words, one obvious next step per screen, and no hidden gestures. The order number must be easy to read out over the phone.
- **Privacy:** only a first name or nickname. Never ask for a phone number, address or email in the app; the address goes to the seller on WhatsApp.
- **No fixed weekday wording:** a menu can be for any day. Use its date, never "this week" or "Saturday".
- **Pictures:** banners are shown whole and never cropped. The menu picture is the only food photo.
