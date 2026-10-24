# 123 · Taller phone banner that fills the iPhone clock area

**Target: 1.0.44.1** (small release, no migration). **Status:** built 25 Oct (mock-up `uxDesign/customer/mockups/123-tall-banner.html`); tall = picture ratio 1.5–2.5 read on load (`src/ui/useTallPicture.ts`); one image spans the clock band and the 3 : 1 box (`object-position: center bottom`); no fade over it; the page fade waits until the banner scrolls away. Known: on the very first load an iPhone may show 1.0.44's band (background picture) for a moment before the tall picture is known.
**Owner (25 Oct, after 1.0.44 went live):** "I don't like the banner, I want to upload new image for both DellaVee and Onde Onde and we can use the full height … so what is the new height and instruction for the top part?" · "A" (mock-up first, then build).

## What
- The phone banner upload accepts **1200 × 600 (2 : 1)** as well as today's **1200 × 400 (3 : 1)**.
- **Bottom 1200 × 400** = the banner everyone sees (browser, Android, tablet, iPhone), exactly as today.
- **Top 1200 × 200** = shown only in the iPhone home-screen app, behind the clock (plan 122). iPhones show the part closest to the seam: about 145 px (iPhone 12–14) to 185 px (iPhone 16 Pro); the very top may stay hidden.
- Choice behind the clock: tall banner's top strip → banner background picture → blurred banner → colour (122's order, with the tall strip first).
- Settings → Kitchen → Pictures: the phone banner guide shows the two zones; a downloadable template `public/guides/template-phone-banner-tall.svg`.
- No extra download: it is the same picture file.

## Instructions for sellers (EN/ID in the guide)
- Top 200 px: background only (sky, wall, pattern), no text, logo, faces or food; calm colours (a soft dark fade sits behind the clock).
- Bottom 400 px: everything important, as today.

## Stages
| # | what | proof |
|---|---|---|
| 1 | slot accepts 3 : 1 or 2 : 1; resize keeps the shape; ~100 KB aim | unit: both shapes accepted, other shapes refused |
| 2 | banner shows only the bottom 3 : 1 of a tall picture **everywhere it appears**: customer banner (`KitchenBanner`), seller phone Orders list (`SellerLayout`), seller sign-in (`SignInFrame`), Settings → Pictures preview; the seller tablet uses the wide desktop banner (unchanged). iPhone customer app strip shows the top part anchored at the seam | unit + capture at `--sat` 47 / 62 px, and at 0 |
| 3 | **upload help in every place that uploads the phone banner** (owner 25 Oct): seller Settings → Kitchen → Pictures (`ImagesScreen`), the admin/first-time kitchen pictures editor (`KitchenImagesEditor` in `AuthRoutes`), both via `SlotGuide` + `seller-setup` i18n `guide.phoneBanner` and the slot label/size hint; new guide picture + downloadable template (1200 × 600, zones as `uxDesign/customer/mockups/123-template-phone-banner-1200x600.svg`); text below | unit, capture of both screens EN + ID |
| 4 | docs (plan list, roadmap), scoped gate, emulator not needed (iPhone-only look; browsers unchanged) | scoped gate |

**Deploy impact:** client only, no migration, no secret. Old 3 : 1 banners behave exactly as in 1.0.44. Owner step after deploy: upload the new 1200 × 600 banners for DellaVee and Onde Onde, then re-add the iPhone app is **not** needed (the status-bar setting is already there).

## Upload help text (stage 3, EN / ID)
- Size hint: "1200 × 400, or 1200 × 600 for the iPhone app top" / "1200 × 400, atau 1200 × 600 untuk bagian atas aplikasi iPhone"
- Guide lines (replace `guide.phoneBanner`):
  1. "Bottom 1200 × 400: the banner everyone sees. Put faces, the logo and text here." / "Bawah 1200 × 400: banner yang dilihat semua orang. Taruh wajah, logo, dan teks di sini."
  2. "Optional top 200 px (1200 × 600 in total): shown only in the iPhone app, behind the clock. Background only, sharp, no text or faces." / "Opsional 200 px di atas (total 1200 × 600): hanya tampil di aplikasi iPhone, di belakang jam. Hanya latar, tajam, tanpa teks atau wajah."
  3. "Keep the area of the time, camera and battery calm and fairly dark, so the white clock reads." / "Buat area jam, kamera, dan baterai tenang dan agak gelap, agar jam putih terbaca."

## Owner rulings (25 Oct)
- "I don't want top part blur in the banner image": a tall banner's top part is shown sharp (no blur); the blur stays only as the fallback for old 3 : 1 banners without a background picture.
- "I want to still make it seamless image full height but the top part should not have any text or image etc, since those areas either be hidden or blurred": one seamless 1200 × 600 picture; the top 200 px holds no text or main subject (hidden in browsers/Android, under the clock with the soft dark fade in the iPhone app). 
- **Final (owner, 25 Oct): "or we can make it not blurred but if so, make the top image have some area for the text status bar"** → option B for tall banners: **no fade over a tall banner** (the picture shows 100% as drawn); the designer keeps the clock, camera and battery area calm and dark enough for white text. The thin fixed fade (122) appears only after the banner has scrolled away (e.g. an IntersectionObserver on the banner), so it never darkens a tall banner. Old 3 : 1 banners keep 1.0.44's look (background picture or blur, with the fade).
