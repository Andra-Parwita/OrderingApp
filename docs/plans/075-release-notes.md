# 075 · About ShaggyBobo and release notes in the seller app

**Status:** questions answered (2026-10-14; D-100); plan only, build next round after the mock-up. Owner: "we need to plan for next round to have release notes in the seller app, so we can see what changes" → "we may need to add in seller app 'About' and show the ShaggyBobo branding, fancy, same like in the admin left page, and show the releases and a bit of about; only on the seller app; we don't need to build now, just a plan".
**Goal:** sellers (owners, chefs, helpers) can open an **About** page in the seller app that shows the ShaggyBobo branding, a short "about", the current version and **what changed in each release**, in plain EN and ID. Seller app only (not customers, not admin).

## Today
- Plan 059 shows "A new version is ready" and a safe Refresh; it says nothing about what changed.
- Changes are listed only in docs/HANDOVER.md and commit messages (technical, English).
- The ShaggyBobo branding already exists: `src/app/BrandPanel.tsx` (plan 036): the Nusantara market scene, the walking mascot, the logo and the version line, on the admin pages and the seller sign-in / first set-up. Its colours and sizes are the brand's own (`src/theme/brandTokens.ts`).

## Proposal (to be confirmed question by question)
1. **About in the seller menu:** a new item **About** (left menu on tablet/computer, under Help; phone: More → About), for every role.
2. **Livelier with Lottie** (owner, 15 Oct: "for About I want to use maybe better animation or background with Lotties"): the About page gets a Lottie animation or animated background instead of only the still brand panel; shares the Lottie choice (source, library: a new dependency, owner's OK) with the customer app round. **Source (owner, 15 Oct: "we try to do it ourselves"): we make our own** from the layered mascot parts (body, spoon arm, legs, closed eyes) and the market scene; the player library still needs the owner's OK.
3. **The About page:** the ShaggyBobo brand panel (scene, mascot, logo) reused from `BrandPanel`, the version (`appVersion`), a few lines "about ShaggyBobo" (who makes it, what it is for, the privacy promise in one line), and a link to Help.
4. **Releases in a slide-in panel** (owner, 15 Oct): About shows one row "What's new · Releases" (latest version + date); tapping it slides a panel in (from the right on tablet, full screen on phone) with **at most the last 5 releases**, newest first and open, older ones folded.
5. ~~"What's new" after an update~~ **No pop-up** (owner, 14 Oct): the notes stay on About.
6. **Where the notes live:** a small file in the repo (e.g. `shared/releaseNotes.ts`, EN + ID), written as part of each release's checklist; no database, no new dependency.

## Questions (one at a time)
1. ~~A "What's new" card after an update?~~ **No, leave it in About** (owner, 14 Oct; D-100).
2. ~~Who writes the notes~~ **Claude drafts 2–4 plain lines (EN / ID) per release from the handover; the owner or the builder decides what goes in and what doesn't** before the deploy (owner, 14 Oct; D-100).
3. ~~The about text~~ **The owner writes it later** (14 Oct); the page is built with a placeholder the owner fills in.
4. ~~How far back~~ **From the next release (1.0.36)** (owner, 14 Oct).

## Stages (after the questions)
| # | stage |
|---|---|
| 1 | mock-up of the About page (phone + tablet) for the owner's OK |
| 2 | notes file + About page + menu item (all roles), EN/ID |
| 3 | release checklist gains "write the notes"; Help mentions About |
| 4 | tests (unit for the notes list, one Playwright check), docs |

**Deploy impact (expected):** none (no migration, no secret).
