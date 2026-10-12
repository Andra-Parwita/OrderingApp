# 060 · The language customers see first

**Status:** building (owner 22:12: "we can start changing stuff now and commit or push, but it won't be deployed yet") (2026-10-12, owner: "customer app should default to the language set by the seller, and then customers can change it themselves"; deployed 1.0.30 first).
**Goal:** with **English and Indonesian** (plan 056), the owner also picks **Customers see first: English / Indonesian**. A customer opening the kitchen for the first time sees that language; once they switch, their own choice is remembered and wins. "English only" / "Indonesian only" stay as they are (forced, no switch).

## Rules
- Storage: migration `0014_first_language.sql` adds `kitchen_settings.first_language TEXT NOT NULL DEFAULT 'en' CHECK (first_language IN ('en', 'id'))` (add-only). The customer menu response carries it; missing = today's behaviour.
- Customer side: "has chosen" = the customer switched language at least once on this device (a separate flag, not the shared `lang` key, so the seller app on the same device is unaffected). No choice yet → the kitchen's first language.
- Settings → Kitchen: under "English and Indonesian", a small "Customers see first" select, EN + ID, with the line "Customers can switch language; their own choice is remembered."

## Stages
| # | stage | files | done when |
|---|---|---|---|
| 1 | migration 0014, settings + menu contracts, mock worker, the Settings control | `migrations/`, `worker/db/`, `shared/`, `mocks/`, `src/features/seller-settings/` | mocks: default en; owner sets id; menu carries it |
| 2 | customer first-language rule + the "has chosen" flag | `src/features/customer-menu/kitchenLanguage.ts`, customer settings switch | unit: first visit → kitchen's first language; after a switch → the customer's choice; seller app language untouched |

## End of phase
- [ ] typecheck · eslint · touched unit tests · e2e `customer-batch1`, `native-customer`
- **Deploy impact:** ⚠️ migration 0014 (add-only) on the live D1 before deploying.
