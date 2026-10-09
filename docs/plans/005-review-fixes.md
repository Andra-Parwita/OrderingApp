# 005 · Code-review fixes (plan 001 server)

**Status:** approved by the builder (2026-10-10, "A"); **done** (06:11). The 3 fixes are in, each with a test that fails without it. The coordinator re-ran the 4 server test files (85/85) and `eslint worker mocks` (clean). The full gate runs with plan 004's end-of-phase gate (plan 004 is mid-phase).
**Goal:** fix the 3 correctness findings from the code review of the plan 001 work (`/code-review`, high, 10 Oct 05:49), so one bad menu, a stray tap or a retry can't leave orders in the wrong state.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Auto-finish keeps going.** `finishDueMenus` wraps each seller's `finishMenu` in try/catch, logs a count-only line for failures (no seller name, order or token), and moves on to the next menu. | `worker/db/menus.ts`, `worker/api/scheduled.ts` | a test: menu A's finish throws, and menus B and C still finish in the same run |
| 2 | **Customer "collected" needs Ready.** For `by === 'customer'`, only a pickup order in `ready_for_pickup` (or already collected) can be collected. Anything else answers a plain refusal; the customer has no force. | `worker/db/handover.ts` | tests: an ordered or confirmed order is refused, and stays unchanged; a ready one is collected; a repeat call is idempotent |
| 3 | **A place message is safe to retry.** The message-log row is written in the **last** batch, after every order change, so a failed later batch leaves no log row; a retry then isn't flagged as a repeat. Orders the message already readied are skipped on a retry (they are Ready now), so nobody gets the message twice. | `worker/db/handover.ts` | a test with more than one batch where the second batch fails: no log row, and the retry sends to the rest only |

## End of phase

- [ ] Full gate: typecheck · lint · format:check · test · Playwright `auth-desktop-chromium` and `desktop-chromium`

## Notes

- **Not in this plan:**
  - Contacts are keyed per order, so a repeat customer's number isn't reused. That's a design question for the owner (D-059).
  - A place message reads every live order (efficiency, low).
  - The retired screens left as aliases or dead code (`SendUpdateScreen.tsx`, the old `SettingsScreen` and its test, the old phone `OrdersScreen` and `OrderRow`) need the owner's OK to delete.
- Deviation (accepted): a `ready_now` retry also skips an order the seller readied on its own in the last 10 minutes; it already got its Ready line.
