# Onde Onde customer app · handoff

Design handoff for the customer side of Onde Onde: the web app family and friends open from a WhatsApp link to order from a home cook. React web app, installable to the home screen, with web push.

## Start here

1. **See the design:** serve the `design` folder and open `index.html`:
   ```
   npx serve design
   ```
   (or `python3 -m http.server 8080 --directory design`). The boards need `support.js` beside them and won't render from file://.
2. **Read the spec:** `SPEC.md`, covering screens, states, theme, navigation, add to home screen, notifications and data rules.
3. **Using Claude Code?** `HANDOFF-AGENT.md` (renamed from CLAUDE.md so it isn't auto-loaded) tells the agent how to open the boards, find each screen, switch themes and compare the build against the design.

## Contents

- `design/`: 9 boards (`*.dc.html`), `support.js` (runtime), `assets/`, `index.html`
- `data/screens.json`: every screen id, where it is drawn, and its browser context
- `data/fixtures.json`: the sample data drawn in the design
- `data/strings.json`: English and Indonesian copy (Indonesian is a draft)
- `tokens/`: the seller app's five colour themes (light and dark), as TypeScript and CSS, plus the theme rules

## Boards

| Board | Screens |
| --- | --- |
| Main | Menu home · full picture · slide-in (motion) · dishes · how ordering works |
| MenuStates | Paused · cut-off passed · not out yet · loading error |
| Basket | Basket · pickup place · your name · delivery with error |
| Placed | Placing · order placed · QR code |
| Order | Confirmed · ready for pickup · cancel confirmation |
| MyOrders | Current and earlier · empty · earlier order · archived |
| InstallIOS | iPhone Safari: ask · 4 steps · open from home screen · step 1 in Indonesian |
| InstallOther | iPhone inside WhatsApp · Android allow · Android inside WhatsApp · Android settings · desktop |
| Notify | Off · phone's prompt · on · blocked |

## For the implementer

- The home screen icon comes from each seller's "Small icon" upload (square 512 × 512). Please provide a default icon for kitchens that haven't uploaded one.
- See `SPEC.md` section 10 for the remaining open items.
