# 075 · About ShaggyBobo and release notes in the seller app

**Status:** draft (2026-10-14), plan only, not building yet; questions with the owner one at a time. Owner: "we need to plan for next round to have release notes in the seller app, so we can see what changes" → "we may need to add in seller app 'About' and show the ShaggyBobo branding, fancy, same like in the admin left page, and show the releases and a bit of about; only on the seller app; we don't need to build now, just a plan".
**Goal:** sellers (owners, chefs, helpers) can open an **About** page in the seller app that shows the ShaggyBobo branding, a short "about", the current version and **what changed in each release**, in plain EN and ID. Seller app only (not customers, not admin).

## Today
- Plan 059 shows "A new version is ready" and a safe Refresh; it says nothing about what changed.
- Changes are listed only in docs/HANDOVER.md and commit messages (technical, English).
- The ShaggyBobo branding already exists: `src/app/BrandPanel.tsx` (plan 036): the Nusantara market scene, the walking mascot, the logo and the version line, on the admin pages and the seller sign-in / first set-up. Its colours and sizes are the brand's own (`src/theme/brandTokens.ts`).

## Proposal (to be confirmed question by question)
1. **About in the seller menu:** a new item **About** (left menu on tablet/computer, under Help; phone: More → About), for every role.
2. **The About page:** the ShaggyBobo brand panel (scene, mascot, logo) reused from `BrandPanel`, the version (`appVersion`), a few lines "about ShaggyBobo" (who makes it, what it is for, the privacy promise in one line), and a link to Help.
3. **Releases on the About page:** newest first, each with its version, date and 2–4 plain lines (EN / ID); older releases folded.
4. **"What's new" after an update** (optional, question 1): a card once after Refresh pointing to About.
5. **Where the notes live:** a small file in the repo (e.g. `shared/releaseNotes.ts`, EN + ID), written as part of each release's checklist; no database, no new dependency.

## Questions (one at a time)
1. After an update, does a "What's new" card pop up once, or is About enough? — _open_ (A: card once + About; B: About only, with a dot on About when there is something new; C: one line in the new-version bar)
2. Who writes the notes, and where they live — _open_ (proposal 5)
3. The "about" text: what it says, and who appears (ShaggyBobo, the family, a contact?) — _open_
4. How far back the releases go (from 1.0.35, or earlier ones written up too) — _open_

## Stages (after the questions)
| # | stage |
|---|---|
| 1 | mock-up of the About page (phone + tablet) for the owner's OK |
| 2 | notes file + About page + menu item (all roles), EN/ID |
| 3 | optional "What's new" card; release checklist gains "write the notes"; Help mentions About |
| 4 | tests (unit for the notes list, one Playwright check), docs |

**Deploy impact (expected):** none (no migration, no secret).
