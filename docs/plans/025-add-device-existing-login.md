# 025 · Add a device: use the passkey or password the account already has

**Status:** approved by the builder (2026-10-10). Bug found on the live iPad. After a 6-digit add-device code in the home-screen app:
- "Face or fingerprint" failed with "could not use a passkey", because the iPad already held the account's passkey (made in Safari and shared by iCloud Keychain), and creating a second one is refused;
- "Set a password" showed "Something went wrong", because the server refuses a new password through a code when the account already has one (`worker/db/auth.ts`, `register`, "This account already has a password").

**Goal:** a person adding a device whose account already has a login just signs in with it. Errors say what happened.

## Stages

| # | stage | files | done when |
|---|---|---|---|
| 1 | **Server tells the client what exists.** The code-redeem answer (and `me` on a setup session) says whether the account has a password and whether it has passkeys. No secrets: just two booleans. | `worker/db/auth.ts`, `shared/authContract.ts` | tests: both flags right for an account with a password, with a passkey, with neither |
| 2 | **The setup step offers the existing login.** After a code, if the account has a passkey: "Sign in with face or fingerprint" (a passkey **sign-in** that finishes the session; on success the device is in), with "Add a new passkey" second. If the browser refuses creation with `InvalidStateError` (passkey already on this device), fall back to signing in with it. If the account has a password: "Use your password" (the normal password sign-in for this kitchen) instead of "Set a password". | `src/features/seller-auth/` (PasskeyHelpScreen, PasswordSetupScreen, DeviceCodeScreen), `src/app/AuthRoutes.tsx` | tests: each branch; `InvalidStateError` falls back to sign-in |
| 3 | **Real messages.** The setup and sign-in screens show the server's error code as a known EN/ID message (already has a password, passkey already registered, session expired, too many tries) instead of "Something went wrong". | `src/features/seller-auth/authText.ts`, i18n | tests: each code maps to its text |

## End of phase
- [ ] typecheck · lint · format · `mocks/auth*.test.ts` and seller-auth unit tests · e2e `seller-auth` (virtual authenticator) on desktop (`--workers=1`)
