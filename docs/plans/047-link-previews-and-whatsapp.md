# 047 · Link previews and a WhatsApp emoji fix

**Status:** approved (2026-10-12, owner: "A", now, before the next deploy). Seen in the owner's screenshot `temp/bug/img.png` (not in git): the WhatsApp invite shows only "ShaggyBobo's Order · order.shaggybobo.app", no picture; and "Hi Sandra! �" — the 👋 broke.
**Goal:** links the app sends or shares show a proper preview card (picture, title, description), and emojis in WhatsApp messages arrive intact.

## Causes
- The pages have no Open Graph / Twitter tags (`og:*` nowhere in `worker/pages.ts`, `worker/api/kitchenPage.ts`, `shared/kitchenHeadLinks.ts`, `index.html`), so WhatsApp has nothing to show but the title.
- Messages are sent through `https://wa.me/?text=…` (8 places in `src/`); that short link is known to break emoji on WhatsApp for desktop. The direct `https://api.whatsapp.com/send?text=…` does not.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Preview image.** `public/brand/og-shaggybobo.png`, a small square 512 × 512 (owner change: WhatsApp shows a small thumbnail for a square picture): the happy-face icon centred on the brand beige, made with sharp from `temp/shaggybobo-mascot/assets/faces/face-happy.png`. | `public/brand/` | the file exists at that size |
| 2 | **Tags in the page head** (the Worker's head rewrite, read fresh per request like plan 011/024): every page gets `og:type`, `og:site_name`, `og:title`, `og:description`, `og:image` (absolute URL, with width and height), `og:url`, and `twitter:card` = `summary`. **Kitchen and order pages:** the kitchen's name as the title, "Order from <kitchen> · Pesan dari <kitchen>" as the description, the kitchen's **app icon** (`railIcon`, 512 × 512; else the ShaggyBobo image) as the picture, not the banners. **Everything else** (invite / setup / sign-in / admin / home): "ShaggyBobo's Order" and the ShaggyBobo image. Text escaped. | `worker/pages.ts`, `worker/api/kitchenPage.ts`, `shared/kitchenHeadLinks.ts` | tests: a kitchen page's head has its name and icon URL; the setup page has the ShaggyBobo image; values are escaped |
| 3 | **WhatsApp links.** One shared helper builds `https://api.whatsapp.com/send?text=<encoded>` (and `…&phone=` where a number is used); every `wa.me` use switches to it. | `src/lib/` (or the existing shared place for links), the 8 call sites | unit: an emoji message round-trips through the helper's URL; no `wa.me` left in `src/` |

## End of phase
- [ ] typecheck · eslint · the touched unit tests and `mocks` page tests
- [ ] e2e: the specs that assert a `wa.me` href (update them), run one at a time with `--no-deps`
- [ ] after deploy, the owner sends one invite and one menu link to himself on WhatsApp and checks the card and the 👋
