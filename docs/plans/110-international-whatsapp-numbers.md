# 110 · WhatsApp numbers from any country

**Status:** done (2026-10-19), not committed or deployed. Approved by the builder ("A, + should be international"). Builder (urgent): "non-Australian WhatsApp numbers can be accepted".
**Today:** every phone field takes only an Australian mobile (`shared/phone.ts` `normaliseAuMobile`: `04…`, `+61 4…`). It is used for the kitchen's WhatsApp number (Settings → Kitchen, checked again on the server in `shared/sellerContract.ts`) and for customers' numbers in the seller's own contacts (New order, customer edit, contacts CSV, address book; never stored in the cloud, D-007/D-059).
**Goal:** any WhatsApp number works, for example Indonesia `+62 812 3456 7890`; Australian numbers keep working exactly as today.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **One rule in the shared code** (fixes every field at once): a number written with `+` or `00` and a country code is accepted as international, 8–15 digits in all (the WhatsApp/E.164 limit); `04…` and `+61 4…` stay Australian mobiles as today; stored as digits with the country code, as today (`wa.me` needs exactly that). `formatPhone` keeps the `+61 412 345 678` look for Australian numbers and shows others as `+62 812…` grouped. The function is renamed `normalisePhone` and every caller updated. | `shared/phone.ts` (+ test), `shared/sellerContract.ts`, the 8 callers in `src/features/seller-orders/` and `src/features/seller-settings/` | tests: `+62 812 3456 7890`, `0062…`, `+44 7700 900123` accepted; `0412 345 678` and `+61 412 345 678` as today; too short/long, letters, `+61 2…` landline refused |
| 2 | **Wording** (EN/ID): "WhatsApp number. Australian mobile like 0412 345 678, or another country with + (for example +62 812 3456 7890)." in the 5 helper/error texts. | seller-orders and seller-settings i18n | the texts show in both languages |

## End of phase
- [x] typecheck · lint/format on changed files · `shared/phone` and the seller-orders, seller-settings unit tests · e2e `seller-settings-batch2` (it saves a WhatsApp number)

## Decisions and notes
- D-111: `+` or `00` means international; a number starting with `0` stays an Australian mobile.
- Gate (2026-10-19): typecheck, eslint and prettier on changed files; unit 399/399 (shared/phone, sellerViews, seller-orders, seller-settings, customer-menu, seller-share); e2e `seller-settings-batch2` passed. Non-Australian numbers display as `+` + two digits + blocks of four (e.g. `+62 8123 4567 890`): cosmetic, the country-code length is not known.
