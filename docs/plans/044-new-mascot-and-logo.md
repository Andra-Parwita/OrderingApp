# 044 · The new ShaggyBobo mascot and logo icon

**Status:** approved (2026-10-11, in this round). **Assets replaced the same evening:** use `temp/shaggybobo-mascot/` (owner: "better instruction and sample"); its `IMPLEMENTATION.md` is binding (tuned values, markup, CSS: a **jump on the spot** with squash, legs kick, spoon lifts, ground shadow, **blink every 2 s**; logo icon = `faces/face-happy.png`; a pill container around icon + wordmark in light and dark). Where IMPLEMENTATION.md and its README differ (pivots), IMPLEMENTATION.md wins. The files are placeholder quality; the designer's final files will have the same names and canvas. The earlier `temp/shaggybobo-new/` set is superseded. **Wordmark (owner: "A", keep the animation):** today's font and its letter hop stay; only the colours follow IMPLEMENTATION.md (no Fredoka, no new font). Owner: the "ShaggyBobo" text stays; "we don't need to re-test everything, simply on admin page is good enough".
**Added by the owner while building (2026-10-11):** the left column's top bar is transparent over the scene (only the footer stays solid beige); the top-bar logo pill is always the light one (never a black box on beige); the form logo box lines up with the heading; the wordmark's letter hop must run in the top bar too; **phones ("A")**: no beige top or bottom bar, the version and © as one small muted line at the bottom.
**Goal:** the brand bar's icon and the walking mascot on the admin and seller-setup sign-in pages become the new simple bean character: no leaves, a spoon arm that waves, legs that walk on the spot, eyes that blink, a gentle bounce. Everything stops with reduced motion.

## Assets (all checked: sizes as the README says, real alpha)
- `logo-icon.svg` 256 × 256, groups `head` and `eyes` → drawn inline in `src/app/BrandLogo.tsx` (head tilt, eye blink; no leaf sway any more)
- `mascot-leg-left.png`, `mascot-leg-right.png`, `mascot-body.png`, `mascot-arm-spoon.png`, `mascot-eyes-closed.png`, each 1800 × 1270 on one canvas → `public/brand/` as WebP (alpha), same names
- Layer order (back to front): left leg, right leg, body, spoon arm, closed eyes (only while blinking). Pivots on the full canvas: left leg (42%, 73%), right leg (58%, 74%), arm (36%, 56%).
- `mascot-full.png` and `preview.jpg` are references only (not shipped).

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Logo icon.** Replace the icon's shapes in `BrandLogo.tsx` with the new SVG (groups `head`, `eyes`); keep the wordmark, sizes and dark-mode box. Remove the leaf, `LEAF_COLOUR`, `--mascot-leaf` (GlobalStyle) and `brandColour.leaf`. | `src/app/BrandLogo.tsx`, `src/theme/GlobalStyle.tsx`, `src/theme/brandTokens.ts` | unit: the logo still has the name ShaggyBobo; no leaf |
| 2 | **Walking mascot.** `BrandMascot.tsx` stacks the five layers (canvas 1800 × 1270, `aspect-ratio`), feet 50 px above the footer as now; legs swing opposite each other (walk on the spot), a small bounce per step, the arm waves, the closed-eyes layer shows briefly every 3–6 s. Old walking WebPs removed from `public/brand/`. | `src/app/BrandMascot.tsx`, `public/brand/` | unit: five layers in order; closed eyes hidden at rest |
| 3 | **Docs.** `docs/guide/update-brand-logo.md` updated for the new files, layers and pivots (no leaves, no leaf colour). | `docs/guide/update-brand-logo.md` | — |

## End of phase (owner: the admin page is enough)
- [ ] typecheck · eslint · `src/app` unit tests
- [ ] e2e `admin` only (`--project=auth-desktop-chromium --no-deps`), plus screenshots of `/admin/sign-in` at 1361 × 865, light and dark
