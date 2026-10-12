# 060 · The language customers see first

**Status:** building (owner 22:12: "we can start changing stuff now and commit or push, but it won't be deployed yet") (2026-10-12, owner: "customer app should default to the language set by the seller, and then customers can change it themselves"; deployed 1.0.30 first).
**Goal:** with **English and Indonesian** (plan 056), the owner also picks **Customers see first: English / Indonesian**. A customer opening the kitchen for the first time sees that language; once they switch, their own choice is remembered and wins. "English only" / "Indonesian only" stay as they are (forced, no switch).

## Rules
- Storage: migration `0014_first_language.sql` adds `kitchen_settings.first_language TEXT CHECK (first_language IS NULL OR first_language IN ('en', 'id'))` (add-only, nullable, no default: NULL = the seller has not chosen). The customer menu response carries it only when chosen; missing = today's behaviour (the phone's own language). A settings PUT with `firstLanguage: null` clears it; omitted keeps it (owner ruling 13 Oct, D-096).
- Customer side: "has chosen" = the customer switched language at least once on this device (a separate flag, not the shared `lang` key, so the seller app on the same device is unaffected). No choice yet → the kitchen's first language, only if the seller picked one; otherwise the phone/saved language is left alone.
- Settings → Kitchen: under "English and Indonesian", a small "Customers see first" control with three options, **Phone's language** (default, = not chosen) / EN / ID, with the line "Customers can switch language; their own choice is remembered."

## Stages
| # | stage | files | done when |
|---|---|---|---|
| 1 | migration 0014, settings + menu contracts, mock worker, the Settings control | `migrations/`, `worker/db/`, `shared/`, `mocks/`, `src/features/seller-settings/` | mocks: default not chosen (menu omits it); owner sets id; PUT null clears |
| 2 | customer first-language rule + the "has chosen" flag | `src/features/customer-menu/kitchenLanguage.ts`, customer settings switch | unit: first visit → kitchen's first language; after a switch → the customer's choice; seller app language untouched |

## End of phase
- [ ] typecheck · eslint · touched unit tests · e2e `customer-batch1`, `native-customer`
- **Deploy impact:** ⚠️ migration 0014 (add-only, nullable column, no default) on the live D1 before deploying; existing kitchens stay on the phone's language until the seller picks one.
