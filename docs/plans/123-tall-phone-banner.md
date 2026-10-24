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
- **Live finding (25 Oct, 1.0.44.1):** on the owner's iPhone the top part behind the clock showed blurred and dim at rest, sharp when pulled down. Owner: "I think we can leave the top blur, I like it, or maybe we can make it a setting in admin?" → "A": finish the fix (sharp), show sharp vs soft blur side by side, the owner picks one look for everyone; a per-kitchen setting (Sharp / Soft blur) only later, as its own plan with a mock-up.

## Stage 5 · per-kitchen setting "Behind the clock: Sharp / Soft blur" (owner 25 Oct: "I like both … I want the setting also part of this hotfix")
- **Target: 1.0.44.2**, together with the blur fix. Mock-up `uxDesign/customer/mockups/123-clock-area-setting.html` approved (owner "A", 25 Oct).
- Phone banner card (seller Settings → Kitchen → Pictures and the admin pictures editor): row "Behind the clock (iPhone app)" / "Di belakang jam (aplikasi iPhone)", hint "How the top of your banner shows behind the time and battery." / "Cara bagian atas banner Anda tampil di belakang jam dan baterai.", choice **Sharp / Soft blur** ("Tajam / Blur lembut"); shown only for a tall banner.
- Stored per kitchen: one add-only column (e.g. `kitchens.clock_area` TEXT NULL, `sharp` | `blur`; NULL = the default) in migration `0035`; in the public menu answer, the seller and admin image/settings routes, backup and restore. Old clients ignore it.
- Customer banner: a tall banner uses the kitchen's choice; 3 : 1 banners and browsers/Android unchanged.
- **Deploy impact:** one add-only migration, applied before the Worker deploy.
- **Soft blur strength (owner "C", 25 Oct):** **12 px** (was 20 px), brightness 0.85, the soft dark gradient on top as today; compared at 20 / 12 / 8 / 4 px in the mock-up. Applies to the "Soft blur" choice for tall banners; the 1.0.44 fallback blur for 3 : 1 banners without a background picture stays 20 px unless decided otherwise.
- Owner: "I have to try it live on my phone whether 8 or 12 px blur … we can change quickly." Ship 12 px as one constant (`statusBarFade.ts`); after the live check a switch to 8 px is a one-line change + quick deploy (no database change).

## Outcome (25 Oct)
- 1.0.44.2 (Worker `70e17010…`) removed the fixed page fade over a tall banner; the owner's iPhone (iOS 26) **still shows a soft blur behind the clock**: iOS 26's own scroll edge effect, not our code (lesson 45). Owner: "I do like it, so we may not do the other setting." **Stage 5 (the setting) is dropped**; mock-up kept for reference. `BLUR_TALL_BANNER` stays false (our own blur on top would double it).
