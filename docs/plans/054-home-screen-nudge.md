# 054 · A friendly "put it on your home screen" card

**Status:** approved (2026-10-12, owner: "A", tonight). Owner: the ladies and the customers "don't understand about tech and home screen"; the app should know whether it was opened from the home screen or just the browser, and recommend it instead of people having to find it in Settings.
**Goal:** when the app is opened in a browser (not from its home-screen icon), a gentle card at the top of the first screen invites people to add it to their home screen, with one tap on Android and big, simple picture steps on iPhone. Never shown inside the installed app; "Not now" hides it for 7 days.

## Rules
- **Opened from the home screen** = `matchMedia('(display-mode: standalone)')` or `navigator.standalone` (iOS): no card.
- **Browser:** the card shows on the customer's kitchen menu (top of the first screen) and on the seller's Home (tablet) / Orders (phone).
- **Android/desktop Chrome** with an install offer (`beforeinstallprompt`): "Add to home screen" opens Chrome's install dialog. **iPhone/iPad Safari:** "Show me how" opens the existing picture steps (Share ⎙ → Add to Home Screen), pointing where Share is. **Other browsers** that can't install (e.g. in-app browsers): a short "open this page in Chrome / Safari to add it" line.
- "Not now" stores a per-device date and hides the card for 7 days (try/catch around storage; no storage = show again next visit, never an error).
- Plain words, EN + ID, no tech terms. Customer: "Put <kitchen> on your home screen · Order again with one tap and get a message when your order is ready." Seller: "Put the seller app on your home screen · Open it with one tap on cooking day."

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Shared card** built on `src/components/install/` (detect, installPrompt, InstallScreens, useInstallFlow): `HomeScreenCard` with the rules above. | `src/components/install/` | unit: hidden in standalone; Android tap calls the prompt; iOS opens the steps; Not now hides 7 days |
| 2 | **Placed** on the customer kitchen menu and the seller Home (tablet) / Orders (phone, top of the list). | `src/features/customer-menu/`, `src/features/seller-home/` or `src/app/SellerHomeRoute.tsx`, `src/features/seller-orders/` (one line each) | unit: the card renders on both; not inside the installed app |

## End of phase
- [ ] typecheck · eslint · the touched unit tests · e2e `customer-batch1` (the card must not break the flow)
- **Deploy impact:** none (display only). People who already installed see nothing new.
