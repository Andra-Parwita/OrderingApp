# 102 · Android customer app: one install choice, one icon per kitchen, orders inside the kitchen

**Target: later** (owner, 20 Oct: "start with 114/115 and decide 101/102 later"; Fable risk review: docs/reports/2026-10-20-101-102-risk.md).
**Status:** analysis, owner 18 Oct, **not approved**. No app source was changed. Mock-up: `uxDesign/customer/mockups/102-android-install.html`. Aligns with plan 101 (seller app per kitchen, same day) and builds on plan 068 (manifest id per kitchen).
**Owner, 18 Oct:** "iPhone is fine; the problem is Samsung/Android." (1) Installing the app is confusing, Chrome offers more than one way: **just one choice** to make the app. (2) On Android the installed app's icon is the first kitchen's, not the one being installed. (3) "maybe use one passkey". (4) "we may have to allow seeing orders only per kitchen or all, thus change the route of the order." (5, beta) "since we have a beta trial, it's important to also let them know how to reset or delete."

## Findings (file:line)

### 1 · Why Android can give the first kitchen's icon
Not the cause: `index.html:3-14` has no manifest or icon link at all (nothing static to leak); icon URLs carry the slug (`shared/kitchenManifest.ts:19-21`), so no cache collision between kitchens; ids differ per kitchen (`kitchenManifest.ts:124`, plan 068).

Candidates, most likely first:
| # | cause | evidence | how it gives the wrong icon |
|---|---|---|---|
| **1** | **Every kitchen's manifest has `scope: "/"`** | `shared/kitchenManifest.ts:128` (`scope: seller ? '/seller' : '/'`) | The first WebAPK (Dellavee) claims the **whole origin**. Chrome/Android treat `/onde-onde` as inside the installed Dellavee app: the menu can offer "Open in Dellavee" instead of Install, links open in the Dellavee app, and "Add to home screen" can resolve to the already-installed app's identity. Plan 068 fixed the **id** only, not the scope. |
| 2 | **My orders / Settings / root install the *last visited* kitchen, not the shown one** | `src/components/install/manifestLinks.ts:37-39` (`lastSlug`), `src/api/device/lastKitchen.ts:12-27`; `worker/api/kitchenPage.ts:37-38` returns `null` for these paths, so the server HTML has **no manifest link** and React adds it after load | Installing from `/settings` (Settings "Install" row, `CustomerSettingsView.tsx:250,286`) uses the kitchen visited last in that browser |
| 3 | Manifest link **swapped by JavaScript** after load; **one** saved install event | `manifestLinks.ts:53-63,78-90` (`useEffect`); server head only for `/<slug>` and `/o/<token>` (`kitchenPage.ts:39-65`, `kitchenHeadLinks.ts:57-65`); on `/` (`pages.tsx:146-156`) `<Navigate>` jumps to the remembered kitchen inside the SPA; `installPrompt.ts:16-26` saves the **first** `beforeinstallprompt` and `promptInstall` (`:29-40`) uses it | The document Chrome parsed on `/` never had a kitchen manifest; after a hop between kitchens the button can install the kitchen whose event fired first |
| 4 | Kitchens **without an upload share one icon file**; the PNG route answers a **302** | `worker/api/kitchenRoutes.ts:128-135` (`defaultIconRedirect`), `kitchenManifest.ts:39` | Not "first kitchen's", but two kitchens without uploads look identical; a redirect on a manifest icon can make WebAPK minting fall back to a letter icon (the same suspicion plan 101 records from plan 048) |
| 5 | Manifest `type` follows the upload (`kitchenManifest.ts:116`), same file declared as 192, 512 and 512 maskable (`:117-121`) | | A JPEG or non-square upload declared as PNG may be rejected by minting. Low |

**Most likely cause: 1 (shared scope `/`), with 2 and the single saved install event as the ways a person ends up installing the wrong kitchen.** The code cannot confirm Chrome's exact "already installed" logic; it needs a phone.

**How to prove it on a real phone (builder, about 20 minutes, Android Chrome):**
1. Fresh Chrome profile (or uninstall both). Open `https://order.shaggybobo.app/dellavee`, look at the menu entry (Install app or Add to home screen). Install. Note the home icon.
2. In **Chrome (not the app)** open `/onde-onde`. Does the menu say "Open in Dellavee" or still "Install app"? What icon does installing give? (cause 1)
3. `chrome://webapks` lists the minted WebAPKs with manifest URL, scope and id: two entries? which manifest URL and icon each?
4. From WhatsApp tap an Onde Onde order link: does it open in the Dellavee app (title bar, icon)? (scope capture)
5. Repeat step 2 installing from `/settings` after visiting both kitchens. (cause 2)
6. `chrome://inspect`, `Page.getInstallabilityErrors` on each kitchen page (as plan 048 stage 2), and the headers of `/k/onde-onde/icon-192.png` (302? content type?).

### 2 · Scope today and what falls outside
Customer manifests are scoped `/` for **every** kitchen (`kitchenManifest.ts:128`); the start URL may be `/<slug>`, `/<slug>/...` or `/o/...` (`safeStartUrl`, `:76-84`). So today **nothing** is outside the scope; the problem is the opposite: every kitchen app (and the area `/seller`, though a seller WebAPK with the smaller scope `/seller` should win its own links) lies inside Dellavee's scope. Android hands a link to `order.shaggybobo.app/...` to **some** installed app, and the page cannot choose which.
If the scope is narrowed to `/<slug>/` (option A), these URLs fall **outside** every kitchen app: `/o/<token>`, `/my-orders`, `/settings`, `/`. In a WebAPK an out-of-scope navigation opens a **Chrome Custom Tab with a URL bar** over the app, which breaks the tab bar feeling (`CustomerShell.tsx:21-22`, `activeTab` `:42-43`). This is what the owner foresaw.

Where those URLs come from:
| place | file:line |
|---|---|
| routes | `src/app/customerRoutes.tsx:234-240` |
| WhatsApp message link | `src/api/device/whatsapp.ts:29` |
| copy-link in the install flow | `src/components/install/useInstallFlow.ts:92` |
| push click URL | `worker/push/dispatch.ts:113` (`data.url = /o/<token>`), opened by `public/sw.js:107-115` |
| order page head, start URL `/o/<token>?source=homescreen` | `worker/api/kitchenPage.ts:53-65`, `manifestLinks.ts:35` |
| tab bar, banner | `CustomerShell.tsx:21-22,42-43`, `ShellBanner.tsx:44-102` |
| links already sent (WhatsApp, notifications) | `/o/<token>` must keep working forever |

### Route options
| | A. per-kitchen paths | B. scope `/` for all (today) | C. keep, fix install only |
|---|---|---|---|
| shape | `/<slug>/o/<token>`, `/<slug>/my-orders`, `/<slug>/settings`; `scope: "/<slug>/"`, `start_url: "/<slug>"` | all apps share one scope | keep `/o/`, `/my-orders`, `/settings`; add `?k=<slug>` where a kitchen is needed |
| Android link capture | disjoint scopes: a Dellavee link can only open the Dellavee app | ambiguous | ambiguous |
| icon cause 1 | **fixed at the root** | stays | stays (2 and 3 fixed) |
| old links | `/o/<token>` redirects to `/<slug>/o/<token>` | none needed | none needed |
| size | **M-L** | 0 | S |
| risk | medium: router, links, push, tests | none | the icon complaint may remain |

**Size of A:** routes: 3 route groups under `/:slug/`, keep `/o/:token*`, `/my-orders`, `/settings` as redirects (`customerRoutes.tsx:234-240`, `AppRoutes.tsx:20-26`); a helper `orderPath(slug, token)` for the ~9 `navigate('/o/...')` sites (`customerRoutes.tsx:99,123,124,140,150,151,170-172,220`); tab bar hrefs and `activeTab`/`hasTabBar`/`isRootPage` read the slug from the path (`CustomerShell.tsx`, several blocks in `CustomerShell.test.tsx`); WhatsApp link (`whatsapp.ts:29`) and copy link (`useInstallFlow.ts:92`); push `data.url` (`dispatch.ts:113`; the dispatcher knows the seller; `liveConnection.ts:63` must accept both forms); head builder (`kitchenPage.ts:53-65`, `kitchenPageTarget` `kitchenHeadLinks.ts:42-46`) and `safeStartUrl`; `scope`/`start_url` in `buildManifest`. e2e: 5 specs mention `/o/`. Reserved slugs: `o`, `my-orders`, `settings` must stay unusable as slugs (`shared/seller.ts:12` `RESERVED_SLUGS`; `dishes`, `basket`, `how-it-works` are existing sub-paths, no clash).
**Old order links in WhatsApp keep working:** `/o/<token>` stays a route; the Worker already finds the seller by token (`kitchenPage.ts:53`), and the SPA does `<Navigate replace>` to `/<slug>/o/<token>`. Installed apps keep their **id**, so they update in place (a scope change can take days to reach a phone; people with a wrong icon reinstall, see section 6).
**Recommendation: A**, in two cuts so the risky part ships second (stages 1-3 first fix install and icons; stage 4-5 move the routes after the phone proof).

### 3 · My orders: per kitchen or all
Today (plan 068 and its 17 Oct follow-up): the app's kitchen first, "Other kitchens (N)" folded; in a browser tab all orders newest first. With A, an order of another kitchen opens `/<other>/o/<token>`, **outside this app's scope**, so Android opens a Custom Tab.
- **A1 (recommended): this kitchen only inside the app;** the "all kitchens" list (with the fold) lives in the browser tab at `/my-orders`. Honest to the app boundary.
- A2: keep the fold in the app; other kitchens' orders open in the browser with a note. Works, but looks broken.

### 4 · One way to install (Android)
Every install entry today:
| entry | file:line | Android without a prompt |
|---|---|---|
| Home screen card on the menu | `HomeScreenCard.tsx:104-151` ("Add to home screen" only if the browser offers or iPhone; else "Open this page in Chrome" and "Show me how") | "Show me how" calls `start()` |
| Pill "Add to your home screen · How" after the first order | `HomeScreenPill.tsx:30-67`, `PlacedNudge.tsx:47` | "How" calls `start()` |
| Settings row "Add to home screen" + "Show me how" + line "No Install button? Tap ⋮ in Chrome, then Add to home screen" | `CustomerSettingsView.tsx:286-291,440`, `i18n/en.json` `settings.homeShow/homeFallback` | names a **second** way |
| Chrome's own menu and mini-infobar, Samsung Internet's menu | browser | cannot be removed, only made consistent |

Bug found: on Android **without** a saved prompt, `start()` (`useInstallFlow.ts:203-208`) is the **notification** entry (`entryFor`, `flow.ts:104-130`: Android gives `android-allow` and asks for notification permission). So "How" on Android does not explain installing at all. Together with Chrome's "Add to home screen" and "Install app", that is the "more than one way".

**Proposal (one choice):** one button "Install app" / "Pasang aplikasi" everywhere (card, pill, Settings row):
1. A saved `beforeinstallprompt` → `promptInstall()` (Chrome's own dialog, creates the WebAPK).
2. No prompt, Android, not an in-app browser → ONE screen with one numbered path per browser: **Chrome** "⋮ → Install app"; **Samsung Internet** "≡ → Add page to → Home screen" (Samsung Internet may only make a shortcut with a URL bar in some versions: unverified, check on a Samsung phone; if so, say so in the text).
3. In-app browser (WhatsApp) → existing `androidInApp` screen ("Open in Chrome"), unchanged.
4. Remove Settings' `homeFallback` line and the words "Add to home screen" on Android; fix the `start()` mix-up (install entry must never ask notification permission).
5. Right kitchen: clear the saved event when the manifest link changes, and install from Settings/My orders only after going to `/<slug>` (the row says "Install <kitchen>").
Browser menus stay as they are; our screens name the single path.

### 5 · Passkey ("maybe use one passkey")
**Already true.** Remember me is **one account per person** (`customer_accounts`); a passkey belongs to the account (`customer_passkeys.account_id`, `migrations/0029_remember_me.sql:15-25`); the WebAuthn identity is the site (`worker/auth/webauthn.ts:80,149` `rpID`), not a kitchen. Per-kitchen customer codes are derived per kitchen from the account (`customer_kitchen_codes`, plan 087: "The code differs per kitchen", so kitchens can't link a customer). Orders attach through `customer_order_links` rows with `seller_id`. The cookie `__Host-customer` and the key store are per origin, so all kitchen apps on Android Chrome share them. **No change is needed.** Two notes: (a) on **iPhone** each home-screen app has its own storage, so each kitchen app signs in again (one tap with the same passkey); (b) narrowing the scope per kitchen does not split the cookie or the passkey.

### 6 · Beta testers: reset or delete (owner, 18 Oct)
Steps the owner sends on WhatsApp, also shown in the app on a **Help page: Settings → Help → "Start fresh" / "Mulai dari awal"**. **App** = the app does it with one button; **Phone** = phone settings only.
| step | who | EN / ID |
|---|---|---|
| 1 Remove the old or wrong kitchen icon | **Phone** | Android: press and hold the icon, tap *Uninstall* (Samsung: Settings → Apps → the kitchen name → *Uninstall*). iPhone: press and hold → *Remove App* → *Delete App*. / Android: tekan lama ikon, ketuk *Copot pemasangan* (Samsung: Setelan → Aplikasi → nama dapur → *Copot*). iPhone: tekan lama → *Hapus App* → *Hapus*. |
| 2 Forget this phone's data | **App**: "Reset this phone" button | Signs out, forgets the key, clears My orders, name, address, language and the saved kitchen from this browser, then returns to the start. Does **not** delete the account on our side. / Keluar, hapus pesanan, nama, alamat dan dapur tersimpan dari HP ini. Tidak menghapus akun di server. |
| 3 Delete my saved data on our side | **App**: the existing "Delete my saved data" (`RememberMeCard.tsx:79`, `rememberMe.ts:184`), linked from the page | Deletes the Remember me account, order links and sealed address; asks the phone to drop the passkey where it can (`signalUnknownCredential`, `rememberMe.ts:176-200`). / Hapus semua data tersimpan kami. |
| 4 Clear the site's data if the app misbehaves | **Phone** | Chrome: ⋮ → Settings → Site settings → All sites → order.shaggybobo.app → *Delete & reset*. Samsung Internet: ≡ → Settings → Sites and downloads → Manage website data → the site → Delete. iPhone Safari: Settings → Apps → Safari → Advanced → Website Data → search "shaggybobo" → Remove (menu names differ by iOS version). |
| 5 Remove the Remember me passkey | **Phone** (the app asks the phone to forget it where the browser allows; otherwise manual) | Google Password Manager: Settings → Google → Password Manager → Passkeys → *order.shaggybobo.app* → Delete. Samsung Pass: Passkeys → pick the site → Delete. Apple Passwords: Passwords app → *order.shaggybobo.app* → Delete. Keeper: open the record *order.shaggybobo.app* → Delete. |
| 6 Install the right kitchen again | **App**: the one Install button (section 4) | Open the kitchen's link from the owner, tap *Install app*, check the icon and name. |
The reset button is small: `signOutHere` + `clearRememberMeLocal` + `keyStore().clear()` + the `src/api/device/*` keys (My orders, first name, address, last/app kitchen, theme); no new server call; size S. Unregistering the service worker and clearing caches is one extra call; only if the owner wants it. The owner's WhatsApp text (EN and ID, copy-paste) is kept in `docs/guide/` next to the page's wording. Menu names above are from memory and **must be checked on a Samsung, a Pixel and an iPhone** in stage 3.

## Open questions (one at a time, A / B / C, recommendation in bold)
1. **Route / scope.** **A (recommended): per-kitchen paths (`/<slug>/o/<token>`, `/<slug>/my-orders`, `/<slug>/settings`), scope `/<slug>/`, old links redirect (M-L).** B: keep scope `/` (0, icon complaint stays). C: keep routes, fix install only (S).
2. **Proof first?** **A (recommended): the 20-minute phone proof (finding 1) before building the routes (stages 4-5).** B: build A anyway. C: skip.
3. **My orders in a kitchen app.** **A1 (recommended): this kitchen only in the app, all kitchens in the browser tab.** A2: keep the fold, other kitchens open in the browser.
4. **One install button.** **A (recommended): one "Install app" label everywhere, Chrome prompt when it exists, one fallback screen per browser (Chrome, Samsung Internet), no "Add to home screen" wording on Android.** B: only fix the "How" bug.
5. **Passkey.** **A (recommended): no change, it is already one account for all kitchens.**
6. **Beta reset.** **A (recommended): Settings → Help → "Start fresh" page + "Reset this phone" button + WhatsApp text.** B: WhatsApp text only. C: text + button + service-worker/cache clearing.
7. **Release.** **A (recommended): stages 0-3 in 1.0.43 (install, icons, beta help); routes (4-6) in 1.0.44 after the phone proof.** B: everything in 1.0.43.

## Stages
| # | stage | files | size | tests |
|---|---|---|---|---|
| 0 | **Phone proof** (finding 1, steps 1-6, `chrome://webapks`, installability errors); write the result here | none | S | none |
| 1 | Manifest: `scope: "/<slug>/"`, `id` unchanged, start URL inside scope; icon route answers 200 with the bytes (no 302) or a generated PNG; manifest link from the page's own kitchen, never `lastSlug`; Settings/My orders go to `/<slug>` to install. (If stage 0 shows scope is not the cause, only the non-scope parts ship.) | `shared/kitchenManifest.ts` (+test), `worker/api/kitchenRoutes.ts`, `src/components/install/manifestLinks.ts` (+test), `shared/kitchenHeadLinks.ts` | M | unit: manifest scope/start per kitchen, `safeStartUrl`, `manifestTarget` for settings; e2e `kitchen-links` |
| 2 | One install button: single label, prompt else per-browser fallback (Chrome, Samsung Internet), fix `start()` on Android without prompt, drop `homeFallback`, reset saved event on manifest change | `HomeScreenCard.tsx`, `HomeScreenPill.tsx`, `CustomerSettingsView.tsx`, `installPrompt.ts`, `InstallScreens.tsx`, `i18n/en.json`/`id.json` | M | unit: `HomeScreenCard.test.tsx`, new `installPrompt.test.ts`, `useInstallFlow.test.tsx` (android, no prompt), `CustomerSettingsView.test.tsx`; e2e `native-customer` |
| 3 | Beta help: Settings → Help → "Start fresh" page, "Reset this phone", EN/ID text, WhatsApp copy text in `docs/guide/`; check menu names on real phones | `src/features/customer-settings/`, `src/api/customer/rememberMe.ts` (reuse), i18n, `docs/guide/` | S-M | unit: reset clears keys and signs out; page in EN and ID; e2e `customer-settings` (extend) |
| 4 | Routes A: `/:slug/o/:token*`, `/:slug/my-orders`, `/:slug/settings`; redirects from `/o/:token*`, `/my-orders`, `/settings`; tab bar and banner by slug; `orderPath` helper; reserved slugs | `customerRoutes.tsx`, `AppRoutes.tsx`, `CustomerShell.tsx` (+test), `ShellBanner.tsx`, `liveConnection.ts`, `shared/seller.ts` | L | unit: redirects, `activeTab`/`hasTabBar` by slug; e2e `native-customer`, `kitchen-links`, the 5 specs that mention `/o/` |
| 5 | Links: WhatsApp message, copy link, push `data.url`, order head and start URL use the new path; old links still answered | `whatsapp.ts`, `useInstallFlow.ts`, `worker/push/dispatch.ts`, `worker/api/kitchenPage.ts`, `kitchenHeadLinks.ts` | M | `mocks/push.test.ts`, `kitchenHeadLinks.test.ts`; e2e `push` |
| 6 | My orders per kitchen in the app (A1); docs: `docs/architecture` (routes, manifest), `docs/product` (install flow, My orders), decision, `pnpm run docs`; scoped gate; HANDOVER | `src/features/customer-orders/`, docs | S-M | unit: standalone own kitchen only; browser all |
Total L; stages 0-3 are the cheap, safe part.

## Deploy impact
- **Migration: none.** No secret, no new dependency, no binding.
- Stages 1-3: client + Worker. Installed apps keep their **id** and update in place (a scope change can take days to reach a phone); people with a wrong icon remove it and install again (the beta text says how).
- Stages 4-5: **old links must keep working**: redirect `/o/<token>*`, `/my-orders`, `/settings`, keep the old push URL parsed. Notifications already sent point at `/o/<token>`; the service worker opens whatever URL they hold, so the redirect covers them. Risk: a broken redirect breaks every WhatsApp link, so keep one e2e per old path.
- Check live after deploy: install Dellavee then Onde Onde on one Android phone (two icons, two names); an order link of each opens its own app; a push click; Samsung Internet install; iPhone unchanged.

## Real-phone check list
1. Android Chrome: install Dellavee, then Onde Onde from its own link: two icons and names; `chrome://webapks` shows two scopes.
2. Install button: once per kitchen page, Chrome's dialog opens, no second "Add to home screen" wording.
3. Samsung Internet: fallback steps; icon and name right; with or without URL bar.
4. Old WhatsApp order link (`/o/<token>`): opens the right kitchen app (or the browser) and lands on `/<slug>/o/<token>`.
5. Push for an order: tap opens the right app and order.
6. My orders and Settings inside the Onde Onde app stay inside it (no Custom Tab).
7. Remember me: create a passkey in Dellavee's app, open Onde Onde's app: same passkey, different customer code per kitchen.
8. Start fresh: Reset this phone empties My orders; Delete my saved data removes the passkey from Google Password Manager / Samsung Pass; reinstall works.
9. iPhone: unchanged (Share → Add to Home Screen), icon and name per kitchen, order link opens the right kitchen.

## Owner answers (18 Oct, questions page)
- **Q1 = A:** order, My orders and Settings move under the kitchen (`/<slug>/o/…`), each app scoped to its kitchen; old links redirect.
- **Q2 = A:** prove it on a real Android phone first (20 min) before building the routes.
- **Q4 = A:** one "Install app" button everywhere with one fallback screen per browser.
- **Q5 = A:** customer passkey: no change (already one for all kitchens).
- **Q6 = A:** "Start fresh" Help page with "Reset this phone" + the same steps as WhatsApp text (EN/ID).
- **Q3 = A (owner, 18 Oct):** My orders inside a kitchen's app shows that kitchen's orders only; the browser tab still shows all kitchens.
- Q7 (release split) still open (Fable risk report pending).
- **Release (owner, 18 Oct): 1.0.43, right after 1.0.42** ("all the icon/app things can be 1.0.43"). Fable's risk report (`docs/reports/2026-10-18-1042-scope-risk.md`): 101 + 102 stages 1–3 together (same files, one builder); 102 scope + routes (stages 4–6) on its own after the phone proofs (1.0.44) unless the owner says otherwise.
- **Owner, 18 Oct ~21:20: 101 and 102 ship together in one deploy, 1.0.43** (Fable advised 102 routes separately; owner chose one deploy).
