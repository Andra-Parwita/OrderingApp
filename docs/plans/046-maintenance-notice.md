# 046 · "Update in progress": advance notice and a maintenance mode

**Status:** draft (2026-10-11). Builder: "a notification of deployment happening, so sellers and others know they cannot do anything for a period of maintenance". Q1 answered "A" (sellers, staff and customers).
**Goal:** people are told ahead of an update, and during it they see a calm "Updating, back in a few minutes" instead of errors, while the server refuses changes so nothing is half-saved during a migration. For now the admin switches it on and off by hand around each manual release (plan 045, release automation, is for later).

## Open question (builder)

**Q1: who sees the advance notice?** Builder: **A**.
- **A (recommended):** sellers and staff in their app, and customers on the menu and order pages.
- **B:** sellers and staff only; customers see only the short "Updating" screen during the update.
- **C:** sellers only; nothing for customers.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Server state.** A small `app_settings` row (next free migration): `maintenance` (off/on), `notice_from`, `notice_until`, `notice_text_en`, `notice_text_id`. Public `GET /api/status` (cheap, cacheable for a few seconds) returns it. While on, every write route answers 503 `maintenance` (reads keep working where they can; the admin and the release token are exempt). | `migrations/`, `worker/`, `shared/` | tests: writes refused while on, reads fine, admin exempt; off restores everything |
| 2 | **Admin.** "Announce an update" (date, start, length, optional note EN/ID) and "Maintenance on / off" on the admin page. A token-only endpoint (`MAINTENANCE_TOKEN` secret) lets the release workflow switch it without a passkey. | `src/features/admin/`, `worker/api/`, i18n | tests: admin only; token works only on that endpoint |
| 3 | **Notice and screen.** A quiet banner from `notice_from` to `notice_until` ("Update on Sun 12 Oct, 10:00–10:15 pm. The app pauses briefly."), per Q1. While maintenance is on: a full "Updating, back in a few minutes" screen; a 503 `maintenance` from any call shows it too; the page checks `/api/status` every 30 s and returns by itself. | `src/app/`, `src/features/customer-menu/`, `src/api/`, i18n | tests: banner in its window only; 503 shows the screen; back by itself when off |
| 4 | **Release hook (later, with plan 045).** Plan 045's workflow turns maintenance on before the backup and off after the health check; it stays on if the release fails. | `.github/workflows/release.yml` | a test release shows the screen during migrate and clears after |

## End of phase

- [ ] typecheck · lint · format · `mocks` maintenance tests · admin, app, customer-menu unit tests · e2e one spec: notice → maintenance on → screen → off
- [ ] Announce and run one real update with sellers watching

## Decisions and notes

- Stages 1–3 are this plan now (the admin switches maintenance by hand: on before the backup and migrations, off after the health check). Stage 4 waits for plan 045.
