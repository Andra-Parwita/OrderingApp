# CLAUDE.md · Onde Onde customer app handoff

You are building the Onde Onde customer app, a React web app (installable PWA with web push), so that it matches this design as closely as possible. Read `SPEC.md` first, then use the design files as the visual source of truth.

## What's here

| Path | What it is |
| --- | --- |
| `SPEC.md` | The written spec: platform, theme, navigation, every screen and state, add-to-home and notification flows, data, accessibility, open items |
| `design/*.dc.html` | The design boards. Each is a strip of phone screens (390 × 844 each) in plain HTML + inline CSS |
| `design/support.js` | The runtime the boards need to render. Keep it beside the boards |
| `design/assets/` | Banner, menu picture, wide logo, placeholder home screen icon |
| `design/index.html` | Links to every board |
| `design/canvas.json` | How the boards were laid out on the design canvas (reference only) |
| `data/screens.json` | Every screen: id, board, frame number, browser context, safe-area values, whether it's a comparable app screen |
| `data/fixtures.json` | The exact sample data drawn in the design, plus per-screen state overrides |
| `data/strings.json` | EN/ID copy keyed by screen (Indonesian is a draft) |
| `tokens/tokens.ts`, `tokens/tokens.css`, `tokens/onde-onde-theme.md` | Theme tokens shared with the seller app: 5 brands × light/dark |

## Viewing the design

The boards must be served over http (not opened as file://), with `support.js` next to them:

```
npx serve design        # or: python3 -m http.server 8080 --directory design
```

Open `/index.html`, or a board directly, e.g. `/Main.dc.html`. Each board renders its phone frames in a row.

- **Finding a screen:** `data/screens.json` gives the board and `frame`. In the rendered page the Nth phone screen is the Nth element with class `scr` (390 × 844). The desktop item on `InstallOther.dc.html` is a browser window, not a `.scr`.
- **Theme:** every board's root element has the classes `th <brand> <light|dark>` (brand: `ondeonde | bali | sumatra | sunda | jawa`). Change them in the page (e.g. set the element's className) to see any theme; all colours are CSS variables, so the whole board recolours.
- **Phone chrome is not app UI.** Hide it before comparing: `.sb, .asb, .di, .ph, .hi, .ahi { visibility: hidden !important }`. On `InstallOther.dc.html` `.ph` is the Android camera hole; elsewhere it's unused. Browser bars (`.saf` Safari, `.chrome` Chrome, `.ctab` WhatsApp in-app, and the grey bar at top: 54px on the iPhone WhatsApp screen) and system dialogs are illustrations of the browser or phone, not app UI. Ignore those regions. Set `.scr { border-radius: 0 }` for a clean rectangle.
- Fonts load from Google Fonts (Plus Jakarta Sans, IBM Plex Mono); wait for `document.fonts.ready` before capturing.

## Matching the design

1. Build the app with a **fixtures mode** (e.g. `/__fixtures/{screenId}?brand=ondeonde&mode=light`) that renders each screen in `data/screens.json` with the data in `data/fixtures.json` (apply `screenStates` for that id). That makes every state reachable for visual checks.
2. Use `env(safe-area-inset-*)` through CSS variables (`--sat`, `--sab`, see SPEC 1) so a check can set them to each screen's `safeTop` / `safeBottom` from `data/screens.json` and line the app up with the frame.
3. For each screen with `"compare": true`: capture the design's `.scr` (chrome hidden) and the app's fixture page, both at 390 × 844 with the same brand and mode, animations off. Compare them side by side or as a pixel diff, masking the browser-bar and system-dialog regions noted above. Fix the app until they match; then repeat in at least one other brand and in dark mode.
4. Check copy against `data/strings.json`, and switch to Indonesian to check nothing truncates or overlaps.

## Rules that matter most

- Theme from the seller's choice; light/dark follows the phone by default (Settings: Auto / Light / Dark).
- One filled button per screen; status always icon + word; touch targets ≥ 44 px; WCAG AA.
- Pages slide in from the right with a visible ‹ Back; tab bar on Menu, My orders, Settings.
- Never block ordering; add to home screen and notifications are optional.
- First name only; never store phone, address or email.
- Use the menu's date, never "this week" or a weekday name.
