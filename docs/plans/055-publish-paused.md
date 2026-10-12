# 055 · Publish now, or publish with ordering paused

**Status:** approved (2026-10-12, owner: "when we publish a menu we should allow the seller to publish but pause ordering, or publish and become live straight away"; in this round).
**Goal:** the wizard's Publish step offers two clear choices: **Publish and take orders now**, or **Publish, ordering paused** (customers can see the menu but can't order until the seller switches "Taking orders" on). Uses the existing "Taking orders" switch (`takingOrders`); no new state, no migration.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Publish choice.** On the Publish step (`PublishStep.tsx`): pressing Publish opens a confirmation modal (project Dialog: focus trapped, Esc/X/Cancel publish nothing) titled "Publish the menu for <day>?" with two radio cards, default "take orders now", and one confirm button labelled by the choice ("Publish and open orders" / "Publish, paused"); the step keeps just the Publish button; after a paused publish the live screen shows "Menu published · ordering paused. Turn on Taking orders in Orders when you're ready."; the publish request sets `takingOrders` true/false in the same call (or publish + one update, atomically from the user's view). The server's publish must not force ordering back on if paused was chosen (check `worker/db/menus.ts` publish). After publishing paused: Home shows "Orders paused" (plan 039) and the customer menu shows its paused message; switching "Taking orders" on (Orders header) opens it. EN + ID. | `src/features/seller-menu/PublishStep.tsx`, the publish op/saga, `worker/db/menus.ts` (publish), `worker/api/routes.ts` (only if the request needs the field), `shared/menusContract.ts` | unit/mocks: publish with paused → live menu with `takingOrders: false`, customer ordering `closed_by_seller`; publish now → open; the switch later opens ordering |

## End of phase
- [ ] typecheck · eslint · `src/features/seller-menu`, `mocks` unit tests
- **Deploy impact:** none beyond the normal deploy; no migration.
