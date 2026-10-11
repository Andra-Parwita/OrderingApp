# 027 · Admin sign-in: an empty left panel

**Status:** replaced by [028](028-developer-branding-sign-in.md) (2026-10-11)
**Goal:** the admin set-up and sign-in pages no longer show the last kitchen's banner, logo and name (admin belongs to no kitchen). The left panel is empty (plain tint) until the owner supplies an admin image.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | `SignInFrame` takes `admin`: no last-kitchen lookup, an empty tinted panel (no picture, no app name), no kitchen head above the form. `/admin/setup` and `/admin/sign-in` pass it. Seller pages unchanged (D-051). | `src/app/SignInFrame.tsx`, `src/app/AuthRoutes.tsx`, `src/app/SignInFrame.test.tsx` | a unit test: with a last kitchen stored, the admin frame asks for no menu and shows no image or kitchen name |

## Panel size (for the admin image to come)
- Tablet and desktop (≥ 768 px wide): left column, **46 %** of the width, full window height, sticky. 1024×768 → about 471×768; 1180×820 → 543×820; 1920×1080 → 883×1080.
- Phone (< 768 px): a band on top, full width, **24 %** of the window height (390×844 → 390×203).
- The seller banner is shown whole (`object-fit: contain`) on a colour or blurred background; an admin image would follow the same rule.

## End of phase
- [ ] typecheck · `src/app/SignInFrame.test.tsx`
