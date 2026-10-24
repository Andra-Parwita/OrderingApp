# 121 · Anonymous order statistics and nudges for Remember me and notifications

**Target: 1.0.44.** **Status:** built 24 Oct, in the 1.0.44 gate. Mock-up approved ("mock is good"): `uxDesign/customer/mockups/121-nudges.html`.

## Owner's words (24 Oct)
- "Yeh we can count that anonymously, I think we can count etc just for statistics." · "Statistics is in admin app only."
- "We want to encourage remember me and notification, so maybe in my orders we can have small nudge, and customer dismiss and if new menu or new order coming up, we can nudge again, especially when they ordering."

## Part A · Nudges (client only)
As drawn in the mock-up (frames 1–5):
- A small card at the top of **My orders**: notifications ("Get a message when your order is ready · Turn on") while an order is open and notifications are off; otherwise Remember me ("Keep your orders on all your phones · Turn on") when Remember me is off.
- **One card at a time.** Notifications first while an order is open.
- **iPhone in a browser** (not installed): notifications need the home-screen app, so the card says "Add to your home screen to get a message when your order is ready · How".
- **Dismiss (✕)** = quiet until the next **new menu** of a kitchen in My orders, or the customer's **next order**. After **4 dismissals** of a card it never shows again (still in Settings).
- **Order placed: no new line.** Owner, 24 Oct: "Keep only the existing card on Order placed (no new line). The new nudges go in My orders only." (Frame 4 of the mock-up is superseded.)
- Device-only state (localStorage, try/catch): dismiss count and the "quiet until" marker per card. No server change.

## Part B · Anonymous statistics (after plan 113 lands; it touches orders)
- New nullable columns on `orders` (one migration): `src_place` (`app` | `browser` | `inapp`), `src_os` (`ios` | `android` | `other`), `src_push` (0/1), `src_remember` (0/1). The order's `language` already exists.
- The customer app sends these with the order (no names, no ids; values only from the list above); the Worker validates and stores; older clients send nothing (stored as null).
- **Admin app only:** a "Statistics" card: per kitchen, per week, counts of orders by each fact (never per person, never per order).
- Retention: the columns live and die with the order row (existing retention rules). **Recorded decision:** orders are deleted about 4 weeks after the cooking day, so only about 4–5 weeks of counts exist. The admin card asks for 8 weeks and older weeks stay empty. We do not keep a separate count table.
- **Recorded decision (built):** sample orders, private orders and orders a team member entered are left out of the counts, because they were not placed from a customer's phone (`worker/db/orderStats.ts`).
- Built: migration `0034_order_stats.sql`; `POST /api/s/:slug/orders` takes an optional `stats` (bad values dropped, never fails an order); `GET /api/admin/stats` (admin only); backups carry `stats`; admin "Statistics" section.
- Backup and restore carry the columns (plan 113's comparison test updated).

## Stages
| # | what | who | proof |
|---|---|---|---|
| A | nudges in My orders + Order placed line, EN/ID, rules above | builder (customer files) | unit: one card at a time, dismiss quiet-until, 4-dismiss stop, iPhone-browser variant; e2e native-customer / customer-batch1 |
| B1 | migration + Worker validation/storage + client sends facts | builder (after 113) | unit: invalid values dropped, old clients ok; migration on scratch D1 |
| B2 | admin Statistics card | same builder | unit + e2e admin |
| C | docs (data model, api, product flows), plan list, roadmap | coordinator | `pnpm run docs` |

**Deploy impact:** one add-only migration (B1), applied before the Worker deploy; nudges are client-only.

## Follow-up: no duplicate Remember me accounts (owner "A", 25 Oct)
Found on the owner's iPhone: two customer passkeys ("Indra · customer (Remember me)" and an unnamed "Remember me") and one new account in the live backup. On iPhone each home-screen app has its own storage, and the new My orders card's "Turn on" opened a sheet that only registers. Fix in 1.0.44: the turn-on sheet offers "Turned on Remember me before? Restore your orders"; on iPhone the card says "Turn on or restore"; a safeguard to reuse an existing passkey is investigated. Owner cleanup after the deploy: delete the duplicate account (Settings → Remember me → Delete my saved data, in the app where it is active), delete the unnamed passkey in Passwords, restore with "Indra · customer".
Owner (25 Oct): the older account is the Onde Onde one; after the 1.0.44 deploy the owner will restore, or keep the newly named DellaVee one ("Indra · customer"), then delete the other account and its passkey.
