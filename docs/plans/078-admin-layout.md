# 078 · Admin page: pinned header, compact left column, desktop first

**Status:** ✅ built + gated (2026-10-15), not deployed. Deviations: the Maintenance on/off keeps its existing buttons (not a switch); signing out another device needs a second tap; all sections stay mounted (counts known up front). Mock-up approved (owner "A"): Layout A, [`uxDesign/seller/mockups/078-admin-layout.html`](../../uxDesign/seller/mockups/078-admin-layout.html) (open through a local server). This round, after 079 and 080. Owner (screenshot `temp/bug/img_7.png`, live admin): "the vertical scroll is on the full page so the banner or sign-up on top is not shown, because we have more admin devices and announcement; for admin we should make the left column more concise and not so big; mostly admin will work on PC desktop".
**Goal:** on a desktop the admin page keeps its ShaggyBobo header in view, and the left column is short and dense, so devices, the announcement and settings don't push everything down.

## Today (live 1.0.35)
- The whole page scrolls: the brand header with the sign-out scrolls away as soon as the left column grows.
- The left column holds everything: "Your admin devices" (each device with big Rename / Sign out buttons), "Add a device", "Announce an update" (date, start, minutes, notes EN/ID), maintenance, backup checks. With 3 devices it is taller than the screen.
- The main area shows the seller list.
- Files: `src/features/admin/AdminHomeScreen.tsx`, `MaintenancePanel.tsx`, `BackupMinutesPanel.tsx`, `ProblemsPanel.tsx`, `SellerDetails.tsx`, `shared.tsx`, the brand header (`src/app/BrandPanel.tsx`).

## Proposal (to be confirmed)
1. **Pinned header**; the left column and the main area each scroll on their own (like the seller app).
2. **(chosen) The left column becomes a short menu** of sections: Sellers · Announce & maintenance · Platform settings (backup checks) · Your devices; the main area shows the chosen section, with room for the forms.
3. **Compact rows:** a device is one line (name · "this device" · last used) with small icon buttons (rename, sign out) instead of two big buttons each.
4. Desktop first; **on a phone the sections are chosen from a full-width dropdown at the top** (owner, 15 Oct), under the pinned header.
5. **The left column can be dragged wider** (owner, 15 Oct: "we could also extend the left panel wider"): a drag handle on its edge (also ← / → keys), about 200–480 px, double-click resets, the width remembered on the device; desktop only.
6. **Mock-up:** approved, Layout A (the file also shows B for comparison; build A only).

## Questions (one at a time)
1. ~~The layout~~ **Layout A** (owner, 15 Oct): a short menu on the left, the chosen section in the main area.

**Deploy impact (expected):** none (no migration, no secret).
