# 059 · "A new version is ready" and safe refresh for home-screen apps

**Status:** approved by the standing rule (owner 2026-10-12: requests go into this round). Owner: "since some people already beta test it, if we deploy, are they going to be okay, do they need to restart? How can they refresh when they run it as a home-screen app?"
**Goal:** after a deploy, nobody is stuck on an old version. A home-screen app has no address bar or reload button, and phones keep it open in the background for days, so: (1) the app notices a newer version and shows a calm bar **"A new version is ready · Refresh"** / **"Versi baru sudah siap · Muat ulang"**; (2) if an old screen fails to load a part of the app that the deploy replaced, it reloads itself once; (3) nothing typed is lost (the bar never reloads by itself).

## Rules
- **Version check:** the build writes `version.json` (`{ "version": __APP_VERSION__ }`, never cached: `Cache-Control: no-store` via the worker or the service worker skipping it). The app checks it on start, when the app comes back to the front (`visibilitychange` → visible), and at most once every 5 minutes. Different from the running `__APP_VERSION__` → the bar.
- **The bar:** top of the screen, muted, with **Refresh** (reloads) and ✕ (hide until the next check). Seller and customer. Never shown in dev.
- **Stale chunk:** on Vite's `vite:preloadError` (a lazy part of the app missing after a deploy) → reload **once** (a `sessionStorage` guard stops loops).
- **Service worker:** today pages load network-first and `/assets` cache-first, which is fine; add `version.json` to the never-cache list. No change to push.
- EN + ID. Help topic 11 ("If something goes wrong") gets: "The app looks odd after an update? Close it completely and open it again" (iPhone: swipe up and hold, swipe the app away; Android: the square/recent button, swipe it away).

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | `version.json` at build, the check + bar (`src/components/update/`), the preload-error reload, mounted once in `src/main.tsx`; `public/sw.js` never caches it | `vite.config.ts` (emit), `src/components/update/`, `src/main.tsx` (one line), `public/sw.js`, `worker/` only if a header is needed | unit: different version → bar; same → none; ✕ hides; preloadError reloads once, not twice |

## End of phase
- [ ] typecheck · eslint · unit tests
- **Deploy impact:** none to apply. **This deploy itself:** people already running an old home-screen app get the new version the next time the app is **fully closed and reopened** (old versions have no bar yet); from this version on, the bar tells them.
