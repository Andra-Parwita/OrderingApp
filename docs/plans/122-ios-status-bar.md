# 122 · iPhone status bar: the banner runs to the top edge

**Target: 1.0.44.** **Status:** mock-up approved 24 Oct (owner "A"): `uxDesign/customer/mockups/122-status-bar.html`. Building.
**Owner:** "can we actually also control the bg colour on the iPhone top header that has the status bar, battery indicator part?" · "in DellaVee the banner is dark, so in light mode the image is kind of under the status bar; can the image stretch to the top too?" · "A".

## What
- **Customer pages only** (kitchen and order pages, the head the Worker writes): `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`. Seller and admin pages keep today's bar (their layouts are not built for it).
- The page draws under the status bar; status-bar text is white on iOS home-screen apps.
- **Banner pages:** the shell banner grows by `env(safe-area-inset-top)` so the picture runs up behind the clock; content below starts where it does today.
- **Soft fade** behind the clock (60 px, rgb(20,17,12): .62 → 0) so white text reads on light banners (~4–6:1).
- **Pages without a banner:** a thinner, softer fade, just enough for the clock to read (owner "A").
- **Cold start:** the dark-spotlight launch picture and splash already fill the top.
- Browsers and Android are unchanged (they use `theme-color`). iOS reads this setting when the app is added: existing installs see it after re-adding (lesson 44).

Also in this change: one line in the "Start fresh" help and the WhatsApp guide (EN/ID): "To get the new start screen: remove the app, open the link in Safari, pull down to refresh, then Add to Home Screen."

## Proof
Unit: the head of kitchen and order pages has the meta, seller pages do not; the banner height adds the safe area. e2e: kitchen-links (meta in served HTML), customer-batch1, native-customer (iphone-chromium). Owner check on the iPhone after re-adding the app.

## Follow-up (owner, 25 Oct)
- The first build filled the clock area with the banner's background **colour**. Stretching the picture itself would crop ~15% at each side on a Pro Max (3:1 box + 62 pt → ×1.42), cutting edge text such as logos. Owner: "do that blurred image" — the clock area shows a soft, blurred, enlarged copy of the same banner picture; the real banner stays fully visible.
- An always-on thin fade behind the clock in the iPhone app (also after the banner scrolls away).
- Basket and edit-order headers no longer add the safe area twice under the banner.
- **Final choice (owner, 25 Oct): "A4"** after comparing `uxDesign/customer/mockups/122b-status-bar-options.html`: the clock area shows the kitchen's own **banner background picture** (`bannerBackgroundImage`, Settings → Kitchen → Pictures), cover-fitted into the strip; kitchens without one get the blurred copy of the banner; with no pictures at all, the colour band.
- **Later option (owner, 25 Oct: "A for now"):** a taller phone banner, 1200 × 570 px (~2.1:1): the bottom 1200 × 400 is today's banner (text, logos, faces stay there); the top ~170 px shows only behind the clock in the iPhone app and is trimmed elsewhere. Needs the upload to accept that shape and a guide picture. Not in 1.0.44.
