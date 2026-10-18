# 096 · Home-screen nudge in the notice-pill style

**Status:** built 18 Oct for 1.0.41 (root page approved "A" after the localhost preview); approved 18 Oct (owner "A"): colour **N1 soft stone**, home-screen pill text **"Add to your home screen · How"** / "Tambahkan ke layar utama · Caranya"; build after 1.0.41. Mock-up: `uxDesign/customer/mockups/096-install-nudge.html`.

## Goal
Owner, 18 Oct: "this similar style should maybe be used to nudge customer to install it as app or home screen?" Use the plan 095 E2 pill (floating, 40 px, ShaggyBobo icon, ✕ with 40×40 tap area) in a calm **neutral** colour, so it isn't mistaken for an update (green) or a notice (amber).

## Proposal (to confirm with the mock-up)
- Text: "Put {{kitchen}} on your home screen" · link "How" · ✕ (EN/ID; reuse `src/components/install` strings where they exist).
- Shown only in the browser (not when already installed / standalone), on the menu home and on the order-placed page (order updates on iPhone need the home-screen app).
- Tap → opens the existing install steps (`src/components/install`).
- ✕ hides it for 14 days on this phone.
- Never at the same time as a green/amber pill (one pill at a time; update first).

## Remember me nudge (owner "A", 18 Oct)
Owner: "or we could nudge it if they pick delivery or create order or if they have order the first time … also can nudge them if they want to keep Remember me".
- Same pill style, on the **order-placed page only** (never in basket/checkout):
  - first order on this phone: "Keep this order on any phone you use · Remember me"
  - a delivery order: "Keep your address for next time · Remember me"
- Only if Remember me is off. One nudge at a time (update/notice pills first, then home screen, then Remember me). ✕ → ask again after 30 days, at most 3 times in total, then only the Settings card (local storage, per phone).
- **Restore is not a nudge.** Owner: "how can we restore their order, if we never know and only have first name previously?" — correct: restore only works for customers who turned Remember me on before; we can't tell from an empty phone. Keep today's quiet line on an empty My orders, worded honestly: "Turned on Remember me before? Restore your orders", and next to it the existing way back for everyone else (the WhatsApp order link, or "Have an order code?" + first name).

## First-visit flow (owner, 18 Oct; taken as "A")
Owner: "when they open the first time (no orders) what do we show … I think we can leave Remember me as part of their first order or ordering as a small indicator"; "also make sure there is a '?' about Remember me which we can then slide up (bottom sheet) for info about what Remember me does".
| moment | shows |
|---|---|
| first visit, no orders | the menu only, no nudges (the 087 menu chip goes) |
| ordering, name step | one quiet line under the first-name field: "☐ Remember me on all my phones  (?)" / "☐ Ingat aku di semua HP-ku (?)" (owner: "as long as it's consistent" → the feature's existing title wording); off by default; "?" opens the existing Remember me explanation in a bottom sheet (what it keeps, why it's safe, passkey, "ordering works without it"); ticked → after the order is placed, the turn-on runs (first name already known → Face ID) |
| order placed (first order) | the home-screen pill (N-colour) |
| later | the Remember me pill only if not ticked (30 days, max 3); Settings card always |
Short pill texts so they fit at 390 px: "Keep this order · Remember me", "Keep your address · Remember me" (ID "Simpan pesanan ini · Ingat aku", "Simpan alamatmu · Ingat aku").

## Main page (order.shaggybobo.app/), in 1.0.41
Owner, 18 Oct: "simply show the logo and simply say welcome to ShaggyBobo app or something, and an abstract or vague message to say maybe check their contact (which could mean their seller WhatsApp etc) if they're looking for something else … later on we can show what the page can lead to: other seller app, customer app, store etc."
- Logo, "Welcome to ShaggyBobo" / "Selamat datang di ShaggyBobo", and "Looking for a kitchen or shop? Open the link you were sent." / "Mencari dapur atau toko? Buka tautan yang dikirim kepadamu." No links, no names.
- **Pure page** (owner, 18 Oct: "root page should not show any bottom bar .. it's pure like index.html"): no tab bar, no customer shell, **no automatic jump in a browser** (`REDIRECT_RETURNING_CUSTOMERS = false` in `src/app/pages.tsx`); inside an installed home-screen app "/" jumps to the last kitchen so nobody is stranded without an address bar (coordinator's safety rule, told to the owner 18 Oct). Look: option B of `uxDesign/customer/mockups/097-main-page.html` (About hero animation, logo, welcome, neutral hint; seller link off behind `SHOW_SELLER_LINK`). Plus `noindex` in index.html, neutral default link preview ("ShaggyBobo · By invitation"), and clearing `lastKitchen` on kitchen-not-found.
- **Later (not now):** the page can grow into a hub: seller app sign-in, customer app, store (plan 082). Owner, 18 Oct: "could be kitchen, shop, an event organiser, when we do event ticketing for community events etc, so community activities" → keep the root page's wording neutral (not "kitchen or shop" only). Fable is analysing options (mock-up `uxDesign/customer/mockups/097-main-page.html`).

## Stages
| # | what | who |
|---|---|---|
| 1 | Mock-up: neutral pill light/dark, on menu home and placed page, next to the 095 pills for comparison | design agent (sonnet) |
| 2 | Owner OK | owner |
| 3 | Build + scoped gate | builder (sonnet) + coordinator |

**Deploy impact:** client only.
