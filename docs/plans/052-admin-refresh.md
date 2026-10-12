# 052 · Admin page: "Last updated" and a Refresh button

**Status:** approved (2026-10-12, owner: "I would prefer in admin page to show a banner when last updated and have a refresh button, and don't let it click refresh more often than 1 minute"; in this round).
**Goal:** the admin page shows when its data was loaded and refreshes on demand, at most once a minute.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Last updated + Refresh.** A line at the top of the sellers panel: "Last updated 19:42 · 2 minutes ago" (the relative part ticks each minute) and a **Refresh** button that reloads the seller list with summaries, the Problems list and the open seller's panel (people, invites), without a page reload. After a refresh the button is disabled for 60 s with a countdown ("Refresh in 45 s"). EN + ID. | `src/features/admin/AdminHomeScreen.tsx` (+ the panel's load hooks), admin i18n | unit (fake timers): the time shows; Refresh reloads all three; disabled for 60 s, enabled after; the open panel reloads |

## End of phase
- [ ] typecheck · eslint · `src/features/admin` unit tests · e2e `admin` (`--project=auth-desktop-chromium --no-deps`)
