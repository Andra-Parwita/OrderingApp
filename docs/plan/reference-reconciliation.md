# Reconciling the owner's reference prototype

**Status:** accepted in full by the owner ("A"), recorded as [D-027](../decisions/README.md), 2026-10-07.
**Sources:** the owner's artifact "Delave weekly orders (prototype)" ([extraction](../design/reference/delave-prototype-extract.md)) vs. the rulings in [decisions](../decisions/README.md) and the [concept brief](../../briefs/food-ordering-concept-brief.md). The rules say the coordinator never picks between conflicting sources; each row has a recommendation for the owner.

## 1 · Conflicts

| # | topic | artifact says | we decided / brief says | recommendation |
|---|---|---|---|---|
| 1 | Seller sign-in | setup key (7 days, 3 devices) → device name → **4–6 digit PIN**; 6-digit "add device" code (10 min); 5 tries → 15 min lockout; auto-lock after 12 h | **passkey**, password fallback, admin issues keys (D-011, D-013, D-014) | **Keep passkeys** (stronger, nothing to remember); **adopt** from the artifact: device naming, 3 devices per key, 6-digit add-device code (10 min), 5 tries → 15 min lockout. No PIN. |
| 2 | Note on labels | label shows the note (≤ 70 chars, tinted) | notes never on labels (D-018) | **Artifact wins**: an allergy note on the container is a safety aid when packing. Amend D-018. |
| 3 | Colours | its own Sogan-like palette (brown `#7A4B2A`, indigo, gold, sage; status tints: Confirmed green, Ready gold, Out indigo) | round-2 Sogan palette (D-025) | **Artifact palette wins** (it's your own design and very close to D-025); the coordinator re-checks every pair for AA before the swap. |
| 4 | Font | Plus Jakarta Sans from Google Fonts | system font; no external requests | **System font now**; self-host Plus Jakarta Sans later if you want it (a font file is an asset, not a package, but it's an outside download, so it needs your OK). |
| 5 | Kawung strip | 10 px strip above menu, orders, past weeks, labels | no motif (D-026, just ruled) | **Keep D-026** (no motif) unless you now want the strip. |
| 6 | Retention | keep 10 / 26 / **52** weeks, archive to a file | brief: "only the current week … old orders deleted or reduced to weekly totals after a few weeks" | **Brief wins for orders** (delete order details after 4 weeks), but **keep weekly totals** (orders, income, item totals) for the past-weeks view, plus the artifact's export to a file. |
| 7 | Change tracking | full history of customer edits with diffs, "Changed" badge | last 4 changes of anyone (D-013) | **Merge**: keep last-4 audit, add the "Changed" badge and a short diff ("+1 Lemper, note changed") in the entry. |
| 8 | Seller-entered order | "Confirm order now" checkbox, "Mark paid" checkbox | starts Confirmed (D-010) | **Adopt the checkboxes**, "Confirm now" ticked by default (keeps D-010's default). |
| 9 | Cut-off | auto-closes at the cut-off, manual Open/Closed toggle, sample Fri 9 pm | customers locked out after cut-off (D-024); sample Fri 8 pm | **Adopt** auto-close + manual toggle; sample time 9 pm. |
| 10 | "N left" | shown only when ≤ 5 left | always shown when there's a limit | **Adopt ≤ 5.** |
| 11 | Kitchen name in samples | "Delave" | "Dapur Bu Ani" (made up) | **Use "Delave"** if that's your real brand. |

## 2 · New features in the artifact (not in our plan yet)

| feature | recommendation | where |
|---|---|---|
| Lock order (customer can't change it) | adopt | batch 2 (order page, order detail) |
| Seller's own WhatsApp number in settings → "Send to seller" opens the right chat | adopt (it's the seller's number, already public in the group; answers the open question) | batch 2 |
| "How ordering works" 3-step guide on the menu | adopt | batch 2 |
| Returning customer / "WhatsApp received" / "Nudge customer" | adopt (helps the seller know when to confirm) | batch 2 |
| Send an update to many customers (templates: Ready in N min, Arrived, Arriving in N min, custom; recipient groups) | adopt; in-app inbox now, push in phase 5 | batch 4 (Saturday) |
| Stats: orders, income, paid, unpaid | adopt (totals of orders; still no payment handling) | batch 2 (cook list) |
| Cook view group-by: item / customer / pickup-delivery (+ our chef grouping, D-012) | adopt, merged with chef | batch 2 |
| Paste a WhatsApp post → items | adopt | batch 3 (menu editor) |
| Past weeks, export JSON / CSV, import backup | adopt (with row 6) | batch 3 |
| Theme switch (auto / light / dark) in the app | adopt | batch 2 |
| Desktop seller layout: left rail + list/detail split at ≥ 820 px | adopt | batch 2 |
| Customer QR on the order; "scan" link | already planned (batch 4) | — |

## 3 · Unchanged

Bilingual EN/ID, no customer phone or address in the cloud (the artifact's "customer WhatsApp number" in the seller's send-link sheet is optional and not saved, which fits D-007), order codes, statuses and flows, notes ≤ 200, portion limits shared across customers, push only after "Turn on updates", destructive actions need a second tap.
