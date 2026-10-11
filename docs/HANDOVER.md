# Hand-over

**Rewrite this file at the end of every session, before the commit** (owner, 2026-10-11). The next session, on the owner's PC or the builder's, starts here.

**Last session:** 2026-10-11, the owner's PC (Adelaide), with Claude as coordinator. Branch `indra/brand_logo_ux`, rebased on the builder's `plan/flow-and-prototype` (84c4b31).

## Where things stand
Everything below is built and checked on this PC: typecheck, lint, format, 1796 unit tests, and the full e2e suite (Chrome at Android-phone, iPhone and desktop sizes, the sequential chain, and one WebKit smoke test). It is **not committed or deployed yet**.

| plan | what |
|---|---|
| 024 | customer pages show the kitchen's theme from the first paint |
| 026 | an error log devices send to the server (newest 500, nothing personal); the admin's "Problems" list with filters, paging and Clear |
| 028 | the **Helper** role ("Asisten"): invite, a deny-by-default server allowlist, the helper's own screens (Orders read-only, Hand over, Sell) |
| 029 | **selling on the day**: pre-order and/or day stock per dish, atomic sales and a sales log, live updates, the **Sell** screen (−1, −n, set count, undo), the end-of-day summary and CSV |
| 030 | chefs add and edit their own dishes ("Your dishes") |
| 032 | pause a kitchen (closed to customers, or fully), single-use links (from 033), a notice slot in the seller layout |
| 036 | ShaggyBobo branding on the admin and first-setup pages (was 027/028 on this branch) |
| 037 | the menu wizard opens as a layer over the current screen |
| 038 | admin page: two panels, brand bar, seller rows with a summary, a right-hand panel with **Invitations** / **Settings** tabs |
| 039 | the seller **Home** at `/seller` (tablet and desktop); **Orders moved to `/seller/orders`** |
| 040 | the top band: a 3840 × 328 wide banner matched to the left menu, logo fills its block, slide-over on scroll; every image upload shows its size, types and a guide with a template |
| 041 | the admin uploads a kitchen's images |
| 042 | **print orders on A4** (Orders → 🖨 Print; phone: More → Print orders) |
| 043 | a friendly **invite message** in EN or ID (editable preview, Copy message), also for chef/helper invites; the admin sees the **newest 20 invites** per kitchen (waiting / used / expired) |
| — | the ShaggyBobo logo above the sign-in form sits in a beige box in light mode too |

**Plan 044 (second commit):** the new bean mascot (jumps on the spot, blinks every 2 s), the happy-face logo icon in a pill, the left column's top bar over the scene, phones without beige bars. Its assets are placeholder quality from the owner's lab (`temp/shaggybobo-mascot/`); the designer's final files keep the same names (see guide/update-brand-logo.md). `--legs-x` on `:root` moves the legs; the owner is choosing the final value.
**Postponed by the owner:** 031 (admin opens a kitchen as its owner). It may come back later as a read-only "view as".
**Decisions recorded today:** D-092 (helper role, labelled chef in history; helper invites like every invite), D-093 (the wide banner is 3840 × 328, designed for iPad landscape).
**Live plan status with every agent and time:** [plans/live-status.md](plans/live-status.md). **Plans index:** [plans/README.md](plans/README.md).

## Next: merge and deploy (the builder, on his PC)
1. **The owner** commits on `indra/brand_logo_ux`, merges `plan/flow-and-prototype` into `main`, then `indra/brand_logo_ux` into `main`, and pushes. Because of today's rebase, pushing the branch itself needs `git push --force-with-lease`.
2. **The builder** pulls `main`, then:
   - `pnpm install`
   - `pnpm exec playwright install chromium webkit` (once per PC, for the e2e tests; see "Running e2e" in guide/tech-stack.md)
   - `pnpm db:migrate:local`: applies **0009 client log, 0010 helper, 0011 day selling, 0012 pause** to the local database (add-only; keeps data)
3. **Before deploying**, read [guide/deploy-cloudflare.md](guide/deploy-cloudflare.md) and the latest `plans/release-*.md`:
   - apply the same four migrations to the live D1: `pnpm exec wrangler d1 migrations apply shaggybobo-order --remote`
   - no new secrets this time (`ADMIN_SETUP_KEY` and the push keys are unchanged)
   - deploy: `pnpm run deploy`
4. **Check on the live app:** the seller lands on Home (tablet), Orders at `/seller/orders`, the new banner, the admin page's panel and Images, Print, Sell, inviting a helper.

## The owner's checks after the deploy
- 027: a named admin device on the iPad
- 028: invite a helper and try it on a phone
- 029: a pretend stall day on two devices
- 030: a chef adds a dish
- 032: an invite link on the phone; pause and resume the demo kitchen
- 042: a real print or "Save as PDF"
- Upload the Onde Onde banners (3840 × 328 wide, 1200 × 400 phone) from the admin page or Settings → Images

## Known and not done
- Send reminder and Download CSV on Orders (in the design, not in the app yet)
- The printed totals count pre-orders only (stall sales are in the Sell summary)
- The chalkboard "M" in the Onde Onde banner sits behind the logo board (artwork)
- WebKit e2e can be slow under a full parallel run; a spec that times out once usually passes alone

## After this deploy (owner)
The **customer app** is the next plan (with the owner's Lottie animations). Also waiting: 031 as a read-only "view as".

## Ready prompt for the next session
> Read docs/HANDOVER.md and CLAUDE.md. We merged and deployed the 2026-10-11 round (plans 024–042). Check the live app against "The owner's checks after the deploy", then start planning the customer app update. Ask me one question at a time.
