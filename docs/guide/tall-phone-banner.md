# Make a tall phone banner (1200 × 600) with ChatGPT

All picture prompts are also in [architecture/images.md](../architecture/images.md#creating-pictures). Plan 123 (1.0.44.1). The phone banner can be 1200 × 600: the bottom 1200 × 400 is the banner everyone sees; the top 200 px shows only in the iPhone app, behind the clock, exactly as drawn (no blur, no fade). Designer brief and template: `uxDesign/customer/mockups/123-designer-brief.md`, `123-template-phone-banner-1200x600.png`.

## 1 · Ask ChatGPT (attach the current 1200 × 400 banner)
ChatGPT cannot output 1200 × 600; its wide size is 1536 × 1024, so it makes that and we crop.

```
Extend this banner image upward (outpainting). Output 1536 × 1024 (landscape). Place my original image unchanged at the bottom, full width (1536 × 512, bottom edge to bottom edge), and do not change, redraw, recolour or move anything in it: same faces, text, logo, food and colours. Fill the top 1536 × 512 by continuing the existing background seamlessly upward (sky, wall, wood, leaves, lights or decoration that already appear at the top edge of my image), with no visible seam. The new top area must contain NO text, NO logo, NO people or faces and NO food, only background scenery. Keep the new area just above my image calm and fairly dark, especially the left third, the middle and the right third, so white phone status-bar text (time, battery) stays readable there. No blur, no vignette, no frame, same art style and lighting as my image.
```

**What really happens (DellaVee, 25 Oct):** ChatGPT redraws the whole scene instead of keeping the original pixels, and places the content a little higher. Pasting the original back on the bottom then shows a visible seam, so **use ChatGPT's picture as a whole** and choose the crop.

## 2 · Crop to 2 : 1 and resize to 1200 × 600
- Scale the 1536 × 1024 picture to 1200 wide (1200 × 800), then take a 1200 × 600 window.
- **Choose the window so the logo, faces and food sit inside its bottom 400 px**, with ~30 px space above the logo. The top 200 px of the window must be scenery only.
  - Bottom-anchored window (y 200–800 of the 1200 × 800) is the default; DellaVee needed y 160–760 because the logo sat high.
- Save as JPEG ~85% (≈ 200 KB). The seller app compresses again on upload (~100 KB), so the file size doesn't matter, only the shape.
- **Claude can do this** for you: put the ChatGPT file somewhere on the PC and ask. It crops in a headless browser (canvas `drawImage` + `toDataURL('image/jpeg', 0.85)`; load the files as data URLs, a `file://` image taints the canvas) and shows a preview on an iPhone 16 Pro Max, an iPhone 13 and a browser.
- **Claude.ai alternative** (it does it with its code tool; attach ChatGPT's picture, and the original 1200 × 400 banner if you have it):
```
I attach a banner picture made by an image AI (any size). Make me a 1200 × 600 phone banner from it with your code tool (Python + Pillow), like this:
1. Scale the picture so it is exactly 1200 px wide, keeping its shape, with high-quality resampling (Lanczos). If it is then less than 600 px tall, stop and tell me; never stretch or squash it.
2. Pick a 1200 × 600 window from it. The bottom 400 px of the window (y 200 to 600) is the banner everyone sees: the logo, all text, faces and food must be fully inside it, with about 30 px of space above the highest of them. The top 200 px (y 0 to 200) must contain only background scenery (sky, roof, trees, wall), no text, logo, faces or food. Start from the window anchored at the bottom of the picture and move it up only as much as needed. Tell me which y range you used.
3. Do not change, redraw, blur, sharpen or recolour anything.
4. Save as JPEG, quality 85, progressive, sRGB, no metadata. Aim for 150 to 300 KB; if it is over 400 KB, lower the quality to 80.
5. Also make two small preview PNGs: (a) the bottom 1200 × 400 only (what browsers and Android show); (b) the full picture with a thin dashed red line at y = 200, plus a black pill 344 × 101 px centred at x 428 to 772, y 61 to 162 (the iPhone camera), white text "9:41" at x 75, y about 111, and a white battery shape ending at x 1125, y about 111.
Give me the JPEG and both previews to download, and tell me the final size in KB.
```
- If you attach the original 1200 × 400 too, you can add: "If the bottom 400 px of your window looks almost the same as my original, paste my original over the bottom 400 px instead, but only if there is no visible seam; otherwise keep the AI picture."

## 3 · Check before uploading
- Cover the top 200 px: the bottom 1200 × 400 alone must still work as the banner (logo not cut).
- In the top part, the time (left, x 80–300, y 90–150), the camera pill (middle) and the battery (right, x 900–1120) sit on calm, darker background.
- Nothing important within ~40 px of the left and right edges.

## 4 · Upload
Seller app → Settings → Kitchen → Pictures → Phone banner → Change (needs 1.0.44.1 or later; 1.0.44 accepts only 1200 × 400). Existing installs pick it up at once; no re-adding of the iPhone app needed.

Files so far: `D:\Projects\home\assets\dellavee\DapurDellaVee_banner_1200x600.jpg` (from `DelaveFullBanner.png`, crop y 160–760).
