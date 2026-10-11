# 028 · ShaggyBobo branding on admin and seller first set-up

**Status:** done (2026-10-11); owner's design in chat (`temp/img.png`, `temp/img_1.png`, not in git) and "that should be Shaggy Bobo". Replaces [027](027-admin-sign-in-panel.md).
**Goal:** `/admin/setup`, `/admin/sign-in` and `/seller/setup` (the invitation) show the developer's ShaggyBobo branding instead of a kitchen. `/seller/sign-in` (a returning seller) keeps the last kitchen's banner (D-051).

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | Mascot in the repo (`public/brand/shaggybobo-mascot.svg`). `SignInFrame` takes `brand` (`admin` / `sellerSetup`): no last-kitchen lookup. Tablet and desktop (≥ 768 px): the left column (46 %) has a header (mascot logo, "ShaggyBobo", an outlined "Seller setup" pill on seller setup only (owner: no "Admin console", it doesn't exist)), the mascot in the middle, and a footer (version pill, `build <commit> · production/development`, `· draft` if any, `© <year> ShaggyBobo`). Phone: the header as a top bar, the footer as a bottom bar, no mascot. Above the form: mascot logo + "ShaggyBobo". Brand colours #2B1D12 on #EADBC2 in both themes. EN/ID under `app.brand`. | `src/app/BrandPanel.tsx` (new), `src/app/SignInFrame.tsx`, `src/app/AuthRoutes.tsx`, `src/i18n/en.json`, `src/i18n/id.json`, `src/app/SignInFrame.test.tsx` | unit test: both brand pages ask for no menu, show the pill, the name, the copyright and the version |

## End of phase
- [x] typecheck · `src/app`, `src/features/admin`, `src/features/seller-auth` unit tests (151/151)
- [x] screenshots: admin sign-in 1361×865, seller setup 390×844
- [ ] lint · format:check · e2e `seller-auth`, `session-flow` (at the end of the phase)

## Stage 2 · Nusantara market art (2026-10-11)
Owner's package `temp/shaggybobo-branding/` (README brief, not in git). Assets moved to `public/brand/`:
- `shaggybobo-header.svg`: icon and wordmark as one image, 145 × 32, alt "ShaggyBobo". Used in the header, the phone top bar and above the form.
- `nusantara-market.webp` (446 KB, 1200 × 2000): fills the middle edge to edge (cover, scaled 1.04 to hide its soft edges). Tablet and desktop only, so phones never download it.
- `shaggybobo-mascot.svg` (unchanged): its own layer on the scene, at 57 % height, `min(65%, 320px)` wide.
Not taken: the PNG fallbacks (SVG and WebP work in every supported browser) and the reference concept.
Checked in screenshots at 1361×865, 820×1180 and 390×844. Typecheck and `SignInFrame` tests pass (5/5).
Later (owner's list): a native-resolution scene, a transparent walking mini-me, and Lottie states.

## Stage 3 · Walking mascot (2026-10-11)
Owner: "it misses the walking mascot image that should be used in the main image", to look like `reference/approved-concept-with-mascot.png`.
- `temp/shaggybobo-branding/mascot/WalkingMascot.png` (1536 × 1024, 1.8 MB, a transparent cut-out) trimmed and saved as `public/brand/shaggybobo-walking.webp` (900 × 635, 99 KB).
- It replaces the SVG mascot in the middle: walking on the path, at 60 % across and 68 % down, `min(62%, 380px)` wide, with a soft shadow under it. `public/brand/shaggybobo-mascot.svg` is removed (the header logo carries its own icon).
- Checked in screenshots at 1361×865 and 820×1180.

## Stage 4 · Animation and the dark-mode logo fix (2026-10-11)
Owner: "would it be possible to make it animated .. css", "have the head and word shaggybobo animate", and bug `temp/bug/img.png`: "Shaggy" could not be seen in dark mode, with the dark logo variant (`temp/bug/img_1.png`) as the fix.
- The logo is drawn inline (`src/app/BrandLogo.tsx`, from the owner's `shaggybobo-header.svg`), so "Shaggy" takes the colour around it. `public/brand/shaggybobo-header.svg` is removed.
- Above the form: brown "Shaggy" in light mode; in dark mode the logo sits in the brand's dark brown box with a light "Shaggy" (the owner's dark variant).
- CSS only, no new dependency: the head tilts gently, the leaf sways, the eyes blink, the letters hop in a wave every 6 s, and the walking mascot bounces straight up and down (1.2 s), feet always 50 px above the footer, whatever the scene's crop (owner, `temp/bug/img_2.png`: a fixed 175 px looked different per screen; "like 50px from footer top", "so it does not matter how the background would be"). The scene now covers the middle through a 3:5 stage (container query units) instead of `object-fit`. All of it is off with `prefers-reduced-motion: reduce`.
- Checked in a dark-mode screenshot at 1361×865. Typecheck passes.
- Fixed bars (owner: "always have fixed height of footer and header and the middle image can just fill"): tablet and desktop header and footer are 72 px each, and the scene fills everything between them edge to edge. On phones the top and bottom bars are 56 px (plus the safe areas). On a narrow column the footer wraps to two lines inside the same height. Checked at 1361×865, 820×1000 and 390×844.

## Stage 5 · Mascot parts move (2026-10-11)
Owner chose "A": a CSS blink and a gentle spoon wave on the current picture (a real Lottie waits for layered artwork from the artist).
- `shaggybobo-walking.webp` is split, on the same 900 × 635 canvas, into `shaggybobo-walking-body.webp` (84 KB) and `shaggybobo-walking-spoon.webp` (16 KB, the spoon, the hand and the arm up to the body's outline). At rest they line up exactly.
- `src/app/BrandMascot.tsx`: the figure bounces (1.2 s), the arm swings from the shoulder at (201, 380) by −9° / +4° (1.8 s), and the eyes blink every 4.5 s (skin-coloured lids with a closed-eye line, drawn in SVG over the eyes). All of it is off with reduced motion.
- Checked with frozen frames (eyes closed, arm raised) at 1361×865.
- Not done: the mouth (it needs drawn mouth shapes) and the legs (the seam would show). Both wait for layered artwork.
- Leaves: first orange, then the owner chose "Black" ("maybe like a bit of dirt"). The two green leaves on the walking mascot are recoloured an earthy near-black (`#22180F` to `#5C4630`), with their light rim and olive outline cleaned, in `shaggybobo-walking-body.webp` (rebuilt from the owner's original PNG). The logo icon's leaf in `BrandLogo.tsx` matches (`#4A3626`).
- Leaf colour as one CSS variable (owner chose "A"): the leaves are cut out of the body layer into `shaggybobo-walking-leaves.webp` (5 KB, greyscale shading). The colour is `var(--mascot-leaf, #4A3626)` (`LEAF_COLOUR` in `BrandLogo.tsx`), shared by the mascot (a masked colour block with the shading multiplied on top) and the logo leaf. Checked: setting `--mascot-leaf` on `:root` recolours both live.
- Leaf colour set to the owner's pick `#A34F38` (2026-10-11).
