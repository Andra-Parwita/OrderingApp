# 056 · Languages for customers: English and Indonesian, English only, or Indonesian only

**Status:** approved (2026-10-12, owner: "I want the seller to be able to enable only English or Indonesian only", then "A": a per-kitchen setting, this round).
**Goal:** a kitchen setting **Languages for customers** with three options: **English and Indonesian** (default, today's behaviour), **English only**, **Indonesian only**. With one language: customers see everything in it with **no language switch**; the seller fills in **one field** for each bilingual text (dish name, description, tagline, post greeting/closing, image alt); the WhatsApp post and customer messages come out in that language. The seller app's own language switch is unchanged.

## Rules
- **Storage:** migration `0013_languages.sql` adds `kitchen_settings.languages TEXT NOT NULL DEFAULT 'both' CHECK (languages IN ('both', 'en', 'id'))`. Add-only; existing kitchens stay "both".
- **One-field editing:** with one language, every bilingual pair shows one field (labelled without "(EN)"/"(ID)") and **saves the same text into both** columns. So the server contract, the CSV (matched by name + chef) and every reader keep working, and switching back to "both" shows the text in both fields, ready to translate.
- **Customers:** the customer app's language is forced to the kitchen's language and its EN/ID switch is hidden; push and WhatsApp texts use it too. "Both" = today.
- **Who:** owners change it (Settings → Kitchen, next to the WhatsApp number); the admin's kitchen Settings tab shows it read-only or editable like the other settings there.
- EN + ID for the setting's own labels: "Languages for customers" / "Bahasa untuk pelanggan"; "English and Indonesian" / "Inggris dan Indonesia"; "English only" / "Hanya Inggris"; "Indonesian only" / "Hanya Indonesia"; help: "Customers see the menu in the languages you choose. With one language you type each text once."

- **One language per dish is enough** (owner, 2026-10-12): with "both", a dish (name, description) may be filled in **only one language**; the empty one shows the other's text everywhere (already how `shared/text.ts` `pickText` displays). Today the name in English is required: change it to **at least one of the two names** (dish editor, `shared/menusContract.ts` dish/CSV validation, `shared/dishCsv.ts` so `name_en` falls back to `name_id`, and the CSV match key uses whichever name is filled). Check labels, print, the WhatsApp post and push all go through `pickText`.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Server + setting:** migration 0013; the field in kitchen settings read/write (repo, D1, mock worker, contracts); the customer menu response carries `languages`; the Settings → Kitchen control. | `migrations/0013_languages.sql`, `worker/db/` (settings), `worker/repo/Repository.ts` (settings only), `mocks/`, `shared/` settings + menu contracts, `src/features/seller-settings/` | mocks test: default both; owner sets en/id; chef/helper refused; the menu response carries it |
| 2 | **Customers:** forced language and no switch when one language. | `src/features/customer-*`, `src/i18n` (customer locale), the push/WhatsApp text builders | unit: en-only kitchen shows EN with no switch; id-only shows ID |
| 3 | **One language per dish is enough** (rule above) and **one field per text** in the seller editors (dish editor, kitchen tagline, post greeting/closing, image alt), saving both columns. **After plan 055** (shares `src/features/seller-menu/`). | `src/features/seller-menu/` (DishEditor), `src/features/seller-setup/`, `src/features/seller-settings/` | unit: id-only → one "Name" field; saving writes it to both |

## End of phase
- [ ] typecheck · eslint · touched unit tests · e2e `customer-batch1`
- **Deploy impact:** ⚠️ **one new migration (0013, add-only)**: apply it to the live D1 **before** deploying (`pnpm exec wrangler d1 migrations apply shaggybobo-order --remote`), and `pnpm db:migrate:local` on each PC. Nothing else changes for existing kitchens (they stay "both").
