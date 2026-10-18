# 095 · Clearer notice bars (new version, announcement, maintenance)

**Status:** approved 18 Oct (owner picked **E2**); building with 1.0.41. Mock-up: `uxDesign/seller/mockups/095-notice-bars.html` (option E, variant E2).

## Goal
Owner, 18 Oct: "When there is update or new version available or announcement bar, the bar is not clear enough, can you make it better colour and always has the shaggybobo icon on the banner? It's ok to make it like 40px tall, so easy to tap to refresh." Then: "the Refresh is also too close to the ✕"; "we could also simply use Refresh link style instead of button"; picked "E2".

## Today
- New version: `src/components/update/UpdateBar.tsx` (~30 px, `surf2`, only the small "Refresh" text is tappable).
- Maintenance: `src/components/maintenance/MaintenanceHost.tsx`; admin short message: `src/components/maintenance/NoteHost.tsx` (bubble look, `theme.bubble`).

## Change (option E2, customer and seller apps)
| # | item |
|---|---|
| 1 | All three bars: a floating pill (rounded, soft shadow, 6 px from the edges), 40 px tall, ShaggyBobo icon (24 px, `public/brand/logo-icon.webp`) at the left, one line of text (ellipsis), ✕ with a 40×40 tap area and ≥16 px space before it |
| 2 | New version: solid green pill (light `#1F6B5C`-family / dark light-green, exact values from the mock-up, as theme tokens), "Refresh" as bold underlined link text; **the whole bar refreshes on tap** (✕ only hides) |
| 3 | Announcement / short message and maintenance: soft amber pills (light and dark tokens from the mock-up) |
| 4 | Contrast ≥ 4.5:1 for text, link and ✕ in both modes (as measured in the mock-up); visible focus ring; the bar is a button with an accessible name ("A new version is ready. Refresh") |
| 5 | The top-bar height registration (`useTopBar`) reports the new height so pages shift correctly |

## Gate (scoped)
typecheck · lint/format changed files · unit of update + maintenance components · e2e specs that show these bars (short-message, maintenance, any update-bar spec) · captures light/dark at 390 px and seller tablet.

**Deploy impact:** client only; no migration, no secret.
