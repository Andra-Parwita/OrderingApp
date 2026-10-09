# Onde Onde customer app · design spec

The customer side of Onde Onde: what family and friends use to order food from a home cook. It is a **React web app** opened in the phone's browser from a WhatsApp link, installable to the home screen (a PWA), with web push for order updates. It is not Expo and not a native app.

The design boards in `/design` are the visual source of truth. This file is the written spec behind them. Where the two disagree, ask; where the original customer brief disagrees with this file, this file wins (it records later decisions).

Companion files: `data/screens.json` (every screen and where it is drawn), `data/fixtures.json` (the sample data the design uses), `data/strings.json` (EN/ID copy), `tokens/` (theme tokens shared with the seller app).

---

## 1. Platform

- React web app, phone first. Tablet and desktop use the same screens, centred at phone width up to 480 px, wider later.
- Installable PWA: web app manifest + service worker. **One manifest per kitchen** (see 6.4).
- Web push for seller messages (see 7).
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- **Safe areas:** never hard-code the 54 px top / 34 px bottom seen in the frames. Use `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`. A good pattern: define `:root { --sat: env(safe-area-inset-top, 0px); --sab: env(safe-area-inset-bottom, 0px); }` and use `var(--sat)` / `var(--sab)` everywhere, so a test can set them to the frame values (54 / 34; 88 at the bottom in Safari screens; see `data/screens.json`).
- Status bar colour comes from the manifest / `<meta name="theme-color">` set to the theme's `bg`, per light and dark.
- The phone frames show the status bar, Dynamic Island, home bar and browser bars. Those are the phone's or browser's, **not part of the app**.

## 2. Theme

The customer app uses **the seller's theme**. The seller picks one of five colour themes for the whole kitchen in the Seller app → Settings → Appearance. Full values: `tokens/tokens.ts` (TypeScript) and `tokens/tokens.css` (CSS custom properties); rules: `tokens/onde-onde-theme.md`.

- Themes: **Onde Onde** (green, default), **Bali** (blue), **Sumatra** (red), **Sunda** (indigo), **Jawa** (brown). Each has light and dark.
- A theme sets the accent (`fill`, `atext`, `tint`) and tints the backgrounds (`bg`, `panel`, `surf`, `surf2`, `line`). Text and status colours never change between themes.
- **Light / dark:** follow the phone (`prefers-color-scheme`) by default. Settings → Appearance offers Auto (default) · Light · Dark, remembered on the device. Set `color-scheme` on the root so native controls match.
- In the design files the theme is the class list on each board's root: `th <brand> <light|dark>` (brand: `ondeonde | bali | sumatra | sunda | jawa`). Change those classes in the browser to see any combination. `tokens.css` uses the same classes.
- Token names in the design CSS vs `tokens.ts`: `--fill`=fill, `--onfill`=on, `--acc`=atext, `--tint`=tint, `--bg`=bg, `--panel`=panel, `--surface`=surf, `--s2`=surf2, `--line`=line, `--edge`=ctrl, `--text`=text, `--muted`=muted, `--ok`=conf, `--ready`=ready, `--warn`=warn, `--warnbg`=warnTint, `--danger`=danger, `--kbg`=kbg.
- Photos (banner, menu picture) and the phone's own UI keep their own colours in every theme.

### Type and size

- UI: **Plus Jakarta Sans** 400/500/600/700. Order codes: **IBM Plex Mono** 600, letter-spacing .06em. Tabular figures for prices, counts and times.
- Phone: screen title 26–28 px/700; section label 13 px/700 uppercase .05em muted; row name 15–16 px/600–700; body 15 px; meta 13–14 px muted.
- Touch targets ≥ 44 × 44 px, 8 px apart. Main buttons 54 px tall, fully rounded (pill). Steppers 44 px round.
- Radius: controls 10–12 px, cards and sheets 14–20 px, pills fully round.
- One filled (accent) button per screen; everything else outlined or plain text.
- Separate with spacing and 1 px `line` hairlines, not boxed cards (exceptions in the design: the info sheet on the menu home, the "Get a message" card, status banners).

## 3. Navigation model

- **Bottom tab bar** on the three root pages: Menu · My orders · Settings. The active tab uses `atext`, bold, plus a mark; never colour alone. My orders shows a dot when an order has an update the customer hasn't seen.
- **Pages slide in from the right** (push), with a top bar: **‹ Back** label on the left (names the previous page: "Menu", "Dishes", "Basket", "Order", "My orders"), the kitchen's wide logo centred, nothing on the right. Then a large page title. Board `Main.dc.html` frame 3 shows the motion.
- The back button is the main way back. In an installed iPhone web app the edge-swipe back gesture may not exist, so never rely on it.
- Checkout pages (basket, pickup place, your name, placing) hide the tab bar and pin their one action at the bottom.
- Respect `prefers-reduced-motion`: no slide, just a cross-fade or instant change.
- The full menu picture opens as a full-screen viewer (pinch to zoom, swipe down or ✕ to close).
- The cancel confirmation is a bottom action sheet drawn by the app.

## 4. Screens

Ids match `data/screens.json`. Copy is in `data/strings.json`.

### 4.1 Menu (from the WhatsApp link)

**menu-home**: top to bottom: the kitchen's **phone banner** (3:1, shown whole, never cropped), then the **menu picture** (3:2, the only food photo) filling the rest of the screen behind a **see-through info sheet** (surface at about 88% with a strong blur). On the photo: EN/ID switch (top right) and **See full picture** (bottom left). The sheet: kitchen name and tagline · Cooking {date} · Order by {date, time} · Pickup at {n} places · or delivery › · How ordering works ›. Main button **See dishes and order ›**. Tab bar below.

- Tapping the photo or See full picture → **menu-full-picture**.
- See dishes and order → **menu-dishes** slides in.
- The menu picture is optional (new menus start without one): show the banner, then the sheet on a plain `kbg` background.

**menu-dishes**: top bar (‹ Menu, logo). Title "Dishes", line "{date} · order by {dateTime}". Rows: name (600–700), description (muted), size · **price**; right side a round − qty + stepper. Before the first add, only + shows. "{n} left" (warning colour + clock icon) when 5 or fewer remain; the + is disabled when the basket holds all that's left. **Sold out**: muted name, an outlined "Sold out" pill with icon, no stepper. Dishes have no pictures. After the first dish, a sticky bar above the tab bar: **{n} items · {total} · View basket ›**.

**menu-how-it-works**: three steps with big icons: pick dishes, then pickup or delivery · place the order with your first name, no account · send it on WhatsApp to {cook}, {number}; you pay them directly. Shown automatically once to first-timers, otherwise from the row on menu home.

**States** (board `MenuStates.dc.html`): **menu-paused** ("Not taking orders right now", Message the seller on WhatsApp, "See the dishes anyway" link), **menu-closed** (cut-off passed, uses the **date**, never a weekday word like "this Saturday"), **menu-not-published** (banner only, "The menu isn't out yet"), **menu-load-error** (skeleton, then error card with Try again). Plus **Kitchen not found** for a wrong or old link (friendly message, no list of kitchens) and **Home** without a kitchen link ("Open your seller's link from WhatsApp").

### 4.2 Basket and checkout

**basket**: rows with name, "{price} each · **line total**", stepper (the − becomes a bin icon at 1); Total. Section "Pickup or delivery": segmented control (Delivery hidden if the seller doesn't offer it). Pickup: one row showing the chosen place and time, **Change ›** → **pickup-place**. Delivery: the note that the address goes on WhatsApp and is never stored. Pinned **Next: your name ›**.

**pickup-place**: "Where will you pick up?", "All on {date}". Radio rows (up to 5): place, time window, directions text; a round directions button (opens maps) on each. **Done**.

**your-name**: First name (required, 40 max, helper "Only your first name or a nickname"); Note (optional, 200 max, counter, helper "Don't write your address or phone number here"); summary (items, total, pickup or delivery); "You can change or cancel until {dateTime}"; **Place order · {total}**.

**placing**: same page dimmed, button disabled with spinner "Placing your order…".

**Errors** (inline banner at the top of the basket, warning colour + icon, plain words, says what changed and what to do): a dish sold out or fewer left than asked (adjust the basket and say so: **basket-delivery-error**), cut-off passed, ordering paused. Warn, never block silently. Empty basket: "Your basket is empty" + Back to menu.

**Change order**: the same basket screens in edit mode: title "Change your order", first name fixed, button **Update order · {total}**. The last dish can't be removed; cancel instead.

### 4.3 Order placed and QR

**order-placed**: "Order placed" (icon + word), "Thanks, {name}. Now send it to {cook}." A tappable card with the **order number** (mono, large, e.g. K7F-2QX) and a small QR → **order-qr**. Main button **Send to {cook} on WhatsApp** (pre-filled message: code, dishes, total, pickup or delivery, first name, and for delivery "My address:" to complete). Then the **Get a message when your order is ready** card with **Turn on updates** (see 6). Links: View order details · Change or cancel. "Saved in My orders on this phone." For returning customers sending on WhatsApp is optional.

**order-qr**: full screen on `surf`: "Show this at pickup", big QR (≈250 px), order code (mono 44 px), first name · items · total, place and time, and a hint to turn up screen brightness. Reached from Order placed and the QR button on the order page. The QR always stays dark-on-white, even in dark mode.

### 4.4 Order page (the customer's private link)

Header: kitchen · date, order code (mono), QR button. Status pills (icon + word), e.g. Confirmed and Not paid. A four-step progress bar: Ordered → Confirmed → Ready / Out for delivery → Collected / Delivered.

- **order-ready**: big status banner in `conf`: "Ready! Pick up at {place}", time and directions, then **I've collected my order** (asks once, "Mark as collected?"). Delivery uses the same banner pattern for "Out for delivery" / "Arriving soon" / "Delivered" in the `ready` colour.
- **Updates from the seller**, newest first: "Ready in {n} min", "Ready for pickup at {place}", "Out for delivery", "Arriving soon", "Delivered", or the seller's own text with their name. Empty: "No updates yet."
- Notifications line: "Notifications are off · Turn on" (or the "on" state, see 6).
- Order details: dishes, total ("pay {cook}"), pickup or delivery, name, note. Paid or Not paid shown as a pill.
- **order-confirmed**: **Change order** and **Cancel order** (danger outline) side by side while the order is Ordered or Confirmed, not locked and before the cut-off, with "Until {dateTime}". After the cut-off: "Changes closed at the cut-off." Locked: "The seller has locked this order. Message them on WhatsApp to change it."
- **order-cancel-confirm**: action sheet "Cancel order {code}?", "{cook} will see it's cancelled. You can't undo this.", **Yes, cancel my order** (danger) / **Keep my order**.
- Message {cook} on WhatsApp is always available.

### 4.5 My orders

**my-orders**: title; "Have an order code?" field + Open (accepts k7f2qx, K7F 2QX, K7F-2QX; opens it if saved on this phone). **Current**: rows with code, update dot, total, kitchen · dishes, date · pickup place or Delivery, and status pills (status, Locked, Paid / Not paid). **Earlier**: compact rows with code, kitchen · date, total, and Collected / Cancelled / Archived (icon + word). Footnote "Saved on this phone only. No account." Orders from several kitchens can appear.

**my-orders-empty**: "Your orders will appear here" + Go to the menu. **order-earlier**: a finished menu's order is read-only, with "This menu is closed. You can still see what you ordered." and "Details kept until {date}". **order-archived**: after 4 weeks only kitchen, date, code, "This order has been archived" and a link to the current menu remain.

### 4.6 Settings

Language (EN / ID, default from the phone, remembered) · Appearance (Auto · follows phone / Light / Dark) · Order updates (switch, see 6) · Put Onde Onde on your home screen (Android: Install button; iPhone: opens the guide in 6.2). Drawn on board `InstallOther.dc.html` frame 4.

## 5. Copy and language

- Every string in English and Indonesian; Indonesian is about 20–30% longer, so no fixed-width labels. Starter copy: `data/strings.json` (Indonesian needs a native check).
- Dates follow the language: "Sat 17 Oct" / "Sab 17 Okt". Use the menu's cooking date; never "this week" or a fixed weekday.
- Prices in AUD.
- Order codes: 6 characters shown as XXX-XXX in mono; readable aloud.

## 6. Add to home screen and notifications

Updates are optional. **Never block ordering.** Customers who skip can always check the order page.

### 6.1 When to ask

Right after placing an order: the "Get a message when your order is ready" card on Order placed. Also from the order page's notifications line and from Settings. What **Turn on updates** does depends on the device:

| Device / browser | What happens | Screens |
| --- | --- | --- |
| iPhone, Safari, not installed | Guide to add to the Home Screen (web push only works for installed web apps on iPhone, iOS 16.4+) | ios-ask → ios-step-1…4 → ios-open-from-home |
| iPhone, inside WhatsApp, Instagram or another in-app browser | "First, open this page in Safari" with **Copy link** | ios-inside-whatsapp |
| iPhone, Chrome / Edge / Firefox | Their Share menu also offers Add to Home Screen (iOS 16.4+). Show the same guide with "Share" as step 1, or the open-in-Safari screen if you prefer one path | (reuse ios-step screens) |
| iPhone, installed (opened from the home screen) | Ask for permission, only from a tap on the button | notify-off → system prompt → notify-on |
| Android, Chrome (or Samsung Internet) | Ask for permission straight away; no install needed | android-allow |
| Android, inside WhatsApp | "First, open this page in Chrome": ⋮ → Open in Chrome | android-inside-whatsapp |
| Desktop | Optional quiet line "Get updates on this computer · Turn on" | desktop |

Detection: in-app browsers by user agent (WhatsApp, FBAN/FBAV, Instagram, Line); iPhone by platform; installed by `matchMedia('(display-mode: standalone)')` or `navigator.standalone`; push support by `'PushManager' in window` and `'serviceWorker' in navigator`. When unsure, show the generic guide and keep "Skip" visible.

### 6.2 iPhone guide (Safari)

One step per screen, big pictures, EN and ID. The instruction sits at the **top** of each screen so it stays visible while Safari's menus open from the bottom. Each step has "Done, next step" and Back; ✕ closes the guide at any point.

1. **Tap •••** (bottom right; an arrow points at Safari's real button). Older iPhones: "Tap the Share button instead, then skip to step 3."
2. **Tap "Share"** in the menu that opened.
3. **Tap "Add to Home Screen"** ("Don't see it? Tap More or scroll down").
4. **Tap "Add"** (top right; leave "Open as Web App" on).
5. **Now open Onde Onde from your Home Screen**: "It opens straight to order {code}. Turn on notifications there." Plus "I can't find the icon" and "Stay here and check the order page".

The iPhone screens follow current iOS (26). Verify the step pictures against real devices before launch; Apple moves these menus between versions.

### 6.3 After install: permission

When the app is opened from the home screen and notifications are not yet allowed, the order page shows **notify-off**: "Last step: turn on notifications" with **Turn on notifications** and Not now. Only call `Notification.requestPermission()` from that tap. Then:

- **notify-on**: "Notifications are on · We'll tell you when your order is ready." Subscribe to push and send the subscription to the server for this order.
- **notify-blocked** (permission denied): explain how to turn them back on. iPhone: Settings → Notifications → Onde Onde → Allow Notifications. Android: in Chrome ⋮ → Settings → Site settings → Notifications → allow the site (if Chrome itself is blocked: phone Settings → Apps → Chrome → Notifications). Button "I turned them on" re-checks `Notification.permission`.
- Settings → Order updates mirrors the state and can turn them off (unsubscribe).

### 6.4 The order link after install

The customer must land on **their order**, not a blank home screen:

- Serve **one web app manifest per kitchen** (e.g. `/k/{kitchen}/manifest.webmanifest`) with that kitchen's name, theme colours, the seller's icon, and `start_url` pointing at the page the customer is on when they install (for the order flow: their order page, e.g. `/o/{code}?source=homescreen`). Set the manifest link when the order page loads so it's current at the moment of "Add to Home Screen".
- On iPhone, the installed app has **separate storage from Safari**. The order saved in Safari is not there. On first open, read the order code from `start_url`, fetch it and save it to the installed app's My orders.
- Notification taps open `/o/{code}` in the installed app (or the browser on Android).
- Fallback: My orders → "Have an order code? Open it".

### 6.5 Home screen icon

Each seller uploads their own icon in the Seller app → Settings → Kitchen → pictures → **Small icon**: square, at least 512 × 512, filling the whole square (no border, no rounded corners, no black corners: the phone rounds it), main subject centred. Upload hint for sellers: "Square picture, at least 512 × 512. Fill the whole square; phones trim the edges." Use it for the manifest icons (192, 512, maskable) and `apple-touch-icon` (180). If none is uploaded, use a default Onde Onde icon. Customers who installed earlier may keep the old icon until they re-add it. The design uses `design/assets/home-icon.jpg` as a placeholder.

## 7. Seller messages and push

- Message types: Ready in {n} min · Ready for pickup (at {place}) · Out for delivery · Arriving soon · Delivered · the seller's own text. Pickup messages go to everyone at a place; delivery steps per order.
- Each message is a web push **and** appears in "Updates from the seller" on the order page. Messages don't change order status.
- Push title: kitchen name; body: the message (`data/strings.json` → push); icon: the seller's icon; tap opens the order.
- Not installed on iPhone, or permission not given: the order page is the only place messages show. That's fine.

## 8. Data and privacy

- No account, no password, no payment in the app. Only a first name or nickname; never a phone number, address or email. The delivery address goes to the seller on WhatsApp.
- My orders lives on the phone (localStorage / IndexedDB per origin). Order details are kept for 4 weeks, then only the kitchen, date and code remain (archived).
- Offline: show the last loaded menu or order with "You're offline", keep actions that need the network disabled, offer Try again.

## 9. Accessibility

WCAG AA: text ≥ 4.5:1, icons and control edges ≥ 3:1 (the tokens are checked). Visible 2 px focus ring in `fill`, 2 px offset. Every input labelled. Status never by colour alone (icon + word). Real buttons and links. Order codes read out character by character (`aria-label="K 7 F, 2 Q X"`). Respect reduced motion. Live regions for basket count and order status updates.

## 10. Open items for the implementer

- **Home screen icon**: the seller uploads it (6.5); provide the default icon.
- Verify the iPhone guide screenshots on iOS 26 and one older iOS; verify in-app browser detection on current WhatsApp builds (iOS and Android).
- Indonesian copy needs a native speaker's check.
- The phone banner in the design is a 2:1 file with blurred bands; real seller uploads are 3:1 (1200 × 400).
- Seller app parity: the seller's "Message a pickup place" and delivery steps must trigger the push and order-page updates described in 7.
- The menu picture slot is 3:2; a portrait collage gets cropped top and bottom on menu home (whole on the full-picture view).
