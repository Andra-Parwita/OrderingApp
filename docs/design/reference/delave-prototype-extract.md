# Delave Weekly Orders — Prototype Extraction

**Source:** artifact-fbc0ea83-1791112336-2473.html | "Delave weekly orders (prototype)" | 2026-10-07 | Owner's reference prototype

---

## Visual Design

### CSS Custom Properties (Light / Dark)

| Token | Light | Dark |
|---|---|---|
| `--bg` | #FAF7F0 | #16120E |
| `--surface` | #FFFFFF | #211B15 |
| `--surface2` | #F3EDE2 | #2B241C |
| `--text` | #2A2420 | #F3ECE1 |
| `--text2` | #6E5C4B | #BCA98F |
| `--line` | #E7DDCC | #3A3027 |
| `--primary` | #7A4B2A | #C68A57 |
| `--primary-h` | #673E22 | #D59A68 |
| `--on-primary` | #FFFFFF | #1A120B |
| `--indigo` | #1F3550 | #A9BFDC |
| `--gold` | #B8892E | #D9AE57 |
| `--sage` | #5E7D4F | #8FB07D |
| `--red` | #A63A2B | #E07C6C |
| `--wa` | #2F6B4A | #3E8A60 |

**Status pill backgrounds/text:**
- Ordered: bg #EFE8DC / #2E271F, text #5A4A3C / #D6C7B2
- Confirmed: bg #E4ECDD / #26321F, text #3E5A31 / #B9D3A9
- Ready: bg #F6E9CC / #3A2F17, text #6E4F12 / #E8C77E
- Out: bg #DFE6EF / #1E2A3A, text #1F3550 / #B5C9E4
- Done (collected/delivered): bg #ECE9E3 / #2A2723, text #5F5A52 / #BDB6AA
- Cancelled: bg #F5E1DD / #3A1F1A, text #8A2E21 / #EFA597

**Font:** Plus Jakarta Sans 400/500/600/700 (with system fallbacks)

**Radius:** 14px (buttons/cards), 999px (pills/badges), 10-12px (various)

**Kawung strip (decorative pattern):** 10px solid bar with repeating leaf/circle pattern; used above menu, orders list, past weeks; light theme: primary (#7A4B2A) stroke, gold (#B8892E) fill

**Layout:**
- Customer max-width: 520px centered, bordered on desktop (min 560px)
- Seller: rail (228px, desktop ≥820px) + main; mobile: tabbar at bottom
- Split-view detail: ≥820px opens side panel (380px list + flex detail)

**Button variants:** primary (solid brown), secondary (border + surface), ghost (transparent), danger (red, or solid if `.armed`), wa (WhatsApp green)

---

## Customer Screens & Behaviours

### Menu Screen
- **Header:** Kawung strip, logo + brand title + tagline, week info ("Welcome to [date], Order by [cutoff]"), language+theme switcher
- **Hero images:** Collage SVG (6 item circles) or carousel of 5 uploaded images; tag "Sample photo"
- **Items list:** 1–10 items, each shows: number, name, description, price, unit, "X left" (if ≤5), sold-out badge
- **Stepper:** Shows quantity; "+1" button disabled at limit (portion remaining = limit − sold across all current orders)
- **How it works:** 3-step numbered guide (1. choose & order, 2. get order number K7F-2QX, 3. send to seller on WhatsApp)
- **Cart bar:** "{N} items, $total" button (dismisses when order closed) → checkout sheet

### Checkout / Place Order Sheet
- **Fields:** Order name (required, stored in localStorage), fulfillment (segmented: Pickup/Delivery), note (≤200 chars), order summary
- **Info box:** "Send this order number to [seller name] on WhatsApp at [phone]" (or "optional" if returning customer)
- **Button:** "Place order" or "Update order" (if editing); sheet → confirmation sheet

### Order Placed / Confirmation Sheet
- **Display:** Checkmark icon, order code, QR (reusable, encoded as https://delave.pages.dev/o/{token}), items summary, total
- **Actions:**
  - Send on WhatsApp (goes to chat picker if no phone saved, or direct if returning)
  - Turn on updates (toggles S.notify; iOS needs Home Screen install first)
  - Done (returns to My Orders tab)
- **Optional info:** "Send on WhatsApp is optional" (for returning customers)

### My Orders (Orders Tabs)
- **Empty state:** "Your orders will appear here. Pick something from this week's menu to get started."
- **Sections:** "This week" (current) + "Earlier orders" (past, up to 10 total shown)
- **Order card:** Code + status pill, item summary, fulfillment or date, total, lock icon if locked, new indicator (dot) if unseen
- **Install banner:** Shows if updates off and not installed ("Add Delave to Home Screen…")
- **Display settings card:** Theme selector (auto/light/dark)

### Order Detail View
- **Header:** Back button, order code, status pill
- **Status timeline:** Vertical line + dots, animated progress (ordered → confirmed → ready → collected/delivered or out → delivered)
- **Items:** Quantity × name, subtotal per item, total
- **Fulfillment:** Pickup/delivery on [date]
- **Note:** If present, shows in notification box
- **QR code:** For pickup (shows only if not past/cancelled)
- **Inbox/timeline:** Timestamped updates and custom seller messages
- **Actions:**
  - "Change order" (if status ordered/confirmed AND not locked, edits cart and returns to menu)
  - Send on WhatsApp
  - "Cancel order" (arms 3-second confirm) → cancelled status
- **Locked banner:** "Seller locked this order. Message on WhatsApp to change."

### How Ordering Works (Collapsible)
- Numbered list: choose items → get number → send on WhatsApp → seller confirms

### Install / Notification Guide Sheet
- **iPhone path:** Safari share → Add to Home Screen → Open from Home Screen → Allow notifications
- **Android path:** Tap turn on updates → Allow in Chrome prompt → optional full install via menu
- **Platform notes:** iOS 16.4+, Android immediate (no extra steps)
- **Prototype buttons:** "First install on iPhone/Android", "I've added to Home Screen" (prototype only)

### Notification/Permission Flows
- **Permission prompt:** Alert: "Delave would like to send you notifications. Notifications may include alerts, sounds and icon badges." [Don't allow] [Allow]
- **Test notification:** Shows order update as floating banner above tabbar (logo, brand title, time "now", order code + message)
- **Returned customer flow:** Auto-marks as returning if any past collected/delivered order from same phone

---

## Seller Screens & Behaviours

### Setup / Sign-In Flow
**Step 1: Setup key entry**
- Input: 16-char key (DLV-XXXX-XXXX-XXXX-XXXX format), auto-formatted uppercase
- Validation: Key must match, not expired (default prototype key valid 7 days), ≤3 devices per key
- Error codes: "Key not valid or expired. {N} tries left." (N = 5−attempts, then 15-min lockout) | "Key used on 3 devices already"
- QR scan button, "I have a 6-digit code" button (switches to code flow)
- Prototype key: DLV-7KQ4-M9XP-2HTR-W3NC

**Step 2 (alt): Device code entry**
- Input: 6-digit code (one-time, valid 10 minutes)
- Error: "Code not valid or expired. {N} tries left."

**Step 3: Device name**
- Input: Text field; pre-guesses "iPhone", "iPad", "Android", "Computer"
- Stored for later device list

**Step 4: PIN creation**
- 4–6 digits, shown as dot indicators (last 2 dots dashed if not required)
- Numeric keypad (0–9, backspace, continue)
- Set 1 → set 2 → confirmation; "PINs didn't match" → restart set 1
- Lockout: 15 minutes after 5 failed attempts (attempts reset on success)

**Final:** Shows "Seller app set up on [device name]"

### Orders Screen (Split View)

**Left panel (list):**
- **Tools bar (always visible):**
  - Open/Closed toggle + auto-close time
  - Stats: Orders count, Income (sum of totals), Paid (filtered), Unpaid
  - Search: "Type or scan order number" (uppercase, uppercase with letters; exact 6-char code match navigates to order)
  - Chips: All (count) / Needs confirming / Changed / To do / +New order / +Send update / +Print labels / +Add samples / 🔥 Simulate change
  - Group by: Order / Item / Customer / Pickup or delivery

- **Order row (`.orow`):**
  - Code + name
  - Meta: Quantity × fulfillment (if grouped by item) OR item summary
  - Icons: "Waiting WhatsApp" (if new, not returning), "Added by seller" pill, "Changed" (gold), "New" (indigo), note icon, lock icon, delivery truck icon, Paid checkmark
  - Status pill

- **Empty state:** "Share this week's menu to start taking orders. New orders appear here instantly."

**Right panel (detail, ≥820px):**
- Only shows when order selected
- On mobile (<820px), navigates to detail view with back button

### Order Detail (Seller View)

- **Header:** Code + name + fulfillment (pickup/delivery) + language tag (EN/ID) + placed time
- **Status banner (if ordered and customer-placed):** Gold or indigo banner:
  - "New customer" (if not returning, not waGot) | "Returning" (if returning) | "WhatsApp received" (if waGot)
  - Button: "Mark WhatsApp received" (if not returning/waGot) | "Nudge customer" | Both
- **Changed banner (if order changed):** Gold: "Changed at [time]. [Item qty changes]. [If note changed] [If fulfillment changed]"
- **Items card:** Listed as "Q× name [other language] | subtotal"
- **Total:** Styled emphasis
- **Note:** If present, shows in notification box
- **Next status button:** Context-aware ("Confirm order" / "Mark ready" / "Mark out" / "Mark collected" / "Mark delivered")
- **Finished banner (if done/cancelled):** "Finished" or "Cancelled"
- **Action row:**
  - "Lock/Unlock order"
  - "Mark paid" (toggles, shows checkmark if paid)
  - "Print label" (1 label)
  - "Send order link" (opens WhatsApp with pre-filled order message)
- **Cancel button (danger, arms 3-sec):** Only if not collected/delivered/cancelled
- **Change history:** Timeline of customer edits (timestamp + summary of diff)

### Cook View (Grouped by Item)

- **Header:** "To cook this Saturday"
- **Summary line:** "X to make, [Y pickup] [Z delivery]"
- **Item card (`.crow`, clickable):**
  - Item name, quantity to make
  - Unit + "X of Y portions" (or just X portions)
  - Progress bar (0–100%, orange if ≥80%)
  - Collapsible: "Who ordered" list (name, code, qty, pickup/delivery)

### Menu Editor

- **Week info:** Cooking date (Saturday formatted) + cutoff time (Friday 9pm or 21.00)
- **Images (0–5):**
  - Gallery manager: upload, remove, mark as sample photo, shows KB size
  - Max 5 images; display "Up to 5 images" when full
  - Images resized/compressed on upload
- **Logo:** Upload (256px max), remove
- **Items (1–10):**
  - Per item: #, English name, ID name, English desc, ID desc, unit (toggles based on lang), price (A$), portion limit
  - "Add item" button (disabled if 10), "Remove" (arms 3-sec)
  - Price step: 0.5
- **WhatsApp post settings:**
  - WhatsApp number (tel input)
  - Greeting (EN/ID)
  - Closing note (EN/ID, can include {phone} template)
  - Saved in localStorage per device
- **Paste WhatsApp post parser:**
  - Textarea for numbered list from WhatsApp
  - Parser regex: `^\s*(\d{1,2})[.)]\s*(.+?)\s*[-–—:]\s*\$\s*(\d+(?:[.,]\d{1,2})?)\s*$`
  - Extracts: item name, unit (if contains "biji/pcs/pieces/potong/gr/g/kg/ml"), description (if in parens), price
  - "Read items" button → shows parsed list + "Use these N items" (replaces menu)
  - Error: "No items found. Each line needs a number, a name and a price."
- **Share to WhatsApp:** Preview sheet with language toggle (Indonesia/English/Both)
  - Contains formatted menu with greeting, items, prices, order link, closing

### Past Weeks / Archive

- **Retention:** Keeps {N} weeks (default 52, selectable 10/26/52)
- **Storage:** Show storage used (database + images MB), % of 15360 MB cap
- **Per-week row (expandable):**
  - Date + order count + income
  - Expanded detail:
    - Stats: orders, income, paid, unpaid
    - "Item totals" (expandable per item → who ordered list)
    - Orders list (code, name, items, status, total, paid indicator)
- **Archive oldest:** Button if older week exists; downloads JSON file to device, removes from storage

### Settings

**Branding:**
- Title (text)
- Tagline (EN/ID)
- WhatsApp number (tel, saved)
- Logo (upload/remove)

**Storage:** Meter showing DB % (indigo) + Images % (brown), usage in MB, oldest week stored

**Security → Devices:**
- List: name, "This device" badge (current), last used time, remove button (arms 3-sec)
- Setup key info: "{N} of 3 devices, valid until {date}"
- Actions:
  - "Add device" → generates 6-digit code (valid 10 min, 1-use)
  - "Lock now" → PIN unlock screen
  - "Sign out" (arms 3-sec) → clears local auth

**Backup:**
- Last backup: date or "never"
- Export backup (JSON)
- Export orders (CSV)
- Import backup (JSON)

**Appearance:**
- Theme: Match device / Light / Dark
- Language: English / Bahasa Indonesia

**Reset:** Clears all (prototype-only, restores 6 sample orders)

### Bulk Send Updates / Messages Sheet

- **Message template selection:** Chips for:
  - "Ready in…" (10/15/20/30/45/60 min options) + "Also update status to ready"
  - "Ready for pickup" + "Also update status"
  - "Arrived at pickup" (no status)
  - "Arriving in…" (min options) + "Also update status to out"
  - "Out for delivery" + "Also update status"
  - "Delivered" + "Auto-status"
  - "Collected" + "Auto-status"
  - "Custom message" (textarea)
- **Recipients:** Chips for group (All open / Pickup / Delivery / Not collected or delivered / Clear all)
- **Recipient list:** Scrollable checkboxes, shows name, code, fulfillment, items
- **Info:** "Every customer sees it in their order. Customers with updates on also get a notification."
- **Error:** "Select at least one customer"
- **Send:** Toast "Update sent to N customers"

### New Order from WhatsApp (Manual Creation)

- **Customer name (required):** Text input
- **Language:** EN/ID segmented
- **Fulfillment:** Pickup/Delivery segmented
- **Items:** Stepper for each (same as menu, shows remaining if limit)
- **Note (optional):** ≤200 chars
- **Confirm order now:** Checkbox
- **Mark paid:** Checkbox
- **Create order:** Button → Success sheet showing code + QR + send link

### Print Labels

- **Label layout (print view):**
  - Kawung strip (7px brown)
  - QR code (78px)
  - Order code (26px, uppercase, tabular-nums)
  - First name only (15px, bold)
  - "PICKUP / AMBIL" or "DELIVERY / ANTAR" (11.5px)
  - Items list (12px): Qty × ID name / EN name
  - Note (if present, ≤70 chars, yellow bg, 11.5px)
- **Grid:** 2 columns on letter, 4 columns in normal view
- **Print button:** Triggers browser print dialog

---

## Data Model Implied

### Order Object
- `code`: K7F-2QX style (3-3 alphanumeric)
- `token`: 24 random chars (for QR links)
- `name`: Customer name
- `lang`: 'en' | 'id'
- `fulfil`: 'pickup' | 'delivery'
- `note`: ≤200 chars
- `items`: {itemId: qty, …}
- `status`: 'ordered' | 'confirmed' | 'ready' | 'out' | 'collected' | 'delivered' | 'cancelled'
- `locked`: boolean (seller can lock edit)
- `paid`: boolean (seller mark)
- `changed`: boolean (customer edited)
- `isNew`: boolean (badge)
- `changes`: [{t: timestamp, diff: [{id, d: qty_delta}, …], note: bool, fulfil: bool, cancelled: bool}, …]
- `inbox`: [{t: timestamp, k: status_key | 'custom', text?: string, m?: minutes}, …]
- `created`: timestamp
- `past`: boolean (older than current week)
- `returning`: boolean (detected if any past collected/delivered from same phone)
- `waGot`: boolean (seller confirmed WhatsApp received)
- `source`: 'app' | 'seller' (manually added by seller)

### Item Object
- `id`: 'i1' | 'iN' | 'pN...' | 'nTimestamp'
- `en`: English name
- `id_`: Indonesian name
- `den`: English description
- `did`: Indonesian description
- `uen`: English unit (e.g., "4 pieces")
- `uid`: Indonesian unit
- `price`: Float (e.g., 15.50)
- `limit`: Integer (0 = unlimited)
- `hue`: Hex color for collage

### Auth Object (Seller)
- `paired`: boolean
- `locked`: boolean (locked after 12 hours)
- `pin`: 4–6 digits (or null if not set)
- `devices`: [{id: 8 chars, name, created: ts, last: ts, current: bool}, …]
- `attempts`: Failed attempts (resets on success or after lock)
- `lockUntil`: timestamp (0 if not locked)
- `keyUses`: Count (0–3)
- `keyExp`: Expiry timestamp
- `step`: 'key' | 'code' | 'name' | 'pin'
- `via`: 'key' | 'code'
- `key`: Setup key input
- `code`: 6-digit device code input
- `dname`: Device name
- `err`: Error message
- `pinCtx`: 'set1' | 'set2' | 'verify' | 'unlock' | 'gate' (context for PIN entry)
- `pinEntry`: Typed PIN digits
- `pin1`: First PIN (for confirmation)
- `addCode`: 6-digit code generated for adding device (expires 10 min)
- `addExp`: Expiry timestamp
- `armDev`: Device ID armed for removal (3-sec)

### State (localStorage keys with `fo_` prefix)
- `fo_lang`: 'en' | 'id'
- `fo_theme`: 'auto' | 'light' | 'dark'
- `fo_name`: Customer name
- `fo_wa`: WhatsApp number
- `fo_greet`: {en, id} (greeting templates)
- `fo_closing`: {en, id} (closing templates)

### Brand Object
- `title`: Store name (default "Delave")
- `ten`: English tagline
- `tid`: Indonesian tagline

---

## Rules & Limits

### Ordering
- **Portion limits:** Per-item limit (0 = unlimited); "X left" shown if remaining ≤5
- **Sold calculation:** Across current (non-cancelled) orders; respects limit; new customer can't exceed
- **Cut-off time:** Friday 9pm (EN) / 21.00 (ID); auto-closed, manual toggle to re-open
- **Note:** ≤200 chars; address and phone sent via WhatsApp, not in app
- **Fulfillment flow (pickup):** Ordered → Confirmed → Ready → Collected
- **Fulfillment flow (delivery):** Ordered → Confirmed → Out → Delivered
- **Order edit:** Only in "ordered" or "confirmed" status, and if not locked; changes tracked with diff

### Seller Setup
- **Setup key:** Valid 7 days, 3 devices max per key
- **Device code:** 6 digits, valid 10 minutes, one-time use
- **PIN:** 4–6 digits; set on first device, re-enter on others
- **Failed attempts:** 5 before lockout; lockout 15 minutes; after successful unlock, attempts reset
- **Lock (auto):** 12 hours of inactivity
- **Device limit:** 3 (enforced by key, not stored per device)

### Menu
- **Items:** 1–10 per week
- **Images:** 0–5, resized to 1600px max, compressed
- **Logo:** 256px max, JPEG compressed
- **Item name:** EN + ID
- **Unit field:** Optional, separate EN/ID
- **Price:** A$ decimal (0.5 step)
- **Portion limit:** Integer or empty (0 = no limit)

### Notifications
- **Platforms:** Web push (requires Home Screen install on iOS)
- **Opt-in:** Explicit permission request
- **Returning customer:** Auto-detected from past collected/delivered orders
- **Notification content:** Templated status + optional custom message (≤200 chars)
- **Inbox:** Latest updates shown in timeline, timestamps

### Past Data & Retention
- **Retention period:** {N} weeks (default 52, options 10/26/52)
- **Auto-archive:** Oldest week removed after retention
- **Archive format:** JSON download to device (no cloud)
- **CSV export:** Orders with code, name, items, prices, totals

### Storage
- **Capacity:** 15360 MB
- **Breakdown:** Database ~0.4 MB + ~0.003 MB per order, Images ~1 MB/week + 5 MB for logo/extras
- **Device-local:** All data stays on phone, localStorage + in-memory

### WhatsApp Integration
- **Phone number:** Stored in brand settings (seller), no customer phone stored (only in WhatsApp)
- **Order link:** https://delave.pages.dev/o/{token} (QR + code display on order)
- **Scan link:** https://delave.pages.dev/scan/{code}
- **Message templates:** EN/ID, can include {phone} placeholder (replaced with formatted seller number)

### Labels & Print
- **Label template:** Kawung strip, QR, code, first name, fulfillment, items, note (truncated ≤70)
- **Print layout:** Portrait, 2 columns (8mm gap), page-size margins
- **Label dimensions:** Implied ~250px wide in grid (exact sizing by printer)

---

## Prototype-Only Controls

**Prototype bar (top, dark blue):**
- Label: "Prototype" (light gray)
- Mode toggle: "Customer" / "Seller" (segmented buttons)
- "Simulate" button (sparkle icon) → Simulation sheet

**Simulate sheet options:**

1. **Customer notifications (section):**
   - 8 event buttons: "New menu published", "Order confirmed", "Ready in 15 min", "Ready for pickup", "Arriving in 20 min", "Out for delivery", "Delivered", "Collected"
   - Taps auto-enable updates and show notification

2. **Phone setup (section):**
   - "First install on iPhone" → Starts new iPhone visitor (no Home Screen install, guides to allow notifications)
   - "First install on Android" → Starts new Android visitor (one tap to allow)
   - "Send test notification" → Shows notification banner (if updates off, shows "Turn on updates first")

3. **Seller (section):**
   - "Seller: first login" → Shows setup key/device/PIN screens
   - "Seller: app locked after 12 hours" → Shows PIN unlock screen

**Other prototype buttons:**
- "Add sample orders" (8 random orders with random changes)
- "Simulate a change" (random customer edits random item +1, optionally adds note)
- "Prototype: I added it to Home Screen" (marks installed, shows splash screen)
- "Prototype: end lockout" (immediately unlocks seller after failed PIN attempts)
- "Prototype: open the link as the customer" (adds order to My orders, shows order detail)

**Simulated events:** Each notification event shows real notification + app auto-opens with relevant screen

---

## Open Questions Noticed

1. **Image upload sizing:** Compression at 1600px and 0.8 quality for menu images, 256px and 0.85 for logo — is this optimal for home Wi-Fi viewing and bandwidth?

2. **Portion limits across customers:** When multiple customers order the same item, limit is shared across all — is this intended, or should each customer get their own limit?

3. **QR link longevity:** QR links use /o/{token} and /scan/{code} on external domain — how long are these links valid, and who hosts the redirect?

4. **Seller phone in customer WhatsApp:** Customer message shows seller's formatted phone; is privacy a concern (phone visibility in customer's WhatsApp sent list)?

5. **Device code re-use:** 6-digit code is 1-time use and 10-min valid — if seller loses phone during setup, they'd need a new key or code. Is this flow documented?

6. **Lockout after 12 hours:** Auto-lock timer is in-memory only (not persisted on page reload). How is 12-hour lock enforced across browser restarts?

7. **Order code format:** K7F-2QX allows 34^6 = 1.3B combinations. Collision probability acceptable for weekly ordering (10–50 orders)?

8. **Note field character limit (200) vs WhatsApp:** Customer note shown in seller inbox and on label — but address/phone go via WhatsApp. Is separation intentional, or should note support address too?

9. **Returning customer detection:** Triggered by any past collected/delivered order — does this work across browser/phone changes, or only same localStorage?

10. **Notification permission persistence:** "Allow" is stored in S.notify (localStorage), but browser may revoke if user disables site notifications — fallback behavior unclear.
