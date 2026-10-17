# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here. Older hand-overs are in git history.

**Last session:** 2026-10-14 → 17 (long session), the owner's PC (Adelaide), Claude as coordinator. Shipped 1.0.35, 1.0.36 and 1.0.37 the same week; built 1.0.38.
**Live:** Release **1.0.38** (17 Oct ~22:15; Worker `0708ee42-ea66-46e3-b654-c2a4ad16b327`; site reports `63ea073`; tag `v1.0.38`; `main` = that commit). Backup before its migrations: `backups/shaggybobo-2026-10-17-c.sql` (697 rows); migrations 0028, 0029, 0030 applied. Live check: health OK, devTools false, all security headers present, **console clean** (Cloudflare Web Analytics allowed; Cloudflare stamps the per-page CSP nonce on its injected bot-detection script). Previous: 1.0.37 (`3aca8f4`, Worker `4e161e69…`).
**Release 1.0.38:** gated green (17 Oct 21:40: unit green, e2e 99 passed / 0 failed with `--workers=2`), deployed 21:45 (`dc3bc02f`), then a CSP follow-up deployed ~22:15 (`0708ee42`): Cloudflare Web Analytics allowed + per-page nonce.

## House rules learned this session (binding)
- **No git writes (commit, push, merge, tag) unless the owner says so for that step; ask first every time.** Stage only your own files, by path; never `git commit -a` while a builder edits the tree (lessons 27).
- **Owner decides; one question at a time** (A/B/C with a recommendation), status marker on every message (🔴 / 🟡 / 🟢), plain words.
- **Mock-up before any UI build;** open mock-ups for the owner in **their own browser tab** each (`Start-Process <url>`; the mock-up viewer is `python -m http.server 8765 --bind 127.0.0.1`, this PC only).
- **AUD and Adelaide only** in every mock-up, sample and research answer (no Rupiah, no Indonesian addresses, no UK shops). Indonesian is only the second language; mixed "kamu"/"Anda" is fine.
- **Estimate vs actual:** every step you promise gets an estimate (with the time you gave it) and the real finish time in `docs/plans/live-status.md` (table "Release 1.0.38: estimate vs actual").
- **Files under ~750 lines (soft);** new code in its own file; don't grow the big ones (routes.ts, seller.ts, menus.ts, auth.ts, AppRoutes.tsx). Splitting them is the overnight clean-up (plans 088/090).
- **Long runs only with the tool's background mode, never a shell `&`;** before re-running, check whether the first run is still alive; stop processes only by exact PID (lessons 21, 26).
- Agents never deploy, never run `--remote` / `wrangler secret`, never reseed; back up before migrations; the owner runs deploy commands.

## 1.0.38 status (what's in it)
| plan | what | state |
|---|---|---|
| 086 | **Admin short message:** in-app note (never a phone notification), 30 s or ✕, once per device; admin picks kitchens + audience (everyone / sellers / customers) + active 15 min / 1 h / today; list + slide-over in admin; admin menu split into Announce update · Maintenance · Short message (each fits without scrolling); note pushes the page down, dark bubble one step lighter (also the maintenance bar). D-106 | built |
| 087 | **"Remember me" / "Ingat aku"** (optional customer passkey): order list + first name follow the customer; saved address **sealed with the passkey (PRF)** so the server can't read it, deleted after 30 days without an order; account deleted after 12 months unused; per-kitchen stable code and **"✓ Passkey-confirmed · C-xxxx"** for sellers; 6-digit "add this phone" code; chip on the menu (first time), Settings card, "Restore them" on empty My orders, one line after the 2nd order; privacy modal; seller Help topic; "No sign-ups needed …". Customer sign-in is separate from seller/admin (tested). D-107 | built; e2e with virtual passkeys passes |
| 089 | **Security touch-ups:** IP hash salted daily (migration 0030, no raw IP stored); browser security headers incl. CSP (enforced; dev loosens only `script-src`); order limit 5 per 10 min per kitchen per client (account when signed in); dead code removed (`PrintJob`, cook `label.*`) | built |
| — | Release notes for 1.0.38 | **picked by the owner (17 Oct, "B")**: EN "Remember me: customers can keep their orders on a new phone with a passkey, safely unlocked with their face or fingerprint (no password), and you'll see ✓ on their orders." / ID "Ingat aku: pelanggan bisa membawa pesanannya ke HP baru dengan passkey, aman dibuka dengan wajah atau sidik jari (tanpa kata sandi), dan kamu melihat tanda ✓ di pesanan mereka." (owner "A"); EN "Small fixes and polish." / ID "Perbaikan kecil dan penyempurnaan." → to write into `releaseNotes.ts` + `RELEASE_VERSION` + the tests after the e2e run |

**Deploy impact 1.0.38:** migrations **0028** (short messages), **0029** (Remember me), **0030** (IP salt), all add-only; no new secrets. **After deploy, check on the live site:** the pickup map embed, QR scan, About animation and Google Fonts load (new CSP), a Remember me turn-on on a real phone (Face ID / fingerprint; PRF works on iOS 18+ / recent Android), the seller's ✓ mark, and send one short message.
**Deploy order (owner's faster way):** `pnpm build` → back up (`pnpm exec wrangler d1 export shaggybobo-order --remote --output backups/shaggybobo-<date>.sql`) → (announce / maintenance optional; migrations are add-only) → `pnpm exec wrangler d1 migrations apply shaggybobo-order --remote` (expect 0028, 0029, 0030) → `pnpm exec wrangler deploy` → live check → merge `main` + tag `v1.0.38` (ask first).

## Next session (fresh)
1. Read this file, then CLAUDE.md and `docs/guide/agent-working-conventions.md`.
2. **Ask the owner first whether setup is needed** (owner, 17 Oct): on the same PC that ran this session it usually isn't; on another PC (e.g. the builder's): `git pull`; `pnpm install`; `pnpm db:migrate:local` (migrate only, never reseed).
3. 1.0.38 is live. Ask the owner about their phone checks: **Remember me** on a real phone (turn on, place an order, see ✓ on the seller side, restore on a second phone if they have one), **send a short message** from admin (Short message → New message), the **pickup map and QR scan** (new CSP), and the About animation.
4. Owner checks still open: 1.0.36/1.0.37 phone checks; **a real label print from the seller's Samsung tablet** (Labels page → A4 → Print; printer paper A4, scale 100%).

## Later (owner rulings recorded)
- **Overnight work:** plan **090** clean-up (14 items: split the route file by area, one source for kitchen orders, one menu store + one live-refresh helper, chef permissions as an allow-list, shared Tag/Notice UI parts, one radius token set, sweep expired codes, drop old routes, order tokens out of the live-socket URL, …) and plan **088** split large files (< 750 lines, not too strict). Plan **091** faster tooling (ESLint/Prettier cache, no-cycle gate-only, Vitest split into fast vs D1 groups, skip the 2 slow design-compare specs by default (needs owner OK), `.editorconfig` LF + one-time renormalise commit (needs owner OK)) — measure first.
- **Much later:** plan **082** store mode (mock-up "Sandra's Store", Indonesian bags & clothes, AUD): mode fixed per place, one passkey across places, no payments until Square, small photos (~30 KB), home = featured + category tiles, category pages with pages, no pickup/delivery on the home.
- Code health report: `docs/reports/2026-10-17-code-health.html` (plain-language; open it in a browser).
- Older open items: Help screenshots from the live app; the customer app Lottie round; 077 leftover (Settings "default cut-off time" in the kitchen's clock); Dellavee feedback; the owner's wife's iPad.

## Local tips
- Playwright needs `NODE_EXTRA_CA_CERTS="C:/Users/Indra/AppData/Local/mkcert/rootCA.pem"`. Lint needs `NODE_OPTIONS=--max-old-space-size=8192`.
- Gate timings on 17 Oct: typecheck 31 s · lint 162 s · format 24 s · unit ~13 min · e2e ~10 min. Unit "fetch failed"/EADDRINUSE failures are Windows port clashes: re-run those files alone.
- Agents sometimes create CRLF files: `npx prettier --write <files>` fixes `format:check`.
- Passkeys don't work on the LAN-IP dev URL (Remember me hides itself there); use `https://localhost:5173`.

## Ready prompt for the next session
> Read docs/HANDOVER.md, CLAUDE.md and docs/guide/agent-working-conventions.md. Live is 1.0.38 (tag v1.0.38): short message (086), Remember me (087), security touch-ups (089). Ask the owner before any git write. Ask me whether "Next session" step 2 (setup) is needed, then step 3 (the owner's phone checks), then ask which plan is next, one question at a time.
