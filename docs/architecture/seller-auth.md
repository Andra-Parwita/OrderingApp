# Seller sign-in (design, draft)

**Status:** decided 2026-10-07 in [D-011](../decisions/README.md): passkeys for admin and seller, a password fallback for the seller only, an easy passkey help screen. The comparison below is kept as the record.
**Owner's ask (2026-10-07):** "need to consider how we can have better auth for the seller, since we will give them a key etc .. and ability for them then to login".
**Owner, later the same day:** "seller may have more than one device .. and I may also have ability to connect to server to generate key .. so I don't need to run Claude .. this is like super admin (developer) login".
**Constraints:** one seller (possibly on 2–3 devices: phone, tablet, a helper's phone); Cloudflare free plan; no private data in the cloud ([D-007](../decisions/README.md)); customers have no accounts and are not affected; every new dependency needs the owner's OK.

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
| local dev on this PC | on `https://localhost` only — **not** on the LAN IP: WebAuthn refuses an IP address as the site's identity, so phones on `https://192.168.178.177` can't make passkeys (correction 2026-10-09; see D-046) | yes | no; needs a dev-only bypass |
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
