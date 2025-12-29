# Koios Firmware SPA

A Vite-powered Vue 3 single-page application for flashing firmware to Koios devices. Uses esp-web-tools for installation, Nuxt UI 4, and optional OIDC authentication for factory provisioning.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Chrome or Edge browser (for Web Serial API)

## Getting started

```bash
pnpm install
pnpm dev
```

The dev server runs on `http://localhost:5173` by default.

## Environment Variables

| Variable                        | Description                                            |
| ------------------------------- | ------------------------------------------------------ |
| `VITE_FIRMWARE_API_BASE`        | Base URL for the firmware API                          |
| `VITE_LICENSING_API_BASE`       | Base URL for the licensing API                         |
| `VITE_OIDC_ISSUER`              | OIDC issuer URL                                        |
| `VITE_OIDC_CLIENT_ID`           | Public client identifier                               |
| `VITE_OIDC_REDIRECT_URI`        | Redirect URI registered with the IdP                   |
| `VITE_OIDC_LOGOUT_REDIRECT_URI` | Post logout redirect URI                               |
| `VITE_OIDC_SILENT_REDIRECT_URI` | Silent renew redirect URI (defaults to `/auth/silent`) |

## Scripts

```bash
pnpm dev          # Start Vite dev server
pnpm build        # Create production build
pnpm preview      # Serve production build locally
pnpm lint         # Run ESLint
pnpm typecheck    # Run vue-tsc for type checking
pnpm generate:api # Regenerate OpenAPI types
```

## Project Structure

- `src/pages/` - Vue Router views (home, flash, console)
- `src/stores/` - Pinia stores (auth, console)
- `src/lib/` - API clients, auth helpers, runtime config, serial utilities
- `src/components/` - Shared Vue components

## User Flow

1. **Home page** (`/`) - Browse available devices
2. **Flash page** (`/flash/:project`) - Select variant and version, install firmware
3. **Console page** (`/console`) - View serial output, provision device (if logged in)

## Authentication

Authentication is **optional**. Public users can browse and flash firmware. Factory users can log in to access crypto provisioning features.

Uses OIDC with PKCE against Keycloak (`sso.koiosdigital.net/realms/kd-prod`).

## Technologies

- Vue 3 + Vite 6 + TypeScript
- Pinia for state management
- Nuxt UI 4 + Tailwind CSS 4
- esp-web-tools for firmware flashing
- esptool-js for serial console
- oidc-client-ts for authentication
- @xterm/xterm for terminal display
