# Kitchen pictures

How the kitchen pictures are sized, stored and made. Storage rules (R2, refs, clean-up) are in [data-model.md](data-model.md#r2-object-rules); the upload sizes live in [`shared/imageSlots.ts`](../../shared/imageSlots.ts).

## Slots
| slot | size (px) | shows where |
|---|---|---|
| `desktopBanner` | 3840 × 328 | seller tablet and wide screens (D-093) |
| `phoneBanner` | 1200 × 400 (3 : 1), or **1200 × 600 (2 : 1, plan 123)** | customer banner on every page, seller phone Orders, seller sign-in. A 2 : 1 picture shows only its bottom 3 : 1 everywhere; the top 200 px fills the iPhone app's clock area (plan 122/123) |
| `railImage` | 1200 × 600 | seller left menu logo block |
| `railIcon` | 512 × 512 | app icons (home screen, splash) |
| `bannerBackgroundImage` | 1280 × 256 | behind the banner; the iPhone clock area for 3 : 1 banners (plan 122) |
| `menuPicture` | 1200 × 800 | the menu picture (D-060) |
| `dishPicture` | 600 × 600 | one per dish (plan 067) |

The seller's device resizes and compresses at upload (phone banner aims at ~100 KB, `PHONE_BANNER_TARGET_KB`); each upload gets a new content-hashed name, and the old file is deleted unless something still uses it.

## Creating pictures
Step-by-step guide for a tall phone banner: [guide/tall-phone-banner.md](../guide/tall-phone-banner.md). Designer brief and template: `uxDesign/customer/mockups/123-designer-brief.md`, `123-template-phone-banner-1200x600.png`.

### 1 · ChatGPT: extend a 3 : 1 banner upward (attach the 1200 × 400 original)
ChatGPT's wide output is 1536 × 1024; it tends to redraw the whole scene, so we crop its picture rather than paste the original back.
```
Extend this banner image upward (outpainting). Output 1536 × 1024 (landscape). Place my original image unchanged at the bottom, full width (1536 × 512, bottom edge to bottom edge), and do not change, redraw, recolour or move anything in it: same faces, text, logo, food and colours. Fill the top 1536 × 512 by continuing the existing background seamlessly upward (sky, wall, wood, leaves, lights or decoration that already appear at the top edge of my image), with no visible seam. The new top area must contain NO text, NO logo, NO people or faces and NO food, only background scenery. Keep the new area just above my image calm and fairly dark, especially the left third, the middle and the right third, so white phone status-bar text (time, battery) stays readable there. No blur, no vignette, no frame, same art style and lighting as my image.
```

### 2 · ChatGPT: design the top so the iPhone status bar sits naturally in the picture
The status bar is never drawn into the picture (iOS draws it live). Instead the scenery (shadows, clouds, leaves, roof) disguises the three places where iOS puts the time, the camera pill and the icons, so they feel part of the picture (owner, 25 Oct; wording refined with ChatGPT). Positions are an iPhone 16 Pro Max in the app (the strip shows y ≈ 31–200 of 1200 × 600; 1 pt = 2.73 px); an iPhone 13 shows from y ≈ 55.
```
Redesign only the top 200 px of my attached 1200 × 600 banner (y 0 to 200). Keep the bottom 1200 × 400 (y 200 to 600) exactly as it is: same scene, logo, characters, food and colours, with no visible seam where the new top meets it.
The top area sits behind the iPhone status bar. iOS draws it live on top of the picture: a white clock on the left, the black Dynamic Island pill in the middle, and white signal, Wi-Fi and battery icons on the right. Do NOT draw the clock, the pill, the icons, or any frame or decoration around them. Instead, use the scenery itself (lighting, shadows, clouds, leaves, roof) to disguise them, so the status bar feels like it belongs to the picture:
1. Left, x 60 to 320, y 80 to 150 (the clock): a darker, gently shadowed part of the scene, such as shadowed sky, banana or palm leaves, or the underside of a roof beam, with minimal detail so the white clock reads clearly.
2. Middle, x 410 to 790, y 50 to 170 (the Dynamic Island): the most important part. Place the darkest part of the top here, for example a dark horizontal cloud formation with natural, irregular edges (not pill-shaped), so the black pill blends into it. Subtle small birds nearby are fine.
3. Right, x 860 to 1140, y 80 to 150 (signal, Wi-Fi, battery): dark blue-purple clouds or shadowed tree foliage, with minimal detail directly behind the white icons.
Keep the atmosphere, time of day, style and colours of the original. No text, no logo, no faces, no food, no bright lights or white in those three places, no blur, no vignette. Output 1200 × 600 if you can.
```
ChatGPT usually returns 1536 × 1024 instead: run step 3 to get back to 1200 × 600, then check (with the step 3 preview) that the three dark areas still sit under the time, pill and icons. The areas are generous, so a small shift is fine.
### 3 · Claude.ai: crop, resize and compress the AI picture to 1200 × 600
Claude.ai runs real code on the file, so it never redraws the picture.
```
I attach a banner picture made by an image AI (any size). Make me a 1200 × 600 phone banner from it with your code tool (Python + Pillow), like this:
1. Scale the picture so it is exactly 1200 px wide, keeping its shape, with high-quality resampling (Lanczos). If it is then less than 600 px tall, stop and tell me; never stretch or squash it.
2. Pick a 1200 × 600 window from it. The bottom 400 px of the window (y 200 to 600) is the banner everyone sees: the logo, all text, faces and food must be fully inside it, with about 30 px of space above the highest of them. The top 200 px (y 0 to 200) must contain only background scenery (sky, roof, trees, wall), no text, logo, faces or food. Start from the window anchored at the bottom of the picture and move it up only as much as needed. Tell me which y range you used.
3. Do not change, redraw, blur, sharpen or recolour anything.
4. Save as JPEG, quality 85, progressive, sRGB, no metadata. Aim for 150 to 300 KB; if it is over 400 KB, lower the quality to 80.
5. Also make two small preview PNGs: (a) the bottom 1200 × 400 only (what browsers and Android show); (b) the full picture with a thin dashed red line at y = 200, plus a black pill 344 × 101 px centred at x 428 to 772, y 61 to 162 (the iPhone camera), white text "9:41" at x 75, y about 111, and a white battery shape ending at x 1125, y about 111.
Give me the JPEG and both previews to download, and tell me the final size in KB.
```

### 4 · Claude Code (this repo) can do step 3 locally
Without Pillow: a headless browser via `@playwright/test` (canvas `drawImage`, `toDataURL('image/jpeg', 0.85)`; load files as data URLs, since a `file://` image taints the canvas), plus a preview on an iPhone 16 Pro Max, an iPhone 13 and a browser. Done for DellaVee (window y 160–760) and Onde Onde (y 158–758) on 25 Oct; results in `D:\Projects\home\assets\<kitchen>\…_banner_1200x600.jpg`.
