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

## Wireframes

- [batch-1.html](wireframes/batch-1.html): core loop: customer menu (EN, ID), basket and checkout, order placed + WhatsApp text; seller order list, order detail. Approved (draft 2).
- [batch-2.html](wireframes/batch-2.html): after ordering: My orders, order page (before cut-off, Saturday ready), add order for a WhatsApp customer + send link, cook list by chef, share menu to WhatsApp. Approved (draft 2).
- [batch-3.html](wireframes/batch-3.html): seller setup: menu, edit item, saved sets, week settings, banner, chefs and people, print labels, preview as customer. Approved (draft 2).
- [batch-4.html](wireframes/batch-4.html): sign-in and Saturday: invite key, passkey help, password fallback, sign in, admin page, admin first setup, scan to collect, hand-over, delivery run. Approved.

**Navigation (coordinator default, overrulable):** seller bottom tabs Orders · Cook list · Hand-over · Menu · More; chefs the same without Menu; customers have no tab bar (menu ↔ My orders link).

## Mock-ups

- [batch-1-directions.html](mockups/batch-1-directions.html): two visual directions (A Sage, B Clay), customer menu + seller orders, light and dark, with token and contrast tables and proposed status-pill tints. Picked: **A, Sage** ([D-023](../decisions/README.md)).
- [batch-1-directions-2.html](mockups/batch-1-directions-2.html): round 2: B Clay, C Sogan, D Nila & Kunyit, with an optional batik motif in the banner. Picked: **C, Sogan** ([D-025](../decisions/README.md)); motif pending.
- [seller-desktop.html](mockups/seller-desktop.html): desktop seller layouts A1 (table + slide-over) vs A2 (three columns), with cook list and empty state, low-tech-literacy rules (D-030). Picked: **A1** + "Next order" ([D-031](../decisions/README.md)).
