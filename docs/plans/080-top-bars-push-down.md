# 080 · Top bars push the page down instead of covering it

**Status:** approved (owner "A", 2026-10-15); this round, after plan 079. Owner: "also the maintenance bar ideally pushes everything down and does not overlay the top one; is that possible and not causing breaking?"
**Goal:** the maintenance notice (plan 046), the "new version" bar (plan 059) and the offline banner (plan 062) take their own space at the top; the page starts below them, so headers (e.g. the admin brand header, `temp/bug/img_7.png`) are never covered.

## Today
- All three bars are `position: fixed` overlays stacked with CSS variables (`--update-bar-height`, `--notice-bar-height`): `src/components/maintenance/MaintenanceHost.tsx`, `src/components/update/updateCheck.ts`, `src/components/network/OfflineBanner.tsx`.
- Pages are sized to the full screen (`100dvh` / `100vh`) in ~25 files (layouts for seller, customer, admin, sign-in, Help, install, Cook, Orders …), so they don't know about the bars.

## Build
1. One variable for the total height of the bars that are showing, `--top-bars` (0 when none), kept by the bars themselves (measured, updated on show / hide / resize / wrap to two lines).
2. The app root gets `padding-top: var(--top-bars)`; every full-screen layout uses one shared helper, "the screen height minus the bars" (`calc(100dvh - var(--top-bars, 0rem))`), instead of its own `100dvh`. Pinned headers and slide-in panels start below the bars.
3. The full-screen "Updating, back in a few minutes" maintenance screen stays a cover over everything (it is meant to block).
4. **ShaggyBobo icon in the maintenance notice** (owner, 15 Oct: "can we have the ShaggyBobo icon on left or right?"): the small ShaggyBobo icon (`/brand/logo-icon.webp`) on the **left**, in place of the 🛠 emoji (the ✕ close stays on the right); decorative (`alt=""`), sized to the text line; same in light and dark. A little **space between the icon and the text**, and the message sits in a soft **speech bubble whose small tail points at Bobo**, so it reads as Bobo saying it (owner, 15 Oct). Subtle: muted tint, 1px hairline, no heavy border; the bar's height barely changes.
5. **Not breaking:** each of the ~25 layouts is captured with no bar, one bar and two bars (phone + desktop); unit test for the variable; the maintenance and update e2e specs re-run; the seller, customer and admin specs re-run at the gate.

No mock-up: same bars and pages, only the overlap goes away; the coordinator shows before / after captures.

**Deploy impact (expected):** none.
