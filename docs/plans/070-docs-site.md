# 070 · A branded HTML docs site, kept current

**Status:** approved (2026-10-13, owner "A", D-098: dev-only `marked` + `mermaid`). Owner: "I need an HTML view of the docs for easy reading, not just the md; better visualisation of the architecture, message sequences and the main UX flows; ShaggyBobo branding on each page; and in Claude we always need to update this."
**Goal:** the project docs (architecture, data model, API, sign-in, product overview, **roadmap** ([product/roadmap.md](../product/roadmap.md): Square payments, a simple store, events/ticketing), **how the source is kept** ([architecture/source-layout.md](../architecture/source-layout.md): folder structure, layering rules, how to add things, what to watch when restructuring later; owner 13 Oct), decisions, plans index, the guides) as a small **HTML site**: ShaggyBobo header (logo, mascot, palette), a left menu, search, EN text as written; **diagrams** for the architecture (browser ↔ Worker ↔ D1/R2/Durable Object/AI), **message sequences** (place an order → seller notified → status → customer push; seller sign-in with passkey; invite → setup; publish menu; offline/retry), and the **main UX flows** (customer: menu → basket → order → My orders; seller: make menu → publish → orders → hand over/sell; admin: kitchen → invite). Built from the Markdown so there is one source; rebuilt by one command; and a standing rule that every change that touches these topics updates the docs.

## Rules (proposed)
- Source stays Markdown in `docs/`; diagrams are Mermaid blocks inside it (so GitHub shows them too).
- `pnpm run docs` builds `docs/site/` (HTML + CSS + the brand images); a small Node script; light and dark; WCAG AA; works offline once built.
- **Not public**: it describes routes and sign-in internals. Viewed on the PC (and by the builder after pulling), not served by the live app.
- **Kept current**: CLAUDE.md gets a rule: any change to `migrations/`, an API route, a role rule or a main flow updates the matching doc page (and its diagram) in the same change, and `pnpm run docs` is run at the end of the phase.

## Stages (sketch)
| # | stage |
|---|---|
| 1 | the builder script + branded page template + left menu + search; the existing pages rendered |
| 2 | diagrams: architecture, 5 message sequences, 3 main UX flows (Mermaid, in the Markdown) |
| 3 | the CLAUDE.md rule + a line in the agent conventions' end-of-phase checklist |

## Needs the owner's OK
- **New dev-only libraries** (CLAUDE.md: "no new dependency without the owner's OK"): a Markdown renderer (`marked`) and the diagram renderer (`mermaid`). Dev-only: never shipped in the app.
- **Deploy impact:** none (the site is not deployed).
