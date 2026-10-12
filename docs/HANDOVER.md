# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here.

**Last session:** 2026-10-12, late evening into the night, the owner's PC (Adelaide), with Claude as coordinator. The owner went to sleep at about 23:00 and asked: "do this automated and tested, then commit and push; I will check tomorrow". Branch `indra/brand_logo_ux`. `main` = **Release 1.0.30** (`0ad9830`, plans 047–059, deployed by the builder on 12 Oct). **Everything below was built after 1.0.30, committed and pushed to `indra/brand_logo_ux` overnight. Not merged into `main`, not deployed.**

## Where things stand
**Final gate (13 Oct, 06:36), all green:** typecheck ✅ · lint ✅ · format ✅ · **unit: all pass** (172+ files; the full run had 9 load-only timeouts that pass alone, and 2 tests still assuming 10 dishes, fixed) · **e2e 76 passed, 0 failed** (`scratch/n-e2e5.log`; 28 skipped = captures and opt-ins). The e2e runs found **one real bug, fixed**: after Save, Settings → Kitchen kept the typed WhatsApp number instead of the saved one (a plan 061 draft re-written by the form's unmount flush). Two specs updated (a chef lands on `/seller/orders`; the banner scroll check waits for the list). One overnight run hung for 6 hours in `design-compare-customer` while the PC slept; it passes alone and in the final run.

### Built after 1.0.30 (this branch)
| plan | what | deploy impact |
|---|---|---|
| 060 | **The language customers see first**: Settings → Kitchen, under "English and Indonesian", "Customers see first"; once a customer switches, their own choice is remembered (`langChosen`) and the seller app's language on the same device is untouched | ⚠️ **migration 0014** |
| 061 | **Never lose typed data**: a draft on the device for the dish editor (with "Close and keep draft"), the new chef's name, the menu wizard's note and place, Settings (kitchen, ordering rules, WhatsApp post, pickup places), the seller's New order (device only), invites (name, role; never the key or link), and the **customer basket and checkout**; "Restored what you typed · Discard"; 7-day expiry; "Keep my version / Use the saved version" when the server changed meanwhile | none |
| 062 | **Calm network errors**: loading retried 3 times (1/3/9 s) only for network errors, 5xx and 429; **saves never retried** (owner A); live refresh backs off and **stops after 5 refusals** (owner A) with "Can't reach the kitchen right now · Try again"; reconnect capped at 8; one offline banner (stacks under the update bar); the customer order page pauses while hidden; 403 says "You are not allowed to do this" | none |
| 063 | **Pickup · Delivery · Both**: one clear choice at the top of the menu's Details step; only the matching settings show; switching to Delivery with places ticked asks first; Check says "Pickup only / Delivery only / Pickup or delivery"; **the customer basket offers only what the menu offers** (Dellavee's live bug) and the **server refuses** anything else from customers (`fulfilment_unavailable`) | none |
| 064 | **Pictures of the last 10 menus are kept** (rolling): Past menus show their picture; "Start from" a past menu copies it; the picture slot has "Use a past menu's picture"; files are deleted only when nothing uses them | ⚠️ **migration 0015** |
| 065 | **My orders** remembers the last kitchen (its banner after a reload) and shows each order's **kitchen pill** between code and total | none |
| 066 | **Up to 50 dishes per menu** (portions per dish per order stay 99; dish stock up to 10,000). Fixed a real bug on the way: a 50-line order hit D1's 100-variable limit (`portionGuard` now uses `json_each`). Every route stays at ≤ 7 database round trips. Print totals fit; the WhatsApp post lists dishes up to 3,000 characters, then "+ N more on the menu" | none; **publish 11+ dishes only a day after the deploy** (an app that hasn't refreshed still refuses more than 10) |
| D-097 | **Devices opens on the phone** (More → Devices), so a phone-only seller (Chandra) can add her tablet herself | none |
| Help | two tabs, **Seller help** (12 topics, incl. new "Phone or tablet?" and a rewritten "Make and publish a menu" with pickup places first) and **Customer help** (a 7-question FAQ: ordering, lost order, updates, home screen, odd app, languages, orders from other kitchens) | none |
| — | customer **Settings** shows the kitchen banner on top | none |

**Decisions recorded:** D-095 (Help public at a hidden address), D-096 (languages; one language per dish is enough), D-097 (Devices on the phone). **Live plan status:** [plans/live-status.md](plans/live-status.md). **Plans index:** [plans/README.md](plans/README.md).

## For the owner tomorrow: questions waiting (one at a time)
1. **063 Menu defaults:** Settings → Menu defaults is still two-way (delivery on/off). A true Pickup · Delivery · Both default needs one more stored setting. **A:** leave it two-way (each menu's Details has the three-way choice). **B:** add the stored setting (small; maybe a migration).
2. **060 default first language:** every kitchen now says "English" first by default, so an Indonesian phone opening a "both" kitchen sees English until it switches (before, it followed the phone). **A:** default to the **phone's language** unless the owner picked one. **B:** keep English as the default.
3. **Dish pictures for customers:** the customer menu shows no dish pictures today (only the menu's collage). **A:** leave it. **B:** a plan to show each dish's picture (lazy-loaded).
4. **Invite message drafts:** the editable invite message isn't kept as a draft, because it contains the key. **A:** fine as is.

## Deploy impact (tell the builder before the next deploy)
| area | impact |
|---|---|
| database | ⚠️ **two new migrations, both add-only: 0014_first_language, 0015_past_menu_pictures.** Apply to the live D1 **before** deploying: `pnpm exec wrangler d1 migrations apply shaggybobo-order --remote`. On each PC `pnpm db:migrate:local` (never reseed). Deploying the code first breaks the kitchen settings reads and the menu finish until they are applied |
| secrets / settings | ✅ nothing new |
| beta testers | ✅ the new-version bar (plan 059, live since 1.0.30) tells them to Refresh; no "close and reopen" message needed this time |
| 50 dishes | publish a menu with more than 10 dishes only a day after the deploy |
| signed-in people | ✅ nobody is signed out |

**After deploying, check:** Dellavee's basket offers delivery only; a translation still works (⇄); a menu finish keeps its picture in Past menus.

## Next session
1. Read this file. Check the gate line above.
2. Go through "Questions waiting" **one at a time** (owner rule).
3. When the owner is happy: merge `indra/brand_logo_ux` into `main` (a normal push now, no force), and the builder deploys (migrations 0014 + 0015 first).

## Known and not done
- **Dellavee is a beta tester.** Ask her for feedback after the next deploy (delivery-only basket fixed).
- Help screenshots still missing for screens that need a real signed-in session (Devices, the 6-digit code, Invite, Publish, Orders): take them from the live app.
- Clearer image-slot labels; the seller's own invite list with paging; keep max 50 invites per kitchen.
- 031 as a read-only "view as"; Send reminder / Download CSV on Orders; stall sales in the printed totals; owners pausing their own kitchen.
- The owner's wife's iPad (invite "used", 0 devices): send a recovery key if she can't sign in ("leave it for now").
- The **customer app** round (with the owner's Lottie animations).

## Ready prompt for the next session
> Read docs/HANDOVER.md and CLAUDE.md. Overnight work (plans 060–066, D-097, Help tabs) is pushed on indra/brand_logo_ux, not deployed. Tell me the gate result, then go through "Questions waiting" **one at a time**: two lines on each, then one A / B question, and wait for my answer before the next. Never several questions in one message.
