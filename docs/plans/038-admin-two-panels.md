# 038 · Admin page in two panels, sellers expand and collapse

**Status:** draft (2026-10-11), waiting for the owner's approval and the mock-up. From the owner's screenshot `temp/bug/img_4.png` (not in git): "there is no way to collapse that device", "I should be able to collapse or expand each seller, and your admin devices and add device should always be shown … on the left panel … so this page can be 2 panels, left about admin and its devices, right about sellers". Builds on plans 027 and 033 (admin devices, People per kitchen).
**Goal:** on tablet and desktop, `/admin` has two panels. **Left:** the admin's own things, always visible: Your admin devices (rename, sign out) and Add a device (the 6-digit code). **Right:** the sellers, each one a row that expands to its details (link, invite and recovery keys, demo switch, People and their devices) and collapses again. No server or database change.

## How it is today
`src/features/admin/AdminHomeScreen.tsx` is one column, in this order: the Sellers table; the selected seller's panel under it (opened by selecting a row, and it can't be closed again); Add a seller; Your admin devices, at the bottom, below the fold.
Seen in the screenshot: the header has no side padding (EN/ID and "Admin" touch the left edge, and "Sign out" is cut off on the right).

## Design
- **Tablet and desktop (≥ 768 px):** two columns. Left, about 22 rem, sticky: Your admin devices and Add a device (the code shown in place). Right, the rest: Add a seller, then the seller rows.
- **A seller row:** name, link, created, devices, and a chevron. Clicking the row (or Enter/Space) expands its details under it; clicking again collapses. Each row opens and closes on its own; all start collapsed. `aria-expanded` and `aria-controls` on the row button.
- **The details** are today's panel, unchanged inside (keys, demo, People with devices, sign out, remove).
- **A clear split between the two panels** (owner: "make sure in the admin page there is a distinction of panel left and right, admin panel and seller list panel"): the admin panel sits on a **lighter** background than the sellers panel (owner: "maybe left panel has a different lighter panel background"; the theme's raised surface token, in both light and dark mode), with a 1px hairline between the two, and each panel has its own heading ("Admin" and "Sellers").
- **Phone:** one column. The admin part first, then the sellers. Same expand and collapse.
- **Header: the ShaggyBobo brand bar** (owner, `temp/bug/img_5.png`: "we need to show the ShaggyBobo banner on top or somewhere, currently it has no brand logo at all"). The same beige bar and animated logo as the sign-in pages (`BrandTopBar` / `BrandLogo` in `src/app/`, plan 036), carrying "Admin", EN/ID and Sign out, with the same side padding as the content so nothing touches the edges or gets cut off. At the bottom, the brand footer (version, build, © ShaggyBobo), as on sign-in.
- Theme tokens only (D-006), EN/ID for any new label (for example "Show details", "Hide details" for screen readers).

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 0 | **Mock-up** of `/admin` at 1361 × 865 and 390 × 844: two panels, one seller expanded, one collapsed. The owner approves it. | `uxDesign/` | owner OK |
| 1 | **Two panels and the brand bar.** Split the screen into an admin panel (left) and a sellers panel (right); phone stacks them. | `src/features/admin/AdminHomeScreen.tsx`, `src/features/admin/shared.tsx`, `src/app/BrandPanel.tsx` (export only, if needed) | unit test: the ShaggyBobo logo is on `/admin`; the admin devices and Add a device are on the page with no seller selected |
| 2 | **Expand and collapse each seller.** The table's "select" becomes a toggle per row; several can be open. | `src/features/admin/AdminHomeScreen.tsx`, `src/features/admin/i18n/en.json`, `id.json` | unit test: a row expands to its People and collapses again; two rows can be open at once; `aria-expanded` follows |
| 3 | **A summary on each seller row** (owner: "on sellers it would be good to have some summary, if possible, in addition to devices/created"). The admin's seller list also returns, per kitchen: **people** (count), **current menu** (Live · <cooking day> / Not published / None), **orders** on the current menu (count, no names), and **last active** (the newest device "last used"). Shown in the row, so the collapsed list already tells the admin who is running a menu. Counts only, nothing private (D-007). A small server change: one query in the admin seller list, plus the contract. | `shared/authContract.ts` (`AdminSeller`), `worker/db/auth.ts` (the admin seller list), `src/features/admin/`, i18n | unit tests: the contract parses the new fields; the mock world returns a kitchen with a live menu and 3 orders as "Live · Sat 17 Oct · 3 orders"; a kitchen with none shows "No menu" |
| 4 | **Details in a right-hand panel, not an expanding row** (owner, 2026-10-11: "when I select a seller or create a seller it shows a panel with detail from the right instead of expanding the row, same with the invitation etc, since mostly admin will work from desktop"). On desktop/tablet, selecting a seller opens its details in a side panel from the right (the existing `SlideOver`), with **tabs** (owner: "the seller detail panel can have tabs, invitation and settings (images)"): **Invitations** (invite key, recovery key, People with their devices) and **Settings** (Images from plan 041, the demo switch); "Add a seller" and a new invite/recovery key open the same way. The list stays visible and the selected row is marked. Phone: the same panel, full screen. Replaces stage 2's expand/collapse. | `src/features/admin/**` | unit: selecting a row opens the panel on the Invitations tab with its People; the Settings tab shows the Images and the demo switch; the tabs are a real tab list (arrow keys, `aria-selected`); Esc and ✕ close it and return focus; Add a seller opens the form in the panel; the key shows in the panel |

## End of phase
- [ ] typecheck while building
- [ ] lint · format:check · `src/features/admin` unit tests · e2e `admin`
- [ ] screenshots at 1361 × 865 and 390 × 844 match the mock-up

## Decided by the coordinator (owner may overrule)
- **Add a seller** sits at the top of the right panel, as a row that expands to the form (recommended option A; the owner went fully automated before answering).
