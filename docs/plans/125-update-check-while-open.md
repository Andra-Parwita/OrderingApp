# 125 · Version with the hotfix number, "Check for update" in About, fewer automatic checks

**Target: hotfix 1.0.45.1** (client + Worker, no migration). **Status:** built and checked 27 Oct (gate + emulator), deploying. Owner 26 Oct: first "check every few minutes", then (same evening) **"don't check every 5 minutes … keep a local state of last check … every 10 minutes … in About have 'Check for update' like in Chrome, so we don't keep polling the server"** → Q "A": About checks by itself when opened, plus the button.

## Why
After 1.0.45 went live, Rina asked how to refresh the seller app on her Android phone. The app shows "A new version is ready · Refresh" (plan 059), but it only checks `/version.json` when the app is opened or comes back to the screen (at most every 5 minutes). An app left open on screen, like a seller tablet all day, never checks, so the bar never appears.

## What (final)
- **No timer.** The automatic check runs only when the app opens or comes back to the screen, **at most every 10 minutes**; the time of the last check is **saved on the phone** (localStorage, try/catch), so reopening the app within 10 minutes does not ask the server again. Same bar "A new version is ready · Refresh".
- **About (seller):** "Version 1.0.45.1" with **"Check for update" / "Cek pembaruan"**. About checks by itself when it opens (like Chrome), and the button checks again: newer → "Updating…" and the app reloads into the new version (same path as the bar's Refresh); same → "You have the newest version" / "Anda sudah memakai versi terbaru"; offline or error → "Could not check. Try again later." / "Tidak bisa memeriksa. Coba lagi nanti." A manual check ignores the 10-minute gap.
- Trade-off accepted: a tablet left open all day does not find a new version by itself; About or returning to the app does.

## Version with the hotfix number (owner 26 Oct, "A (no need the date)")
- Today the app shows only the release ("1.0.45"); a hotfix keeps it, so nobody can tell from the app whether a phone has the hotfix. Rina's phone More screen shows no version at all.
- New: one constant for the hotfix number next to `RELEASE_VERSION` in `shared/release.ts`; the app shows **"Version 1.0.45.1"** (just "1.0.45" when there is no hotfix) in Settings, About, the tablet's left menu, and a small line at the bottom of the **phone More screen**. No date.
- The What's new pill and release notes stay keyed by the release (`RELEASE_VERSION`), so a hotfix does not pop "What's new".

## Rina signed out (26 Oct evening) and the fixes that follow
- Both of Rina's devices were signed out; she had **password** sign-in on both (no passkey) and did not know the password. Evidence (backup 21:20): the tablet session ended after 21:05 (device kept, kitchen not paused, membership kept → a Sign out / **Switch person** tap), then 2 wrong password tries at 21:06; owner: "I think she clicked Switch user and got confused". Not caused by 1.0.45 (deployed 21:21). No sign-out log exists. Back in via a recovery key (a **new** owner account; recovery = re-invite, D-090) + the 6-digit code for the tablet.
- **Switch person (owner A):** shows only when the kitchen has **more than one person** (person = an account that is a member of the kitchen; one person with a tablet and a phone added by "Add a device" is one person), never on the phone, and asks "Tap again" when it shows. Rina's old accounts (two password accounts and one unfinished) count as people until removed: clean-up after the hotfix.
- **Phone Sign out (owner A):** asks "Tap again to sign out" + "You will need your screen lock or password to sign in again." (as the tablet's Devices sign-out).
- **Screen-lock wording (owner A):** sign-in button "Sign in with your screen lock" / "Masuk dengan kunci layar"; setup choice "Screen lock (fingerprint, face or PIN) · Recommended. Nothing to remember." / "Kunci layar (sidik jari, wajah, atau PIN) · Disarankan. Tidak perlu diingat."; password choice "For devices without a screen lock." / "Untuk perangkat tanpa kunci layar."
- **Devices, other device (owner A):** "Sign out" → "Remove device" / "Hapus perangkat"; confirm "Tap again to remove" / "Ketuk lagi untuk menghapus"; line "This device will be signed out and needs a new 6-digit code to come back." / "Perangkat ini akan keluar dan perlu kode 6 angka baru untuk masuk lagi."
- **Admin bug (owner 26 Oct):** admin → kitchen panel → People → Remove (tap twice): the person is removed but the row stays until the panel is reopened (`SellerDetails.tsx` reloads the list after the remove; cause unknown, reproduce in a test first).
- **Sign-in per device (owner A):** seller Settings → Devices shows "Screen lock" / "Password" per device ("Kunci layar" / "Kata sandi"); admin → kitchen → People shows per person "2 devices (screen lock, password)" and "never finished setting up" / "belum selesai diatur" for an account without a device. Derived from `devices.credential_id` and `accounts.password_hash`; no migration.

## Stages
| # | what | proof |
|---|---|---|
| 1 | ~~timer every 5 min~~ (built, then dropped by the owner) → no timer; automatic check at most every 10 min, last-check time saved on the phone | unit: no fetch within 10 min across a remount; fetch after 10 min on return; no interval |
| 1b | version label with the hotfix number (Settings, About, tablet left menu, phone More) + About "Check for update" (auto on open + button) | unit: label with and without hotfix; More shows it; About: newer → reload path, same → "newest", error message |
| 2 | scoped gate: typecheck, lint, format, `src/components/update` + importers' unit tests | logs |

**Deploy impact:** very low, client only. Fewer automatic `/version.json` requests than today (10-minute gap, remembered across restarts). Old apps get the About button after they update once.
