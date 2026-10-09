# Plans

Every change starts here as a plan ([D-055](../decisions/README.md)). One file per plan, named `NNN-short-name.md` (for example `001-seller-share.md`). The owner approves a plan before any building starts.

- **Who builds:** the owner plans (from the design in `uxDesign/`) with the coordinator; the owner's son executes the plans on his own PC. So each plan must stand on its own: quote the rulings it relies on, name the files, and say what "done" looks like.
- **During the stages:** run typecheck only.
- **At the end of the phase:** run the full gate once (lint · format:check · test · the changed Playwright specs). See [tech-stack.md](../guide/tech-stack.md#quality-gate).

The long-range [roadmap](../plan/roadmap.md), the live [board](../plan/board.md) and [lessons](../plan/lessons.md) stay in `docs/plan/`.

## Plans

| # | plan | status |
|---|---|---|
| 001 | [Seller app UX redesign](001-seller-ux-redesign.md) | approved, ready to build |
| 002 | [Web push notifications](002-web-push.md) | placeholder; **must be done before going live** |

## Template

```markdown
# NNN · <name>

**Status:** draft | approved | building | done (YYYY-MM-DD)
**Goal:** <one or two sentences: what the owner will see when it's done>

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | <what> | <files / folders> | <how we know; typecheck passes> |
| 2 | ... | | |

## End of phase

- [ ] Full gate: typecheck · lint · format:check · test · changed Playwright specs
- [ ] Owner tries it on the PC (and a phone, if it's customer-facing)

## Decisions and notes

- <rulings made while planning, linked to docs/decisions>
```
