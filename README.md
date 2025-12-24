# Koios Factory SPA

Factory is now a Vite-powered Vue 3 single-page application that uses vue-router, Pinia, Nuxt UI 4, Tailwind CSS 4, and a client-only OIDC PKCE authentication flow.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Access to the Koios firmware and provisioning APIs as well as the OIDC issuer configured in `.env`/`import.meta.env`

## Getting started

```bash
pnpm install
pnpm dev
```

The dev server runs on `http://localhost:5173` by default. Environment overrides can be provided through a `.env` file using the following variables:

| Variable                        | Description                                            |
| ------------------------------- | ------------------------------------------------------ |
| `VITE_FIRMWARE_API_BASE`        | Base URL for the firmware API                          |
| `VITE_PROVISIONING_API_BASE`    | Base URL for the provisioning API                      |
| `VITE_OIDC_ISSUER`              | OIDC issuer URL                                        |
| `VITE_OIDC_CLIENT_ID`           | Public client identifier                               |
| `VITE_OIDC_REDIRECT_URI`        | Redirect URI registered with the IdP                   |
| `VITE_OIDC_LOGOUT_REDIRECT_URI` | Post logout redirect URI                               |
| `VITE_OIDC_SILENT_REDIRECT_URI` | Silent renew redirect URI (defaults to `/auth/silent`) |

## Useful scripts

```bash
pnpm dev         # start Vite in dev mode
pnpm build       # create a production build
pnpm preview     # serve the production build locally
pnpm lint        # run ESLint (flat config)
pnpm typecheck   # run vue-tsc for strict type checking
pnpm api:generate # regenerate OpenAPI-derived TS types
```

## Project structure

- `src/main.ts` bootstraps Vue, Pinia, router, Nuxt UI, and the global Icon component
- `src/router` holds route definitions and auth guards
- `src/stores` contains Pinia modules for auth, crypto provisioning, and firmware flashing
- `src/pages` includes the routed views (home, crypto, programming, auth callbacks)
- `src/lib` wraps runtime configuration, auth helpers, API clients, and serial utilities

Run `pnpm lint` and `pnpm typecheck` before opening a PR to ensure code quality.

## Authentication & Keycloak integration

Factory relies on [`oidc-client-ts`](https://github.com/authts/oidc-client-ts) to run the Authorization Code + PKCE flow entirely in the browser.

1. **Keycloak client** – Create a public client for the SPA, keep the Standard Flow enabled, turn on PKCE with the `S256` challenge method, disable direct access grants, and enumerate every valid redirect/post-logout URI explicitly (no wildcards).
2. **Token lifetimes** – Short access tokens (15–30 min) plus refresh tokens (7–30 days) keep devices safe. Enable refresh tokens for public clients and, if possible, back-channel logout to invalidate sessions from the IdP.
3. **Frontend plumbing** – `src/lib/auth/oidcClient.ts` wraps `oidc-client-ts`’s `UserManager`, bootstrapping it with the runtime config, session-backed storage, and the silent-redirect endpoint at `/auth/silent`. The Pinia store in `src/stores/auth.ts` drives login, logout, silent refresh, and exposes typed helpers to the rest of the app.
4. **Router callbacks** – `/auth/callback` finalizes interactive logins, while `/auth/silent` is loaded inside a hidden iframe by `oidc-client-ts` for token renewal. You can inspect Keycloak or browser logs to troubleshoot PKCE/redirect issues (set `Log.logger = console` for verbose output).

This setup keeps tokens out of `localStorage`, relies on PKCE S256, and uses the library’s built-in CSRF/state handling so the rest of the application can focus on its business logic.
