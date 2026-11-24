# 133 · Ask to send the new-menu notice right after Publish

**Target:** next release. **Status:** owner "B" (24 Nov); mock-up `uxDesign/seller/mockups/133-notice-after-publish.html`, approved with the rulings below (24 Nov); building.

## Why (owner, 24 Nov)
"I have the customer app and did not see any notification when Rina published." The backup of 24 Nov shows DellaVee's Sat 21 Nov menu was published (Wed 18 Nov 10:10 pm) but **no new-menu notice was sent** (`menu_notice_sends` has no row for it). Publishing never notifies by itself (plan 124: the seller taps 🔔 Notify customers → Send, "only if wanted"). 4 devices get DellaVee notices, 1 gets Onde Onde's (all iPhone home-screen apps).

## What (owner "B": "but simply say: do you want to send notification for the customer that has the app already")
- Right after a menu is **published** (tablet Publish step and the phone menu card's Publish), a short question:
  **"Send a notification to customers who already have the app?"** (ID: "Kirim notifikasi ke pelanggan yang sudah punya aplikasinya?") with **Send** and **Not now** (ID: **Kirim** / **Nanti saja**).
- **Send** does exactly what 🔔 Notify customers → Send does today (same notice text, counted as a send for this menu). **Not now** closes; the bell stays for later.
- **No check for subscribers** (owner, 24 Nov: "no need to check if no customer has app or not"): the question always shows after Publish, even when no device gets this kitchen's notices.
- **Always ask, also when published again** after a notice was already sent (owner "A", 24 Nov); Rina can tap Not now.
- **No names and no count** in the question (owner, 24 Nov: "no need to show who and how many customers").
- EN + ID.

## Stages
| # | what | proof |
|---|---|---|
| 0 | mock-up (phone + tablet) | owner OK |
| 1 | build | unit (asks after publish; Send = existing send) |
| 2 | captures phone + tablet, emulator | pictures looked at |

**Deploy impact:** low, client only, no migration.
