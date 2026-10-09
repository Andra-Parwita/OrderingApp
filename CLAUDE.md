# Weekly food ordering (family and friends)

A home cook publishes a menu whenever they like, for pickup or delivery on its cooking day (usually Saturday). Customers order by link in EN or ID and send their order number to the seller on WhatsApp. The seller updates statuses and customers are notified. No payments, no customer accounts, no phone numbers in the cloud. One seller, 10–50 orders a menu. Keep it simple.

## Start here (current work)

- **The app is built and runs locally** (seller, customer, admin; Cloudflare Worker with local D1/R2). Not deployed yet.
- **Now: [plan 001 · Seller app UX redesign](docs/plans/001-seller-ux-redesign.md)**, built by the owner's son from the design in [uxDesign/seller/](uxDesign/seller/README.md). The plan lists setup, the rulings it relies on and 12 stages in order.
- **Next: [plan 002 · Web push](docs/plans/002-web-push.md).** **Before any deploy to Cloudflare, remind the owner (or their son) that web push must be done first.**
- The owner is designing the customer app ([customer brief](docs/design/customer-ux-brief.md)); its redesign is a later plan.
- Each developer's PC uses its own LAN IP for the dev certificate; nothing is hard-coded ([D-053](docs/decisions/README.md)).

## Read when needed (not all at once)

| need | read |
|---|---|
| what we're building | [docs/product/overview.md](docs/product/overview.md); source of truth: [briefs/food-ordering-concept-brief.md](briefs/food-ordering-concept-brief.md) |
| stack, quality gate, testing | [docs/guide/tech-stack.md](docs/guide/tech-stack.md) |
| past rulings | [docs/decisions/README.md](docs/decisions/README.md) |
| everything else | [docs/README.md](docs/README.md) |

## Agent working conventions (mandatory)

[docs/guide/agent-working-conventions.md](docs/guide/agent-working-conventions.md) is **binding, not advice**: roles, asking, briefs, waves, blockers, verification, safety and git. **Read it in full before the first delegation of a session** and follow it. Every builder brief must restate the agent rules (§4) that apply: ownership, alone or not, verification scope, report format, and no sub-agents. If a convention gets in the way, say so and ask; don't quietly skip it.

**Token efficiency is the top priority among the conventions.** Its rules are loaded below so they are always in force:

@docs/guide/token-efficiency.md

## Implementation principles (always apply)

1. **Think before coding.** Don't assume, and don't hide confusion. State ambiguity explicitly. Present the possible interpretations instead of silently picking one. Push back if a simpler solution exists. Stop and ask rather than guess.
2. **Simplicity first.** No feature beyond what was asked. No abstraction for single-use code. No error handling for impossible scenarios.
3. **Surgical changes.** Don't improve adjacent code. Don't refactor things that aren't broken. If you see dead code, mention it and ask; don't delete it.

## Style principles (always apply to UI)

1. **Professional and subtle.** Muted colours, no saturated backgrounds, no heavy borders. Separate things with spacing or a 1px hairline.
2. **Maximise information density** while staying readable and clean.
3. **WCAG AA minimum:** 4.5:1 for text, 3:1 for large text and UI elements, and a visible focus ring.

Details are in [docs/design/README.md](docs/design/README.md).

## Always

- **Stack:** React + TypeScript (strict), Redux Toolkit + redux-saga, Vite, ESLint + Prettier, **no circular imports**, Vitest + Playwright. No new dependency without the owner's OK.
- **Plan first:** every change starts as a plan in [docs/plans/](docs/plans/README.md) with a goal and stages, approved by the owner before building ([D-055](docs/decisions/README.md)).
- **Checks:** while building a plan's stages, run **typecheck only**. The full gate (lint · format:check · test · the changed Playwright specs) runs **once, at the end of the phase**.
- **Dev is always HTTPS** (mkcert, reachable from phones on the home Wi-Fi). See [tech-stack.md](docs/guide/tech-stack.md#testing-on-real-phones-home-wi-fi).
- **Bilingual EN / ID** for every user-visible string, through i18n.
- **Open every message with a status marker:** 🔴🔴🔴 ACTION NEEDED / 🟡 HEADS UP / 🟢 NO ACTION. Ask one question at a time (A / B / C with a recommendation).
- **Commits, pushes and deploys are the owner's.** Mock-ups come before any UI build.
- **Record the owner's rulings** in docs/decisions. Keep this file short; detail goes in docs/.
