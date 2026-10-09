# 007 · Harden the 6-digit add-device code

**Status:** approved by the builder (2026-10-10, "A"); **done** (06:49; the coordinator re-ran the auth tests, 93/93). No migration.
**Goal:** a 6-digit add-device code can't be brute-forced by changing the device id, and can't be used twice. Both points come from the security review (10 Oct); they scored about 6/10, below its reporting cut-off, and the builder chose to fix them before going live.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Limit code attempts per kitchen, not only per device.** Failed `redeemCode` tries also count against the seller's codes, e.g. a lockout once there are 5 wrong codes per seller within the code's 10-minute life, and the outstanding code is invalidated after that. This matches how password and invite-key lockouts are already scoped per seller. | `worker/db/auth.ts`, `worker/api/authRoutes.ts` | a test: rotating `deviceId` doesn't allow more than the per-seller limit; the code is dead after it |
| 2 | **One use only, even under a race.** The redemption marks the code used with a conditional single statement (`UPDATE … SET used = 1 WHERE … AND used = 0`) and only goes ahead if exactly one row changed, inside the same batch as the device or session creation, or checked before it. | `worker/db/auth.ts` | a test: two concurrent redemptions of the same code; exactly one succeeds |

## End of phase
- [ ] typecheck · lint · `mocks/auth.test.ts` and `mocks/authSecurity.test.ts`; the full gate runs with plan 004's.

## Result
- **Per-kitchen limit:** a wrong code can't be tied to a kitchen, so it counts against the device **and every kitchen with a live code** (scope `codes:<sellerId>`, separate from password sign-in). The 5th wrong try locks for 15 minutes and voids all live codes.
- **Single use:** `UPDATE … SET used = 1 WHERE … AND used = 0 … RETURNING` runs before the session is created.
- Both tests fail without their fix.
- **Trade-off, accepted (builder, 2026-10-10, "A"):** anyone can block **all** kitchens' add-device codes for 15 minutes with 5 wrong tries. Password and passkey sign-in are not affected. Revisit with a kitchen field on the code screen if it is ever abused.
