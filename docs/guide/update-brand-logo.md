# How to update the ShaggyBobo logo

The developer's branding (logo, mascot, scene) is fixed by us, not by sellers, so changing it means a new deploy ([plan 036](../plans/036-developer-branding-sign-in.md)).

**Where it shows:** `/admin/setup`, `/admin/sign-in` and `/seller/setup` (the invitation). `/seller/sign-in` shows the kitchen's own banner instead.

| File in `public/brand/` | What it is | Size |
|---|---|---|
| `logo-icon.webp` | the happy-face icon in the logo pill (`src/app/BrandLogo.tsx`), shown at 32 × 32 | 128 × 128, transparent |
| `mascot-leg-right.webp`, `mascot-leg-left.webp`, `mascot-body.webp`, `mascot-eyes-closed.webp`, `mascot-arm-spoon.webp` | the mascot on the scene (tablet and desktop), five layers on one canvas, stacked back to front in that order ([plan 044](../plans/044-new-mascot-and-logo.md)) | 900 × 635 each, the same canvas, transparent |
| `nusantara-market.webp` | the scene behind the mascot, fills the middle (cover: edges are cropped) | 1200 × 2000; keep the important part in the centre 1000 × 1000; keep it under ~500 KB |

The wordmark is text in `BrandLogo.tsx` ("Shaggy" in the text colour, "Bobo" `#d9772b`). The pill around icon and wordmark has light and dark values in `brandPill` (`src/theme/brandTokens.ts`); the beige brand bar always uses the light pill.

## Steps

1. Save the new file over the one in **`public/brand/`** (same name).
2. Check it locally: `pnpm dev`, then open `https://localhost:5173/admin/sign-in` (the dev server picks the file up straight away).
3. Commit, then deploy (`pnpm run deploy`, see [deploy-cloudflare.md](deploy-cloudflare.md)).

No code change is needed for the mascot and the scene. The animations are CSS in `BrandLogo.tsx` and `BrandMascot.tsx` and stop when the device asks for reduced motion.

## Making the files

- **Tightly cropped, transparent background** for the logo and the mascot: empty margins make them look off-centre.
- The mascot is shown up to about 380 px wide. From a large PNG: trim the transparent edges, resize to ~900 px wide and save as WebP (what was done for the walking mascot, from the owner's `WalkingMascot.png`). A new mascot picture also needs the arm cut out again and the eyelid positions in `BrandMascot.tsx` updated, which is a developer step.
- The scene is cropped differently on each screen; keep anything important in its centre.

## Other formats or names

A PNG, or a different file name, works too: change `MASCOT_SRC` or `SCENE_SRC` in `src/app/BrandPanel.tsx` (one line each).

## Caching

Browsers and phones may keep the old picture for a while after a deploy; a hard refresh (Ctrl+F5) shows the new one. To make every device update at once, give the file a new name (e.g. `nusantara-market-v2.webp`) and update its line in `BrandPanel.tsx`.

## The mascot layers

Each layer is a transparent 1800 × 1270 PNG on one canvas with the figure in the same place (resized to 900 × 635 WebP, quality 88, with `sharp` from Node: it is in `node_modules` through other packages but isn't a project dependency). Keep the names and the canvas and the layers line up. The motion values are CSS custom properties on the figure in `BrandMascot.tsx`: `--step` (1.3 s), `--jump` (12 %), `--squash`, `--leg-tuck`, `--arm-swing`, `--blink` (2 s) and the pivots `--shoulder`, `--hip-left`, `--hip-right` (percent of the canvas). New art with a different figure position needs new pivots; a developer step. The feet sit 50 px above the footer (`brandSize.mascotBottom`). No leaves or leaf colour any more.
