# 074 · Live updates everywhere: push instead of checking

**Status:** approved (2026-10-14; all questions answered; building now). Owner: "if we have WebSocket, Durable Object, can't it be push?" → "and I thought we have notifications?" → "we can do that now A; is this for the seller app only? How about the customer app … let's plan and discuss and ask me questions one by one".
**Goal:** screens update **the moment something changes**, pushed by the server, instead of asking every 15 s. Sellers and customers. Fewer requests (plan 073's biggest findings), instant updates, a slow backup check only when the live connection is down.

## Today
| who | screen | how it updates |
|---|---|---|
| seller | Orders, Cook | the kitchen's live WebSocket (`SellerLive` Durable Object) + a 60 s backup loop (plan 062) |
| seller | **Sell, Hand over / Deliveries** | **own 15 s timers** (3 requests each), even when hidden; ignore the live connection |
| customer | **order page** | asks every 15 s (order **and** menu), also after the order is finished |
| customer | My orders | reloads on every screen change |
| customer | menu ("N left", sold out) | loaded when opened |
| customer | notifications (web push) | arrive when "Order updates" is on; an open page doesn't react to them |

## Proposal (to be confirmed question by question)
1. **Seller screens use the existing live connection:** Sell and Hand over / Deliveries listen to `SellerLive` events and refresh only what changed; their 15 s timers go; a slow backup check only while the connection is down; nothing while hidden.
2. **A notification refreshes open pages:** when a push arrives, the service worker tells any open customer page for that order to refresh at once (no extra requests).
3. **Customers get a live connection** (for those without notifications too): the order page (and maybe more, see questions) opens a small WebSocket scoped by the order's private token, so a customer only ever hears about **their** order; the server pushes status / change events; backup: a slow check (60 s) only while disconnected, an instant check on return, none when the order is finished.
4. **Event-aware refresh:** each live event names what changed (order, menu, stock) and screens reload only that part.

## Owner's answers
1. **One connection for the whole customer app** (owner: "why not the customer app parent just connect to one WebSocket?"), opened in the app shell, not per page; one per kitchen with active orders (normally one). It carries **only the customer's own orders that are not yet collected/delivered (or cancelled) and are on the active menu day** (owner, 14 Oct). When the customer **orders again** (a new order), it is added to the connection at once, so its status is live too. Every page listens to it: the order page and My orders update live; a notification arriving also refreshes them. When no such order is left, the connection closes by itself. The menu's "N left / sold out" stays as it is (not live) for now.

2. **Backup check when the live connection is down** (owner, 14 Oct: "slow update, every 5 mins is okay; ideally it's an admin setting that ShaggyBobo admin (me / my son) can change"): default **every 5 minutes**, only while disconnected and the screen is visible, plus an instant check when the customer returns; stops as soon as the connection works. The interval is a **platform setting on the admin page** (stored with plan 046's `app_settings`), read by the apps from `GET /api/status`; sensible bounds (e.g. 1–30 min).

3. **Two backup-check settings on the admin page** (owner "B", 14 Oct): one for **customers** and one for **sellers** (owner/chef/helper screens: Orders, Cook, Sell, Hand over / Deliveries), **both defaulting to 5 minutes**. They replace the fixed 60 s seller loop and the 15 s timers.

- **A small, subtle connection status** (owner, 14 Oct): in customer **Settings** (one muted line), "**Connection: live ●**" when connected, or "**Last updated 10:42**" ("Connection: checking every 5 min") when on the backup check; also when nothing is active: "No active orders". EN + ID ("Koneksi: langsung ●" / "Terakhir diperbarui 10:42"). Not a banner; no colour alarm (the offline banner already covers offline).

4. **Build now** (owner, 14 Oct: "we build it now"), then deploy everything together.

**Shared contract:** `GET /api/status` gains `backupMinutes: { customer: number, seller: number }` (defaults 5 / 5; bounds 1–30), set on the admin page (stage A owns it). Clients use 5 when absent.

## Stages (sketch, after the questions)
| # | stage |
|---|---|
| 1 | seller Sell + Hand over / Deliveries on the live connection; event-aware loaders |
| 2 | notification → open page refresh (service worker message) |
| 3 | customer live connection (Worker route + Durable Object scoping by order token), backup check rules |
| 4 | docs (sequences, state-and-data-flow), tests, a load check against Free-plan limits |

**Deploy impact (expected):** none to apply (no migration); Durable Object usage rises a little (idle WebSockets hibernate, free).
