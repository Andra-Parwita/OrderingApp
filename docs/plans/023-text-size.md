# 023 · Text size: smaller, normal, larger

**Status:** approved by the builder (2026-10-10: "maybe we can have option to have smaller text or larger text, for accessibility"). For both the seller and the customer apps.
**Goal:** each device can pick **Smaller · Normal · Larger** text in Settings, so a seller can fit more orders or read more easily, and a customer can read the menu comfortably.

## Approach (the builder checks it first)
The theme mixes `rem` and `px` sizes (`src/theme/tokens.ts`), so scaling only the root font size would leave the px parts unchanged. The builder checks the two options, picks one and says why:
- **A:** scale the root `font-size` (87.5 % / 100 % / 112.5 %) and convert the remaining px type and spacing tokens to rem;
- **B:** CSS `zoom` on the app root (0.9 / 1 / 1.15), which scales everything evenly and is supported by Safari and Chrome. Check that it doesn't break `position: fixed` sheets or the slide-over.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **The setting.** A three-way Segmented "Text size" in seller Settings → Preferences and in customer Settings (EN/ID), stored per device (localStorage, try/catch), applied at start-up before the first paint (no jump). Browser zoom and the phone's own text size keep working. | `src/theme/` (AppThemeProvider or GlobalStyle), `src/features/seller-settings/PreferencePanes.tsx`, `src/features/customer-settings/` | tests: the choice is stored and applied; captures of the Orders home and the customer menu at all three sizes, looked at by the coordinator (no overlap at Larger on the iPad) |

## End of phase
- [ ] typecheck · lint · format · the touched unit tests · e2e `seller-list-scroll` and `customer-batch1` (`--workers=1`)
