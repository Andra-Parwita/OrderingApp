# How to update the ShaggyBobo logo

The developer's branding (logo, mascot, scene) is fixed by us, not by sellers, so changing it means a new deploy ([plan 028](../plans/028-developer-branding-sign-in.md)).

**Where it shows:** `/admin/setup`, `/admin/sign-in` and `/seller/setup` (the invitation). `/seller/sign-in` shows the kitchen's own banner instead.

| File in `public/brand/` | What it is | Size |
|---|---|---|
| *(no file)* | the icon and wordmark: drawn inline in `src/app/BrandLogo.tsx`, so it follows dark mode and can move. To change it, replace the SVG shapes there (from a 145 × 32 SVG); a developer step | 145 × 32 |
| `shaggybobo-walking-body.webp` + `shaggybobo-walking-spoon.webp` | the walking mascot on the scene (tablet and desktop), split so the spoon arm can swing; the eyelids are drawn in `src/app/BrandMascot.tsx` | 900 × 635 each, the same canvas, transparent |
| `nusantara-market.webp` | the scene behind the mascot, fills the middle (cover: edges are cropped) | 1200 × 2000; keep the important part in the centre 1000 × 1000; keep it under ~500 KB |

## Steps

1. Save the new file over the one in **`public/brand/`** (same name).
2. Check it locally: `pnpm dev`, then open `https://localhost:5173/admin/sign-in` (the dev server picks the file up straight away).
3. Commit, then deploy (`pnpm run deploy`, see [deploy-cloudflare.md](deploy-cloudflare.md)).

No code change is needed for the mascot and the scene. The animations are CSS in `BrandLogo.tsx` and `BrandPanel.tsx` and stop when the device asks for reduced motion.

## Making the files

- **Tightly cropped, transparent background** for the logo and the mascot: empty margins make them look off-centre.
- The mascot is shown up to about 380 px wide. From a large PNG: trim the transparent edges, resize to ~900 px wide and save as WebP (what was done for the walking mascot, from the owner's `WalkingMascot.png`). A new mascot picture also needs the arm cut out again and the eyelid positions in `BrandMascot.tsx` updated, which is a developer step.
- The scene is cropped differently on each screen; keep anything important in its centre.

## Other formats or names

A PNG, or a different file name, works too: change `MASCOT_SRC` or `SCENE_SRC` in `src/app/BrandPanel.tsx` (one line each).

## Caching

Browsers and phones may keep the old picture for a while after a deploy; a hard refresh (Ctrl+F5) shows the new one. To make every device update at once, give the file a new name (e.g. `nusantara-market-v2.webp`) and update its line in `BrandPanel.tsx`.

## Try a leaf colour live (DevTools)

The two leaves on the mascot's head and the leaf on the logo icon share one CSS variable, `--mascot-leaf` (default `#A34F38`, the owner's pick).

1. Open `/seller/setup` or `/admin/sign-in` on a wide window, press F12, then **Elements**.
2. Click the first line, `<html lang="en">`. In **Styles**, the `:root` rule shows `--mascot-leaf: #A34F38`. Click the value or its colour swatch and change it.
   Or, in the **Console**: `document.documentElement.style.setProperty('--mascot-leaf', '#2E9E4F')`.
3. Both leaves change at once, and the leaf shading and outline stay. To keep a colour, change `leaf` in `src/theme/brandTokens.ts`.

The mascot's leaves are a greyscale shading layer (`public/brand/shaggybobo-walking-leaves.webp`) multiplied over that colour.

## Recreating the mascot layers

The three mascot files in `public/brand/` are made from the owner's **`WalkingMascot.png`** (1536 × 1024, a transparent cut-out). It came in the branding package and isn't in git; ask the owner for it. Each output is 900 × 635 on the same canvas, so the layers line up.

1. **Base:** trim the transparent edges, resize to 900 px wide, WebP (quality 86, alpha 90).
2. **Spoon arm** (`shaggybobo-walking-spoon.webp`): keep only the polygon `0,20 150,20 150,268 180,316 201,330 201,470 0,470`. The shoulder pivot is (201, 380), set in `BrandMascot.tsx`.
3. **Body** (`shaggybobo-walking-body.webp`): the base without that polygon and without the leaf pixels from step 4.
4. **Leaves** (`shaggybobo-walking-leaves.webp`): in the box x 480–680, y 0–130, the leaf pixels are the green fill (`g > r+12 && g > b+12`, or `g > r && g > b+8`), the light rim (`g > 120 && g >= r-30 && g > b+60`) and the olive outline (`g >= r-8 && g > b+20`). Store them as greyscale `v = clamp((g-30)/150) × 255` with their alpha. The colour comes from `--mascot-leaf`.
5. **Eyelids:** drawn in `BrandMascot.tsx` at (390, 276) r 56×55 and (531, 241) r 52×50. A new picture needs new positions.

Any image tool works. On this PC it was done with `sharp` from Node (already in `node_modules` through other packages; it isn't a project dependency), using a short script: `trim()` → `resize({ width: 900 })` → an SVG polygon with `composite({ blend: 'dest-out' | 'dest-in' })` → a per-pixel loop for the leaves.
