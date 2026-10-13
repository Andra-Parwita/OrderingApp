# 072 · Tick freely, saved in one go (menu dishes, prices, limits)

**Status:** approved (2026-10-13, owner "A", then: "what if the seller selects a different tab right after ticking quickly?").
**Goal:** in the menu wizard's **Dishes** step (ticking dishes on/off) and the **Check** step's per-menu **price / limit** edits, changes show **instantly** and are sent to the server **in one request** after a short pause (~1 s without changes), instead of one request per tick with every checkbox greyed out while waiting. A small status line shows **"Saving…"** → **"Saved ✓"** (or **"Not saved yet · Try again"**). "Saved as you go" stays true.

## Rules
- **Optimistic:** the tick / value changes on screen at once; boxes are never disabled while a save is in flight.
- **Debounce:** one save ~1 s after the last change, carrying the **whole current state** (the full `dishIds` list; for prices/limits only the items that changed, in one batch request if the API allows, else one request per changed item sent together).
- **Leaving early (owner's question):** switching to another step tab, pressing Edit/Continue, closing the wizard layer, going to another screen, or the page being hidden (`pagehide` / `visibilitychange`) **saves pending changes immediately** (no waiting for the pause). Navigation is not blocked; the new tab shows the saved state as soon as the save returns.
- **Order safety:** only one save in flight; changes made during it are queued and sent right after (the latest state wins); a slow old response never overwrites newer ticks on screen.
- **Failure / offline:** the pending state is kept (plan 061 device draft), the status line says **"Not saved yet · Try again"** (EN/ID) and it retries on the next change, on Try again, or when the connection returns — never an endless loop (plan 062). Leaving the step with unsaved changes after a failure shows a calm warning: "Some changes aren't saved yet. They're kept on this device. Try again / Leave anyway".
- **Server rules unchanged** (limits, chef rules, 50 dishes). A refusal (e.g. menu full, chef not allowed) reverts the affected ticks and says why.
- EN + ID for every text.

## Stages
| # | stage | files | done when |
|---|---|---|---|
| 1 | a small shared "auto-save" helper (debounce, single-flight, flush now, status) | `src/features/seller-menu/` (or `src/components/` if reused) | unit: bursts → one request; flush on demand; latest wins; failure keeps state |
| 2 | Dishes step ticks + Check step prices/limits use it; flush on step change / Edit / Continue / close / navigate / pagehide; the status line | `DishesStep.tsx`, `CheckStep.tsx`, `StepTabs.tsx`, the wizard layer | unit: 10 quick ticks → 1 request; tick then switch tab → saved before/at switch; offline → "Not saved yet" + kept |

## End of phase
- [ ] typecheck · eslint · unit · e2e `seller-menu`, `chef-dishes`
- **Deploy impact:** none (client only).
