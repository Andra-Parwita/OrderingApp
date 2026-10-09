# Plans

Every change starts here as a plan ([D-055](../decisions/README.md)). One file per plan, named `NNN-short-name.md` (for example `001-seller-share.md`). The owner approves a plan before any building starts.

- **Who builds:** the owner plans (from the design in `uxDesign/`) with the coordinator; the owner's son executes the plans on his own PC. So each plan must stand on its own: quote the rulings it relies on, name the files, and say what "done" looks like.
- **During the stages:** run typecheck only.
- **At the end of the phase:** run the full gate once (lint · format:check · test · the changed Playwright specs). See [tech-stack.md](../guide/tech-stack.md#quality-gate).

The long-range [roadmap](../plan/roadmap.md), the live [board](../plan/board.md) and [lessons](../plan/lessons.md) stay in `docs/plan/`.

## Plans

| # | plan | status |
|---|---|---|
| 001 | [Seller app UX redesign](001-seller-ux-redesign.md) | done (2026-10-10); owner check pending |
| 002 | [Web push notifications](002-web-push.md) | replaced by 004 (builder: "A", 2026-10-10) |
| 003 | [Phase 4 follow-ups](003-phase4-followups.md) | done (2026-10-10) |
| 004 | [Customer app redesign and web push](004-customer-redesign-and-push.md) | approved, building; **must be done before going live** |
| 005 | [Code-review fixes](005-review-fixes.md) | done (06:11) |
| 006 | [Security fix: image refs stay with their seller](006-security-image-refs.md) | done (06:30) |
| 007 | [Harden the 6-digit add-device code](007-auth-code-hardening.md) | done (06:49) |

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
