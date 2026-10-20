# 112 · Tell customers when a new menu is published

**Status:** owner 20 Oct: **in 1.0.43 together with plan 111** (first "later", then "I want to include this option as part of option item too"). Questions 2–3 open; mock-up first; not approved for building.

## Goal
After publishing a menu the seller can send "New menu published" to customer apps, sees how many devices will get it, and is warned before sending a third time for the same menu, so customers aren't spammed.

## Why it needs its own work
- Customer notifications today are **per order**: `push_subscriptions` (kitchen + order + device, `migrations/0005_push.sql`). They are deleted when the menu's orders are archived (`worker/db/retention.ts`). After that the app cannot reach past customers.
- A new-menu notice needs a **per-kitchen** permission (kitchen + device only, no name, no phone) that outlives the order: a new table and a migration.

## Owner rulings so far (20 Oct)
- The seller sees a **count** of devices ("23 devices"), never names (no customer accounts in the cloud).
- **A separate, quiet option in customer Settings** (owner, 20 Oct, replaces the earlier "part of order notifications"): "New menus from <kitchen>", off by default, not offered anywhere else. Turning it on first shows a short explanation (what you'll get, how often, how to turn it off), so customers only turn it on if they really want it. Order notifications stay as they are.
- Warn the seller on the **3rd send** for the same menu ("You've sent this twice already…"). Every send is recorded with the menu (time, phones reached); the window always shows when it was last sent.
- A **bell icon** (not a text button) on Home beside "Go to Kitchen" and in the Menu toolbar, only while orders are open; tablet uses a centred window, phone a bottom sheet.

## Open questions (before planning)
1. ~~Existing subscribers~~: answered by the separate opt-in; only customers who turn it on get new-menu notices.
2. The exact switch text (EN/ID).
3. How long a kitchen permission lives without any new order (forever, or e.g. 6 months).
