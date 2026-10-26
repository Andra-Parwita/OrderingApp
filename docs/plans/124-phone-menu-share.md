# 124 · Seller phone: see the menu, publish it, send the notice, share on WhatsApp

**Target: 1.0.45 — live 26 Oct (Worker `e711941c`, owner live check ✅)** (owner A, 26 Oct: alone, as soon as the emulator test passes; large titles, 116 and the chef permissions move to 1.0.46). **Status:** mock-up `uxDesign/seller/mockups/124-phone-menu-card.html` approved (owner A, 26 Oct); built, two Android emulator rounds passed (incl. Back in Chrome and the installed app), closing gate green.

## Why (DellaVee's seller, 25 Oct, in Indonesian)
"Menu dibuat di tablet dan tablet gak punya no WA customer … aku harus share link nya dari tablet ke hpku via bluetooth dulu (aku gak mau WA-ku di tablet, tabletnya buat umum di rumah) … baru aku bisa share ke langgananku. Klo aku bisa lihat menu dan share lebih cepat sih."
The menu is made on a shared family tablet without WhatsApp, so the link has to travel to the seller's phone by Bluetooth before she can send it to customers.

## Owner's decisions (26 Oct)
- "We don't need full menu editing. But to activate, send notifications, share via WhatsApp. The idea is that Rina or the seller does not have or enable WhatsApp on their tablet."
- **Q1 B:** owner only for everything (view, publish, notice, share); chefs and helpers see nothing new.
- **Q2 A:** publish = one confirm sheet with a short summary (cooking day, order cut-off, pickup/delivery, number of dishes) and **Publish menu**; if something is missing, "Finish this menu on the tablet" with what is missing. After publishing: "Menu is live" with Share and Notice. Owner: "seller may have published it on the tablet and need only to share via notifications or WhatsApp; there could be different customers to share with, so seller may share multiple times to different people" → when the menu is already live there is no publish step; **Share on WhatsApp is always there and can be used any number of times**.
- **Q3 A:** a compact **Menu card at the top of the phone's Orders screen** (status, cooking day, buttons); tapping it opens the **read-only menu**.
- **Q4 A (share text):** Share on WhatsApp opens a small sheet like the tablet's Share screen: language ID / EN / Both (last choice remembered), a preview of the ready-made post (`seller-share/shareText.ts`: greeting + dishes + cut-off + pickup + link + closing), and **Share**. Owner asked "and she can also update the text?" → **Q5 A:** the preview is a text box she can type in, for this share only; the changed text stays while the sheet is open (back from WhatsApp, change the name, Share again for the next person); "Reset text" brings back the ready-made post; Close forgets the changes; nothing is saved to Settings. Mock-up frames 6–10.
- **Q6 A (26 Oct):** the button is **"Share menu" / "Bagikan menu"** (it opens the phone's own share list: WhatsApp, SMS, email…; WhatsApp link only where a browser has no share list). Share layer is full screen with Share in the top bar (owner: "beware of keyboard avoidance").
- Not in scope: menu editing on the phone, Taking orders / Sold out switches.

## What
- **Phone Orders screen** (owner, phone layout only): a Menu card above the list.
  - Not published, complete: "Ready to publish · Cooking Sat 31 Oct" + **Publish**.
  - Not published, incomplete: "Not ready · finish on the tablet" (what is missing).
  - Live: "Live · orders close Fri 30 Oct, 9 pm · Cooking Sat 31 Oct" + **Share on WhatsApp** + **🔔 Notice**.
  - Orders closed / finished: as the card's status only (open question below).
- **Publish sheet**: summary + Publish (existing `POST /api/seller/menus/current/publish`); then "Menu is live" with Share + Notice.
- **Notice**: the existing plan 112 send (`GET/POST /api/seller/menu-notices`), same rules (orders open only, warning from the 3rd send).
- **Share on WhatsApp**: the existing share text and link (seller-share), Web Share on the phone (WhatsApp in the share list), fallback `wa.me` text link.
- **Read-only menu**: dishes with price, choices, sold out, pre-order / on the day; no editing.
- The tablet is unchanged. The old "Share menu on WhatsApp" in the empty Orders state is replaced by the card.

## Open questions (after the mock-up): none
- **Q8 A (26 Oct, after the emulator check):** Android Back closes the open share layer, read-only menu or sheet first (one step at a time); Back on the share layer forgets the changed text like Close.
- **Q7 B (26 Oct):** after the cut-off the card shows the status only ("Orders closed"), no buttons (`SHARE_AFTER_CUTOFF = false`).


## Stages
| # | what | proof |
|---|---|---|
| 0 | mock-up | owner OK |
| 1 | Menu card + publish sheet + read-only menu, owner + phone only, EN/ID | unit (states, role, phone only), typecheck |
| 2 | scoped gate + **Android phone emulator check** (owner, 26 Oct): publish, notice, share sheet opens WhatsApp-like targets, read-only menu | e2e touched specs; emulator screenshots |

**Deploy impact:** client only if the existing routes suffice (no migration); confirm while building.
