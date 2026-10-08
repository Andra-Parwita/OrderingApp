# Tech stack and quality gate

The owner's minimum stack; it is required. No new dependency beyond this list without the owner's approval (record it in [decisions](../decisions/README.md)).

| concern | choice |
|---|---|
| UI | **React** (latest stable, [D-006](../decisions/README.md)) + **TypeScript** (`strict` and `noUncheckedIndexedAccess` on) |
| Styling | **styled-components** (latest stable) with a typed `ThemeProvider` theme, light and dark ([D-006](../decisions/README.md)) |
| State | **Redux Toolkit** + **redux-saga** for side effects (API calls, live updates, push) |
| Routing | **react-router** (latest stable, library mode) ([D-022](../decisions/README.md)) |
| i18n | **react-i18next** (EN / ID) |
| Sign-in | **Passkeys** via `@simplewebauthn/server` + `@simplewebauthn/browser`; password fallback for seller and chefs with WebCrypto PBKDF2 ([D-011](../decisions/README.md), [D-014](../decisions/README.md)) |
| Dev server and build | **Vite**, with `@cloudflare/vite-plugin` so the Worker runs in the same dev server |
| Hosting | Cloudflare free plan: Workers, D1, Durable Objects, R2 |
| Lint | **ESLint** (flat config) with `typescript-eslint`, React Hooks rules and `eslint-config-prettier` |
| Format | **Prettier**. Format the files you change. |
| **Circular imports** | **Forbidden.** ESLint `import-x/no-cycle` as an error, so cycles fail lint and show in the editor. Fix them; never suppress the rule. |
| Unit and component tests | **Vitest** (Vite-native, Jest-compatible API, shares the Vite config) + **React Testing Library** + `jsdom`. Covers pure logic (order codes, reducers, selectors, sagas, formatting, i18n) and components. |
| Network guard | **MSW** (Mock Service Worker): tests never hit a real network; the same handlers feed the harness and the prototype's sample data. |
| Test harness and end-to-end | **Playwright**. Every screen can be mounted on its own with fixtures (a harness route), so specs are fast and deterministic. Projects for **mobile WebKit (iPhone)** and **mobile Chromium (Android)**, plus desktop for the seller. Captures go to the ignored `captures/` folder. |

## Quality gate

Green before anything is "done":

`typecheck` · `lint` (includes the cycle check) · `format:check` · `test` (Vitest) · the Playwright specs of anything changed.

The full Playwright suite runs only when the owner asks.

## Testing on real phones (home Wi-Fi)

**Dev always runs on HTTPS** with an mkcert certificate ([D-002](../decisions/README.md)), so Web Push, Home Screen install and camera QR scanning work on phones every day, the same as in production.

- The dev server listens on the local network (`server.host: true`), so a phone on the same Wi-Fi opens `https://192.168.178.177:<port>`. The first time, Windows Firewall asks to allow Node on **private** networks; the owner allows it.
- The certificate covers `localhost`, `127.0.0.1` and `192.168.178.177`. It's created with `mkcert` (installed with winget on ANDRAPC, [D-015](../decisions/README.md)) into the git-ignored `.certs/` folder. Vite reads it through `server.https`, so no npm plugin is needed. Playwright uses the same HTTPS address.
- **One-time per phone:** install `rootCA.pem` (never `rootCA-key.pem`) and trust it. iPhone: AirDrop or email it, install the profile, then Settings → General → About → Certificate Trust Settings → full trust. Android: Settings → Security → Install certificate → CA certificate.
- `192.168.178.177` is **reserved for the dev PC (ANDRAPC) in the router** ([D-015](../decisions/README.md)), so the certificate stays valid. If the reservation ever changes, regenerate the certificate.
- **Never commit or share** the certificate keys or `rootCA-key.pem`.

**Later, optional:** once Cloudflare is configured, a Cloudflare tunnel or a `workers.dev` preview deploy can replace this for testing away from home. A deploy is always the owner's step.

## Testing rules

- A bug fix ships with a test that **fails without the fix**.
- A fixed clock and fixed data keep tests and captures deterministic.
- No real network in any test.
