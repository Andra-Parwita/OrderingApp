# 061 · Never lose typed data

**Status:** approved (2026-10-12, owner "A"). Stages 5, 6 and 9 wait for plan 060 to finish (shared files).
**Goal:** whatever a person types in a form that has a Save or Submit button survives a reload, a closed app, a tab the phone killed, or a closed modal / slide-over, until they press Save / Submit (or Discard). One small shared hook, used form by form.

## What is lost today (survey, 2026-10-12)

Only device preferences use localStorage today (theme, language, chime, rail, first name, my orders, ...). **No form draft and no basket is stored**: the basket and checkout fields live in Redux (`customerSlice`, `checkout`), which is memory only.

| area | form (file) | typed | survives reload today? | how it is saved today |
|---|---|---|---|---|
| seller | Dish editor / New dish (`seller-menu/DishEditor.tsx`, `itemForm.ts`) | name EN/ID, description, price, chef, picture, add-to-menu | no (`useState(draft)`; closing asks "discard?") | on Save only |
| seller | Chefs modal from the dish editor (`seller-setup/ChefsScreen.tsx`) | new chef name; rename | no | each add / rename is its own request (server) |
| seller | Menu wizard steps (`seller-menu/*Step.tsx`, `menuSaga.ts`, `useMenuWizard.ts`) | dishes picked, prices, details, delivery note, pickup places | mostly yes: "Saved as you go" and a saved `wizardStep`; the free-text fields in `DetailsStep.tsx` (delivery note, place editor) are local state until their own Save | server, as you go |
| seller | Kitchen settings: name, phone, languages, first language (`seller-settings/KitchenPanes.tsx`) | text fields | no | Save button |
| seller | WhatsApp post greeting / closing (`KitchenPanes.tsx` `PostForm`) | 2 text areas x EN/ID | no | Save button |
| seller | Ordering rules + delivery note (`PreferencePanes.tsx`) | cutoff days / time, delivery note EN/ID | no | Save button |
| seller | Pickup places (`PickupPane.tsx`) | place name, address, hours, notes | no | Save per place |
| seller | Invite form (`seller-setup/TeamScreen.tsx`, `InviteBox.tsx`) | name, role, chef; message text edited before sending | no | invite request on submit (the generated link is NOT a draft) |
| seller | Customer link pane (`CustomerLinkPane.tsx`) | a customer first name for a personal link | no | local, throwaway; **no draft needed** |
| seller | New order / WhatsApp order (`seller-orders/NewOrderScreen.tsx`, `NewOrderPanel.tsx`) | first name, language, pickup/delivery, quantities, note, phone, address, paid / confirm | no | Submit |
| seller | CSV import preview (`seller-menu/DishCsvTools.tsx`) | a chosen file; preview rows | no | Import button (a file can simply be chosen again; **no draft**) |
| admin | Add kitchen (`admin/AdminHomeScreen.tsx`) | name, slug | no | Add button |
| admin | Rename kitchen (inline, same file) | name | no | Save |
| admin | Invite / key (`admin/KeyBox.tsx`) | display name, message | no | submit; **the key itself is secret and never stored** |
| admin | Setup / sign-in (`AdminSetupScreen.tsx`) | key, device name | no | **never store** (secrets). Nothing to do |
| customer | Basket (`customer-menu/BasketScreen.tsx`, `customerSlice.ts`) | quantities per dish | **no** (Redux only; a reload empties it) | memory |
| customer | Checkout (`CheckoutViews.tsx`) | fulfilment, pickup place, first name, note, address | first name only (`api/device/firstName.ts`, after a successful order); the rest no | Place order |

Needs nothing: the wizard's server-saved steps, the chef add / rename (one request each), the customer link name, CSV file choice, admin sign-in and setup.

## Rules

1. **One small shared hook** `useDraft(key, initial)` in `src/components/draft/` (hook + a tiny `draftStore.ts`; no new dependency, no circular imports). It returns `[value, setValue, { restored, discard, clear }]`.
2. **Key** = `draft:<kitchen slug>:<form>:<item id | "new">`. A new dish and an edit of dish X are different drafts; two kitchens never mix.
3. **Saves on change**, debounced about 400 ms, plus a flush on `pagehide` / `visibilitychange` (phones kill tabs). Every storage call is in try/catch (private mode, full quota); if storage fails the form still works, silently.
4. **Cleared** on a successful Save / Submit (after the server accepts, not before), and on an explicit Cancel or Discard. A close by X / Esc / backdrop does **not** clear it (that is the point). The dish editor's existing "discard changes?" dialog becomes: Keep editing / Close and keep draft / Discard.
5. **On reopening** with a draft: the form shows the draft and one calm line "Restored what you typed · Discard" (EN + ID, i18n). Discard resets to the server values.
6. **Expiry:** a draft older than 7 days is deleted when read. An empty draft (equal to the initial values) is not stored.
7. **Server is the source of truth.** The draft stores the server `updatedAt` (or a hash of the initial values where no `updatedAt` exists) it began from. If, on reopening, the server item differs, show "This changed since you started typing. Keep my version / Use the saved version" and never overwrite silently. A new (unsaved) item has nothing to compare.
8. **Never store** passkeys, admin keys, invite keys or links, session tokens, or any secret. Only the fields listed in the stages.
9. **Privacy:** drafts live on this device only (localStorage), never sent to the cloud, so "no phone numbers in the cloud" holds. The seller's New order form has a customer phone: it is stored locally on that device like any draft and is cleared on Submit / Discard / 7 days. Say this in `docs/guide` (one line) and in the Help topic if a topic covers forms.
10. Customer drafts: the basket and checkout are kept per kitchen slug and menu id; a draft for a menu that has since closed or changed is dropped (items no longer on the menu are removed from the restored basket, with the usual "changed" notice).
11. No change to wizard server saving, to API contracts, or to the database.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Shared hook.** `draftStore` (get / set / clear / expire, try/catch, versioned key prefix) and `useDraft` (debounce, flush on `pagehide`, `restored` flag, `discard`, `clear`, `baseline` for the conflict check); a small `DraftNotice` ("Restored what you typed · Discard", muted line, 1px hairline, focusable button). i18n EN + ID in a shared namespace. | `src/components/draft/useDraft.ts`, `draftStore.ts`, `DraftNotice.tsx`, `index.ts`, i18n json, tests | unit: saves after 400 ms, restores, clears, expires at 7 days, survives a thrown `localStorage`, keys do not collide across kitchens or items, empty draft not stored |
| 2 | **Dish editor.** Draft of the `ItemDraft` fields (not the picture file; keep the picture only if it is already uploaded, otherwise say nothing and let it be re-picked); key by dish id or `new`; the leave dialog gets "Close and keep draft"; clear on successful Save; conflict line when the dish changed on the server. | `seller-menu/DishEditor.tsx`, `itemForm.ts` (only if needed), `seller-menu/i18n/*.json` | reload mid-typing on New dish and on an edited dish restores; Save clears; Discard resets; a server change shows the choice. Unit + one Playwright |
| 3 | **Chefs modal.** Only the "new chef" name field (rename and delete are single requests). Key `chefs:new`. | `seller-setup/ChefsScreen.tsx` | typed name restored after closing the modal; cleared on add |
| 4 | **Wizard free text.** Delivery note and the pickup-place editor inside `DetailsStep.tsx`. Key by menu id. (Dishes, prices and step are already saved as you go.) | `seller-menu/DetailsStep.tsx` | reload restores a half-typed delivery note / place; clear on its Save |
| 5 | **Kitchen settings.** Name / phone / languages / first language pane (`KitchenPanes.tsx`) and ordering rules + delivery note (`PreferencePanes.tsx`). One draft per pane. Another builder is currently editing `KitchenPanes.tsx` and the language files (plan 060): **start this stage after 060 is merged.** | `seller-settings/KitchenPanes.tsx`, `PreferencePanes.tsx`, `settingsForm.ts` (if the draft shape needs it), i18n | reload restores each pane; Save clears; conflict check against the loaded settings |
| 6 | **WhatsApp post + pickup places.** Greeting / closing (`PostForm`, both languages) and the pickup place form in `PickupPane.tsx` (key by place id or `new`). Same 060 caution for `KitchenPanes.tsx`. | `seller-settings/KitchenPanes.tsx`, `PickupPane.tsx` | as stage 5 |
| 7 | **New order (seller).** All fields of `NewOrderScreen.tsx` and `NewOrderPanel.tsx` (one shared draft key per kitchen + menu id, so panel and screen agree). Quantities, name, note, phone, address, language, how. Clear on a created order and on Cancel. If the menu changed or closed, drop unknown dishes with a notice. | `seller-orders/NewOrderScreen.tsx`, `NewOrderPanel.tsx`, `seller-orders/i18n/*.json` | reload mid-order restores; creating the order clears; a closed menu shows the notice |
| 8 | **Invite forms.** Seller `TeamScreen.tsx` (name, role, chef) and the editable message in `InviteBox.tsx`; admin `KeyBox.tsx` (display name, message). The invite link / key is never stored. Admin add-kitchen (name, slug) in `AdminHomeScreen.tsx`. | `seller-setup/TeamScreen.tsx`, `InviteBox.tsx`, `admin/KeyBox.tsx`, `admin/AdminHomeScreen.tsx` | typed name / message restored; cleared on success; a test asserts no key or link is written to storage |
| 9 | **Customer basket + checkout.** Persist quantities and checkout fields (fulfilment, pickup place, first name, note, address) by kitchen slug + menu id: a small `redux` listener or the hook on `BasketScreen` (decide at build; the simplest is a listener on `quantitySet` / `checkoutSet`). Restore on load; drop items not on the live menu; clear on a placed order. First name keeps using `api/device/firstName.ts`. | `customer-menu/customerSlice.ts` or `saga.ts`, `BasketScreen.tsx`, `CheckoutViews.tsx`, customer i18n | reload keeps the basket and typed note; a placed order clears it; a menu change removes unknown dishes with a notice. Plan 060 touches `kitchenLanguage.ts` and customer settings only, but check for overlap first |
| 10 | **Docs and help.** One line in `docs/guide` ("drafts are local, kept 7 days"), a ruling in `docs/decisions`, the Help topic that covers forms (if any), and `docs/HANDOVER.md`. | `docs/guide/*`, `docs/decisions/README.md`, `src/features/seller-help/topics.ts` (one line, EN + ID) | docs updated |

Stages 2 to 9 each depend only on stage 1 and touch disjoint files except 5 and 6 (same file, run in order). A wave of at most 3 builders is possible for 2-4 / 7 / 8 once stage 1 is in.

## End of phase
- [ ] typecheck · eslint · prettier · unit tests for `src/components/draft`, changed features and `mocks`
- [ ] Playwright: dish editor reload, new order reload, customer basket reload (the changed specs only)
- [ ] Manual on a phone: type, background the app for a minute, return; type, close the slide-over, reopen
- **Deploy impact:** none on the server or database (no migration, no API change). Client only: after the deploy, existing users start with no drafts. Risks to watch: a stale draft shown over newer server data (covered by rule 7), and a draft restored on a shared family phone (local, cleared on Submit / Discard / 7 days). Drafts are keyed by a version prefix so a future change of shape can drop old ones safely.
