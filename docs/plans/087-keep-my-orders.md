# 087 · Keep my orders: optional, privacy-first (customers)

**Status:** draft analysis (17 Oct, Fable agent, read-only); owner questions next. Not approved for building.
**Owner, 17 Oct:** "think about customers having social login via Apple ID or Google ID, etc., or maybe passkey, so they can keep their data easily but still private enough"; "we don't need email link"; "the idea is that My orders can be easily found or retained"; "and all are optional for user".

## Today
My orders, the first name, the delivery address and per-kitchen customer codes live only in the browser (`src/api/device/*`). A new phone or cleared browser loses them; one order can be found again by its WhatsApp link or code + first name (D-075).

## Owner rulings
- **Passkey + first name** (owner "B", 17 Oct): stage 1 keeps the order list and the first name.
- **Saved delivery address, 30 days** (owner, 17 Oct: "ideally the stored address that is kept could also be matched for 30 days … if older or no order in the past 30 days, the address is deleted"): the customer's saved address may be kept with their passkey, deleted when they have had no order for 30 days. **Protection: sealed with the customer's passkey** so the server cannot read it (owner "A", 17 Oct). Flow: the customer's phone unlocks it with the passkey, checkout (Delivery) is pre-filled, and on ordering the address travels inside the order exactly as today (encrypted with `ADDRESS_KEY`, team-only, deleted a day after the menu). Phones without the passkey PRF feature: keep the address on that phone only. today's rules for comparison: order addresses on the server are deleted a day after the menu (D-099), the customer's own saved address stays on their phone with no expiry, the seller's address book stays on the seller's device (D-059).
- **Stable per-kitchen customer code + confirmed mark** (owner "A", 17 Oct: "generate some unique id and then the seller actually knows this customer id … and the seller can be more sure about the confirmation"): with the passkey, the plan 071 per-kitchen customer code is tied to the passkey account, so it is the same on every phone (e.g. C-7K3M); orders placed while unlocked carry "✓ Passkey-confirmed · C-7K3M" for the seller. The code differs per kitchen (kitchens can't link a customer across kitchens); no name, phone or email behind it.
- **Recommend it, gently, with the why** (owner, 17 Oct: "in the customer app, recommend to use passkey and explain the advantage and security"). Draft card (Settings, and the quiet hint after an order):
  - EN: **Keep your orders on all your phones (optional).** Turn on a passkey and your orders, name and saved address follow you to a new phone. **Why it's safe:** no email, no password, no phone number; it unlocks with your face or fingerprint; your saved address is sealed so only your phones can read it (not even we can); it's deleted if you don't order for 30 days, and you can delete it any time. Ordering without it works just the same.
  - ID: **Simpan pesananmu di semua HP-mu (opsional).** Nyalakan passkey, dan pesanan, nama, serta alamat tersimpanmu ikut ke HP baru. **Kenapa aman:** tanpa email, tanpa kata sandi, tanpa nomor HP; dibuka dengan wajah atau sidik jarimu; alamat tersimpanmu disegel sehingga hanya HP-mu yang bisa membacanya (kami pun tidak); dihapus kalau kamu tidak pesan selama 30 hari, dan bisa kamu hapus kapan saja. Pesan tanpa ini tetap bisa seperti biasa.

## Options (email ruled out)
| | Passkey vault (A) | Apple / Google (B) | Move to another phone, QR (D) |
|---|---|---|---|
| Personal data we get | none (random id + passkey public key) | Apple/Google id, email (Apple can hide it), name | none |
| Cloud holds | an encrypted "vault" only the customer's devices can read | account + provider id (+ email) + vault | nothing |
| Cost / setup | A$0, reuses the seller passkey code, no secrets | US$99/yr Apple developer, Google console, privacy policy, 2–4 secrets | A$0 |
| Effort | M | M each, L with compliance | S |

## Recommendation (Fable): D first, then A; B not now
1. **Move my orders to another phone** (QR / short code between two phones; no cloud data).
2. **Optional passkey "vault"**: the device encrypts My orders (+ name, saved address, customer codes) and the server stores only the ciphertext (≤ 8 KB) + an opaque id + passkey public key; idle 12 months → deleted; "Delete my saved data" removes everything. The server never gets a customer → orders list, so kitchens can't link a person across kitchens.
3. Apple/Google only later if Square needs a receipt email, as a second way in, never the only one.
- Everything optional: ordering, links and My orders on the same phone work as today; gentle offers only (Settings card; one quiet line after an order; "Had orders on another phone? Restore them" on an empty My orders).
- Privacy text changes: About "No sign-ups. Ever." → "No sign-ups needed … optional passkey, no email, no password"; Settings "No accounts …"; brief and overview lines; a decision amending D-007/D-090 for customers.

## Open questions (Fable's recommendation first)
1. When: stage 1 (QR move) now, passkey after store mode / both now / wait for Square.
2. Cloud content: server-blind encrypted vault / plain token list / both.
3. Lost passkey with no synced copy: accept the loss (links still work; tokens expire in 4 weeks) / printable recovery code / seller-assisted.
4. Apple/Google: only with Square receipts / never / now.
5. Long-term saved address: vault only / also on the server / device only.
6. Staff who are also customers: a separate customer passkey / one shared account.

## Stages (sketch)
| # | stage | size | deploy impact |
|---|---|---|---|
| 0 | decision + privacy text + docs | S | none |
| 1 | QR / 8-character code transfer between two phones | S | none |
| 2 | passkey vault (migration, `/api/customer/auth/*`, vault, Settings card, nudges, delete, idle sweep) | M–L | one migration, no secrets |
| 3 | "Turn on updates here too" on a restored device | S | none |

## Second pass (same agent, after "the idea is that My orders can be easily found or retained" and "all optional")
- Ranking for that goal: **passkey (A)** — survives a cleared browser AND a new phone (passkeys sync in iCloud Keychain / Google Password Manager), zero personal data — > QR move (D) — zero cloud, but needs the old phone in hand — > Apple/Google (B) — same result with emails, money and reviews.
- **Minimal stage 1 = passkey "Keep my orders", order list only:** cloud tables `customer_accounts` (opaque id, created/last used; deleted after 12 idle months or "Delete my data"), `customer_passkeys`, `customer_order_links` (token + kitchen, removed with the order details after 4 weeks), `customer_sessions` (separate cookie from sellers'). No name, email, phone or address in the cloud; name, address and customer codes stay on the device (D-059, D-099 untouched). Push on a restored device re-subscribes active orders through the existing route.
- Trade-off to record: the server (not any kitchen) can see one opaque account ordered at two kitchens; sellers never see the account. Optional later: encrypt the list with the passkey's PRF key.
- QR carry-over becomes stage 2 only if asked; Apple/Google stage 3 only on real demand.
- Revised questions: 1 method first (passkey only / Apple+Google / both); 2 what syncs (order list only / + name and codes / + address); 3 fallback (QR later / none / password); 4 retention (links with the order, account 12 idle months / forever / 6 months); 5 where offered (Settings + empty My orders + one hint after the 2nd order / Settings only / every order); 6 cross-kitchen linkability on the server (accept + document / PRF-encrypted / one account per kitchen).

## Third pass (after "all optional")
Same recommendation (passkey, order tokens only). Additions: call it **"Keep my orders on all my devices"**, never "account"; separate tables and cookie (`__Host-customer`) so a customer can never reach seller routes; recovery via a 6-digit "add this phone" code from a signed-in device (stage 2), like sellers have; label passkeys clearly ("Jo · my orders") because a staff passkey on the same site appears in the same picker; About bullet becomes "No sign-ups needed …". Stages: 0 decision + texts (S), 1 passkey keep-list (M, one migration, no secrets), 2 second device + push re-subscribe (S), 3 optional name/customer-code sync (S).
