# Design

Not written yet. Holds the UI design once planning starts:
- the screen list and flows (seller and customer)
- the approved mock-ups and the clickable prototype (one frame per state that matters)
- design tokens (colour, spacing, type), components, and the label and WhatsApp-post layouts

## Style guidelines (the owner's ruling)

1. **Professional and subtle**
   - Use a muted, low-saturation palette: neutral surfaces with one restrained accent colour.
   - No saturated or brightly coloured backgrounds. Keep accent colour for small things: the primary action, focus, a status dot or pill.
   - No heavy borders or boxed-in cards. Separate with spacing, a 1px hairline or a slight surface tint.
   - Status colours (ready, out for delivery, cancelled) are muted tints, and never the only signal: always pair them with text or an icon.
2. **Information density, still readable and clean**
   - Use compact spacing and rows, so the seller's order list and cook totals fit on one phone screen where possible.
   - Have a clear type hierarchy with few sizes and weights, plus tabular numbers for prices, quantities and totals.
   - No decoration that costs space. Show key identifiers (order code, name, total) at a glance and never truncate them.
   - Tap targets stay at least 44 px even when rows are compact.
3. **WCAG AA minimum**
   - Contrast of 4.5:1 for text and 3:1 for large text and non-text UI (icons, input outlines, focus ring). Check it in the build.
   - Every control works by keyboard with a visible focus ring, and every input has a label.
   - Support light and dark mode with the same rules, and respect `prefers-reduced-motion`.

All colours, spacing and type come from design tokens, with no literal values in components (see [the planning skill](../../.claude/skills/react-ts-app-plan/SKILL.md), "Styling principles").

Mock-ups come before any UI build. The images in [briefs/mock](../../briefs/mock/) are for the owner's eye only, never a build source.

## Flows

- [workflow.html](workflow.html): the weekly cycle as a sequence diagram (customer, server, seller), with the WhatsApp hand-offs marked. Draft, 2026-10-07.
