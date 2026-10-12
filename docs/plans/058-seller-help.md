# 058 · A simple Help page for sellers ("How to")

**Status:** approved (2026-10-12, owner "A" on the mock-up `temp/mockups/seller-help.html`, 11 topics; D-095) (2026-10-12, owner: "a simple Help / how-to for sellers, with the ShaggyBobo brand, especially how to add dishes, invite, etc."; this round).
**Goal:** one friendly, bilingual (EN / ID) **Help** page at a **hard-to-guess public address `/help-yw4xsvh8`** (owner, 2026-10-12: public, but not easy to find or remember; no sign-in; `noindex, nofollow` and not in any sitemap; `/seller/help` is NOT a route), ShaggyBobo-branded (the bean mascot, the happy-face logo, the beige/green palette), with short step-by-step "How to" topics in plain words and a few small pictures. Opened from the seller app: a **Help** item in the **left menu, right under Settings** (owner, 2026-10-12), More on the phone, and the sign-in page, works signed out, and can be printed.

**Where the link appears:** the left menu's **Help** (under Settings), More on the phone, the **sign-in page** ("Need help?"), the **first-setup page** where the invite key is typed ("Help with your invite key"), and the friendly **invite message** (one line: "Help: <link>"). The address is one constant in `shared/` so it can be changed later.

## Topics (short, 3–6 steps each)
1. **Get started:** sign in with your passkey; add a second device (6-digit code); install the app on your home screen.
2. **More devices and other people:** your own tablet and phone (6-digit code); someone else (invite a chef or helper; never share your passkey).
3. **Put the app on your home screen** (owner): iPhone/iPad (Safari → Share → Add to Home Screen) and Android (Chrome → Install the app / ⋮ → Install).
2b. **Add dishes:** one dish (name in one or both languages, ⇄ Translate, price, picture, chef); many at once with a CSV (Download template → fill → Import → check the preview).
3. **Make and publish a menu:** the four steps (tabs), Edit, Continue; Publish now or paused; turn "Taking orders" on.
4. **Share the menu:** the WhatsApp post; the link and its preview.
5. **Orders:** statuses, the customer's order number on WhatsApp, Print.
6. **Sell on the day:** the Sell screen (−1, set count, undo), the end-of-day summary.
7. **Your team:** invite a chef or helper (the key works once, on one device, within 24 hours); what each can do.
8. **Your kitchen:** pictures and sizes, languages for customers, pausing the kitchen.
9. **If something goes wrong:** can't sign in (recovery key from the owner/admin), WhatsApp on another device, who to ask.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 0 | **Mock-up** `temp/mockups/seller-help.html` (tablet + phone), for the owner's OK | `temp/mockups/` | owner says A |
| 1 | **The page** at `/help-yw4xsvh8` (public, noindex), topics as a list → each topic expands; EN + ID; links: a **Help** item in the left menu under Settings (every role), More on the phone, sign-in; print-friendly | `src/features/seller-help/`, routes, i18n | unit: topics render in EN and ID; links open it; works signed out |

## End of phase
- [ ] typecheck · eslint · touched unit tests
- **Deploy impact:** none (a new page only).
