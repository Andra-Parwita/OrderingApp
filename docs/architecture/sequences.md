# Message sequences

Written 2026-10-13 (plan 070) from `worker/api/routes.ts`, `worker/api/authRoutes.ts`, `worker/live/`, `worker/push/`, `src/api/http.ts` and `src/api/netState.ts`. The diagrams are Mermaid: GitHub draws them, and `pnpm run docs` draws them in the HTML site. When a route, a live event or a sign-in rule changes, change the diagram in the same change (CLAUDE.md, "Docs stay current"). Routes are listed in [api.md](api.md); the system around them in [overview.md](overview.md); sign-in rules in [seller-auth.md](seller-auth.md).

Two facts hold in every diagram:

- The **live event is only a nudge** ("something changed", with an order code at most). It carries no customer data; the seller's screen refetches through the normal, authorised API.
- The Worker **signals after the D1 write succeeded** and never fails the answer because of it. A missed nudge is covered by the screens' fallback polling.

## 1 · A customer places an order

The seller is told by the **open app** (live socket, toast, optional chime). There is no web push to the seller yet ([plan 021](../plans/021-seller-new-order-alert.md): "seller push when the app is closed is a later, separate plan"). The customer then sends the order number to the seller on WhatsApp by hand; the app only opens WhatsApp with the text written.

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer phone
    participant W as Worker (/api/s/:slug/orders)
    participant D as D1
    participant L as SellerLive (Durable Object)
    actor S as Seller screen

    S->>L: GET /api/seller/live (WebSocket, session cookie)
    C->>W: POST /api/s/:slug/orders (items, name, pickup or delivery)
    W->>D: check menu is live and taking orders, portions left
    W->>D: insert order, take portions, order token
    D-->>W: order + private token
    W->>L: POST /notify {type: order.created}
    L-->>S: {type: order.created, at}
    W-->>C: 201 order (token in the link)
    S->>W: GET /api/seller/orders (refetch)
    W-->>S: live orders
    Note over S: toast "New order", row highlight, optional chime
    C->>C: Order placed page: "Send to the cook on WhatsApp"
```

## 2 · The seller changes a status

Only the **customer's** subscription gets a web push (one per order, if the customer turned it on). The push is built after the write and sent in `waitUntil`, so the seller's answer is not slowed. An open customer app also hears the change over its own live connection (section 11), and a push arriving while the app is open makes the service worker tell the page, which refreshes that order at once.

```mermaid
sequenceDiagram
    autonumber
    actor S as Seller screen
    participant W as Worker (/api/seller/orders/:code/status)
    participant D as D1
    participant L as SellerLive
    participant P as Push service
    actor C as Customer phone

    S->>W: POST orders/:code/status (next status)
    W->>D: write status + inbox entry for the customer
    W->>L: notify {type: order.changed, code}
    L-->>S: other seller devices refetch
    W-->>S: 200 updated order
    W-)P: waitUntil: web push to this order's subscription
    P-)C: notification (kitchen name, short text)
    C->>W: tap opens /o/:token, GET /api/orders/:token
    W-->>C: order with its new status and message
    Note over C,W: no push? The open order page polls the same GET
```

## 3 · Seller sign-in with a passkey (and the 6-digit add-device code)

Passkey sign-in works from anywhere. A **new device** is added by a signed-in person: Settings, Devices makes a 6-digit code (10 minutes, one use, stored as a hash) that the new device enters.

```mermaid
sequenceDiagram
    autonumber
    actor P as Person (new device)
    participant W as Worker (/api/auth/*)
    participant D as D1
    actor O as Same person (signed-in device)

    rect rgba(127, 127, 127, 0.14)
    Note over P,D: Sign in with a passkey
    P->>W: POST /api/auth/passkey/options
    W->>D: store challenge (5 min, one use)
    W-->>P: WebAuthn options
    P->>P: unlock with face, finger or screen lock
    P->>W: POST /api/auth/passkey (signed response)
    W->>D: verify, check kitchen not paused, make session (hash only)
    W-->>P: 200 + __Host-session cookie (30 days, renewed)
    end

    rect rgba(127, 127, 127, 0.14)
    Note over P,O: Add another device with a 6-digit code
    O->>W: POST /api/auth/device-codes
    W-->>O: 6-digit code (10 min, one use)
    P->>W: POST /api/auth/code (the 6 digits)
    W->>D: check code and lockout, then start a setup session
    W-->>P: setup session (60 min)
    P->>W: POST /api/auth/register/options, then /register
    W-->>P: passkey saved, full session
    end
```

Five wrong tries lock the key or person for 15 minutes (`locked_out`); sign-in calls are limited to 30 a minute per browser id.

## 4 · Invite, then setup with the key

The owner invites a person by name and role (the admin invites a kitchen's first owner; a recovery is the same call). The key is shown once and is good for 24 hours and one device.

```mermaid
sequenceDiagram
    autonumber
    actor O as Owner (or admin)
    participant W as Worker
    participant D as D1
    actor N as New person

    O->>W: POST /api/seller/invites (name, role)
    W->>D: store SHA-256 of the key (24 h, 1 device)
    W-->>O: the key, shown once
    O-)N: invite message by WhatsApp (key or link)
    N->>W: POST /api/auth/invite (key)
    W->>D: check key, lockout, kitchen not paused
    W-->>N: setup session (60 min)
    N->>W: POST /api/auth/register/options, then /register
    W->>D: create person, membership, device, session
    W-->>N: signed in (passkey, or a password if the phone cannot make one)
    Note over N,W: already signed in? The same key just adds the kitchen to that person
```

## 5 · Publish a menu (now, or with ordering paused)

A menu goes `not published -> live -> finished` (D-063). Publishing can ask for **ordering paused**: the menu is visible, but the customer cannot place orders until the seller turns ordering on. Customers read the menu from the same route, so the new state shows on their next load.

```mermaid
sequenceDiagram
    autonumber
    actor S as Seller (wizard, Publish step)
    participant W as Worker (menus/current/publish)
    participant D as D1
    participant L as SellerLive
    actor C as Customer

    S->>W: POST menus/current/publish {force, takingOrders}
    W->>D: check the menu has dishes and a date
    alt a warning can be overridden
        W-->>S: refusal with warning
        S->>W: POST again with force: true
    end
    W->>D: menu becomes live, ordering on or paused
    W->>L: notify {type: menu.changed}
    L-->>S: other seller devices refetch the menu
    W-->>S: 200 menu view
    S->>S: Share screen: link, QR, message
    C->>W: GET /api/s/:slug/menu
    W-->>C: menu (ordering open, or "not taking orders yet")
```

## 6 · Offline, retry, "Can't reach the kitchen"

Only **GET** calls are retried on their own (no answer, a 5xx or a 429, with growing gaps). Writes such as placing an order are not repeated for the person: the screen shows the error and the customer can try again. The banner has three messages: offline, server not answering, and **"Can't reach the kitchen right now." with Try again**, shown when a poll gave up after 5 refusals in a row.

```mermaid
sequenceDiagram
    autonumber
    actor U as Phone screen
    participant H as http.ts and netState
    participant B as Offline banner
    participant W as Worker

    U->>H: poll: GET order or orders
    H->>W: request
    W--xH: no answer, 5xx or 429
    H->>H: retry with growing gaps (GET only)
    H->>H: final result recorded: transient
    H-->>B: failing: "Server isn't answering. Try again in a moment."
    Note over U,B: no network at all: "You're offline. Your changes are kept."
    loop each failure
        U->>H: next poll, gap doubles (up to 5 min)
    end
    H-->>B: after 5 refusals in a row: stopped
    B-->>U: "Can't reach the kitchen right now." + Try again
    U->>B: tap Try again
    B->>H: restart the polls, ask GET /api/health once
    H->>W: request
    W-->>H: 200
    H-->>B: ok, banner hides itself
```

## 7 · A delivery address: customer, encrypted store, kitchen team, auto-delete

Plan 071, [D-099](../decisions/README.md). Only on delivery orders, and only when the server has `ADDRESS_KEY`.

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer phone
    participant W as Worker
    participant D as D1 (orders.address_enc)
    actor T as Kitchen team (owner, chef, helper)
    participant J as Hourly job

    C->>W: POST /api/s/:slug/orders {address: street, suburb, postcode, notes, lat/lng}
    W->>W: AES-GCM encrypt (ADDRESS_KEY, random IV)
    W->>D: store iv.ciphertext only
    W-->>C: order + addressState "saved" (never the address)
    T->>W: GET /api/seller/orders (signed in, this kitchen)
    W->>D: read ciphertext of this kitchen's orders
    W->>W: decrypt (wrong or lost key: "unavailable")
    W-->>T: order with address: Directions, Call, WhatsApp, Delivered
    Note over T,D: cancel, "Delete address now": address_enc set to NULL
    J->>D: one day after the menu finished: address_enc = NULL
```

## 8 · Linking a customer and backing up the device address book

Plan 071, [D-099](../decisions/README.md). The address book (names, phones, addresses, codes) lives only in the seller's device (IndexedDB); the server only ever sees the anonymous `customerCode`.

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer phone
    participant W as Worker (orders.customer_code)
    actor S as Seller device (IndexedDB address book)

    C->>C: first order at a kitchen: random code, kept per kitchen
    C->>W: POST order {customerCode}
    S->>W: Confirm the order
    W-->>S: order with customerCode
    alt code not linked on this device
        S->>S: "Link to a saved customer?" (similar first names)
        S->>S: Link / New customer / Skip
    end
    Note over S: linked: later orders with the code show the saved phone (Call, WhatsApp)
    S->>S: menu finished and new or changed customers since the last backup
    S->>S: "Back up your customer details?" then customers-slug-date.csv
    Note over S: Later asks again next app open. Settings, Customer details: Upload CSV adds or updates, never wipes
```

## 9 · Announce an update and run it in maintenance mode

Plan 046. The admin announces, switches maintenance on before the backup and migrations, and off after the health check.

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant W as Worker (app_settings)
    actor P as Seller / customer phone

    A->>W: PATCH /api/admin/maintenance {notice}
    P->>W: GET /api/status (on start, every 5 min)
    W-->>P: notice, maintenance off
    P->>P: quiet bar "Maintenance on ..." until the window ends
    A->>W: PATCH /api/admin/maintenance {maintenance: true}
    Note over A,W: backup, migrations, deploy
    P->>W: any POST / PATCH / DELETE
    W-->>P: 503 maintenance (X-Maintenance, never retried)
    P->>P: full "Updating, back in a few minutes" screen
    loop every 30 s
        P->>W: GET /api/status
    end
    A->>W: PATCH /api/admin/maintenance {maintenance: false} after the health check
    W-->>P: maintenance off
    P->>P: the screen goes by itself
```

## 10 · Seller screens on the live connection and the backup check (plan 074)

Orders, Cook, Sell and Hand over / Delivery run share one WebSocket per tab. They ask for nothing while it is live; an event names what changed, and each screen reloads only that.

```mermaid
sequenceDiagram
    participant A as Admin page
    participant W as Worker
    participant S as Seller screen (Sell)
    participant DO as SellerLive
    A->>W: PATCH /api/admin/backup-minutes {seller: 5}
    S->>W: GET /api/status (MaintenanceHost, every 5 min)
    W-->>S: backupMinutes {customer: 5, seller: 5}
    S->>W: first load (menu, day log, orders)
    Note over S,DO: socket live: no timer, no polling
    S->>W: POST /api/seller/day/sale
    W-->>S: dayStock, entryId (the screen updates itself)
    W->>DO: stock.changed (from = X-Device-Id)
    DO-->>S: stock.changed (from = this device: echo ignored)
    DO-->>S: stock.changed (another device's sale, different or no `from`)
    S->>W: GET /api/seller/menu (stock only)
    Note over S,DO: socket lost and page visible: one check every backup minutes
    S->>W: reload everything
    Note over S: page hidden: nothing; page shown again: reload at once
```

## 11 · The customer app's one live connection, backup check and notification refresh (plan 074)

The customer shell mounts `CustomerLiveHost` once ([liveConnection.ts](../../src/features/customer-orders/liveConnection.ts)). It opens **one WebSocket per kitchen** where this phone has an active order (not collected, delivered or cancelled; not from a closed week; placed in the last 10 days; normally one). The order page and My orders never open sockets or poll: they read the store, which the connection keeps fresh.

Authorisation is the private order tokens only: `GET /api/s/:slug/live` with the tokens in the `Sec-WebSocket-Protocol` header as `delave.live, tok.a, tok.b` (up to 20, WebSocket upgrade; plan 098 C12 - the old `?tokens=a,b` form is still accepted for tabs opened before the update). The Worker checks every token belongs to **that** kitchen, is on its active menu and is not finished, and hands the room only the **codes** of the orders it admitted. The room (`SellerLive`, `/connect-customer`, tagged `customer`, hibernating) sends such a socket only `order.changed` for those codes (a change without a code, such as "Ready now" or finishing the week, is a bare nudge to every customer socket of that kitchen; no data in it). Seller sockets are untouched: kitchen-wide events never reach a customer. At most 300 customer sockets per kitchen.

```mermaid
sequenceDiagram
    participant P as Order page / My orders
    participant H as CustomerLiveHost (shell)
    participant W as Worker
    participant DO as SellerLive
    participant SW as Service worker
    H->>W: GET /api/s/onde-onde/live (upgrade, tokens in Sec-WebSocket-Protocol)
    W->>W: each token: this kitchen, active menu, not finished
    W->>DO: /connect-customer?codes=C1,C2
    Note over H,DO: live: no timer, no polling
    Note over H: order again: the new token joins at once (new socket)
    W->>DO: order.changed C1 (seller marked Ready)
    DO-->>H: order.changed C1 (only this phone's orders)
    H->>W: GET /api/orders/t1 (one targeted fetch, no menu)
    W-->>P: store updated: order page and list change together
    SW-->>H: postMessage order-push /o/t1 (a notification arrived)
    H->>W: GET /api/orders/t1 (events within 1 s collapse)
    Note over H,W: socket lost, page visible: GET /api/orders?tokens= every backupMinutes.customer
    Note over H: back in the app after 10 s or more, or socket reconnects: one check at once
```

Backup rules: only while a kitchen's socket is down and the page is visible; the gap is `backupMinutes.customer` from `GET /api/status` (5 when absent), through [orderPoll.ts](../../src/features/customer-orders/orderPoll.ts) so plan 062's rules hold (backoff after failures, stop after 5 refusals until Try again, pause while hidden). Finished orders are dropped from the connection when their status reaches the phone, and with none left the socket closes and nothing is checked. Settings shows one muted line from [customerLiveState.ts](../../src/api/customerLiveState.ts): "Connection: live", "Last updated 10:42 · checking every 5 min", or "No active orders".
