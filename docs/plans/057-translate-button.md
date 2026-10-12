# 057 · A ⇄ Translate button for dish texts

**Status:** approved (2026-10-12, owner: "A", Cloudflare's translator, this round).
**Goal:** next to each bilingual text the seller types (dish name, dish description; later tagline and post texts), a small **⇄ Translate** button fills the other language from the one typed (EN→ID or ID→EN). The seller sees the result in the field and can fix it before saving; nothing is saved automatically. Only the dish text is sent: no names, no phone numbers.

## Rules
- **Server:** `POST /api/seller/translate {text, from: 'en'|'id', to: 'en'|'id'}` → `{text}`. Signed-in owner or chef (helpers 403). Text ≤ 500 characters. Uses the **Workers AI** binding (`AI`, model `@cf/meta/m2m100-1.2b`), set in the wrangler config; no npm dependency, no secret.
- **Cost cap:** at most **100 translations per kitchen per day** (counted in the kitchen's existing SellerLive Durable Object storage, key `translate:<yyyy-mm-dd>`; no migration); over the cap → 429 `translate_limit`, the button says "Translation is resting for today. Type it yourself." Cloudflare's free daily allowance covers far more than this.
- **When unavailable** (no AI binding, e.g. local dev without Cloudflare login, or the AI errors): `503 translate_unavailable`; the button shows a calm one-line message and never retries by itself. Agents never call the real AI: tests use a fake binding.
- **UI:** the button sits next to the empty field's label ("⇄ From Indonesian" / "⇄ Dari Inggris"); shown only when the other field has text and the kitchen's languages are "both" (plan 056). EN + ID.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Route + binding + cap** in a new `worker/api/translate.ts` (one registration line in routes), the wrangler `ai` binding, the error codes in `shared/apiError.ts` + `worker/api/respond.ts`, the client call, and a reusable `TranslateButton` in `src/components/`. | `worker/api/translate.ts`, `wrangler.*` (ai binding), `shared/apiError.ts`, `worker/api/respond.ts`, `src/api/`, `src/components/translate/` | mocks/unit with a fake AI: owner/chef ok, helper 403, too long 400, cap 429, no binding 503 |
| 2 | **Wired into the dish editor** (name, description). After plans 055 and 056 stage 3 (shares `src/features/seller-menu/`). | `src/features/seller-menu/` | unit: typing ID then ⇄ fills EN; the error line shows on 503/429 |

## End of phase
- [ ] typecheck · eslint · touched unit tests
- **Deploy impact:** ⚠️ the wrangler config gains an **AI binding** (Workers AI). No migration, no secret. Billing: on the Workers **Free** plan, going over the free daily allowance makes translations fail (button shows "resting"), **no charge**. On the **Paid** plan, usage beyond the free daily allowance is billed per use; the 100-a-day cap per kitchen keeps it at about nothing. The builder checks the account's plan before deploying.
