# 128 · Add a backup password while signed in

**Target: hotfix 1.0.46.1** (with plan 127). **Status:** mock-up `uxDesign/seller/mockups/128-backup-password.html` approved (owner "A", 10 Nov), building.

## Why (owner, 10 Nov)
Rina (DellaVee, also Onde Onde) keeps getting stuck at sign-in. Owner: "she always has problems with passkey" → "B": besides removing the last accidental sign-out (1.0.46.1), give her a second way in. Today a password can only be set during the first setup on a device (`worker/db/authSignIn.ts`, register/setup); a signed-in person cannot add one, so when the screen lock fails on a device she is stuck until the owner sends a key or another device gives a 6-digit code.

## What
- **Settings → Devices** (tablet and phone), a new row at the top, for the signed-in person:
  - **Backup password · Not set** — "Add a password you can use if your screen lock doesn't work." → **Add a password**.
  - **Backup password · Set** — "Use it on the sign-in screen: Use password instead." → **Change password**.
- **Add / change** opens a sheet (on the phone a **full-screen layer with Save in the top bar**, so the keyboard never covers it; owner rule from plan 124 "beware of keyboard avoidance"): New password, Confirm, Show/Hide, the same rules as today (at least 10 characters), **Save password**. EN/ID.
- After saving: "Saved. Write it down somewhere safe." The sign-in screen's **Use password instead** then works for this person on any device.
- Server: one route for a signed-in person (full session, not setup) to set or replace their own account's password, using the existing hashing; rate-limited like sign-in. No migration (`accounts.password_*` exist).
- Admin → People shows it already (plan 125: "screen lock, password").

## Owner rulings (10 Nov)
- **A:** being signed in on the device is enough to add or change the password (no "current password" step). Build it into 1.0.46.1.

## Stages
| # | what | proof |
|---|---|---|
| 0 | mock-up | owner OK |
| 1 | route + Devices row + sheet, EN/ID | unit + mocks: set, replace, too short, setup session refused; sign-in with it |
| 2 | captures at phone and tablet sizes (looked at), emulator Pixel_9 + Tablet_11, the directed specs (seller-auth, session-flow) | logs, screenshots |

**Deploy impact:** Worker + client, no migration.
- **8 characters (owner, 10 Nov):** "don't make it too long, 8 chars is okay" and "once password set, allow it to change easily, since they are already logged in anyway" → the minimum is **8 characters**, the same one rule for setup and the backup password (was 10); Change needs no old password.
