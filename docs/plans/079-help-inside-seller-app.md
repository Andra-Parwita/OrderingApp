# 079 · Help opens inside the seller app

**Status:** approved (owner "A", 2026-10-15); this round, after the 075 + 076 gate. Owner: "when I click Help, it goes to a new tab or replaces the current seller page? That would be bad."
**Goal:** Help from the seller menu opens **inside the seller app**: the left menu (phone: the tab bar) stays, so one tap returns to Orders. The public Help address (`/help-yw4xsvh8`, D-095) keeps working as it is for the sign-in page and invite messages.

## Today
- The rail's Help item and the phone's More → Help go to the public Help page (`SELLER_HELP_PATH`), outside the seller layout: the menu disappears, and the way back is the browser's Back (none in a home-screen app).

## Build
1. A seller route (e.g. `/seller/help`) inside the seller layout renders the same Help content (`src/features/seller-help/HelpScreen.tsx`), without its public page frame (brand header / footer), for every role.
2. The rail Help item, More → Help and in-app links to Help (e.g. `?topic=` links) point to the in-app route when signed in (or in the dev no-sign-in mode); the sign-in page, invite message and other public links keep the public address.
3. Topic links (`?topic=N`) and the Help tabs keep working in both.
4. Tests: nav href, route renders inside the layout, public page unchanged; one e2e step (rail → Help → the rail is still there → Orders).

No mock-up: it is the existing Help page shown in the existing seller frame; the coordinator shows a capture for the owner's OK.

**Deploy impact (expected):** none.
