# 040 · The seller's top band: a wide banner that fills, matched to the left menu

**Status:** approved (2026-10-11, owner: "A"; sizes corrected the same day, owner "A": optimise for iPad landscape, real content in the iPad zone, sides only on wider screens). Mock-up: `uxDesign/seller/mockups/banner-sizes.html` (open it and resize the window); zone templates `uxDesign/seller/mockups/banner-template-8x1.png` and `banner-template-phone-3x1.png`; a UX review (Opus) found the banner grows to 227–320 px on laptops and desktops.
**Goal:** on tablet and desktop (iPad landscape first, "mostly how the seller will use it"), the seller's banner fills the content width with **no side bands** (owner: "I don't want to have ugly bg on left and right"), at the **same height as the left menu's top block**, whose logo **fills its block** edge to edge. Scrolling the content slides it over the banner down to a strip the height of the collapsed menu's top (owner: "the image can stay the same and just showing the top one"); the collapse button stays. The customer phone banner is a separate image and stays 3:1.

## Sizes

| image | upload | shown | text inside |
|---|---|---|---|
| Wide banner (`desktopBanner`) | **3840 × 328** | height = the left menu's top (164 px on iPad landscape; 328 px is 2× for retina), full content width, `object-fit: cover`, centred: the iPad shows exactly the middle 1896 px; wider screens show more of the sides; **narrower than iPad landscape (e.g. portrait) the banner gets shorter instead, so the middle 1896 × 328 is never cut** (height = min(left-menu top, width × 328 / 1896)) | the middle **1896 × 328** (x 972–2868), 40 px from its edges; outside it, scenery only |
| Left-menu logo (`railImage`) | 1200 × 600 (2:1), unchanged | fills its block edge to edge (≈ 232 × 116), kitchen name below | — |
| Left-menu icon (`railIcon`) | 512 × 512, unchanged | fills 72 × 72 when the menu is collapsed | — |
| Phone banner (`phoneBanner`) | 1200 × 400 (3:1), unchanged | the whole image | centre 1080 × 340 |

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **The 8:1 wide banner.** `desktopBanner` becomes 3840 × 328 (the ±5% ratio check follows). The banner strip's height is the left menu's top height (one shared size token), the image `cover`, centred, full width at every width; no side fill. Existing 5:1 banners still show (cropped by `cover`) until replaced; a new upload must be 3840 × 328 (±5%). | `shared/imageSlots.ts`, `src/app/layout.ts`, `src/app/SellerLayout.tsx`, `src/ui/ImageSlot.tsx` (only if needed), the image settings screen and its i18n, `src/theme` size token | unit: the slot accepts 3840 × 328 and refuses 2000 × 400; the banner strip height equals the left menu's top at 1180 × 820 and shrinks at 820 × 1180; e2e `banners` updated (no side bands at 1180 × 820, 1366 × 768, 1920 × 1080; middle uncut at 820 × 1180) |
| 2 | **The left menu's logo fills its block.** No card or padding: the logo image fills the top block edge to edge (`cover`), the kitchen name below it; collapsed, the icon fills a 72 px square. The block's height is the shared token from stage 1. | `src/app/SellerRail.tsx` (and its styled parts) | unit / capture: the logo block and the banner have the same height, open and collapsed |
| 3 | **Slide over on scroll.** When the content's `scrollTop > 8`, the sheet slides over the banner: the image keeps its size and only its top shows, in a strip as tall as the collapsed menu's top; back at the top it returns. The existing collapse button stays (plan 014). `prefers-reduced-motion`: no transition. On Home and Orders. | `src/app/SellerLayout.tsx`, `src/features/seller-orders/BannerToggle.tsx`, `useBannerCollapsed.ts` | unit: scrolling past 8 px collapses and back at 0 expands; the button still works; reduced motion has no transition |
| 4 | **Samples and the design board.** The demo kitchens' sample banners become 3840 × 328 (`public/samples/banner-wide-3840x328.jpg`, a stand-in made from the owner's 2560 × 320 art until the designer delivers the re-laid-out one), and the phone sample is the owner's 1200 × 400 (`public/samples/banner-phone-3x1.jpg`); the seller design boards' banner note updated. | `public/samples/`, `worker/db/seed.ts` (the sample image refs), `uxDesign/seller/screens/*` notes | the seeded kitchens show an 8:1 banner with no bands |
| 5 | **Every upload says what it expects** (owner: "in settings for each upload image we need to show what is the expected dimension and size (jpg etc)"). Under each image slot in Settings → Images: the size in px, the keep-inside zone where it matters, the file types (JPEG, PNG or WebP) and the largest file (600 KB). Today it shows only "Best size W × H px" (plus a keep zone for some). One line per slot, EN + ID, from `shared/imageSlots.ts` and `IMAGE_MAX_KB` so it can never disagree with the check. Plus a **"How to make this picture"** link per slot that opens a short guide in place (a panel, not a new screen): the zone template picture for that slot (`public/guides/`, from `uxDesign/seller/mockups/banner-template-*.png`), what each screen shows, and a **Download template** button, so a seller can hand it to their designer. | `src/features/seller-setup/ImagesScreen.tsx`, its i18n, `public/guides/` (templates) | unit: each slot shows its size, types and 600 KB; the wide banner shows its iPad middle zone (1896 × 328); the guide opens in place and offers the template download |

## End of phase
- [ ] typecheck while building
- [ ] lint · format:check · unit tests for `shared`, `src/app`, `src/features/seller-orders`, the settings feature · e2e `banners`, `seller-rail`, `design-compare`
- [ ] captures at 1180 × 820, 820 × 1180, 1366 × 768, 1920 × 1080 (open and collapsed menu, scrolled)

## Decisions and notes
- The UX review's other route (cap 5:1 at 160 px, keeping uploads) was set aside by the owner's "no side bands" rule.
- Not deployed to real sellers yet, so asking for an 8:1 re-upload is acceptable now.
- Owner unlinked the left menu and the banner, 2026-10-12: collapsing the menu no longer collapses the banner (it still collapses on scroll past 8 px or the ^ button).
