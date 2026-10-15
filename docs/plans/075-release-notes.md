# 075 · About ShaggyBobo and release notes in the seller app

**Status:** questions answered (2026-10-14; D-100); plan only, build next round after the mock-up. Owner: "we need to plan for next round to have release notes in the seller app, so we can see what changes" → "we may need to add in seller app 'About' and show the ShaggyBobo branding, fancy, same like in the admin left page, and show the releases and a bit of about; only on the seller app; we don't need to build now, just a plan".
**Goal:** sellers (owners, chefs, helpers) can open an **About** page in the seller app that shows the ShaggyBobo branding, a short "about", the current version and **what changed in each release**, in plain EN and ID. Seller app only (not customers, not admin).

## Today
- Plan 059 shows "A new version is ready" and a safe Refresh; it says nothing about what changed.
- Changes are listed only in docs/HANDOVER.md and commit messages (technical, English).
- The ShaggyBobo branding already exists: `src/app/BrandPanel.tsx` (plan 036): the Nusantara market scene, the walking mascot, the logo and the version line, on the admin pages and the seller sign-in / first set-up. Its colours and sizes are the brand's own (`src/theme/brandTokens.ts`).

## Proposal (to be confirmed question by question)
1. **About in the seller menu:** a new item **About** (left menu on tablet/computer, under Help; phone: More → About), for every role.
2. **Hero: the market scene + the walking mascot in CSS, no Lottie** (owner, 15 Oct: "I like what you have without Lottie"): the scene drifts slowly and is faded a little; the mascot steps, waves the spoon and blinks (the mock-up's CSS, as on the sign-in page, plan 036); still under reduced motion; **no new dependency**. A Lottie may replace it later (owner may send one).
3. **The About page:** the ShaggyBobo brand panel (scene, mascot, logo) reused from `BrandPanel`, the version (`appVersion`), a few lines "about ShaggyBobo" (who makes it, what it is for, the privacy promise in one line). **No Help link** on About (owner, 15 Oct): Help is already in the menu.
4. **Releases in a slide-in panel** (owner, 15 Oct): About shows one row "What's new · Releases" (latest version + date); tapping it slides a panel in (from the right on tablet, full screen on phone) with **at most the last 5 releases**, newest first and open, older ones folded.
5. ~~"What's new" after an update~~ **No pop-up** (owner, 14 Oct): the notes stay on About.
6. **Where the notes live:** a small file in the repo (e.g. `shared/releaseNotes.ts`, EN + ID), written as part of each release's checklist; no database, no new dependency.

## Questions (one at a time)
1. ~~A "What's new" card after an update?~~ **No, leave it in About** (owner, 14 Oct; D-100).
2. ~~Who writes the notes~~ **Claude drafts 2–4 plain lines (EN / ID) per release from the handover; the owner or the builder decides what goes in and what doesn't** before the deploy (owner, 14 Oct; D-100).
3. ~~The about text~~ **Approved draft (owner, 15 Oct: "fun, light, young, modern"; "HomeMade" instead of "family-made"; ID casual "kamu / nggak"):**
   - Full text below ("About text (approved)"). No "we don't store your IP" line while the log limiter keeps a hashed IP (handover cleanup item).
4. ~~How far back~~ **From the next release (1.0.36)** (owner, 14 Oct).

#### About text (approved)
The heading ends with the **ShaggyBobo icon** (`logo-icon`) instead of 👋 (owner, 15 Oct). No "About ShaggyBobo" heading above it (owner, 15 Oct). The text sits in a **card** (owner "C", 15 Oct; not the bubble or book page) with a **smaller font**; the hero, logo and version stay **pinned** and only the text box scrolls, with a **brand-coloured scrollbar**; a small **What's new ›** button right of the version opens the releases panel. **Light and dark** follow the app's Appearance setting (the app's dark tokens; the hero dimmed a little in dark).

**EN**

> **Hey, we're ShaggyBobo 👋**
> A tiny HomeMade app for home cooks who feed their people. Drop your menu, share one link, and watch the orders roll in, in English or Bahasa. You do the cooking magic. We'll handle the chaos. 🍲
>
> **Your customers' stuff stays safe 🔒**
> - **No sign-ups. Ever.** A first name is all it takes to order. No passwords to forget.
> - **Phone numbers stay off the cloud.** Chats happen on WhatsApp, between you and them.
> - **Addresses? Locked up tight.** Encrypted, seen only by your team, and **auto-deleted a day after the menu ends**. Poof. ✨
> - **Zero ads. Zero selling data.** We don't touch money and we don't sell anyone's info. Not now, not ever.
> - **Notifications are opt-in.** Customers choose, and can switch them off any time.
> - **Your kitchen, your crew.** Only people you invite get in, each with a passkey on their own device.
>
> HomeMade with love (and a lot of tasting). 💛

**ID**

> **Halo, kami ShaggyBobo 👋**
> Aplikasi mungil HomeMade untuk para juru masak rumahan. Pasang menu, bagikan satu tautan, dan pesanan pun berdatangan, dalam bahasa Inggris atau Indonesia. Kamu fokus masak yang enak-enak, sisanya biar kami yang beresin. 🍲
>
> **Data pelangganmu aman 🔒**
> - **Nggak perlu daftar.** Cukup nama depan untuk pesan. Nggak ada kata sandi yang bisa lupa.
> - **Nomor HP nggak disimpan di cloud.** Ngobrolnya lewat WhatsApp, antara kamu dan mereka.
> - **Alamat? Dikunci rapat.** Terenkripsi, cuma timmu yang bisa lihat, dan **terhapus otomatis sehari setelah menu selesai**. Hilang. ✨
> - **Tanpa iklan. Tanpa jual data.** Kami nggak pegang uang dan nggak jual info siapa pun. Dulu, sekarang, selamanya.
> - **Notifikasi? Terserah pelanggan.** Mau nyala atau mati, bebas kapan saja.
> - **Dapurmu, krumu.** Cuma yang kamu undang yang bisa masuk, masing-masing pakai passkey di perangkatnya sendiri.
>
> HomeMade dengan cinta (dan banyak icip-icip). 💛

## Stages (after the questions)
| # | stage |
|---|---|
| 1 | mock-up of the About page (phone + tablet) for the owner's OK |
| 2 | notes file + About page + menu item (all roles), EN/ID |
| 3 | release checklist gains "write the notes"; Help mentions About |
| 4 | tests (unit for the notes list, one Playwright check), docs |

**Deploy impact (expected):** none (no migration, no secret).
