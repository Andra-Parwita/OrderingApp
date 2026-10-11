# Plan live status

The plan work in progress, one row per stage or check, kept current by the coordinator (the main AI session) **at every agent start and finish**. Times are real clock times, Adelaide (ACDT). The plan list and each plan's overall status are in [README.md](README.md).

**Columns:** *agent · tier* is the agent type and model (haiku, sonnet, opus, or the coordinator itself). *Est.* is the estimate given at the start. *Took* is the real time from start to end. *± est.* is Took minus Est. (+ is slower than expected). *Diff* is the files and lines changed (`git diff --stat`), or "—" for read-only work. *State:* ⏳ running · ✅ done · ❌ failed · ⏸ waiting.

## Now

| plan · stage | agent · tier | started | est. | ended | took | ± est. | diff | state |
|---|---|---|---|---|---|---|---|---|

| 037 · 1–3 menu wizard as a layer (modal routes, open from anywhere, look) | builder · sonnet | 16:47 | 50 min | | | | | ⏳ |








## Before "ready to merge" (checked stage by stage against every plan, 18:35)

**Building or queued**
- [ ] 028 stage 4: built; e2e `helper-flow` at the gate
- [x] 030 stage 2: built (18:37); e2e `chef-dishes` at the gate
- [x] 032 stages 3–4: built (18:51), migration 0012; e2e pause being written; stages 1–2 being confirmed
- [x] 042: built (18:44); e2e `print-orders` at the gate; printed totals are pre-orders only
- [x] 031: postponed by the owner (not in this deploy)
- [x] 026 stage 4 leftovers: filter, paging, Clear (18:55)
- [ ] 039 deviations the owner was told about: Send reminder and Download CSV on Orders (not in the app yet), delivery start time (no data); keep as findings unless the owner asks

**Found, to fix before the gate**
- [x] the Orders badge counts cancelled orders (50 vs Home's 44): fixed 18:50
- [x] a new seller's row on the admin page has no summary line until reload: fixed 18:55
- [x] the coordinator's D-007 privacy check of the error log (plan 026): fields and scrubbing fine, except order codes kept in seller paths → fixed 18:40

**End-of-phase gate (one parallel run, quiet tree)**
- [x] new/changed specs sorted (18:48): 126 tests in 33 files; captures opt-in (`CAPTURES=1`); day-selling and seller-setup sequential
- [x] typecheck · lint (8 GB) · format:check · every unit test: 1796/1796 (one port-clash flake passed alone), 19:08
- [x] full e2e: main parallel projects 66 passed (run 6); sequential chain 28 passed, 0 failed (20:50)
- [ ] the specs each plan names: 024 `kitchen-links`, `customer-batch1` · 036 `seller-auth`, `session-flow` · 037 `design-compare` Menu-*, `live` · 038/041 `admin`, `seller-setup` · 040 `banners`, `seller-rail` · 029 `day-selling` · 028 `helper-flow` · 030 `chef-dishes` · 042 `print-orders`
- [ ] captures: 040 (4 sizes, open/collapsed/scrolled), 041 admin Images at 390 × 844, 042 printed pages, Home states
- [x] the owner's local database: 0011 and 0012 applied (20:16; backup in scratch/backup/wrangler-state-2026-10-11-before-0011-0012); dev server back on :5173
- [ ] plans index: tick ✅ and statuses; board "Start here"; the son's deploy checklist

**The owner's own checks (after merge, on the live app)**
- 027 a named admin device on the iPad · 028 invite a helper and try it on a phone · 029 a pretend stall day on two devices · 030 a chef adds a dish · 031 open the demo kitchen as admin · 032 an invite link on the phone, pause and resume · 042 a real print or PDF


## Done (newest first)

| date | plan · stage | agent · tier | started | est. | ended | took | ± est. | diff | state |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-11 | 044 · new mascot (jump + blink), happy-face logo pill, top bar over the scene, phone without bars, `--legs-x` | builder · sonnet | 20:58 | 30 min | 21:30 | 32 min | +2 min | ~12 files, 6 new images | ✅ 139 tests, admin e2e 2/2, typecheck/lint/format clean |
| 2026-10-11 | sign-in form logo: beige container in light mode too | builder · sonnet | 20:46 | 8 min | 20:50 | 4 min | −4 min | 2 files | ✅ 8/8 |
| 2026-10-11 | the whole sequential chain (+ seller-auth / chef-dishes URL fixes) | builder · sonnet | 20:38 | 15 min | 20:50 | 12 min | −3 min | 2 specs | ✅ 28 passed, 0 failed, 9 skipped (mobile-only skips) |
| 2026-10-11 | 044 mock-up `temp/shaggybobo-new/mockup-admin-page.html` (git-ignored, beside the assets) | coordinator · opus | 20:45 | 10 min | 20:50 | 5 min | −5 min | 1 mock-up | ✅ light + dark sent |
| 2026-10-11 | bug fix: helper pages no longer request past-weeks; read-only preferences allowed for helpers | builder · sonnet | 20:34 | 15 min | 20:41 | 7 min | −8 min | 3 files | ✅ helper-flow passes, 0 console errors; 151 tests |
| 2026-10-11 | gate fixes: admin strict text, session-flow admin list, helper-flow Sell locator | builder · sonnet | 20:31 | 15 min | 20:37 | 6 min | −9 min | 3 specs | ✅ 2 pass; helper-flow found a real app bug |
| 2026-10-11 | gate: sequential + affected e2e projects, one at a time | coordinator · shell | 20:28 | 12 min | 20:30 | 2 min | −10 min | — | ⚠️ 24 passed, 3 failed (first full run of these specs), 1 not run |
| 2026-10-11 | 043 · 1–3 invite message EN/ID + admin invite list (newest 20) | builder · sonnet | 20:13 | 30 min | 20:27 | 14 min | −16 min | ~12 files | ✅ 125 tests |
| 2026-10-11 | gate fix: admin spec serial (shared passkey) | builder · sonnet | 20:13 | 5 min | 20:16 | 3 min | −2 min | 1 spec | ✅ 2/2 with default workers |
| 2026-10-11 | gate: full e2e, run 6 | coordinator · shell | 20:05 | 20 min | 20:12 | 7 min | −13 min | — | ⚠️ 66 passed, 1 failed (admin passkey clash), 7 not run behind it |
| 2026-10-11 | e2e devices reorganised (owner: iPhone is about size): Chromium Android + desktop, iPhone-size Chromium set, 1 WebKit smoke last | builder · sonnet | 19:57 | 10 min | 20:01 | 4 min | −6 min | config, 3 specs, tech-stack.md | ✅ `--list` 102 tests |
| 2026-10-11 | gate fix: WebKit project timeout 60 s | builder · sonnet | 19:52 | 5 min | 19:54 | 2 min | −3 min | playwright.config.ts | ✅ |
| 2026-10-11 | gate: full e2e, run 4 | coordinator · shell | 19:40 | 15 min | 19:51 | 11 min | −4 min | — | ⚠️ 54 passed, 2 WebKit timeouts (30 s limit), 41 sequential not run |
| 2026-10-11 | gate fixes: 3 WebKit failures | builder · sonnet | 19:38 | 15 min | 19:44 | 6 min | −9 min | 1 spec | ✅ 1 URL fixed; 2 passed alone (WebKit slowness under load; watch in run 4) |
| 2026-10-11 | gate: full e2e, run 3 (WebKit) | coordinator · shell | 19:26 | 15 min | 19:37 | 11 min | −4 min | — | ⚠️ 53 passed, 3 failed (WebKit: 1 old URL, 1 stays on New order, 1 timeout), 41 not run |
| 2026-10-11 | gate: full e2e, run 2 | coordinator · shell | 19:19 | 15 min | 19:25 | 6 min | −9 min | — | ⚠️ 41 passed; all 26 failures = WebKit not installed on this PC (installed 19:27) |
| 2026-10-11 | gate fixes: 6 e2e failures (outdated expectations) | builder · sonnet | 19:16 | 15 min | 19:23 | 7 min | −8 min | 4 specs | ✅ each passes alone (phone banner is unchanged by design, so the phone header doesn't move) |
| 2026-10-11 | gate: full e2e suite, parallel | coordinator · shell | 19:08 | 15 min | 19:15 | 7 min | −8 min | — | ⚠️ 34 passed, 6 failed (all outdated expectations), 70 not run (wait on those), 18 skipped |
| 2026-10-11 | gate: typecheck · lint · format · all unit tests | coordinator · shell | 18:57 | 10 min | 19:07 | 10 min | 0 | — | ✅ 1796/1796 (1 flake passed alone) |
| 2026-10-11 | 032 e2e + st1–2 check · new-seller summary · 026 filter / paging / Clear | builder · sonnet | 18:51 | 25 min | 18:55 | 4 min | −21 min | ~10 files | ✅ 112 tests |
| 2026-10-11 | 032 · 3–4 pause a kitchen (full / customers only), notice slot for 031 | builder · sonnet | 18:32 | 40 min | 18:51 | 19 min | −21 min | migration 0012, ~20 files | ✅ new tests; miniflare flakes pass alone |
| 2026-10-11 | gate prep: specs sorted parallel / sequential / opt-in; Running e2e note | builder · sonnet | 18:43 | 15 min | 18:48 | 5 min | −10 min | config, 1 spec, tech-stack.md | ✅ `--list` 126 tests |
| 2026-10-11 | chef-nav test + chefMenu test typecheck | builder · sonnet | 18:45 | 5 min | 18:50 | 5 min | 0 | 2 tests | ✅ typecheck clean, 27 tests |
| 2026-10-11 | Orders badge excludes cancelled; print totals labelled pre-orders; order code no wrap | builder · sonnet | 18:45 | 8 min | 18:50 | 5 min | −3 min | 3 files | ✅ unit; code wrap checked at the gate capture |
| 2026-10-11 | 042 · print orders on A4 | builder · sonnet | 18:32 | 30 min | 18:44 | 12 min | −18 min | 4 new, 4 edited | ✅ 9 tests |
| 2026-10-11 | 026 · privacy fix: order codes masked in logged paths | builder · sonnet | 18:38 | 5 min | 18:40 | 2 min | −3 min | 2 files | ✅ 17 tests |
| 2026-10-11 | 030 · 2 chef's menu screens | builder · sonnet | 18:32 | 25 min | 18:37 | 5 min | −20 min | 4 new, ~8 edited | ✅ 103 tests |
| 2026-10-11 | 028 · 4 helper's screens | builder · sonnet | 18:21 | 35 min | 18:33 | 12 min | −23 min | ~15 files, 1 new spec, 1 new project | ✅ 284 tests; e2e helper-flow at the gate |
| 2026-10-11 | 038 · 4 e2e `admin` + 3 screenshots (2 runs) | coordinator · shell | 18:21 | 5 min | 18:28 | 7 min | +2 min | — | ✅ 1/1, captures/p038/ |
| 2026-10-11 | 041 · R2 wiring + admin e2e on the real route (the harness had no Images) | builder · sonnet | 18:21 | 5 min | 18:31 | 10 min | +5 min | routes.ts, r2.ts, spec, 1 test | ✅ 119 + 27 tests |
| 2026-10-11 | 029 · 4–5 Sell screen + end-of-day summary + phone e2e | builder · sonnet | 17:48 | 45 min | 18:19 | 31 min | −14 min | 7 new, ~12 edited | ✅ 485 tests, e2e day-selling ✓; its accidental full run showed 3 failing specs to triage |
| 2026-10-11 | 038 · 4 admin side panel with Invitations / Settings tabs + dark-mode EN/ID fix | builder · sonnet | 17:49 | 35 min | 18:05 | 16 min | −19 min | admin feature + tests | ✅ 26 unit; e2e waits (server busy) |
| 2026-10-11 | 041 · 1–2 admin sets a kitchen's images | builder · sonnet | 17:39 | 40 min | 17:50 | 11 min | −29 min | ~12 files | ✅ 122 tests; routes.ts wiring (1 line) waits for 029 |
| 2026-10-11 | 029 · 1 UI (dish editor, customer menu) + 3 live updates | builder · sonnet | 17:41 | 40 min | 17:49 | 8 min | −32 min | ~10 files | ✅ 50 tests |
| 2026-10-11 | 040 · fix: 4 mocks tests for the sample rename; Settings board note | builder · sonnet | 17:43 | 8 min | 17:46 | 3 min | −5 min | 4 tests, 1 board | ✅ 84/84 |
| 2026-10-11 | 040 · fix: banner collapses with the left menu | builder · sonnet | 17:41 | 10 min | 17:46 | 5 min | −5 min | 3 files | ✅ 541/541 unit, e2e 4/4 |
| 2026-10-11 | 029 · 1–2 server: preorder / day stock, atomic sales + log (migration 0011) | builder · sonnet | 17:25 | 45 min | 17:41 | 16 min | −29 min | 4 new, 15 edited | ✅ 17 new tests; 4 mocks tests broken by 040's sample rename → fix queued |
| 2026-10-11 | 040 · 1–4 top band | builder · sonnet | 17:20 | 60 min | 17:40 | 20 min | −40 min | 10 files | ✅ 609/610 → fixed; e2e banners + seller-rail 4/4 |
| 2026-10-11 | 040 · 5c e2e specs for the new image labels | builder · sonnet | 17:25 | 5 min | 17:27 | 2 min | −3 min | 2 specs | ✅ lint; Playwright at the gate |
| 2026-10-11 | 040 · 5b app icon label + phone icon guide | builder · sonnet | 17:23 | 10 min | 17:26 | 3 min | −7 min | 4 files | ✅ 19/19 |
| 2026-10-11 | 040 · 5 upload instructions + in-place guide + template download | builder · sonnet | 17:20 | 30 min | 17:24 | 4 min | −26 min | 1 new component, 5 guides, i18n | ✅ 19/19 |
| 2026-10-11 | gate fixes: 2 customer tests (1 real bug from 037: customer pages had stopped sliding in), 2 files formatted | builder · sonnet | 17:13 | 15 min | 17:20 | 7 min | −8 min | AppRoutes 1 line, 1 test | ✅ 334 + 52 tests |
| 2026-10-11 | gate: lint again with `NODE_OPTIONS=--max-old-space-size=8192` | coordinator · shell | 17:13 | 6 min | 17:17 | 4 min | −2 min | — | ✅ 0 errors |
| 2026-10-11 | gate: lint · format:check · all unit tests | coordinator · shell | 17:03 | 8 min | 17:12 | 9 min | +1 min | — | ⚠️ unit 1703/1705 (2 customer); format 2 files; lint out of memory |
| 2026-10-11 | fixes from captures: admin header at 390 px; Orders "0 orders" | builder · sonnet | 17:00 | 15 min | 17:03 | 3 min | −12 min | 2 files, 1 new test | ✅ 155 tests; the new test fails without the fix |
| 2026-10-11 | 037 · 1–3 menu wizard as a layer | builder · sonnet | 16:47 | 50 min | 17:00 | 13 min | −37 min | 3 new, ~10 edited | ✅ 190/191 (the 1 is CustomerShell, to check) |
| 2026-10-11 | banner templates (8:1 and phone 3:1 zone images) | coordinator · opus | 16:58 | 5 min | 17:01 | 3 min | −2 min | 2 SVG + 2 PNG + 1 sample | ✅ |
| 2026-10-11 | 039 · 038 · captures for the owner | builder · sonnet | 16:48 | 25 min | 17:00 | 12 min | −13 min | new `e2e/p039-captures.spec.ts` | ✅ 3/3, 0 console errors; 2 defects found |
| 2026-10-11 | banner mock-up `uxDesign/seller/mockups/banner-sizes.html` + 6:1 / 8:1 samples | coordinator · opus | 16:53 | 15 min | 17:00 | 7 min | −8 min | 1 mock-up, 2 sample images | ✅ checked at 1180×820 |
| 2026-10-11 | 030 · 1 server rules: chefs add and edit their own dishes | builder · sonnet | 16:47 | 25 min | 16:58 | 11 min | −14 min | routes.ts, 1 new test file | ✅ 80 tests; full server suite at the gate |
| 2026-10-11 | banner sizes · UX review | general · opus | 16:48 | 8 min | 16:52 | 4 min | −4 min | — | ✅ cap seller banner at 160 px (one constant); phone stays 3:1 |
| 2026-10-11 | 039 · 4–5 Home live states, Orders slimmed (+2 gate fixes) | builder · sonnet | 16:28 | 50 min | 16:45 | 17 min | −33 min | 4 new, ~16 edited | ✅ 273/273 unit; Send reminder + CSV not built (don't exist yet) |
| 2026-10-11 | 028 · 3 invite and list (+ ID label "Asisten") | builder · sonnet | 16:43 | 20 min | 16:48 | 5 min | −15 min | 4 files + i18n | ✅ 42 tests |
| 2026-10-11 | owner's local DB: migrate 0009 + 0010 (add-only; backup first) | coordinator · shell | 16:41 | 3 min | 16:42 | 1 min | −2 min | — | ✅ `/api/log` 204 on :5173 |
| 2026-10-11 | 028 · 1–2 helper role: migration 0010, contract, server allowlist | builder · sonnet | 16:34 | 40 min | 16:40 | 6 min | −34 min | 4 files edited, 3 new | ✅ 694 server tests |
| 2026-10-11 | 026 · 4 admin sees the error log (Problems panel) | builder · sonnet | 16:28 | 25 min | 16:33 | 5 min | −20 min | 8 files, 1 new | ✅ 108 tests; filter, paging, Clear left for later |
| 2026-10-11 | 039 · e2e specs + guards link for `/seller/orders` | builder · sonnet | 16:28 | 20 min | 16:31 | 3 min | −17 min | 15 files, ~1 line each | ✅ typecheck, lint; Playwright at the gate |
| 2026-10-11 | 028 · re-plan after 033 | Plan · sonnet | 16:25 | 6 min | 16:26 | 1 min | −5 min | plan only | ✅ helper = 3rd membership role; 2 rulings |
| 2026-10-11 | 038 · 3 seller-row summary | builder · sonnet | 16:23 | 25 min | 16:26 | 3 min | −22 min | 6 files, 3 tests | ✅ 110 tests; server 683/683 |
| 2026-10-11 | 039 · 2–3 Home: routes, nav, states 1/2/5–6, dialogs, panel | builder · sonnet | 16:09 | 45 min | 16:24 | 15 min | −30 min | ~20 new files, 8 edited | ⚠️ typecheck ok; 130/131 unit, 1 lint → fixed in 4–5 |
| 2026-10-11 | 026 · fix `token=` scrub (+ a 2nd scrub-order bug it found) | builder · sonnet | 16:21 | 5 min | 16:24 | 3 min | −2 min | 1 file, ~3 lines | ✅ lint clean, unit green |
| 2026-10-11 | 038 · fixes: lint, failing test (test was wrong), lighter left panel + headings, e2e selectors, unused keys | builder · sonnet | 16:16 | 15 min | 16:22 | 6 min | −9 min | 8 files, 1 new test | ✅ lint clean, 20/20 unit; e2e + screenshots at the gate |
| 2026-10-11 | 026 · 1–3 client error log | builder · sonnet | 16:17 | 30 min | 16:20 | 3 min | −27 min | 9 new files, 7 edited (+~450) | ⚠️ lint clean; 35/36 unit → fix |
| 2026-10-11 | 038 · 1–2 admin two panels + brand bar | builder · sonnet | 16:09 | 30 min | 16:14 | 5 min | −25 min | 8 files, 1 new | ⚠️ typecheck ok; lint 3 errors, 1 test failing → fixes |
| 2026-10-11 | 024 · 1–2 customer theme from the first paint (+ lint fix) | builder · sonnet | 16:09 | 30 min | 16:16 | 7 min | −23 min | 8 files +120/−17, 3 new | ✅ typecheck, lint, 419/419 unit |
| 2026-10-11 | unfinished plans · fastest order, parallel tracks | Plan · fable | 16:05 | 6 min | 16:08 | 3 min | −3 min | — | ✅ Home first: yes; 3 tracks |
| 2026-10-11 | 039 · 0 design boards into `uxDesign/seller/screens/` | coordinator · opus | 16:04 | 5 min | 16:05 | 1 min | −4 min | 7 boards added, Main + Main-Finished replaced, Main-Empty removed, index merged (28 boards) | ✅ |
| 2026-10-11 | Playwright Chromium install (for specs and captures) | coordinator · shell | 16:04 | 3 min | 16:05 | 1 min | −2 min | — | ✅ |
| 2026-10-11 | 036 · rebase on `plan/flow-and-prototype`, renumber 027/028 → 036, 037 | coordinator · opus | ~15:25 | 10 min | ~15:40 | ~15 min | +5 min | 2 conflicts; 12 files (renames, comments, index) | ✅ typecheck, 254/254 unit |
| 2026-10-11 | 037 · map the menu wizard (review) | Explore · haiku | ~14:55 | 2 min | ~14:56 | 1 min | −1 min | — | ✅ |
