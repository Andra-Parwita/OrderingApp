# Onde Onde seller app · UX handoff

Oct 9, 2026 · @Indra Parwita

## How to use this

The canvas **Onde Onde · Seller app** is the visual source of truth. This doc is the written spec: the tokens, rules and decisions behind every board. Where they disagree, the decisions log here wins.

- Every board has Tweaks for **theme** (light/dark) and **brand** (the five colour themes). Check any screen in all ten combinations before building.
- Boards marked with a Play button are clickable for the main interactions; the rest are static.
- Sample names, prices and codes are placeholders. Prices assume AUD.
- Design is tablet-first (1180 × 820). Desktop uses the same layout. Phone (390 × 844) is a deliberate subset.

## Principles and global rules

Professional and subtle, WCAG AA, dense but readable, touch friendly. Every screen follows these rules:

| Rule | What it means in practice |
| --- | --- |
| Warn, never block | The seller can always go ahead. Warnings say who is affected ("3 people ordered Rendang"). Applies to menus, dishes, orders, delivery steps and messages. |
| One next step | One filled (accent) button per screen or panel. Everything else is outlined or quiet. |
| Touch | Every target at least 44 × 44 px, 8 px apart. Whole rows are tappable where a row opens something. |
| Status | Always icon + word, never colour alone. |
| Focus | 2 px ring in the accent colour, 2 px offset, on every control. |
| Language | Every label exists in EN and ID. Leave 30% extra width for Indonesian; no fixed-width labels. |
| Separation | Spacing and 1 px hairlines, not boxed cards. |
| Less scrolling | Long forms split into panes or wizard steps; lists over 20 items page in 20s. |
| No hidden gestures | Every action has a visible button. No swipe-only actions. |
| Dates | Use the menu's cooking date ("Sat 17 Oct"), never "this week" or a fixed weekday. |
| Chefs | Owner-only items are hidden for chefs, not greyed out. |
| Phone | Native feel: no visible scrollbars, bottom tab bar, segmented controls, native dropdowns. |
| Privacy | First name only. No phone numbers or addresses stored. |

## Colour

Five themes, each with light and dark. A theme sets the accent and tints the backgrounds; text and status colours never change. Every pair below was checked: text ≥ 4.5:1, controls ≥ 3:1.

### Theme tokens

| Token | Onde Onde | Bali | Sumatra | Sunda | Jawa |
| --- | --- | --- | --- | --- | --- |
| fill (dark) | #8CC08A | #84C3D6 | #EBA0AA | #A9B6EC | #D9AE7E |
| on-fill (dark) | #0F1E10 | #0B2129 | #2B0A10 | #121A3A | #2A1A08 |
| accent text (dark) | #93C590 | #8CC6D8 | #EDA6AF | #AEBBEE | #DDB38A |
| tint (dark) | fill at 14% | fill at 14% | fill at 14% | fill at 15% | fill at 15% |
| bg / panel / surface (dark) | #121411 / #0E100D / #181A16 | #101417 / #0C1013 / #161B1F | #161112 / #110D0E / #1C1617 | #111219 / #0D0E14 / #17181F | #15120E / #100E0B / #1B1813 |
| surface 2 / line (dark) | #20231E / #2A2E27 | #1E2429 / #283037 | #251D1F / #322729 | #1F2029 / #2A2C37 | #24201A / #312B23 |
| fill (light) | #2F6B36 | #1D5C73 | #8A2232 | #3A4C96 | #7A4A1E |
| on-fill (light) | #FFFFFF | #FFFFFF | #FFFFFF | #FFFFFF | #FFFFFF |
| accent text (light) | #2A5F30 | #1A5469 | #7E1F2E | #34448A | #6E431B |
| tint (light) | #E5EFE2 | #E0EDF1 | #F5E1E3 | #E4E7F4 | #F2E7DA |
| bg / panel / surface (light) | #F6F2E8 / #EFEADD / #FFFDF8 | #F1F4F4 / #E7EDEE / #FCFEFE | #F7F0EE / #F0E6E3 / #FFFBFA | #F2F2F7 / #E9EAF2 / #FDFDFF | #F6F0E6 / #EEE5D7 / #FFFBF4 |
| surface 2 / line (light) | #F4F0E6 / #E4DED0 | #EEF3F4 / #DAE2E4 | #F6EEEC / #E6D9D6 | #F0F1F7 / #DDDFEA | #F5EEE2 / #E5DACA |

### Shared tokens (all themes)

| Token | Dark | Light | Used for |
| --- | --- | --- | --- |
| text | #F1EEE6 | #1C1F1A | Body, names, totals |
| muted text | #A9AFA3 | #5D6358 | Codes, items, meta |
| control edge | #6B7266 | #7F857A | Input and button outlines |
| confirmed / ready | #7EC4B0 | #1F6B5C | Status, with icon |
| changed / warning | #E9B949 | #8A5A00 | Flag, warnings, not paid |
| danger | #EE8B78 | #A93724 | Cancelled, delete |
| out for delivery | #8DB4E8 | #2B5C9E | Status, with icon |

The seller picks light, dark or auto per device, and the colour theme for the whole kitchen. Native dropdowns get the page's colour scheme passed through; options never use the muted colour.

## Type, spacing and touch

One typeface for UI (Plus Jakarta Sans, 400/500/600/700) and one monospace for order codes (IBM Plex Mono 500/600). All prices, counts and times use tabular figures.

| Role | Size / weight | Notes |
| --- | --- | --- |
| Screen title | 22 px / 700 (phone 26–28 px) | "Orders", "Kitchen · Sat 17 Oct" |
| Section heading | 16–20 px / 700 |  |
| Group label | 12–13 px / 700, uppercase, 0.06em tracking, muted | Chef groups, pickup places |
| Row name | 15 px / 600 | Customer and dish names |
| Body | 14 px / 400 (phone 15 px) |  |
| Meta | 12–13 px, muted | Items summary, hints |
| Order code | 12–15 px mono / 600 | Never truncated |

| Spec | Value |
| --- | --- |
| Tap target | min 44 × 44 px; main actions 48–56 px tall |
| Row height | 48 px (Kitchen, menus), 56–64 px (orders, two lines) |
| Radius | 10 px controls, 12–16 px sheets and dialogs |
| Page padding | 24–28 px tablet, 16 px phone |
| Gaps | 8 px between controls, 16–24 px between groups |
| Side panel | 384 px (order detail), 560 px (slide-over editors) |

## Layout shell

Tablet and desktop: a collapsible left panel plus a main panel. Phone: a bottom tab bar.

**Left panel (tablet)**

- Open (232 px): menu picture 2:1 and kitchen name; Orders · Kitchen · Pickup & delivery · Menu · Settings; at the bottom, who is signed in with Switch, EN/ID, Collapse menu.
- Collapsed (72 px): small icon (or initial), icons with tooltips, language, expand. The choice is remembered per device.
- Chefs don't see Menu or Settings.
- Menu shows a "Not published" badge while a menu is being made.

**Main panel**

- Starts with the kitchen banner, shown whole at 5:1 (no cropping), on the background picture or colour.
- Content sits on a sheet with 16 px top corners. While working, the banner shrinks to a 40–44 px strip and the sheet rises over it. Task screens (wizard, Kitchen, Pickup & delivery, Settings) start with the strip.
- Detail opens beside the list (order detail, 384 px); editors slide over the list (dish editor).

**Phone**

- Bottom bar: Orders · Pickup & delivery · More.
- Phone banner 3:1 at the top of Orders; other phone screens have no banner.
- Everything else (Menu, Kitchen, Settings) says "Open this on a tablet or computer".

**Picture slots (seller uploads)**

| Slot | Shape | Upload size | Where |
| --- | --- | --- | --- |
| Menu picture (kitchen) | 2:1 | 1200 × 600 | Left panel, shared posts |
| Small icon | Square | 512 × 512 | Collapsed panel, browser tab |
| Wide banner | 5:1 | 2000 × 400 | Tablet and desktop |
| Phone banner | 3:1 | 1200 × 400 | Phone |
| Background | Picture or colour | \~1280 × 256 | Around banners |
| Menu picture (per menu) | 3:2 | 1200 × 800 | Top of that menu on customers' phones |

## Patterns

Every screen is built from these. Build each once; screens are content inside them. The Patterns board shows a sketch of each.

| Pattern | Used for | Key rules |
| --- | --- | --- |
| List + side panel | Orders, order detail | List keeps its scroll place; panel 384 px; one main action pinned at the bottom. Phone: full screen with Back. |
| Slide-over editor | Dish editor, New order (tablet) | Dims the list; Cancel + Save pinned; asks before closing with unsaved changes. |
| Settings in panes | Settings | Section tabs on the left, one section at a time, fields in 2 columns, EN and ID side by side. |
| Wizard | Make a menu (4 steps) | Each step fits one screen; Back never loses input; finished steps can be tapped; autosaves. |
| Reuse picker | Menu step 1 | Start from Saved sets, Past menus or Your dishes; mix freely; picked list on the right. |
| Focus task | Kitchen · Pack | One bag at a time, big tick rows, "Packed · next bag". |
| Warning dialog | Delete dish, remove place, cancel order, restore backup | Says who is affected; buttons name the outcome ("Keep dish" / "Delete anyway"); never a block. |
| Bottom sheet (phone) | Order filter | Handle + visible Close; 48 px rows. Tablet uses a small menu instead. |
| Toast with Undo | Confirm, Mark paid, delivery steps | Quick reversible actions don't ask first; Undo for 6 s; announced to screen readers. |
| Compose & send | Share menu, Message a pickup place | Shows the exact text before sending; language choice; one send button. |
| Empty & first run | No menu yet, cooking day over | Says why it's empty; one next step; first run is a checklist. |
| Pages of 20 | Earlier menus, devices | "21–40 of 64", Previous / Next 44 px. A live menu's orders stay one list. |

## Screens and states

Board names match the canvas. "Phone" means the screen also exists on phone.

### Home (Orders)

The home screen depends on the menu's state:

| State | Home shows | Board |
| --- | --- | --- |
| No menu yet (first run) | Setup checklist: pictures, WhatsApp number, Make a menu, Publish | Orders · no menu yet |
| Menu not published | A line "Your menu for \<date> isn't published yet · Continue" (opens the Menu screen), then the last menu's summary and earlier menus | Orders · no live menu (unpublishedMenu Tweak on) |
| Menu live | Its orders: list + detail, Taking orders switch, Share menu, New order | Orders · tablet / phone |
| Cooking day over | "Just finished" summary, unpaid loose ends, Earlier menus (pages of 20) | Orders · cooking day over |

- Orders list rows: code, first name, Changed flag (word + icon), WhatsApp / returning / entered-by-staff icons, total, items, pickup or delivery, status, Paid.
- Filters: status tabs (All, Ordered, Confirmed, Ready, Done, Cancelled) plus two toggles, Changed and Not paid. Phone: one dropdown opening a bottom sheet.
- **Taking orders** switch beside Live. Off = "Orders paused"; customers see "Not taking orders right now"; the seller can still add orders.
- Order detail: changed note, items, note, details, recent changes; Confirm order (main), Send WhatsApp link, Mark paid; Lock, Nudge, Cancel as plain buttons. Phone: "Confirm & send on WhatsApp" as the main button.
- Every phone order row has a WhatsApp button (opens WhatsApp with the message written; the seller picks the chat).

### Menu screen

Same shell as Home, but about the menu rather than its orders. Three states:

| State | Menu screen shows |
| --- | --- |
| No active menu | Past menus list (pages of 20) and **New menu**, which asks for the cooking day, then opens step 1 |
| Not published | "Your menu · not published", progress through the 4 steps, **Continue · step N**, Delete |
| Live | The live menu itself: dishes with price, limit, sold, sold out, edit; Add dish (n of 10); Edit details; Share again; Unpublish |

- Editing a live menu stages changes: a banner "2 changes not published yet · Discard · Publish changes"; changed dishes are marked.
- While a menu is active, past menus sit behind a **Past menus · 34** button that opens a side panel.
- Tapping a past menu opens its detail in the same panel: totals, dishes with quantities sold, who ordered (name, code, items, total, paid), and "Use these dishes for a new menu".
- Your dishes and Saved sets are reachable from the header at all times.

### Make a menu (wizard, tablet)

1. **Dishes**: reuse picker (Your dishes, Saved sets, Past menus), New dish, edit pencil per dish, "Save these as a set". Max 10 dishes.
2. **Details**: cooking day, orders close, delivery on/off + note (EN/ID), pickup places (tick per menu, edit or add in place, max 5 saved), menu picture 3:2 (optional).
3. **Check**: per-menu price, limit, chef, sold out; Details summary; "Worth a look" warnings that never stop publishing; phone preview in EN/ID.
4. **Publish & share**: Publish menu, then the WhatsApp post (ID / EN / Both), Share to WhatsApp, Copy text, Copy order link, Go to orders.

The menu is "Not published · saved" until step 4. Everything saves as you go, so each step has a plain Close (no "Save & close").

Editing a live menu uses the same screens without the wizard: the title stays "Menu for \<cooking date>" with a Live status, the step bar becomes tabs (Dishes · Details · Prices & limits), there is no Publish step, and the footer says changes go to customers as you make them, with a Done button. The words "New menu" are never used.

### Dish editor (slide-over)

Name (required, 80), description (300), size (40), each EN + ID side by side; price; limit (optional); chef (native dropdown + Edit chefs). Empty Indonesian shows "customers will see the English text". New: "Add to this menu too". Edit: used-on info, Delete dish (warning). Edit chefs opens a form to pick, add, rename, remove and invite chefs.

### Kitchen (tablet)

- **Cook**: compact rows, total per dish, pickup/delivery split, group by Dish or Chef, Count mode (− / +, "6/11"), Print labels (A4 sheet or 62 mm roll).
- **Pack**: one bag per order, tick each item, "Packed · next bag", Skip for now. Packing does not change order status.

### Pickup & delivery (tablet + phone)

- **Pickup**: one column per pickup place (phone: stacked). Header: place, time, directions, count, last message sent, one **Message** button. Rows: bag code, name, paid, items, status. No per-row actions; customers confirm collection on their phone.
- **Message a pickup place**: Ready in N min, Ready for pickup, Your own text. Sent by web push and shown on the order page. Already-sent messages are marked; sending again warns but is allowed.
- **Delivery**: per order, Out for delivery → Arriving soon → Delivered; each step notifies that customer. No group delivery messages.

### New order (phone and tablet)

First name, language, items with − / + steppers (shows "3 left", "sold out"), pickup place or delivery, note, Confirm it now, Already paid. Main button: "Create & send link on WhatsApp"; secondary: "Create only".

### Settings (tablet, owner)

Kitchen (name, WhatsApp number, pictures, picture description EN/ID) · WhatsApp post (greeting and closing EN/ID, preview) · Pickup locations · Menu defaults (cut-off rule, delivery default + note) · Appearance (light/dark/auto, colour theme) · Chefs (invite, rename, delete) · Devices (add with 6-digit code, rename, sign out) · Backup.

### Phone More

Switch person, language, sign out. Note: "Menu, Kitchen and Settings are on your tablet or computer."

### Sign in (tablet + phone)

Board **Signin** (Tweaks: device tablet / phone, step). Tablet: banner on the left, form on the right. Phone: banner on top, form below. EN / ID toggle top right on every step; the kitchen's logo and name sit above the form.

- **Sign in:** one big button "Sign in with face or fingerprint" (passkey). Below it: "Use password instead", then "First time on this device? Use your invite key". A short note says to ask the owner for a new invite if they've lost access.
- **Password:** username, password with Show, Sign in, Back.
- **First time:** segmented Invite key / 6-digit code. Key input is mono and accepts it pasted with or without dashes; the code is 6 boxes that auto-advance and accept paste. Continue.
- **Create:** "Welcome, Sari" (first name from the invite). Two cards: Face or fingerprint (recommended) or Set a password. Then straight into Orders.

Errors show inline under the field in plain words ("That key has expired. Ask the owner for a new one."), never as a popup.

## Decisions log

Agreed during design review, 9 Oct 2026. Where the brief or today's app differs, these win.

Added later the same evening: the Menu screen (above) and staged edits on a live menu with **Publish changes** (option A, assumed; confirm).

| Decision | What it changes |
| --- | --- |
| Warn, never block (D-062) | Live menus stay editable; deleting or replacing ordered dishes warns. Extends to orders, delivery steps and messages. Today's three menu blocks and the Pickup/Delivery refusals go. |
| One menu at a time (D-063) | Live → done → next menu. A new menu is "Not published" until Publish. No draft beside a live menu. |
| "Not published" wording | Used everywhere instead of "draft". |
| Dish library | Every dish ever saved is kept in Your dishes, separate from orders. Menus hold copies with their own price, limit, chef, sold out. |
| Dish IDs are internal | Never shown in the UI. |
| Pickup locations (D-061) | Up to 5 saved in Settings; each menu ticks which it uses; editable in place from the menu step. |
| One picture per menu | 3:2 collage, optional; new menus start without one. |
| Chefs default to the kitchen | Unassigned dishes belong to "Onde Onde · whole kitchen"; deleting a chef moves dishes there. Chefs can be added and invited from the dish editor. |
| Kitchen, not Cook list | Nav: Orders · Kitchen · Pickup & delivery · Menu · Settings. More is phone-only. |
| Packing is separate | Kitchen · Pack records a packed flag only; it never changes order status. |
| Customers confirm collection | No Collected button for the seller on Pickup. |
| Pickup messages per place only | One Message button per pickup place; no per-customer messages there. Delivery messages only through the three per-order steps. |
| Messages don't change status | No "also update the order status" option. |
| Sent log | Each group's sent messages are shown; repeats warn but are allowed. |
| Updates by web push | Shown on the order page plus web push. WhatsApp only for a single order, opened with the text written. |
| Taking orders lives on Orders | Not a setting; a switch beside Live. |
| WhatsApp number lives in Settings · Kitchen | Tab "Ordering & WhatsApp" became "WhatsApp post" (greeting and closing only). |
| Phone scope | Live orders, order detail, New order, Pickup & delivery, More. |
| Five colour themes | Onde Onde, Bali, Sumatra, Sunda, Jawa; each with light and dark backgrounds. |

## Data model changes

What the design needs that the brief doesn't store yet:

| Record | Fields | Lifetime |
| --- | --- | --- |
| Dish (library) | id, name EN/ID, description EN/ID, size EN/ID, default price, default limit, chef, last used | Until the seller deletes it |
| Saved set | name, list of dish ids, times used | Until deleted |
| Menu dish | dish id, price, limit, chef, sold out (per menu) | With the menu |
| Menu | state (not published / live / finished), cooking day, cut-off, pickup place ids, delivery on + note EN/ID, picture, wizard step reached, taking orders on/off | Totals kept after 4 weeks |
| Pickup place | place, directions EN/ID, from, to | Max 5; until deleted |
| Order | + packed flag, + collected-by-customer time | As today (details 4 weeks) |
| Message log | menu, group (place or delivery or order), message type, time, sent count | With the menu |
| Chef | name, signed in or not; default chef = the kitchen | Until deleted |
| Kitchen settings | + colour theme, + menu defaults (cut-off days and time, delivery default + note) | — |
| Device setting | light / dark / auto, left panel open or collapsed | Per device |

## Open questions

- [ ] Live dish limits: add a **Dishes** panel on the live Orders screen (sold / limit / left, edit limit, sold out)? Proposed, not yet designed.
- [ ] New order on tablet: same fields as the phone form, as a slide-over; not drawn yet.
- [ ] Ready status: with no Ready button on Pickup and messages no longer changing status, Ready is set only in order detail. Confirm that's enough on the cooking day.
- [ ] Sumatra theme sits close to the danger red; shift danger toward orange-red when that theme is on?
- [ ] Exact behaviour of an open native dropdown varies by device; keep the native control, pass the colour scheme.
