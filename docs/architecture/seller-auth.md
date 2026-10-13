# Sign-in (how it works now)

**Status:** built and live. Refreshed 2026-10-13 from `worker/api/authRoutes.ts`, `worker/db/auth.ts`, `shared/authContract.ts` and migrations 0002, 0007, 0010 and 0012. Decided in [D-011](../decisions/README.md) (passkeys, a password fallback), reworked by [D-085](../decisions/README.md) to [D-090](../decisions/README.md) (people and memberships) and [D-092](../decisions/README.md) (helpers). The comparison of options from 2026-10-07 is kept at the end as [history](#history-the-original-options-2026-10-07).

**Constraints that still hold:** Cloudflare free plan; no private data in the cloud ([D-007](../decisions/README.md): no email, no phone); customers have no accounts; a new dependency needs the owner's OK (the passkey library was approved).

## People, roles and kitchens

| term | meaning |
|---|---|
| person | one login with a **display name** only (D-090). Their passkey or password covers every kitchen they belong to (D-087) |
| membership | a person in a kitchen with a role: **owner**, **chef** (linked to a cook in the chefs list) or **helper** (no cook row; sells and hands over only) |
| active kitchen | the kitchen the session works in; a person in several kitchens switches with the kitchen switcher (`POST /api/auth/switch`) |
| admin | the owner of the app (the developer). A separate login with its own passkey, never joined to a kitchen person; sees kitchens, people, devices, keys and the error log, never order data |

What each role may call is in [api.md](api.md#role-limits).

## The flow

1. **Invite key.** The owner invites a person by name and role (the admin invites a kitchen's first owner; a recovery is the same call). A long random key is shown once, only its SHA-256 is stored, and it works for **24 hours, for one device** (D-085).
2. **First sign-in.** The person opens `/seller/setup` (or the invite link) and enters the key. They get a short **setup session** (60 minutes) and register a passkey, or a password if the device cannot make one. A person who is already signed in just joins the new kitchen with the key.
3. **Session.** A full session is a random token in the `__Host-session` cookie (HttpOnly, Secure, SameSite=Strict); D1 keeps only its hash. It lasts **30 days, renewed on each use**, with one session per device.
4. **More devices.** A signed-in person makes a **6-digit device code** (10 minutes, one use, hash only) in Settings, Devices, and enters it on the new device.
5. **Devices and removal.** Each person sees and removes their own devices; the owner sees the team and can remove a person (their sessions in that kitchen end at once); the admin can remove any device.
6. **Password sign-in.** Open the kitchen's sign-in page, pick your name from the team list (`GET /api/s/:slug/team-names`), type the password. Passkey sign-in works from anywhere.
7. **Recovery.** If every device is lost, the owner re-invites the person; the admin re-invites an owner. There is no email or self-service reset (D-090).
8. **Pausing.** The admin can close a kitchen to customers, or pause it fully, which deletes its sessions and blocks every key, code and sign-in (`kitchen_paused`, D-086).
9. **Protection.** State-changing calls check `Origin`; sign-in requests are limited to 30 a minute per browser id; 5 wrong tries lock a key or person for 15 minutes; WebAuthn challenges last 5 minutes and work once; the live socket opens only with a valid session; limiters keep a hash of an address, never the address.

| number | value | constant |
|---|---|---|
| invite key | 24 hours, 1 device | `KEY_TTL_HOURS`, `KEY_MAX_DEVICES` |
| device code | 6 digits, 10 minutes | `CODE_LENGTH`, `CODE_TTL_MINUTES` |
| session | 30 days, renewed; setup 60 minutes | `SESSION_DAYS`, `SETUP_SESSION_MINUTES` |
| lockout | 5 fails, 15 minutes | `MAX_FAILED_ATTEMPTS`, `LOCKOUT_MINUTES` |

All in [`shared/authContract.ts`](../../shared/authContract.ts). Routes: [api.md](api.md#sign-in). Tables: [data-model.md](data-model.md#sign-in-rebuilt-in-0007-d-085-to-d-090).

## Bootstrapping the admin

At deploy the builder sets one secret once (`ADMIN_SETUP_KEY`, a Cloudflare secret, never in git; locally in `.dev.vars`). Opening `/admin/setup` with it registers the admin's first device; it is refused once an admin exists. After that everything is done in the admin pages.

## Sign-in pages and branding

The seller and admin sign-in pages use a split layout on tablet and desktop (image left, form right) and the image on top on a phone (D-051). Before sign-in the page does not know the kitchen, so it uses the **last kitchen this device used** (slug and theme kept on the device): that kitchen's phone banner shown whole on its background colour. A device with no last kitchen, or a kitchen with no phone banner, gets a plain tinted panel with the app name. The public Help page is linked from the sign-in and setup screens (D-095).

## Passkeys: support and the fallback

- **Supported on:** iPhone and iPad on iOS 16+; Android 9+ with Google Play services; Windows 10/11 with Windows Hello; macOS 13+. It needs only a screen lock.
- **Not supported:** very old phones, or a phone with no screen lock. Setup says so in plain words, shows the passkey help, and offers the **password**.
- **WebAuthn needs a domain, not an IP address.** Locally that means `https://localhost` only; a phone on the LAN IP uses the password (D-046).
- **iPhone:** a web app added to the Home Screen has its own storage, separate from Safari, so the person signs in once inside it. Passkeys work there.

---

# History: the original options (2026-10-07)

*Kept as the record, not as the design. Where it differs from the sections above (up to 3 devices per key, a one-role seller account, a chef account per cook), the sections above win.*

**Owner's ask (2026-10-07):** "need to consider how we can have better auth for the seller, since we will give them a key etc .. and ability for them then to login". Later the same day: "seller may have more than one device .. and I may also have ability to connect to server to generate key .. so I don't need to run Claude .. this is like super admin (developer) login".

## The shape common to every option

1. **Invite key.** The admin creates it from the **admin page** (below), which generates a long random **one-time key**, shows it once, and stores only its hash in D1, valid for 24 hours. You give it to the seller (WhatsApp, in person).
2. **First sign-in.** The seller opens `/seller/setup` on their phone, enters the key, and sets up their real login (below). The key is then used up.
3. **Session.** After login the device gets a long random session token in a secure cookie (`__Host-`, HttpOnly, Secure, SameSite=Strict). D1 stores only its hash, with the device name and last-seen time. The seller stays signed in for **30 days, extended on each use**, so in practice they log in rarely.
4. **More devices.** From a signed-in device the seller taps "Add a device", which shows a short-lived (10 min) one-time key or QR for the new device.
5. **Devices list and revoke.** The seller sees their devices and can sign one out remotely (a lost phone).
6. **Recovery.** If every device is lost, the admin issues a new invite key from the admin page.
7. **Protection.** Key and login attempts are rate-limited; state-changing requests check the `Origin` header; the live-updates connection (Durable Object) is opened only with a valid session.

## Two roles: admin and seller

| role | who | can |
|---|---|---|
| **admin** (super admin, developer) | the owner | create seller invite keys; see each seller device and sign it out; issue a recovery key; add their own devices. Sees no order data beyond what the seller sees. |
| **seller** | the home cook, on 1–3 devices | everything in the seller app; add and revoke their own devices |
| **chef** ([D-013](../decisions/README.md)) | a cook in the seller's chefs list | sign in after a seller invite; everything the seller can do except the menu, the chefs list and invites; every change goes in the order's last-4 audit |

- Both roles use **the same sign-in mechanism** (one code path, one set of tests); a session carries its role, and `/admin/*` endpoints refuse seller sessions.
- **Bootstrapping the first admin:** at deploy, the owner sets one secret once (`ADMIN_SETUP_KEY`, a Cloudflare secret, never in git). Opening `/admin/setup` with it registers the admin's first device; it is refused once an admin exists. After that everything is done in the admin page, with no scripts and no Claude. Locally, the same secret lives in the ignored `.dev.vars`.
- The admin page is plain and desktop-first (one screen: sellers, devices, keys). It is in EN only unless the owner asks for ID.

## The options for "the real login"

| | **A · Passkey** (recommended) | **B · Password** | **C · Cloudflare Access** |
|---|---|---|---|
| how the seller logs in | Face ID / fingerprint / phone PIN | a password they choose | a one-time code emailed to them, before the app loads |
| phishing / reuse risk | none: bound to this site, nothing to type or reuse | a reused or weak password is the main risk | low |
| forgotten login | passkeys sync via iCloud / Google, so a new phone usually just works; otherwise a new invite key | a new invite key | handled by email |
| works in the iPhone Home Screen app | yes (iOS 16+) | yes | awkward: the Access redirect can break out of the Home Screen app |
| local dev on this PC | on `https://localhost` only — **not** on the LAN IP: WebAuthn refuses an IP address as the site's identity, so phones on `https://<the PC's LAN IP>` can't make passkeys (correction 2026-10-09; see D-046) | yes | no; needs a dev-only bypass |
| new dependency | yes: `@simplewebauthn/server` + `@simplewebauthn/browser` (well-maintained, runs on Workers); hand-rolling WebAuthn checks is a security risk | none (PBKDF2 via the Workers WebCrypto API) | none in code; set up in the Cloudflare dashboard |
| private data in the cloud | none (a public key only) | a password hash | the seller's email address, in Cloudflare |
| effort | medium | low | low code, more outside-repo config |

**Recommendation: A, passkey, with the invite key for first setup and recovery.** It's the strongest and the easiest for the seller day to day (a glance at the phone), works in the Home Screen app, and keeps nothing private in the cloud. Its cost is one approved dependency and a bit more build effort than a password.

## Passkey device support and the fallback

Owner's question (2026-10-07): "what happens if seller does not have passkey? is passkey available in device?"

- **Supported on:** iPhone / iPad on iOS 16+ (synced via iCloud Keychain); Android 9+ with Google Play services (synced via Google Password Manager); Windows 10/11 with Windows Hello; macOS 13+. Most phones from the last 6–7 years qualify.
- **Needs only a screen lock** (PIN, pattern or passcode). Face ID / fingerprint are optional.
- **A laptop without passkey support** can still sign in by scanning a QR with the seller's phone (needs Bluetooth on both).
- **Not supported:** very old phones (iOS 15 or earlier, Android without Google Play services), or a phone with no screen lock.
- **The app checks before setup.** If the device can't make a passkey, setup says so in plain words and shows the passkey help screen first, then offers the **password** fallback ([D-011](../decisions/README.md)).
- **iPhone note:** a web app added to the Home Screen has its own storage, separate from Safari, so the seller signs in once inside the Home Screen app. Passkeys work there.

## When it's built

- **Phases 2–3 (wireframes, prototype):** the setup, login, add-device and devices screens are wireframed and clicked through on mock data; no real auth.
- **Phase 4 (local backend):** the real flow on the local Worker + D1, with tests; the admin setup key comes from `.dev.vars`.
- **Phase 5:** the owner sets `ADMIN_SETUP_KEY` on Cloudflare and registers the admin device (owner steps); seller invites then come from the admin page.
