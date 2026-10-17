# 092 · Remember me polish

**Status:** approved 17 Oct (owner: "we do this 092", all 10 items, as hotfix release 1.0.39 on top of 1.0.38); building. Mock-ups: `uxDesign/customer/mockups/092-remember-me-polish.html`, `092-settings-align.html` (option D). Source: the owner's first real-phone use of Remember me on live 1.0.38 (iPhone, home-screen app, passkey saved in Keeper). Rulings: D-108.

## Goal
Make Remember me (plan 087, D-107) easy to understand for customers who don't know passkeys: a named passkey, a calmer Settings page, plain wording and a readable privacy note.

## What the owner saw (17 Oct)
- The home-screen app on iPhone has its own storage, separate from Safari, so it started with no orders and no first name; the passkey was saved as just "Remember me".
- "This phone can't seal your address" showed because Keeper gives no PRF secret (expected; Apple Passwords on iOS 18+ does). "Seal" reads oddly.
- Customer Settings feels crowded; the button "I already use Remember me (e.g. in another kitchen's app)" wraps onto two lines at 390 px.
- The privacy modal is one block of text, hard to read.
- Many "ShaggyBobo" passkeys in Keeper; no way to tell which is the customer, seller or admin one.

## Items
| # | item | ruling |
|---|---|---|
| 1 | **First name before Face ID** when turning on Remember me and the name is unknown: one field "Your first name" + Skip; the name is saved with the account and names the passkey | "A" (owner 17 Oct) |
| 2 | **Address:** no new step; it is still saved with the first delivery order. Say why, plainly: "We keep your address so it's filled in for you next time." | "A"; owner: "need to be clear that we just keep your address so easy to fill up later" |
| 3 | **No app lock.** Face ID only where the saved address needs it | "A" |
| 4 | **Customer Settings tidied:** less crowded, buttons fit on one line at 390 px; mock-up first (owner's iPhone screenshot in `temp/`) | mock-up |
| 5 | **Privacy modal readable:** headings, bullet points, spacing; same content | mock-up |
| 6 | **Plain wording (EN + ID):** "lock / locked" for "seal / sealed" ("dikunci / terkunci" for "disegel / tersegel"); "6-digit code"; "ID" for "id"; "(not even us)"; ID adv3 "benar-benar kamu"; intros say "We remember your orders, name and address on this phone and on any other phone you use." / "Kami ingat pesanan, nama, dan alamatmu di HP ini dan di HP lain yang kamu pakai." (not only "a new phone"; apply to every "new phone" line) | owner: "it's odd"; owner: "remember you in this phone and new phone or other phone .. something like that" → "A" |
| 7 | **Hint when turning on (before Face ID) and in the no-lock state:** "When your phone asks where to save it, choose Passwords (iPhone) or Google Password Manager (Android). Other password apps can't lock your address." Recommend only the phone's standard manager; the web app cannot hide the other choices (iOS lists Keeper etc.) | owner "A" (passkey was in Keeper); owner: "we need to offer to use standard apple and google and not other password manager". Confirmed on the owner's iPhone 17 Oct: saved in Passwords → "address is sealed" |
| 8 | **Clear passkey names:** customer "Indra · customer (Remember me)", seller "Indra · seller", admin "Indra · admin"; no name: "Remember me · ShaggyBobo's Order", "Seller · …", "Admin · …" (built with the app's `APP_NAME`, which has the apostrophe; coordinator's call, told to the owner 17 Oct). No kitchen name: one passkey serves every kitchen. Only new passkeys get the new names | "A"; owner on skip: "remember me - ShaggyBobo Order or something like that" |

| 9 | **Bottom sheets slide up:** the shared `src/ui/patterns/BottomSheet.tsx` gets a short slide-up (~0.25 s) and a fading backdrop, none with Reduce Motion; all 6 users get it (incl. seller `PhoneOrdersScreen`, re-tested) | owner: "bottom sheet should slide up" (today none animates) |
| 10 | **Settings button groups line up:** Language, Appearance and Text size groups are different widths, so the left edges are ragged | owner: "not all same size … not align and kind of ugly"; mock-up `uxDesign/customer/mockups/092-settings-align.html`; owner picked **D** (17 Oct, "do D"): value rows "Language  English ›", "Appearance  Auto ›", "Text size  Normal ›", tap opens a **bottom sheet** (slides up, item 9) with radio choices and a hint under Auto ("Follows phone"); owner "D" over G (sub-page from the right) and E (buttons with icons) |

## Files (expected)
| item | files |
|---|---|
| 1, 7 | `src/components/remember-me/*` (turn-on flow), `src/api/customer/api.ts`, `worker/auth/webauthn.ts` (`customerLabel`) |
| 8 | `worker/auth/webauthn.ts` (`labelOf`, `customerLabel`), `shared/customerContract.ts` (`REMEMBER_ME_LABEL`) |
| 2, 6, 7 | `src/components/remember-me/i18n/en.json`, `id.json`; Help topic text if it says "sealed" |
| 4 | customer Settings route + the Remember me card |
| 5 | the privacy modal in `src/components/remember-me/` |

Items 1, 2, 6, 7 and 8 share the remember-me files, so **one builder** (sonnet) builds them all, after the mock-ups for 4 and 5 are approved.

## Stages
| # | what | who | proven by | done when |
|---|---|---|---|---|
| 1 | Mock-ups: Settings (off / on / on without PRF), the first-name step, the privacy modal; 390 px, EN + ID, AUD/Adelaide | coordinator | owner looks in their browser | owner OK |
| 2 | Build 1–8 | one builder, sonnet | typecheck; unit tests for the labels; e2e `remember-me` spec updated (first-name step, Skip) | report in |
| 3 | Gate + docs | coordinator | lint · format:check · scoped unit · the remember-me spec; captures at 390 px compared with the mock-ups | green; `pnpm run docs` |

**Deploy impact:** no migration expected (the first name already has a column), no new secret. Existing passkeys keep their old names.
