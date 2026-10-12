# 053 · Jump to any step of a menu that isn't published yet

**Status:** approved (2026-10-12, owner: "in the menu screen it should be easy to click to see the different steps, if not published yet"; in this round).
**Goal (owner approved the mock-up `temp/mockups/menu-steps.html`, "A"):** while a menu is being made (not published), the Menu screen shows its four steps as **tabs** (Dishes, Details, Check, Publish & share, each with done / "You stopped here" / to do and a one-line summary). Clicking a tab shows that step **read-only** on the Menu screen (dishes with price, limit, chef; the dates, pickup and delivery; the check results; what publishing will do). Under it: **Edit <step>** opens the wizard layer (plan 037) at that step, and **Continue to step N** opens it at the next step not done yet. The single "Continue" button goes. Home's "making steps" rows link to the matching tab.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Step tabs, read-only, Edit and Continue** as in the goal; a real tab list (arrow keys, `aria-selected`); the read-only views reuse the wizard steps' data (no editing controls); on a live menu nothing changes. EN + ID. | `src/features/seller-menu/MenuScreen.tsx` (+ a small read-only step view), `src/features/seller-home/Draft.tsx`, i18n | unit: each tab shows its step read-only; Edit opens the layer at that step; Continue opens the first not-done step; Home's rows open the matching tab |

## End of phase
- [ ] typecheck · eslint · `src/features/seller-menu`, `src/features/seller-home` unit tests
- **Deploy impact:** none (display and navigation only).
