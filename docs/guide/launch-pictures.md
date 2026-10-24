# Launch pictures (iOS)

A launch picture is the full-screen image iPhone shows while a home-screen app starts. It is iOS only: Android uses the manifest colour and icon.

- **Current kind:** `kitchen` (dark spotlight, ShaggyBobo icon and name). Settings: `scripts/startup-images/kitchen.json`. Pictures: `public/startup/kitchen/startup-<w>x<h>.png` (about 130-150 KB each, committed). Links: `index.html`.
- **Make or remake a set:** `node scripts/make-startup-images.mjs <kind>` (default `kitchen`), then commit the PNGs. Needs internet once for the font. Running it twice gives the same bytes.

## A new app kind (store, events)

1. Copy `scripts/startup-images/kitchen.json` to `store.json`; change colours, icon path, name, font.
2. Run `node scripts/make-startup-images.mjs store`. Pictures go to `public/startup/store/`.
3. In that app's HTML page add a block of `apple-touch-startup-image` links to `/startup/store/startup-<w>x<h>.png` (copy the kitchen block), plus `apple-mobile-web-app-capable`.
4. Extend `src/app/startupImages.test.ts` if the new page is a separate HTML file.

## A new iPhone size

Add `[width, height]` (CSS px, portrait, 3x) to `sizes` in `scripts/make-startup-images.mjs`, run the script, add the matching `<link>` (same `media` pattern) in every page that uses the kind. `pnpm exec vitest run src/app/startupImages.test.ts` checks links, files and pixel sizes.

## Good to know

- iOS needs an exact match of device width, height and pixel ratio. A device with no match just shows black at launch.
- Check on an iPhone: remove the home-screen app, add it again, open it. iOS caches launch pictures, so an old install keeps the old picture.
