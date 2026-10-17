# 084 · Printing: preview first, A4 by default, label printer optional, Help "How to print"

**Status:** ✅ built and gated 17 Oct for Release 1.0.37 (not committed); label-printer switch: per device (owner "A", 17 Oct).
**Why:** a seller printed labels from a Samsung tablet and got only the code + QR. Fixed in the label print CSS (labels pinned to the page corner, wait for fonts, stay mounted until `afterprint`; e2e `label-print`). Owner, 17 Oct: "if click Print, show the preview first so they know what to expect, and then we can see later if the problem is in the printer"; "by default seller only has a normal A4 printer, label roll should be optional and we will need to ask first"; "make sure it is also updated in Help, maybe a new How to print section".

## Print entry points today
| # | where | prints | preview |
|---|---|---|---|
| 1 | More → Labels `/seller/labels` | order labels, A4 2 × 7 or 62 mm roll | the page is the preview |
| 2 | Kitchen → Pack, per bag "Print label" | one order's label | none (printed straight away) |
| 3 | Orders → Print `/seller/orders/print` | order list on A4, totals | the page is the preview |
| 4 | Settings → Links (tablet, owner) | customer link + QR | new window, no preview |
| 5 | Help | all help text | none |

## Changes
1. #2 opens the Labels preview with that order selected (paper, preview, Print).
2. #1 and #3 get a hint under the preview: "If the printout looks different, set the printer's paper to A4 and scale to 100%."
3. #3 Print orders: check and fix the same page-corner positioning as labels (`[data-print-area]` pattern).
4. A4 only by default; the 62 mm roll appears only when "Do you have a label printer (62 mm roll)?" is switched on (per device, owner "A": More → Labels → Printer settings; saved on that device only, so other phones and tablets stay A4-only).
5. Help: a new seller topic "How to print" (EN + ID): where the Print buttons are, preview first, A4 sticker sheet 2 × 7 (or plain A4), the printer's paper A4 and scale 100%, the label printer switch, what to do if the printout looks wrong (Samsung / Android print service tips).
6. #4 and #5 unchanged.
7. **Help "How to print" includes Australian buying tips** (owner, 17 Oct: "we are in Adelaide, Australia, not UK ... in Help how to label we may have some reference on a sample of label printer, a cheap one"): A4 sticker sheets **14 per sheet, 99.1 × 38.1 mm (e.g. Avery L7163 / "14-up addressing labels")** from Officeworks or Kmart; optional label printer **Brother QL-810W (Wi-Fi, about A$200–250)** with the **DK-22205 62 mm roll** (Officeworks), noting it needs Brother's Android print plugin on a Samsung tablet; QL-800 is USB-only (needs a computer). Wording: "for example", no prices in the app text (they change), no shop links that may break.
8. **Handheld scanner check** (owner, 17 Oct: "this scanner is for us to check the order code QR": the team scans the QR on a customer's phone (their order page QR) or on a label at pickup/hand-over): a Bluetooth 2D/QR scanner types what it scans into the focused field. Make sure the Pickup & delivery search (and Pack/Orders search) finds the order when the scanned text is the customer's order-page QR or the label's QR content (a full order link or the code with/without the dash); add a test. Help mentions a Bluetooth 2D QR scanner as optional.
